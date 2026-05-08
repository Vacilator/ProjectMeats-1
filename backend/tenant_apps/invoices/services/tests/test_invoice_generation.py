"""Tests for auto-invoice generation service."""

from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from tenant_apps.invoices.services.invoice_generation import (
    InvoiceLineItem,
    build_invoice_from_po_confirmation,
    build_invoice_from_sales_order,
    calculate_due_date,
    generate_invoice_number,
)


class TestInvoiceNumberGeneration(TestCase):
    """Test invoice number generation."""

    def test_generates_prefixed_number(self):
        result = generate_invoice_number("tenant-1", 42)
        today = date.today()
        expected_prefix = f"INV-{today.strftime('%Y%m')}"
        self.assertTrue(result.startswith(expected_prefix))
        self.assertIn("0042", result)

    def test_default_sequence(self):
        result = generate_invoice_number("tenant-1")
        self.assertIn("0001", result)


class TestDueDateCalculation(TestCase):
    """Test due date calculation from payment terms."""

    def test_net_30(self):
        base = date(2025, 1, 1)
        result = calculate_due_date(base, "net_30")
        self.assertEqual(result, date(2025, 1, 31))

    def test_net_60(self):
        base = date(2025, 3, 1)
        result = calculate_due_date(base, "net_60")
        self.assertEqual(result, date(2025, 4, 30))

    def test_due_on_receipt(self):
        base = date(2025, 6, 15)
        result = calculate_due_date(base, "due_on_receipt")
        self.assertEqual(result, base)

    def test_unknown_terms_default_30(self):
        base = date(2025, 1, 1)
        result = calculate_due_date(base, "custom_terms")
        self.assertEqual(result, date(2025, 1, 31))

    def test_none_date_uses_today(self):
        result = calculate_due_date(None, "net_7")
        expected = date.today() + timedelta(days=7)
        self.assertEqual(result, expected)


class TestLineItemCalculation(TestCase):
    """Test line item total calculation."""

    def test_calculate_total(self):
        item = InvoiceLineItem(
            description="Product A",
            quantity=5,
            unit_price=Decimal("100.00"),
        )
        total = item.calculate_total()
        self.assertEqual(total, Decimal("500.00"))
        self.assertEqual(item.total, Decimal("500.00"))


class TestBuildInvoiceFromSalesOrder(TestCase):
    """Test invoice generation from sales order data."""

    def setUp(self):
        self.valid_so_data = {
            "our_sales_order_num": "SO-2025-001",
            "customer_id": 42,
            "customer_name": "Acme Meats",
            "total_amount": 15000.00,
            "unit_price": 3000.00,
            "quantity": 5,
            "product_description": "Prime Beef Cuts - 5 pallets",
            "payment_terms": "net_30",
            "billing_contact_email": "billing@acme.com",
            "billing_contact_name": "Jane Smith",
        }

    def test_successful_generation(self):
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1", 1)
        self.assertTrue(result.success)
        self.assertIn("INV-", result.invoice_number)
        self.assertEqual(result.invoice_data["customer_id"], 42)
        self.assertEqual(result.invoice_data["status"], "draft")
        self.assertEqual(result.invoice_data["total_amount"], "15000.00")
        self.assertEqual(result.invoice_data["outstanding_amount"], "15000.00")

    def test_line_items_populated(self):
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        lines = result.invoice_data["line_items"]
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["description"], "Prime Beef Cuts - 5 pallets")
        self.assertEqual(lines[0]["quantity"], 5)

    def test_routing_contact_from_billing(self):
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        self.assertEqual(result.routing_contact["email"], "billing@acme.com")
        self.assertEqual(result.routing_contact["department"], "Accounting")

    def test_fallback_to_shipping_contact(self):
        self.valid_so_data.pop("billing_contact_email")
        self.valid_so_data["shipping_contact_email"] = "ship@acme.com"
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        self.assertEqual(result.routing_contact["email"], "ship@acme.com")

    def test_missing_so_number_fails(self):
        self.valid_so_data.pop("our_sales_order_num")
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        self.assertFalse(result.success)
        self.assertIn("Missing sales order number", result.errors)

    def test_missing_customer_fails(self):
        self.valid_so_data.pop("customer_id")
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        self.assertFalse(result.success)
        self.assertIn("Missing customer_id", result.errors)

    def test_missing_total_fails(self):
        self.valid_so_data.pop("total_amount")
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        self.assertFalse(result.success)
        self.assertIn("Missing total_amount", result.errors)

    def test_lineage_tracking(self):
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        lineage = result.invoice_data["lineage"]
        self.assertEqual(lineage["source_type"], "sales_order")
        self.assertEqual(lineage["source_ref"], "SO-2025-001")
        self.assertEqual(lineage["customer_id"], "42")

    def test_due_date_uses_payment_terms(self):
        self.valid_so_data["payment_terms"] = "net_60"
        result = build_invoice_from_sales_order(self.valid_so_data, "tenant-1")
        expected = (date.today() + timedelta(days=60)).isoformat()
        self.assertEqual(result.invoice_data["due_date"], expected)


class TestBuildInvoiceFromPOConfirmation(TestCase):
    """Test invoice generation from PO confirmation."""

    def setUp(self):
        self.so_data = {
            "our_sales_order_num": "SO-2025-001",
            "customer_id": 42,
            "customer_name": "Acme Meats",
            "total_amount": 15000.00,
            "payment_terms": "net_30",
            "billing_contact_email": "billing@acme.com",
            "billing_contact_name": "Jane Smith",
        }
        self.po_data = {
            "po_number": "PO-226052",
            "total_amount": 14500.00,
            "billing_contact_email": "ap@acme.com",
            "billing_contact_name": "Bob AP",
        }

    def test_po_amount_overrides_so(self):
        result = build_invoice_from_po_confirmation(self.po_data, self.so_data, "tenant-1")
        self.assertTrue(result.success)
        self.assertEqual(result.invoice_data["total_amount"], "14500.00")

    def test_po_contact_overrides_so(self):
        result = build_invoice_from_po_confirmation(self.po_data, self.so_data, "tenant-1")
        self.assertEqual(result.routing_contact["email"], "ap@acme.com")

    def test_lineage_includes_po_ref(self):
        result = build_invoice_from_po_confirmation(self.po_data, self.so_data, "tenant-1")
        lineage = result.invoice_data["lineage"]
        self.assertEqual(lineage["source_type"], "po_confirmation")
        self.assertEqual(lineage["po_ref"], "PO-226052")

    def test_delivery_po_number_set(self):
        result = build_invoice_from_po_confirmation(self.po_data, self.so_data, "tenant-1")
        self.assertEqual(result.invoice_data["delivery_po_number"], "PO-226052")
