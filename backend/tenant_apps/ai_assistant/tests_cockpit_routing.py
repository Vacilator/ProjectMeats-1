"""Tests for RT-02.4: Cockpit routing service + CockpitDraftForm model.

Tests:
- infer_form_type (PO, bid, inquiry, unknown)
- build_form_data (field mapping)
- create_draft_from_feedback (end-to-end routing)
- update_draft_status (lifecycle transitions)
- CockpitDraftForm model (creation, RLS table)
"""

from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from tenant_apps.ai_assistant.models import AIFeedbackLog, CockpitDraftForm, CockpitDraftStatus
from tenant_apps.ai_assistant.services.cockpit_routing import (
    FORM_TYPE_BID,
    FORM_TYPE_INQUIRY,
    FORM_TYPE_PURCHASE_ORDER,
    FORM_TYPE_UNKNOWN,
    build_form_data,
    create_draft_from_feedback,
    infer_form_type,
    update_draft_status,
)

User = get_user_model()


class InferFormTypeTest(TestCase):
    """Unit tests for infer_form_type()."""

    def test_po_numbers_means_purchase_order(self):
        result = infer_form_type({"po_numbers": ["226052"]})
        self.assertEqual(result, FORM_TYPE_PURCHASE_ORDER)

    def test_line_items_with_price_means_bid(self):
        result = infer_form_type({
            "line_items": [{"quantity": "40000", "unit_price": "5.50"}]
        })
        self.assertEqual(result, FORM_TYPE_BID)

    def test_line_items_without_price_means_inquiry(self):
        result = infer_form_type({
            "line_items": [{"quantity": "40000", "unit_of_measure": "LBS"}]
        })
        self.assertEqual(result, FORM_TYPE_INQUIRY)

    def test_empty_means_unknown(self):
        result = infer_form_type({})
        self.assertEqual(result, FORM_TYPE_UNKNOWN)

    def test_po_takes_priority_over_line_items(self):
        result = infer_form_type({
            "po_numbers": ["123"],
            "line_items": [{"quantity": "100", "unit_price": "10"}],
        })
        self.assertEqual(result, FORM_TYPE_PURCHASE_ORDER)


class BuildFormDataTest(TestCase):
    """Unit tests for build_form_data()."""

    def test_po_form_data(self):
        parsed = {
            "po_numbers": ["226052"],
            "sender_company": "TX Foods",
            "sender_email": "rowena@txfoods.com",
            "line_items": [{"quantity": "40000", "unit_of_measure": "LBS", "product_description": "Ground Beef"}],
            "delivery_date": "2026-01-15",
        }
        result = build_form_data(parsed, FORM_TYPE_PURCHASE_ORDER)
        self.assertEqual(result["po_number"], "226052")
        self.assertEqual(result["supplier_name"], "TX Foods")
        self.assertEqual(result["contact_email"], "rowena@txfoods.com")
        self.assertEqual(result["delivery_date"], "2026-01-15")
        self.assertEqual(len(result["line_items"]), 1)
        self.assertEqual(result["line_items"][0]["quantity"], "40000")

    def test_empty_parsed_data(self):
        result = build_form_data({}, FORM_TYPE_UNKNOWN)
        self.assertEqual(result, {})


class CreateDraftFromFeedbackTest(TestCase):
    """Integration tests for create_draft_from_feedback()."""

    def setUp(self):
        from apps.tenants.models import Tenant

        self.tenant = Tenant.objects.create(name="Draft Test Tenant", slug="draft-test-tenant")
        self.user = User.objects.create_user(
            username="draft_user", email="draft@test.com", password="testpass"
        )
        self.feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            original_extracted_data={
                "po_numbers": ["226052"],
                "sender_company": "TX Foods",
                "sender_email": "rowena@txfoods.com",
                "line_items": [{"quantity": "40000", "unit_of_measure": "LBS"}],
            },
            confidence_score=0.7,
        )

    def test_creates_draft_successfully(self):
        draft = create_draft_from_feedback(
            tenant=self.tenant, feedback_row=self.feedback, user=self.user
        )
        self.assertIsNotNone(draft.pk)
        self.assertEqual(draft.form_type, FORM_TYPE_PURCHASE_ORDER)
        self.assertEqual(draft.status, CockpitDraftStatus.PENDING)
        self.assertEqual(draft.source_feedback_id, self.feedback.pk)
        self.assertEqual(draft.assigned_to, self.user)
        self.assertEqual(draft.form_data["po_number"], "226052")
        self.assertEqual(draft.form_data["supplier_name"], "TX Foods")

    def test_parsed_payload_stored(self):
        draft = create_draft_from_feedback(
            tenant=self.tenant, feedback_row=self.feedback, user=self.user
        )
        self.assertIn("po_numbers", draft.parsed_payload)
        self.assertEqual(draft.parsed_payload["po_numbers"], ["226052"])


class UpdateDraftStatusTest(TestCase):
    """Tests for update_draft_status()."""

    def setUp(self):
        from apps.tenants.models import Tenant

        self.tenant = Tenant.objects.create(name="Status Test Tenant", slug="status-test-tenant")
        self.user = User.objects.create_user(
            username="status_user", email="status@test.com", password="testpass"
        )
        self.draft = CockpitDraftForm.objects.create(
            tenant=self.tenant,
            form_type=FORM_TYPE_PURCHASE_ORDER,
            form_data={"po_number": "226052"},
            status=CockpitDraftStatus.PENDING,
        )

    def test_pending_to_in_progress(self):
        result = update_draft_status(draft=self.draft, new_status="in_progress", user=self.user)
        self.assertEqual(result.status, CockpitDraftStatus.IN_PROGRESS)

    def test_in_progress_to_submitted(self):
        self.draft.status = CockpitDraftStatus.IN_PROGRESS
        self.draft.save()
        result = update_draft_status(
            draft=self.draft,
            new_status="submitted",
            user=self.user,
            submitted_entity_type="PurchaseOrder",
            submitted_entity_id="42",
        )
        self.assertEqual(result.status, CockpitDraftStatus.SUBMITTED)
        self.assertIsNotNone(result.submitted_at)
        self.assertEqual(result.submitted_by, self.user)
        self.assertEqual(result.submitted_entity_type, "PurchaseOrder")

    def test_cannot_transition_from_terminal(self):
        self.draft.status = CockpitDraftStatus.SUBMITTED
        self.draft.save()
        with self.assertRaises(ValueError):
            update_draft_status(draft=self.draft, new_status="in_progress")

    def test_pending_to_discarded(self):
        result = update_draft_status(draft=self.draft, new_status="discarded")
        self.assertEqual(result.status, CockpitDraftStatus.DISCARDED)


class CockpitDraftFormModelTest(TestCase):
    """Basic model tests."""

    def setUp(self):
        from apps.tenants.models import Tenant

        self.tenant = Tenant.objects.create(name="Model Test", slug="model-test-tenant")

    def test_create_and_query(self):
        draft = CockpitDraftForm.objects.create(
            tenant=self.tenant,
            form_type="inquiry",
            form_data={"line_items": [{"quantity": "100", "uom": "LBS"}]},
        )
        self.assertEqual(CockpitDraftForm.objects.filter(tenant=self.tenant).count(), 1)
        self.assertEqual(str(draft), "Draft(inquiry) [pending]")

    def test_db_table_name(self):
        self.assertEqual(CockpitDraftForm._meta.db_table, "ai_assistant_cockpit_drafts")
