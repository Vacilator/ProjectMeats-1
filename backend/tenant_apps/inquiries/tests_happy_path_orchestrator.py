"""Tests for the happy-path orchestrator (CTE-04.5).

Validates the deterministic state machine that wires:
  FULFILL: inquiry → draft SO → approve SO → carrier fan-out → carrier reply → draft carrier PO
  BROKER:  inquiry → supplier RFQ → reply → draft supplier PO → approve → ... same as FULFILL
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from apps.tenants.models import Tenant
from tenant_apps.contacts.models import Contact
from tenant_apps.carriers.models import Carrier
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryStatusChoices,
    InquirySupplierRFQ,
)
from tenant_apps.inquiries.services.happy_path_orchestrator import (
    BROKER_STEPS,
    FULFILL_STEPS,
    OrchestratorStep,
    advance_orchestrator,
    get_lineage_chain,
    get_orchestrator_state,
)
from tenant_apps.purchase_orders.models import (
    CarrierPurchaseOrder,
    PurchaseOrder,
    PurchaseOrderStatus,
)
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus
from tenant_apps.suppliers.models import Supplier


class OrchestratorTestBase(TestCase):
    """Shared test fixtures for orchestrator tests."""

    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.tenant = Tenant.objects.create(
            name=f"test-orch-{uid}",
            schema_name=f"orch_{uid}",
            domain=f"orch-{uid}.test.local",
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f"Supplier-{uid}",
        )
        self.customer = Customer.objects.create(
            tenant=self.tenant,
            name=f"Customer-{uid}",
        )

    def _make_inquiry(self, route="FULFILL", **kwargs):
        defaults = {
            "tenant": self.tenant,
            "route_decision": route,
            "status": InquiryStatusChoices.PENDING,
            "inquiry_number": f"INQ-{uuid.uuid4().hex[:6]}",
            "supplier": self.supplier,
            "customer": self.customer,
        }
        defaults.update(kwargs)
        return Inquiry.objects.create(**defaults)

    def _make_carrier_po(self, **kwargs):
        carrier = Carrier.objects.create(
            tenant=self.tenant,
            name=f"Carrier-{uuid.uuid4().hex[:6]}",
        )
        defaults = {
            "tenant": self.tenant,
            "our_carrier_po_num": f"CPO-{uuid.uuid4().hex[:6]}",
            "status": "draft",
            "carrier": carrier,
            "supplier": self.supplier,
        }
        defaults.update(kwargs)
        return CarrierPurchaseOrder.objects.create(**defaults)

    def _make_purchase_order(self, **kwargs):
        defaults = {
            "tenant": self.tenant,
            "order_number": f"PO-{uuid.uuid4().hex[:6]}",
            "supplier": self.supplier,
            "total_amount": Decimal("1000.00"),
            "status": PurchaseOrderStatus.APPROVED,
            "order_date": timezone.now().date(),
        }
        defaults.update(kwargs)
        return PurchaseOrder.objects.create(**defaults)

    def _make_sales_order(self, **kwargs):
        defaults = {
            "tenant": self.tenant,
            "our_sales_order_num": f"SO-{uuid.uuid4().hex[:6]}",
            "supplier": self.supplier,
            "customer": self.customer,
            "status": SalesOrderStatus.DRAFT,
            "total_amount": Decimal("1250.00"),
        }
        defaults.update(kwargs)
        return SalesOrder.objects.create(**defaults)


class OrchestratorStateDerivationTests(OrchestratorTestBase):
    """Test state derivation from existing entity links."""

    def test_fresh_fulfill_inquiry_at_draft_so(self):
        inquiry = self._make_inquiry(route="FULFILL")
        state = get_orchestrator_state(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(state, OrchestratorStep.DRAFT_SALES_ORDER)

    def test_fresh_broker_inquiry_at_supplier_rfq(self):
        inquiry = self._make_inquiry(route="BROKER")
        state = get_orchestrator_state(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(state, OrchestratorStep.SUPPLIER_RFQ)

    def test_broker_with_rfq_sent_at_reply_parse(self):
        inquiry = self._make_inquiry(route="BROKER")
        InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=inquiry,
            supplier=self.supplier,
            correlation_key=uuid.uuid4(),
            sender_email="test@example.com",
            recipient_email="supplier@example.com",
            recipient_name="Supplier",
            subject="RFQ",
            body="Test body",
            provider="microsoft",
            status="sent",
        )
        state = get_orchestrator_state(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(state, OrchestratorStep.SUPPLIER_REPLY_PARSE)

    def test_broker_with_replied_rfq_at_draft_supplier_po(self):
        inquiry = self._make_inquiry(route="BROKER")
        InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=inquiry,
            supplier=self.supplier,
            correlation_key=uuid.uuid4(),
            sender_email="test@example.com",
            recipient_email="supplier@example.com",
            recipient_name="Supplier",
            subject="RFQ",
            body="Test body",
            provider="microsoft",
            status="replied",
        )
        state = get_orchestrator_state(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(state, OrchestratorStep.DRAFT_SUPPLIER_PO)

    def test_fulfill_steps_order(self):
        self.assertEqual(FULFILL_STEPS[0], OrchestratorStep.DRAFT_SALES_ORDER)
        self.assertEqual(FULFILL_STEPS[-1], OrchestratorStep.COMPLETED)
        self.assertEqual(len(FULFILL_STEPS), 6)

    def test_broker_steps_order(self):
        self.assertEqual(BROKER_STEPS[0], OrchestratorStep.SUPPLIER_RFQ)
        self.assertEqual(BROKER_STEPS[-1], OrchestratorStep.COMPLETED)
        self.assertEqual(len(BROKER_STEPS), 10)

    def test_completed_state_when_carrier_po_linked(self):
        inquiry = self._make_inquiry(route="FULFILL")
        cpo = self._make_carrier_po()
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["carrier_purchase_order"])

        state = get_orchestrator_state(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(state, OrchestratorStep.COMPLETED)

    def test_broker_with_approved_po_derives_to_fulfill_state(self):
        po = self._make_purchase_order(status=PurchaseOrderStatus.APPROVED)
        inquiry = self._make_inquiry(route="BROKER", supplier_purchase_order=po)
        state = get_orchestrator_state(tenant=self.tenant, inquiry=inquiry)
        # With approved PO but no SO, should be at DRAFT_SALES_ORDER
        self.assertEqual(state, OrchestratorStep.DRAFT_SALES_ORDER)


class OrchestratorAdvanceTests(OrchestratorTestBase):
    """Test orchestrator advance logic."""

    @patch(
        "tenant_apps.inquiries.services.happy_path_orchestrator._step_draft_sales_order"
    )
    def test_advance_fulfill_calls_draft_so(self, mock_step):
        mock_step.return_value = MagicMock(
            step=OrchestratorStep.DRAFT_SALES_ORDER,
            success=True,
            message="Draft SO created.",
            entity_id="123",
            entity_type="SalesOrder",
        )
        inquiry = self._make_inquiry(route="FULFILL")
        result = advance_orchestrator(
            tenant=self.tenant,
            inquiry=inquiry,
            advance_through=OrchestratorStep.DRAFT_SALES_ORDER,
        )
        mock_step.assert_called_once()
        self.assertTrue(result.success)
        self.assertEqual(len(result.steps_executed), 1)

    def test_advance_completed_inquiry_returns_immediately(self):
        inquiry = self._make_inquiry(route="FULFILL")
        cpo = self._make_carrier_po()
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["carrier_purchase_order"])

        result = advance_orchestrator(tenant=self.tenant, inquiry=inquiry)
        self.assertTrue(result.completed)
        self.assertEqual(len(result.steps_executed), 0)

    def test_advance_broker_blocks_on_missing_supplier(self):
        inquiry = self._make_inquiry(route="BROKER", supplier=None)
        result = advance_orchestrator(
            tenant=self.tenant,
            inquiry=inquiry,
            advance_through=OrchestratorStep.SUPPLIER_RFQ,
        )
        self.assertTrue(result.blocked)
        self.assertIn("No supplier", result.blocked_reason)

    def test_advance_broker_blocks_waiting_for_reply(self):
        inquiry = self._make_inquiry(route="BROKER")
        InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=inquiry,
            supplier=self.supplier,
            correlation_key=uuid.uuid4(),
            sender_email="test@example.com",
            recipient_email="supplier@example.com",
            recipient_name="Supplier",
            subject="RFQ",
            body="Test body",
            provider="microsoft",
            status="sent",
        )
        result = advance_orchestrator(
            tenant=self.tenant,
            inquiry=inquiry,
            advance_through=OrchestratorStep.SUPPLIER_REPLY_PARSE,
        )
        self.assertTrue(result.blocked)
        self.assertIn("Waiting for supplier reply", result.blocked_reason)

    def test_advance_broker_approve_po_blocks_on_pending(self):
        po = self._make_purchase_order(status=PurchaseOrderStatus.PENDING)
        inquiry = self._make_inquiry(route="BROKER", supplier_purchase_order=po)
        state = get_orchestrator_state(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(state, OrchestratorStep.APPROVE_SUPPLIER_PO)

        result = advance_orchestrator(
            tenant=self.tenant,
            inquiry=inquiry,
            advance_through=OrchestratorStep.APPROVE_SUPPLIER_PO,
        )
        self.assertTrue(result.blocked)
        self.assertIn("Waiting for approval", result.blocked_reason)


class LineageChainTests(OrchestratorTestBase):
    """Test lineage chain generation for Process Cockpit."""

    def test_lineage_chain_fresh_inquiry(self):
        inquiry = self._make_inquiry(route="FULFILL")
        chain = get_lineage_chain(tenant=self.tenant, inquiry=inquiry)

        self.assertEqual(chain["inquiry"]["id"], str(inquiry.id))
        self.assertEqual(chain["inquiry"]["route_decision"], "FULFILL")
        self.assertIsNone(chain["supplier_purchase_order"])
        self.assertIsNone(chain["sales_order"])
        self.assertIsNone(chain["carrier_purchase_order"])
        self.assertEqual(chain["current_step"], "draft_sales_order")

    def test_lineage_chain_with_carrier_po(self):
        cpo = self._make_carrier_po()
        inquiry = self._make_inquiry(
            route="FULFILL",
            status=InquiryStatusChoices.FULFILLED,
            carrier_purchase_order=cpo,
        )
        chain = get_lineage_chain(tenant=self.tenant, inquiry=inquiry)

        self.assertIsNotNone(chain["carrier_purchase_order"])
        self.assertEqual(chain["carrier_purchase_order"]["id"], str(cpo.id))
        self.assertEqual(chain["current_step"], "completed")

    def test_lineage_chain_broker_with_supplier_po(self):
        po = self._make_purchase_order()
        inquiry = self._make_inquiry(
            route="BROKER",
            supplier_purchase_order=po,
        )
        chain = get_lineage_chain(tenant=self.tenant, inquiry=inquiry)

        self.assertIsNotNone(chain["supplier_purchase_order"])
        self.assertEqual(
            chain["supplier_purchase_order"]["status"], PurchaseOrderStatus.APPROVED
        )

    def test_lineage_chain_includes_contact_role_summaries(self):
        supplier_contact = Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            first_name="Angie",
            last_name="Sanchez",
            email="angie@example.com",
            department="sales",
            title="Account Manager",
            protein_types_responsible=["Beef"],
            items_responsible=["Beef Trim"],
            documents_responsible_for=["spec sheets"],
        )
        customer_contact = Contact.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            first_name="Alex",
            last_name="Buyer",
            email="alex@example.com",
            title="Procurement",
        )
        supplier_po = self._make_purchase_order(
            custom_data={
                "contact_routing": {
                    "supplier_contact": {
                        "contact_id": supplier_contact.id,
                        "recipient_name": "Angie Sanchez",
                        "department": "sales",
                        "title": "Account Manager",
                        "plant_name": "Allen Lund",
                        "matched_items": ["Beef Trim"],
                        "matched_documents": ["Spec Sheets"],
                    },
                    "shipping_contact": {
                        "contact_id": supplier_contact.id,
                        "recipient_name": "Angie Sanchez",
                        "department": "shipping",
                        "title": "Shipping Supervisor",
                        "plant_name": "Allen Lund",
                    },
                }
            },
        )
        sales_order = self._make_sales_order(
            custom_data={
                "process_cockpit": {
                    "customer_contact": {
                        "contact_id": customer_contact.id,
                        "name": "Alex Buyer",
                        "email": "alex@example.com",
                    },
                    "supplier_contacts": {
                        "supplier_contact": {
                            "contact_id": supplier_contact.id,
                            "recipient_name": "Angie Sanchez",
                            "department": "sales",
                            "title": "Account Manager",
                            "plant_name": "Allen Lund",
                            "matched_items": ["Beef Trim"],
                        }
                    },
                }
            },
        )
        inquiry = self._make_inquiry(
            route="BROKER",
            supplier_purchase_order=supplier_po,
            sales_order=sales_order,
            contact=customer_contact,
        )
        InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=inquiry,
            supplier=self.supplier,
            correlation_key=uuid.uuid4(),
            sender_email="ops@example.com",
            recipient_email="angie@example.com",
            recipient_name="Angie Sanchez",
            subject="RFQ",
            body="Test body",
            provider="microsoft",
            status="sent",
            custom_data={
                "recipient_routing": {
                    "contact_id": supplier_contact.id,
                    "recipient_name": "Angie Sanchez",
                    "department": "sales",
                    "title": "Account Manager",
                    "plant_name": "Allen Lund",
                    "matched_items": ["Beef Trim"],
                }
            },
        )

        chain = get_lineage_chain(tenant=self.tenant, inquiry=inquiry)

        inquiry_roles = chain["inquiry"]["contact_roles"]
        self.assertEqual(inquiry_roles[0]["detail_path"], f"/records/contact/{supplier_contact.id}")
        self.assertIn("RFQ sent to Sales", inquiry_roles[0]["header"])
        self.assertIn("Beef Trim", inquiry_roles[0]["responsibilities"])

        po_roles = chain["supplier_purchase_order"]["contact_roles"]
        self.assertEqual(po_roles[0]["role"], "supplier_contact")
        self.assertEqual(po_roles[0]["department_label"], "Sales")
        self.assertEqual(po_roles[0]["name"], "Angie Sanchez")

        so_roles = chain["sales_order"]["contact_roles"]
        self.assertEqual(so_roles[0]["role"], "supplier_contact")
        self.assertEqual(so_roles[-1]["role"], "customer_contact")
        self.assertEqual(so_roles[-1]["detail_path"], f"/records/contact/{customer_contact.id}")
