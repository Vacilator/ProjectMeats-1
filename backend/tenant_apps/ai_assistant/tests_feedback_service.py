"""Tests for RT-02.3: AI Feedback Service — training queue + telemetry + corrections.

Tests:
- suggest_corrections (rule-based correction hints)
- emit_feedback_telemetry (TradeEventLog creation)
- queue_single_feedback (idempotent queue marking)
- process_feedback_with_deps (dependency auto-creation from corrections)
- queue_feedback_for_training Celery task
"""

from __future__ import annotations

import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.core.models import TradeEventLog
from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.ai_assistant.services.feedback_service import (
    EVENT_CORRECTION_APPLIED,
    EVENT_DEPENDENCY_AUTOCREATE,
    EVENT_FEEDBACK_SUBMITTED,
    emit_feedback_telemetry,
    process_feedback_with_deps,
    queue_single_feedback,
    suggest_corrections,
)

User = get_user_model()


class SuggestCorrectionsTest(TestCase):
    """Unit tests for suggest_corrections()."""

    def test_empty_data_returns_empty(self):
        result = suggest_corrections(original_data={}, confidence_score=0.9)
        self.assertEqual(result, {})

    def test_missing_po_with_subject(self):
        result = suggest_corrections(
            original_data={"subject": "RE: PO 226052", "po_numbers": []},
            confidence_score=0.5,
        )
        self.assertIn("po_numbers", result)
        self.assertEqual(result["po_numbers"]["source_field"], "subject")

    def test_quantity_without_uom(self):
        result = suggest_corrections(
            original_data={
                "line_items": [
                    {"quantity": "40000", "unit_of_measure": ""},
                ]
            },
            confidence_score=0.6,
        )
        self.assertIn("line_items[0].unit_of_measure", result)
        self.assertIn("LBS", result["line_items[0].unit_of_measure"]["common_values"])

    def test_low_confidence_meta(self):
        result = suggest_corrections(
            original_data={"po_numbers": ["226052"]},
            confidence_score=0.2,
        )
        self.assertIn("_meta", result)
        self.assertEqual(result["_meta"]["recommendation"], "Low confidence extraction — manual review recommended")

    def test_sender_company_from_email(self):
        result = suggest_corrections(
            original_data={
                "sender_email": "rowena@txfoods.com",
                "sender_company": "",
            },
            confidence_score=0.7,
        )
        self.assertIn("sender_company", result)
        self.assertEqual(result["sender_company"]["suggested_value"], "Txfoods")

    def test_no_suggestions_when_data_complete(self):
        result = suggest_corrections(
            original_data={
                "po_numbers": ["226052"],
                "sender_company": "TX Foods",
                "sender_email": "rowena@txfoods.com",
                "line_items": [{"quantity": "40000", "unit_of_measure": "LBS"}],
            },
            confidence_score=0.9,
        )
        self.assertEqual(result, {})


class EmitFeedbackTelemetryTest(TestCase):
    """Tests for emit_feedback_telemetry()."""

    def setUp(self):
        from apps.tenants.models import Tenant

        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-telemetry-tenant",
        )

    def test_creates_trade_event_log(self):
        emit_feedback_telemetry(
            tenant=self.tenant,
            event_type=EVENT_FEEDBACK_SUBMITTED,
            feedback_id="abc-123",
            actor_user_id="user-456",
            payload={"signal": "thumbs_up"},
        )
        event = TradeEventLog.objects.filter(
            tenant=self.tenant,
            event_type=EVENT_FEEDBACK_SUBMITTED,
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.entity_type, "AIFeedbackLog")
        self.assertEqual(event.entity_id, "abc-123")
        self.assertEqual(event.actor_user_id, "user-456")
        self.assertEqual(event.payload["signal"], "thumbs_up")

    def test_multiple_event_types(self):
        for evt_type in [EVENT_FEEDBACK_SUBMITTED, EVENT_CORRECTION_APPLIED, EVENT_DEPENDENCY_AUTOCREATE]:
            emit_feedback_telemetry(
                tenant=self.tenant,
                event_type=evt_type,
                feedback_id="row-1",
            )
        count = TradeEventLog.objects.filter(tenant=self.tenant).count()
        self.assertEqual(count, 3)


class QueueSingleFeedbackTest(TestCase):
    """Tests for queue_single_feedback()."""

    def setUp(self):
        from apps.tenants.models import Tenant

        self.tenant = Tenant.objects.create(
            name="Queue Test Tenant",
            slug="queue-test-tenant",
        )
        self.row = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            original_extracted_data={"po_numbers": ["226052"]},
            confidence_score=0.8,
            retraining_status=AIFeedbackLog.RetrainingStatus.NOT_QUEUED,
        )

    def test_queues_successfully(self):
        result = queue_single_feedback(str(self.row.pk))
        self.assertEqual(result["status"], "queued")
        self.row.refresh_from_db()
        self.assertEqual(self.row.retraining_status, AIFeedbackLog.RetrainingStatus.QUEUED)
        self.assertIsNotNone(self.row.retraining_queued_at)

    def test_idempotent_when_already_queued(self):
        self.row.retraining_status = AIFeedbackLog.RetrainingStatus.QUEUED
        self.row.save()
        result = queue_single_feedback(str(self.row.pk))
        self.assertEqual(result["status"], "already_queued")

    def test_not_found(self):
        result = queue_single_feedback("999999")
        self.assertEqual(result["status"], "not_found")


class ProcessFeedbackWithDepsTest(TestCase):
    """Tests for process_feedback_with_deps()."""

    def setUp(self):
        from apps.tenants.models import Tenant

        self.tenant = Tenant.objects.create(
            name="Deps Test Tenant",
            slug="deps-test-tenant",
        )
        self.user = User.objects.create_user(
            username="test_feedback_user",
            email="test@example.com",
            password="testpass123",
        )

    def test_no_corrected_data_returns_empty(self):
        row = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            user_corrected_data={},
        )
        result = process_feedback_with_deps(tenant=self.tenant, feedback_row=row, user=self.user)
        self.assertEqual(result["created"], [])
        self.assertEqual(result["existing"], [])

    def test_creates_supplier_from_correction(self):
        row = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            user_corrected_data={
                "sender_company": "Rowena Meats",
                "sender_email": "rowena@rowenameats.com",
            },
        )
        result = process_feedback_with_deps(tenant=self.tenant, feedback_row=row, user=self.user)
        self.assertIn("Supplier:Rowena Meats", result["created"])

    def test_emits_dependency_telemetry(self):
        row = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            user_corrected_data={
                "sender_company": "New Corp",
                "sender_email": "info@newcorp.com",
            },
        )
        process_feedback_with_deps(tenant=self.tenant, feedback_row=row, user=self.user)
        event = TradeEventLog.objects.filter(
            tenant=self.tenant,
            event_type=EVENT_DEPENDENCY_AUTOCREATE,
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.payload["source"], "feedback_correction")


class QueueFeedbackForTrainingTaskTest(TestCase):
    """Tests for the Celery task wrapper."""

    def setUp(self):
        from apps.tenants.models import Tenant

        self.tenant = Tenant.objects.create(
            name="Task Test Tenant",
            slug="task-test-tenant",
        )
        self.row = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            confidence_score=0.7,
            retraining_status=AIFeedbackLog.RetrainingStatus.NOT_QUEUED,
        )

    def test_task_queues_feedback(self):
        from tenant_apps.ai_assistant.tasks import queue_feedback_for_training

        # Call synchronously (not via .delay())
        result = queue_feedback_for_training(str(self.row.pk))
        self.assertEqual(result["status"], "queued")
        self.row.refresh_from_db()
        self.assertEqual(self.row.retraining_status, AIFeedbackLog.RetrainingStatus.QUEUED)

    def test_task_handles_missing_id(self):
        from tenant_apps.ai_assistant.tasks import queue_feedback_for_training

        result = queue_feedback_for_training("999999")
        self.assertEqual(result["status"], "not_found")
