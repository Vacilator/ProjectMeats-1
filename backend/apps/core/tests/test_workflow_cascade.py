"""Tests for workflow_cascade module.

Validates the cascade dispatch logic, guard clauses, and CascadeResult
contract without requiring a live database — uses mocks for model queries.
"""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.core.services.workflow_cascade import (
    CascadeResult,
    attempt_cascade,
)


class MockTenant:
    """Lightweight tenant stub."""

    def __init__(self, tenant_id="00000000-0000-0000-0000-000000000001"):
        self.id = tenant_id


class MockDocument:
    """Generic document stub with configurable model name."""

    def __init__(self, model_name: str = "UnknownModel", doc_id: int = 1, **kwargs):
        self.__class__ = type(model_name, (), {})
        self.__class__.__name__ = model_name
        self.id = doc_id
        for k, v in kwargs.items():
            setattr(self, k, v)


# ============================================================================
# CascadeResult dataclass
# ============================================================================


class CascadeResultTests(SimpleTestCase):
    """Verify CascadeResult defaults and field semantics."""

    def test_default_not_triggered(self):
        result = CascadeResult()
        self.assertFalse(result.triggered)
        self.assertEqual(result.created_entity_type, "")
        self.assertEqual(result.created_entity_id, "")
        self.assertEqual(result.error, "")

    def test_triggered_with_error(self):
        result = CascadeResult(triggered=True, error="boom")
        self.assertTrue(result.triggered)
        self.assertEqual(result.error, "boom")

    def test_triggered_with_created_entity(self):
        result = CascadeResult(
            triggered=True,
            created_entity_type="purchase_order",
            created_entity_id="42",
            created_entity_label="PO-00042",
        )
        self.assertTrue(result.triggered)
        self.assertEqual(result.created_entity_type, "purchase_order")
        self.assertEqual(result.created_entity_label, "PO-00042")

    def test_already_existed_flag(self):
        result = CascadeResult(triggered=True, already_existed=True)
        self.assertTrue(result.already_existed)


# ============================================================================
# attempt_cascade dispatch
# ============================================================================


class AttemptCascadeDispatchTests(SimpleTestCase):
    """Verify attempt_cascade routes to the correct handler or no-op."""

    def test_unregistered_model_returns_not_triggered(self):
        tenant = MockTenant()
        doc = MockDocument("SomeRandomModel")
        result = attempt_cascade(tenant=tenant, document=doc, new_status="approved")
        self.assertFalse(result.triggered)

    def test_registered_model_wrong_status_returns_not_triggered(self):
        tenant = MockTenant()
        doc = MockDocument("Inquiry")
        result = attempt_cascade(
            tenant=tenant, document=doc, new_status="rejected"
        )
        self.assertFalse(result.triggered)

    @patch(
        "apps.core.services.workflow_cascade._CASCADE_HANDLERS",
        {("TestModel", "done"): lambda tenant, document: CascadeResult(triggered=True, created_entity_type="widget")},
    )
    def test_registered_handler_is_called(self):
        tenant = MockTenant()
        doc = MockDocument("TestModel")
        result = attempt_cascade(tenant=tenant, document=doc, new_status="done")
        self.assertTrue(result.triggered)
        self.assertEqual(result.created_entity_type, "widget")

    @patch(
        "apps.core.services.workflow_cascade._CASCADE_HANDLERS",
        {("FailModel", "boom"): lambda tenant, document: (_ for _ in ()).throw(RuntimeError("kaboom"))},
    )
    def test_handler_exception_returns_error_result(self):
        tenant = MockTenant()
        doc = MockDocument("FailModel")
        result = attempt_cascade(tenant=tenant, document=doc, new_status="boom")
        self.assertTrue(result.triggered)
        self.assertIn("kaboom", result.error)

    def test_known_handler_keys_exist(self):
        """Verify all 5 expected cascade routes are registered."""
        from apps.core.services.workflow_cascade import _CASCADE_HANDLERS

        expected_keys = [
            ("Inquiry", "accepted"),
            ("PurchaseOrder", "approved"),
            ("SalesOrder", "confirmed"),
            ("CarrierPurchaseOrder", "delivered"),
            ("Fulfillment", "completed"),
        ]
        for key in expected_keys:
            self.assertIn(
                key,
                _CASCADE_HANDLERS,
                f"Missing cascade handler: {key}",
            )


# ============================================================================
# Inquiry → PO cascade guard
# ============================================================================


class InquiryToPOGuardTests(SimpleTestCase):
    """Test guard clauses in _cascade_inquiry_accepted_to_po."""

    @patch("apps.core.services.workflow_cascade._update_trade_session_status_from_doc")
    @patch("apps.core.services.workflow_cascade._create_trade_document")
    def test_no_customer_no_supplier_returns_error(self, mock_create_doc, mock_update_status):
        """Inquiry with no customer and no supplier should be blocked."""
        from apps.core.services.workflow_cascade import _cascade_inquiry_accepted_to_po

        tenant = MockTenant()
        inquiry = MagicMock()
        inquiry.__class__.__name__ = "Inquiry"
        inquiry.customer_id = None
        inquiry.supplier_id = None
        inquiry.id = 99

        result = _cascade_inquiry_accepted_to_po(tenant=tenant, document=inquiry)

        self.assertTrue(result.triggered)
        self.assertIn("no customer or supplier", result.error)
        mock_create_doc.assert_not_called()
