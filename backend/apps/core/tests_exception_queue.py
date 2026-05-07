"""Tests for CTE-08.1: Exception queue / dead-letter model."""

import uuid
from unittest.mock import patch

from django.test import TestCase

from apps.core.models import TradeExceptionQueue
from apps.core.services.exception_queue import (
    enqueue_trade_exception,
    get_open_exceptions,
    resolve_exception,
    retry_exception,
)


class _TenantMixin:
    """Create a tenant for test isolation."""

    @classmethod
    def setUpTestData(cls):
        from apps.tenants.models import Tenant

        cls.tenant = Tenant.objects.create(
            name="Test Tenant EQ",
            slug="test-eq",
            schema_name="public",
        )


class TradeExceptionQueueModelTest(_TenantMixin, TestCase):
    """Basic model CRUD."""

    def test_create_exception(self):
        exc = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=1,
            trade_id="TRD-2026-00001",
            failed_step="bid_selection.margin_calc",
            reason_code="CALC_ERROR",
            error_message="Division by zero in margin calc",
            status="open",
        )
        self.assertEqual(exc.status, "open")
        self.assertEqual(exc.retry_count, 0)
        self.assertIsNotNone(exc.created_on)

    def test_str_representation(self):
        exc = TradeExceptionQueue(
            status="open",
            failed_step="pdf.generation",
            error_message="Template not found",
        )
        self.assertIn("pdf.generation", str(exc))
        self.assertIn("[open]", str(exc))


class EnqueueExceptionTest(_TenantMixin, TestCase):
    """Test enqueue_trade_exception service."""

    def test_enqueue_creates_record(self):
        exc = enqueue_trade_exception(
            tenant=self.tenant,
            trade_session_id=42,
            trade_id="TRD-2026-00042",
            failed_step="rfq.send_email",
            reason_code="SMTP_FAILURE",
            error_message="Connection timed out",
            entity_type="Inquiry",
            entity_id="abc-123",
            source_event_id=str(uuid.uuid4()),
            context_payload={"attempt": 1, "recipient": "test@example.com"},
        )
        self.assertEqual(exc.status, "open")
        self.assertEqual(exc.failed_step, "rfq.send_email")
        self.assertEqual(exc.context_payload["recipient"], "test@example.com")
        self.assertEqual(TradeExceptionQueue.objects.count(), 1)

    def test_enqueue_halts_trade_session(self):
        """Enqueue should set the linked trade session to 'halted'."""
        from tenant_apps.inquiries.models import Inquiry, TradeSession, TradeSessionStatus

        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            inquiry_number="INQ-2026-00099",
        )
        session = TradeSession.objects.create(
            tenant=self.tenant,
            trade_id="TRD-2026-00099",
            status=TradeSessionStatus.SOURCING,
            inquiry=inquiry,
        )
        enqueue_trade_exception(
            tenant=self.tenant,
            trade_session_id=session.pk,
            trade_id=session.trade_id,
            failed_step="bid_selection.evaluate",
            reason_code="BID_TIMEOUT",
            error_message="Supplier did not respond",
        )
        session.refresh_from_db()
        self.assertEqual(session.status, TradeSessionStatus.HALTED)


class ResolveExceptionTest(_TenantMixin, TestCase):
    """Test resolve_exception service."""

    def test_resolve_sets_status_and_notes(self):
        exc = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            failed_step="so.generate_pdf",
            reason_code="TEMPLATE_ERROR",
            error_message="Missing template",
            status="open",
        )
        result = resolve_exception(
            exception_id=exc.pk,
            tenant=self.tenant,
            resolved_by="user-001",
            resolution_notes="Fixed template path",
        )
        self.assertEqual(result.status, "resolved")
        self.assertEqual(result.resolved_by, "user-001")
        self.assertIsNotNone(result.resolved_at)
        self.assertEqual(result.resolution_notes, "Fixed template path")

    def test_resolve_resumes_halted_session(self):
        """Resolving should resume a halted session."""
        from tenant_apps.inquiries.models import Inquiry, TradeSession, TradeSessionStatus

        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            inquiry_number="INQ-2026-00100",
        )
        session = TradeSession.objects.create(
            tenant=self.tenant,
            trade_id="TRD-2026-00100",
            status=TradeSessionStatus.HALTED,
            inquiry=inquiry,
        )
        exc = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=session.pk,
            failed_step="po.approval",
            reason_code="APPROVAL_TIMEOUT",
            error_message="Approval timeout",
            status="open",
        )
        resolve_exception(
            exception_id=exc.pk,
            tenant=self.tenant,
            resolved_by="operator-1",
            resolution_notes="Manually approved",
        )
        session.refresh_from_db()
        # Should be back to a non-halted state (sourcing is default resume)
        self.assertNotEqual(session.status, TradeSessionStatus.HALTED)


class RetryExceptionTest(_TenantMixin, TestCase):
    """Test retry_exception service."""

    def test_retry_increments_count(self):
        exc = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            failed_step="email.parse",
            reason_code="PARSE_ERROR",
            error_message="Could not extract PO number",
            status="open",
            retry_count=0,
        )
        result = retry_exception(exception_id=exc.pk, tenant=self.tenant)
        self.assertEqual(result.retry_count, 1)
        self.assertEqual(result.status, "retrying")
        self.assertIsNotNone(result.last_retry_at)

    def test_retry_exhausted_after_max(self):
        """After max retries (3), status goes to exhausted."""
        exc = TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            failed_step="email.parse",
            reason_code="PARSE_ERROR",
            error_message="Persistent failure",
            status="retrying",
            retry_count=2,
        )
        result = retry_exception(exception_id=exc.pk, tenant=self.tenant, max_retries=3)
        self.assertEqual(result.status, "exhausted")
        self.assertEqual(result.retry_count, 3)


class GetOpenExceptionsTest(_TenantMixin, TestCase):
    """Test get_open_exceptions service."""

    def test_returns_only_open_and_retrying(self):
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            failed_step="step_a",
            reason_code="ERR_A",
            error_message="Error A",
            status="open",
        )
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            failed_step="step_b",
            reason_code="ERR_B",
            error_message="Error B",
            status="retrying",
        )
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            failed_step="step_c",
            reason_code="ERR_C",
            error_message="Error C",
            status="resolved",
        )
        results = get_open_exceptions(tenant=self.tenant)
        self.assertEqual(results.count(), 2)

    def test_filter_by_trade_session(self):
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=100,
            failed_step="step_x",
            reason_code="ERR_X",
            error_message="Error X",
            status="open",
        )
        TradeExceptionQueue.objects.create(
            tenant=self.tenant,
            trade_session_id=200,
            failed_step="step_y",
            reason_code="ERR_Y",
            error_message="Error Y",
            status="open",
        )
        results = get_open_exceptions(tenant=self.tenant, trade_session_id=100)
        self.assertEqual(results.count(), 1)
        self.assertEqual(results.first().failed_step, "step_x")
