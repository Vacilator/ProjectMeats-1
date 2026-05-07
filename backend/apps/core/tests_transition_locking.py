"""Tests for transition locking service (CTE-07.1).

Covers: transition_entity, guard clauses, concurrent modification detection,
valid transition enforcement, convenience wrappers, and event emission.
"""

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, TransactionTestCase
from django.db import connection

from apps.core.events.contracts import TradeEventType
from apps.core.services.transition_locking import (
    ConcurrentTransitionError,
    TransitionError,
    VALID_TRANSITIONS,
    approve_carrier_po,
    approve_purchase_order,
    approve_sales_order,
    is_valid_transition,
    transition_entity,
)
from apps.tenants.models import Tenant
from tenant_apps.purchase_orders.models import (
    CarrierPurchaseOrder,
    PurchaseOrder,
)
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.suppliers.models import Supplier
from tenant_apps.customers.models import Customer
from tenant_apps.carriers.models import Carrier


class TransitionEntityTests(TestCase):
    """Tests for the core transition_entity function."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Lock Test",
            slug="lock-test",
            schema_name="lock_test",
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name="Test Supplier",
        )
        self.customer = Customer.objects.create(
            tenant=self.tenant,
            name="Test Customer",
        )
        self.po = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            order_number="PO-001",
            order_date=date.today(),
            total_amount=Decimal("1000.00"),
            status="pending_approval",
        )

    def test_successful_transition(self):
        """Should transition status when guard clause passes."""
        result = transition_entity(
            model_class=PurchaseOrder,
            pk=self.po.pk,
            tenant_id=str(self.tenant.pk),
            from_status="pending_approval",
            to_status="approved",
            actor_user_id="user-1",
            emit_event=False,
        )
        self.assertEqual(result.status, "approved")
        # Verify persisted
        self.po.refresh_from_db()
        self.assertEqual(self.po.status, "approved")

    def test_guard_clause_rejects_wrong_status(self):
        """Should raise ConcurrentTransitionError if status doesn't match."""
        with self.assertRaises(ConcurrentTransitionError) as ctx:
            transition_entity(
                model_class=PurchaseOrder,
                pk=self.po.pk,
                tenant_id=str(self.tenant.pk),
                from_status="draft",  # Wrong! Current is pending_approval
                to_status="approved",
                emit_event=False,
            )
        self.assertIn("pending_approval", str(ctx.exception))
        self.assertIn("draft", str(ctx.exception))

    def test_invalid_transition_rejected(self):
        """Should raise TransitionError for disallowed state transitions."""
        with self.assertRaises(TransitionError) as ctx:
            transition_entity(
                model_class=PurchaseOrder,
                pk=self.po.pk,
                tenant_id=str(self.tenant.pk),
                from_status="pending_approval",
                to_status="delivered",  # Can't jump to delivered
                emit_event=False,
            )
        self.assertIn("not allowed", str(ctx.exception))

    def test_entity_not_found(self):
        """Should raise TransitionError if entity doesn't exist."""
        with self.assertRaises(TransitionError):
            transition_entity(
                model_class=PurchaseOrder,
                pk=99999,
                tenant_id=str(self.tenant.pk),
                from_status="draft",
                to_status="pending",
                emit_event=False,
            )

    def test_tenant_isolation(self):
        """Should not find entities from other tenants."""
        other_tenant = Tenant.objects.create(
            name="Other", slug="other-lock", schema_name="other_lock"
        )
        with self.assertRaises(TransitionError):
            transition_entity(
                model_class=PurchaseOrder,
                pk=self.po.pk,
                tenant_id=str(other_tenant.pk),  # Wrong tenant
                from_status="pending_approval",
                to_status="approved",
                emit_event=False,
            )

    def test_extra_updates_applied(self):
        """Should apply extra field updates atomically."""
        # First transition to approved
        transition_entity(
            model_class=PurchaseOrder,
            pk=self.po.pk,
            tenant_id=str(self.tenant.pk),
            from_status="pending_approval",
            to_status="approved",
            emit_event=False,
        )

        # Then transition to sent with extra updates
        result = transition_entity(
            model_class=PurchaseOrder,
            pk=self.po.pk,
            tenant_id=str(self.tenant.pk),
            from_status="approved",
            to_status="sent",
            extra_updates={"order_number": "PO-001-SENT"},
            emit_event=False,
        )
        self.assertEqual(result.status, "sent")
        self.assertEqual(result.order_number, "PO-001-SENT")

    @patch("apps.core.events.dispatcher.emit_trade_event")
    def test_event_emitted_on_transition(self, mock_emit):
        """Should emit domain event after successful transition."""
        transition_entity(
            model_class=PurchaseOrder,
            pk=self.po.pk,
            tenant_id=str(self.tenant.pk),
            from_status="pending_approval",
            to_status="approved",
            actor_user_id="user-1",
            event_type=TradeEventType.SUPPLIER_PO_APPROVED,
            trade_id="TRD-2026-00001",
            emit_event=True,
        )
        mock_emit.assert_called_once()
        call_kwargs = mock_emit.call_args[1]
        self.assertEqual(call_kwargs["event_type"], TradeEventType.SUPPLIER_PO_APPROVED)
        self.assertEqual(call_kwargs["entity_id"], str(self.po.pk))

    @patch("apps.core.events.dispatcher.emit_trade_event")
    def test_event_not_emitted_when_disabled(self, mock_emit):
        """Should not emit event when emit_event=False."""
        transition_entity(
            model_class=PurchaseOrder,
            pk=self.po.pk,
            tenant_id=str(self.tenant.pk),
            from_status="pending_approval",
            to_status="approved",
            emit_event=False,
        )
        mock_emit.assert_not_called()


class ValidTransitionMapTests(TestCase):
    """Tests for the VALID_TRANSITIONS map."""

    def test_all_entity_types_have_maps(self):
        """All expected entity types should have transition maps."""
        expected = {"PurchaseOrder", "CarrierPurchaseOrder", "SalesOrder"}
        self.assertEqual(set(VALID_TRANSITIONS.keys()), expected)

    def test_terminal_states_have_empty_targets(self):
        """Terminal states (cancelled, invoiced, completed) should have no targets."""
        for entity_type, transitions in VALID_TRANSITIONS.items():
            for terminal in ["cancelled", "invoiced", "completed"]:
                if terminal in transitions:
                    self.assertEqual(
                        transitions[terminal],
                        [],
                        f"{entity_type}.{terminal} should be terminal",
                    )

    def test_is_valid_transition_helper(self):
        """is_valid_transition should correctly check validity."""
        self.assertTrue(
            is_valid_transition("PurchaseOrder", "pending_approval", "approved")
        )
        self.assertFalse(
            is_valid_transition("PurchaseOrder", "pending_approval", "delivered")
        )
        # Unknown entity type — permissive
        self.assertTrue(
            is_valid_transition("UnknownModel", "any", "state")
        )


class ConvenienceWrapperTests(TestCase):
    """Tests for approve_purchase_order, approve_sales_order, etc."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Wrapper Test",
            slug="wrapper-test",
            schema_name="wrapper_test",
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant, name="Supplier"
        )
        self.customer = Customer.objects.create(
            tenant=self.tenant, name="Customer"
        )
        self.carrier = Carrier.objects.create(
            tenant=self.tenant, name="Carrier"
        )

    @patch("apps.core.events.dispatcher.emit_trade_event")
    def test_approve_purchase_order(self, mock_emit):
        """approve_purchase_order should transition PO to approved."""
        po = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            order_number="PO-APPROVE",
            order_date=date.today(),
            total_amount=Decimal("500.00"),
            status="pending_approval",
        )
        result = approve_purchase_order(
            pk=po.pk,
            tenant_id=str(self.tenant.pk),
            actor_user_id="user-2",
        )
        self.assertEqual(result.status, "approved")

    @patch("apps.core.events.dispatcher.emit_trade_event")
    def test_approve_sales_order(self, mock_emit):
        """approve_sales_order should transition SO to approved."""
        so = SalesOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            customer=self.customer,
            status="pending_approval",
        )
        result = approve_sales_order(
            pk=so.pk,
            tenant_id=str(self.tenant.pk),
            actor_user_id="user-3",
        )
        self.assertEqual(result.status, "approved")

    @patch("apps.core.events.dispatcher.emit_trade_event")
    def test_approve_carrier_po(self, mock_emit):
        """approve_carrier_po should transition carrier PO to approved."""
        cpo = CarrierPurchaseOrder.objects.create(
            tenant=self.tenant,
            carrier=self.carrier,
            supplier=self.supplier,
            our_carrier_po_num="CPO-001",
            status="pending_approval",
        )
        result = approve_carrier_po(
            pk=cpo.pk,
            tenant_id=str(self.tenant.pk),
            actor_user_id="user-4",
        )
        self.assertEqual(result.status, "approved")


class ConcurrencyTests(TransactionTestCase):
    """Tests that verify locking behavior under concurrency."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Concurrency Test",
            slug="concurrency-test",
            schema_name="concurrency_test",
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant, name="Supplier"
        )

    def test_double_approval_prevented(self):
        """Second approval attempt should fail with ConcurrentTransitionError."""
        po = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            order_number="PO-RACE",
            order_date=date.today(),
            total_amount=Decimal("100.00"),
            status="pending_approval",
        )

        # First approval succeeds
        transition_entity(
            model_class=PurchaseOrder,
            pk=po.pk,
            tenant_id=str(self.tenant.pk),
            from_status="pending_approval",
            to_status="approved",
            emit_event=False,
        )

        # Second attempt with stale from_status should fail
        with self.assertRaises(ConcurrentTransitionError):
            transition_entity(
                model_class=PurchaseOrder,
                pk=po.pk,
                tenant_id=str(self.tenant.pk),
                from_status="pending_approval",  # Stale — now "approved"
                to_status="approved",
                emit_event=False,
            )
