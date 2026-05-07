"""Tests for RT-08.1: Financial calculated fields service."""

from decimal import Decimal
from unittest.mock import MagicMock

from django.test import SimpleTestCase
from django.utils import timezone

from tenant_apps.workflows.services.financial_fields import (
    PaymentStatus,
    RiskLevel,
    TradeFinancials,
    calculate_order_financials,
    calculate_trade_financials,
)


def _make_order(total="100000", outstanding="50000", **kwargs):
    """Create a mock order object."""
    order = MagicMock()
    order.total_amount = Decimal(total)
    order.outstanding_amount = Decimal(outstanding)
    order.payment_due_date = kwargs.get("due_date")
    order.supplier = kwargs.get("supplier")
    return order


class MarginCalculationTest(SimpleTestCase):
    """Test margin calculation between SO and PO."""

    def test_basic_margin(self):
        """Margin = (sell - buy) / sell * 100."""
        so = _make_order(total="100000", outstanding="0")
        po = _make_order(total="80000", outstanding="0")

        result = calculate_trade_financials(sales_order=so, purchase_order=po)

        self.assertEqual(result.margin_amount, Decimal("20000.00"))
        self.assertEqual(result.margin_percent, Decimal("20.00"))

    def test_zero_margin(self):
        """Same buy and sell price = 0% margin."""
        so = _make_order(total="50000", outstanding="0")
        po = _make_order(total="50000", outstanding="0")

        result = calculate_trade_financials(sales_order=so, purchase_order=po)

        self.assertEqual(result.margin_percent, Decimal("0.00"))

    def test_negative_margin(self):
        """Selling below cost = negative margin."""
        so = _make_order(total="40000", outstanding="0")
        po = _make_order(total="50000", outstanding="0")

        result = calculate_trade_financials(sales_order=so, purchase_order=po)

        self.assertTrue(result.margin_percent < 0)
        self.assertEqual(result.margin_amount, Decimal("-10000.00"))

    def test_no_po_no_margin(self):
        """Without PO, margin is 0."""
        so = _make_order(total="100000", outstanding="50000")

        result = calculate_trade_financials(sales_order=so)

        self.assertEqual(result.margin_percent, Decimal("0.00"))


class PaymentStatusTest(SimpleTestCase):
    """Test payment status determination."""

    def test_fully_paid(self):
        so = _make_order(total="100000", outstanding="0")
        result = calculate_trade_financials(sales_order=so)
        self.assertEqual(result.so_payment_status, PaymentStatus.PAID)

    def test_partial_payment(self):
        so = _make_order(total="100000", outstanding="30000")
        result = calculate_trade_financials(sales_order=so)
        self.assertEqual(result.so_payment_status, PaymentStatus.PARTIAL)

    def test_pending_payment(self):
        so = _make_order(total="100000", outstanding="100000")
        result = calculate_trade_financials(sales_order=so)
        self.assertEqual(result.so_payment_status, PaymentStatus.PENDING)

    def test_not_invoiced(self):
        so = _make_order(total="0", outstanding="0")
        result = calculate_trade_financials(sales_order=so)
        self.assertEqual(result.so_payment_status, PaymentStatus.NOT_INVOICED)


class NetExposureTest(SimpleTestCase):
    """Test net exposure calculation."""

    def test_positive_exposure(self):
        """We owe more than we're owed = positive exposure."""
        so = _make_order(total="100000", outstanding="20000")
        po = _make_order(total="80000", outstanding="80000")

        result = calculate_trade_financials(sales_order=so, purchase_order=po)

        # Net exposure = po_outstanding - so_outstanding = 80000 - 20000 = 60000
        self.assertEqual(result.net_exposure, Decimal("60000.00"))

    def test_negative_exposure(self):
        """Customer owes more than we owe = negative (safe) exposure."""
        so = _make_order(total="100000", outstanding="100000")
        po = _make_order(total="80000", outstanding="0")

        result = calculate_trade_financials(sales_order=so, purchase_order=po)

        self.assertEqual(result.net_exposure, Decimal("-100000.00"))


class RiskAssessmentTest(SimpleTestCase):
    """Test risk level assessment."""

    def test_low_risk_default(self):
        so = _make_order(total="10000", outstanding="0")
        result = calculate_trade_financials(sales_order=so)
        self.assertEqual(result.credit_risk, RiskLevel.LOW)

    def test_high_outstanding_ratio(self):
        """>80% outstanding ratio triggers medium risk."""
        so = _make_order(total="100000", outstanding="90000")
        result = calculate_trade_financials(sales_order=so)
        self.assertEqual(result.credit_risk, RiskLevel.MEDIUM)

    def test_large_order_with_high_outstanding(self):
        """Large order + high outstanding = high risk."""
        so = _make_order(total="200000", outstanding="180000")
        result = calculate_trade_financials(sales_order=so)
        self.assertEqual(result.credit_risk, RiskLevel.HIGH)
        self.assertEqual(len(result.risk_factors), 2)


class OrderFinancialsTest(SimpleTestCase):
    """Test single-order financial calculation."""

    def test_purchase_order_financials(self):
        po = _make_order(total="50000", outstanding="30000")
        result = calculate_order_financials(order=po, order_type="purchase_order")

        self.assertEqual(result["total_amount"], "50000.00")
        self.assertEqual(result["outstanding_amount"], "30000.00")
        self.assertEqual(result["paid_amount"], "20000.00")
        self.assertEqual(result["payment_percent"], "40.00")
        self.assertEqual(result["payment_status"], "partial")


class SerializationTest(SimpleTestCase):
    """Test TradeFinancials serialization."""

    def test_to_dict(self):
        so = _make_order(total="100000", outstanding="25000")
        po = _make_order(total="80000", outstanding="80000")

        result = calculate_trade_financials(sales_order=so, purchase_order=po)
        d = result.to_dict()

        self.assertEqual(d["margin_percent"], "20.00")
        self.assertEqual(d["so_payment_status"], "partial")
        self.assertEqual(d["po_payment_status"], "pending")
        self.assertIn("calculated_at", d)
