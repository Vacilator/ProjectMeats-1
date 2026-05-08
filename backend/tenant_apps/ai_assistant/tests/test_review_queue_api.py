import unittest
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

if "tenant_apps.ai_assistant" not in settings.INSTALLED_APPS:
    raise unittest.SkipTest("tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings")

from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.ai_assistant.views import (
    AIFeedbackViewSet,
    ContextualSuggestionsAPIView,
    PendingReviewResolveAPIView,
    PendingReviewView,
)
from tenant_apps.plants.models import Plant

from apps.tenants.models import Tenant, TenantUser


class PendingReviewViewTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username=f"ai-review-{unique}",
            email=f"ai-review-{unique}@example.com",
            password="pw",
            is_staff=True,
        )
        self.manager_user = User.objects.create_user(
            username=f"ai-review-manager-{unique}",
            email=f"ai-review-manager-{unique}@example.com",
            password="pw",
        )
        self.tenant = Tenant.objects.create(
            name=f"AI Review Tenant {unique}",
            slug=f"ai-review-tenant-{unique}",
            contact_email=f"ops-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.manager_user, role="manager", is_active=True)

    def test_pending_review_payload_includes_operational_hub_metadata(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="bill_of_lading",
            confidence_score=0.42,
            original_extracted_data={
                "from_email": "dispatch@example.com",
                "subject": "BOL 9917 ready for review",
                "bol_number": "9917",
                "notes": "Carrier confirmed pickup window.",
                "items": [
                    {
                        "description": "Beef trim combo",
                        "quantity": 12,
                        "total_net_weight": 18000,
                        "weight_unit": "LBS",
                    }
                ],
            },
        )

        request = self.factory.get("/api/v1/ai-assistant/review/pending/")
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = PendingReviewView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data["results"][0]
        self.assertEqual(str(payload["id"]), str(feedback.id))
        self.assertEqual(payload["sender"], "dispatch@example.com")
        self.assertEqual(payload["intent_label"], "Bill Of Lading")
        self.assertEqual(payload["review_entity_type"], "carrier-pos")
        self.assertEqual(payload["review_target_url"], f"/my-tasks?tab=ai-review&draft={feedback.id}")

    def test_pending_review_uses_explicit_review_target_url_from_payload(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="inquiry",
            confidence_score=1.0,
            original_extracted_data={
                "inquiry_id": 17,
                "review_target_url": "/inquiries?review=inquiry&inquiry=17",
                "route_decision": "BROKER",
            },
        )

        request = self.factory.get("/api/v1/ai-assistant/review/pending/")
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = PendingReviewView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        payload = next(item for item in response.data["results"] if str(item["id"]) == str(feedback.id))
        self.assertEqual(payload["review_entity_type"], "inquiry")
        self.assertEqual(payload["review_target_url"], "/inquiries?review=inquiry&inquiry=17")

    def test_pending_review_purchase_order_payload_uses_purchase_order_intent(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            confidence_score=0.95,
            original_extracted_data={
                "order_number": "226001",
                "supplier_name": "Quoted Supplier",
                "review_target_url": "/purchase-orders/44/review",
                "status": "draft",
            },
        )

        request = self.factory.get("/api/v1/ai-assistant/review/pending/")
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = PendingReviewView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        payload = next(item for item in response.data["results"] if str(item["id"]) == str(feedback.id))
        self.assertEqual(payload["intent_label"], "Purchase Order")
        self.assertEqual(payload["review_entity_type"], "purchase_order")
        self.assertEqual(payload["review_target_url"], "/purchase-orders/44/review")

    def test_pending_review_deep_link_includes_highlighted_manager_draft(self):
        highlighted = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="bill_of_lading",
            confidence_score=0.51,
            original_extracted_data={
                "from_email": "dispatch@example.com",
                "subject": "Potential BOL received",
            },
        )
        for index in range(26):
            AIFeedbackLog.objects.create(
                tenant=self.tenant,
                document_id=uuid.uuid4(),
                document_type="purchase_order",
                confidence_score=0.9,
                original_extracted_data={"order_number": f"PO-{index}"},
            )

        request = self.factory.get(f"/api/v1/ai-assistant/review/pending/?draft={highlighted.id}")
        force_authenticate(request, user=self.manager_user)
        request.tenant = self.tenant

        response = PendingReviewView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        ids = [str(item["id"]) for item in response.data["results"]]
        self.assertIn(str(highlighted.id), ids)

    def test_manager_can_resolve_pending_review_item(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            confidence_score=0.84,
            original_extracted_data={"order_number": "PO-2001"},
        )

        request = self.factory.post(
            f"/api/v1/ai-assistant/review/{feedback.id}/resolve/",
            {"user_corrected_data": {"order_number": "PO-2001"}},
            format="json",
        )
        force_authenticate(request, user=self.manager_user)
        request.tenant = self.tenant

        response = PendingReviewResolveAPIView.as_view()(request, feedback_id=str(feedback.id))

        self.assertEqual(response.status_code, 200)
        feedback.refresh_from_db()
        self.assertEqual(feedback.resolved_by_id, self.manager_user.id)

    def test_feedback_submission_requires_comment_for_thumbs_down(self):
        create_view = AIFeedbackViewSet.as_view({"post": "create"})
        document_id = uuid.uuid4()

        request = self.factory.post(
            "/api/v1/ai-assistant/feedback/",
            {
                "document_id": str(document_id),
                "document_type": "inquiry",
                "feedback_signal": AIFeedbackLog.FeedbackSignal.THUMBS_DOWN,
            },
            format="json",
        )
        force_authenticate(request, user=self.manager_user)
        request.tenant = self.tenant

        response = create_view(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn("feedback_comment", response.data)

    def test_feedback_submission_queues_retraining_without_resolving_draft(self):
        document_id = uuid.uuid4()
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=document_id,
            document_type="inquiry",
            confidence_score=0.49,
            original_extracted_data={"customer_name": "North Meats"},
        )
        create_view = AIFeedbackViewSet.as_view({"post": "create"})

        request = self.factory.post(
            "/api/v1/ai-assistant/feedback/",
            {
                "document_id": str(document_id),
                "document_type": "inquiry",
                "feedback_signal": AIFeedbackLog.FeedbackSignal.THUMBS_UP,
                "feedback_source": "ai_inbox",
                "original_extracted_data": {"customer_name": "North Meats"},
            },
            format="json",
        )
        force_authenticate(request, user=self.manager_user)
        request.tenant = self.tenant

        response = create_view(request)

        self.assertEqual(response.status_code, 200)
        feedback.refresh_from_db()
        self.assertEqual(feedback.feedback_signal, AIFeedbackLog.FeedbackSignal.THUMBS_UP)
        self.assertEqual(feedback.feedback_source, "ai_inbox")
        self.assertEqual(feedback.submitted_by_id, self.manager_user.id)
        self.assertEqual(feedback.retraining_status, AIFeedbackLog.RetrainingStatus.QUEUED)
        self.assertIsNotNone(feedback.retraining_queued_at)
        self.assertIsNone(feedback.resolved_by_id)

        request = self.factory.get("/api/v1/ai-assistant/review/pending/")
        force_authenticate(request, user=self.manager_user)
        request.tenant = self.tenant

        pending_response = PendingReviewView.as_view()(request)
        payload = next(item for item in pending_response.data["results"] if str(item["id"]) == str(feedback.id))
        self.assertEqual(payload["feedback_signal"], AIFeedbackLog.FeedbackSignal.THUMBS_UP)
        self.assertEqual(payload["retraining_status"], AIFeedbackLog.RetrainingStatus.QUEUED)

    def test_manager_resolve_queues_retraining_for_corrected_data(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            confidence_score=0.61,
            original_extracted_data={"order_number": "PO-3001"},
        )

        request = self.factory.post(
            f"/api/v1/ai-assistant/review/{feedback.id}/resolve/",
            {"user_corrected_data": {"order_number": "PO-3001", "supplier_name": "Acme Meats"}},
            format="json",
        )
        force_authenticate(request, user=self.manager_user)
        request.tenant = self.tenant

        response = PendingReviewResolveAPIView.as_view()(request, feedback_id=str(feedback.id))

        self.assertEqual(response.status_code, 200)
        feedback.refresh_from_db()
        self.assertEqual(feedback.resolved_by_id, self.manager_user.id)
        self.assertEqual(feedback.submitted_by_id, self.manager_user.id)
        self.assertEqual(feedback.feedback_source, "ai_inbox")
        self.assertEqual(feedback.retraining_status, AIFeedbackLog.RetrainingStatus.QUEUED)
        self.assertIsNotNone(feedback.retraining_queued_at)

    def test_contextual_suggestions_returns_plant_continuity_actions(self):
        plant = Plant.objects.create(
            tenant=self.tenant,
            name="Continuity Plant",
            plant_type="processing",
            city="Chicago",
            state="IL",
            country="USA",
        )

        request = self.factory.post(
            "/api/v1/ai-assistant/suggestions/contextual/",
            {
                "entity_type": "plant",
                "entity_id": str(plant.id),
                "current_state": {},
            },
            format="json",
        )
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = ContextualSuggestionsAPIView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["suggestions"][0]["action"], "update_booking_contact")
