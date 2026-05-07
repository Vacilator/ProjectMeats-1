from __future__ import annotations

import uuid

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from apps.tenants.models import Tenant, TenantUser
from projectmeats.asgi import application
from tenant_apps.ai_assistant.models import AIFeedbackLog


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}},
    ALLOWED_HOSTS=["*"],
)
class AIInboxWebsocketTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        User = get_user_model()

        self.staff_user = User.objects.create_user(
            username=f"staff-{unique}",
            password="pw",
            is_staff=True,
        )
        self.member_user = User.objects.create_user(
            username=f"member-{unique}",
            password="pw",
        )
        self.manager_user = User.objects.create_user(
            username=f"manager-{unique}",
            password="pw",
        )
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.staff_user, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.member_user, role="member", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.manager_user, role="manager", is_active=True)

    def _communicator(self, *, user, tenant_id: str | None, use_subprotocol_token: bool = False):
        token = str(AccessToken.for_user(user))
        params = []
        subprotocols = None
        if use_subprotocol_token:
            subprotocols = ["pm.ai.inbox", "access_token", token]
        else:
            params.append(f"access_token={token}")
        if tenant_id is not None:
            params.append(f"tenant_id={tenant_id}")
        path = f"/ws/ai/inbox/?{'&'.join(params)}"
        return WebsocketCommunicator(
            application,
            path,
            subprotocols=subprotocols,
            headers=[(b"host", b"testserver"), (b"origin", b"http://testserver")],
        )

    def test_staff_user_receives_pending_review_snapshot(self):
        AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            original_extracted_data={"order_number": "PO-1"},
            confidence_score=0.5,
        )

        async def run():
            communicator = self._communicator(user=self.staff_user, tenant_id=str(self.tenant.id))
            connected, _ = await communicator.connect(timeout=1)
            self.assertTrue(connected)

            snapshot = await communicator.receive_json_from(timeout=1)
            self.assertEqual(snapshot.get("type"), "ai.inbox.snapshot")
            self.assertEqual(snapshot.get("pending_count"), 1)
            self.assertEqual(len(snapshot.get("results") or []), 1)

            await communicator.disconnect()

        async_to_sync(run)()

    def test_staff_user_receives_high_confidence_unresolved_snapshot(self):
        AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            original_extracted_data={"order_number": "PO-2"},
            confidence_score=0.97,
        )

        async def run():
            communicator = self._communicator(user=self.staff_user, tenant_id=str(self.tenant.id))
            connected, _ = await communicator.connect(timeout=1)
            self.assertTrue(connected)

            snapshot = await communicator.receive_json_from(timeout=1)
            self.assertEqual(snapshot.get("type"), "ai.inbox.snapshot")
            self.assertEqual(snapshot.get("pending_count"), 1)
            self.assertEqual(len(snapshot.get("results") or []), 1)

            await communicator.disconnect()

        async_to_sync(run)()

    def test_non_staff_user_receives_zeroed_snapshot(self):
        AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            original_extracted_data={"order_number": "PO-1"},
            confidence_score=0.5,
        )

        async def run():
            communicator = self._communicator(user=self.member_user, tenant_id=str(self.tenant.id))
            connected, _ = await communicator.connect(timeout=1)
            self.assertTrue(connected)

            snapshot = await communicator.receive_json_from(timeout=1)
            self.assertEqual(snapshot.get("type"), "ai.inbox.snapshot")
            self.assertEqual(snapshot.get("pending_count"), 0)
            self.assertEqual(snapshot.get("results"), [])

            await communicator.disconnect()

        async_to_sync(run)()

    def test_manager_user_receives_contextual_snapshot(self):
        AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="bill_of_lading",
            original_extracted_data={
                "from_email": "dispatch@example.com",
                "subject": "Potential BOL received",
            },
            confidence_score=0.5,
        )

        async def run():
            communicator = self._communicator(user=self.manager_user, tenant_id=str(self.tenant.id))
            connected, _ = await communicator.connect(timeout=1)
            self.assertTrue(connected)

            snapshot = await communicator.receive_json_from(timeout=1)
            self.assertEqual(snapshot.get("type"), "ai.inbox.snapshot")
            self.assertEqual(snapshot.get("pending_count"), 1)
            self.assertEqual(snapshot["results"][0]["sender"], "dispatch@example.com")
            self.assertEqual(snapshot["results"][0]["source_subject"], "Potential BOL received")

            await communicator.disconnect()

        async_to_sync(run)()

    def test_staff_user_can_authenticate_via_subprotocol_token(self):
        AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            original_extracted_data={"order_number": "PO-3"},
            confidence_score=0.75,
        )

        async def run():
            communicator = self._communicator(
                user=self.staff_user,
                tenant_id=str(self.tenant.id),
                use_subprotocol_token=True,
            )
            connected, _ = await communicator.connect(timeout=1)
            self.assertTrue(connected)

            snapshot = await communicator.receive_json_from(timeout=1)
            self.assertEqual(snapshot.get("type"), "ai.inbox.snapshot")
            self.assertEqual(snapshot.get("pending_count"), 1)

            await communicator.disconnect()

        async_to_sync(run)()
