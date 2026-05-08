from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser
from projectmeats.asgi import application


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}},
    ALLOWED_HOSTS=["*"],
)
class CollaborationWebsocketSecurityTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        User = get_user_model()

        self.user = User.objects.create_user(username=f"u-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="WF",
            description="",
            status="draft",
            workflow_definition={"nodes": [], "edges": []},
            created_by=self.user,
            updated_by=self.user,
        )

    def _communicator(self, *, access_token: str | None, tenant_id: str | None, workflow_id: str):
        params = []
        if tenant_id is not None:
            params.append(f"tenant_id={tenant_id}")
        if access_token is not None:
            params.append(f"access_token={access_token}")
        qs = ("?" + "&".join(params)) if params else ""

        path = f"/ws/workflows/{workflow_id}/collab/{qs}"
        return WebsocketCommunicator(
            application,
            path,
            headers=[(b"host", b"testserver"), (b"origin", b"http://testserver")],
        )

    def test_rejects_anonymous(self):
        async def run():
            comm = self._communicator(
                access_token=None, tenant_id=str(self.tenant.id), workflow_id=str(self.workform.id)
            )
            connected, _ = await comm.connect(timeout=1)
            self.assertFalse(connected)
            await comm.disconnect()

        async_to_sync(run)()

    def test_rejects_authenticated_missing_tenant(self):
        async def run():
            token = str(AccessToken.for_user(self.user))
            comm = self._communicator(access_token=token, tenant_id=None, workflow_id=str(self.workform.id))
            connected, _ = await comm.connect(timeout=1)
            self.assertFalse(connected)
            await comm.disconnect()

        async_to_sync(run)()

    def test_rejects_authenticated_non_member_tenant(self):
        other = Tenant.objects.create(
            name="Other",
            slug=f"other-{uuid.uuid4().hex[:6]}",
            contact_email="other@example.com",
            is_active=True,
        )

        async def run():
            token = str(AccessToken.for_user(self.user))
            comm = self._communicator(access_token=token, tenant_id=str(other.id), workflow_id=str(self.workform.id))
            connected, _ = await comm.connect(timeout=1)
            self.assertFalse(connected)
            await comm.disconnect()

        async_to_sync(run)()

    def test_rejects_workflow_not_in_tenant(self):
        other = Tenant.objects.create(
            name="Other",
            slug=f"other-{uuid.uuid4().hex[:6]}",
            contact_email="other@example.com",
            is_active=True,
        )
        TenantUser.objects.create(tenant=other, user=self.user, role="admin", is_active=True)

        other_workform = TenantWorkForm.objects.create(
            tenant=other,
            name="Other WF",
            description="",
            status="draft",
            workflow_definition={"nodes": [], "edges": []},
            created_by=self.user,
            updated_by=self.user,
        )

        async def run():
            token = str(AccessToken.for_user(self.user))
            comm = self._communicator(
                access_token=token, tenant_id=str(self.tenant.id), workflow_id=str(other_workform.id)
            )
            connected, _ = await comm.connect(timeout=1)
            self.assertFalse(connected)
            await comm.disconnect()

        async_to_sync(run)()

    def test_allows_valid_member_and_workflow(self):
        async def run():
            token = str(AccessToken.for_user(self.user))
            comm = self._communicator(
                access_token=token, tenant_id=str(self.tenant.id), workflow_id=str(self.workform.id)
            )
            connected, _ = await comm.connect(timeout=1)
            self.assertTrue(connected)

            joined = await comm.receive_json_from(timeout=1)
            self.assertEqual(joined.get("type"), "presence.joined")
            self.assertEqual(joined.get("tenant_id"), str(self.tenant.id))
            self.assertEqual(joined.get("workflow_id"), str(self.workform.id))

            await comm.disconnect()

        async_to_sync(run)()

    def test_broadcasts_only_within_same_tenant_and_workflow_group(self):
        other_tenant = Tenant.objects.create(
            name="Other",
            slug=f"other-{uuid.uuid4().hex[:6]}",
            contact_email="other@example.com",
            is_active=True,
        )
        TenantUser.objects.create(tenant=other_tenant, user=self.user, role="admin", is_active=True)
        other_workform = TenantWorkForm.objects.create(
            tenant=other_tenant,
            name="Other WF",
            description="",
            status="draft",
            workflow_definition={"nodes": [], "edges": []},
            created_by=self.user,
            updated_by=self.user,
        )

        async def run():
            token = str(AccessToken.for_user(self.user))
            primary_sender = self._communicator(
                access_token=token,
                tenant_id=str(self.tenant.id),
                workflow_id=str(self.workform.id),
            )
            primary_listener = self._communicator(
                access_token=token,
                tenant_id=str(self.tenant.id),
                workflow_id=str(self.workform.id),
            )
            isolated_listener = self._communicator(
                access_token=token,
                tenant_id=str(other_tenant.id),
                workflow_id=str(other_workform.id),
            )

            connected_sender, _ = await primary_sender.connect(timeout=1)
            connected_listener, _ = await primary_listener.connect(timeout=1)
            connected_isolated, _ = await isolated_listener.connect(timeout=1)
            self.assertTrue(connected_sender)
            self.assertTrue(connected_listener)
            self.assertTrue(connected_isolated)

            await primary_sender.receive_json_from(timeout=1)
            await primary_listener.receive_json_from(timeout=1)
            await isolated_listener.receive_json_from(timeout=1)

            payload = {"type": "cursor.move", "node_id": "node-1"}
            await primary_sender.send_json_to(payload)

            sender_echo = await primary_sender.receive_json_from(timeout=1)
            listener_message = await primary_listener.receive_json_from(timeout=1)
            self.assertEqual(sender_echo.get("type"), "collab.message")
            self.assertEqual(listener_message.get("type"), "collab.message")
            self.assertEqual(listener_message.get("payload"), payload)
            self.assertTrue(await isolated_listener.receive_nothing(timeout=0.2))

            await primary_sender.disconnect()
            await primary_listener.disconnect()
            await isolated_listener.disconnect()

        async_to_sync(run)()
