"""
Tests for the orders app abstract base models and mixins.

Tests the common functionality defined in AbstractBaseOrder and OrderMethodsMixin.
"""
from decimal import Decimal

from django.test import TestCase

from tenant_apps.orders.models import (
    AbstractBaseOrder,
    BaseOrderStatus,
    OrderTypeChoices,
    PaymentStatus,
    get_all_order_statuses,
    get_order_type_label,
)


class TestOrderChoices(TestCase):
    """Test order choice enums."""

    def test_order_type_choices(self):
        """Test OrderTypeChoices enum values."""
        self.assertEqual(OrderTypeChoices.PURCHASE, "purchase")
        self.assertEqual(OrderTypeChoices.SALES, "sales")
        self.assertEqual(OrderTypeChoices.CARRIER, "carrier")

    def test_base_order_status_choices(self):
        """Test BaseOrderStatus enum values."""
        self.assertEqual(BaseOrderStatus.PENDING, "pending")
        self.assertEqual(BaseOrderStatus.APPROVED, "approved")
        self.assertEqual(BaseOrderStatus.DELIVERED, "delivered")
        self.assertEqual(BaseOrderStatus.CANCELLED, "cancelled")

    def test_payment_status_choices(self):
        """Test PaymentStatus enum values."""
        self.assertEqual(PaymentStatus.UNPAID, "unpaid")
        self.assertEqual(PaymentStatus.PARTIAL, "partial")
        self.assertEqual(PaymentStatus.PAID, "paid")


class TestUtilityFunctions(TestCase):
    """Test utility functions."""

    def test_get_order_type_label_purchase(self):
        """Test getting label for purchase order type."""
        label = get_order_type_label("purchase")
        self.assertEqual(label, "Purchase Order")

    def test_get_order_type_label_sales(self):
        """Test getting label for sales order type."""
        label = get_order_type_label("sales")
        self.assertEqual(label, "Sales Order")

    def test_get_order_type_label_empty(self):
        """Test getting label for empty order type."""
        label = get_order_type_label("")
        self.assertEqual(label, "Unknown")

    def test_get_all_order_statuses(self):
        """Test getting all order statuses."""
        statuses = get_all_order_statuses()
        self.assertIn("pending", statuses)
        self.assertIn("delivered", statuses)
        self.assertIn("cancelled", statuses)


class ConcreteTestOrder(AbstractBaseOrder):
    """Concrete implementation of AbstractBaseOrder for testing."""

    class Meta:
        app_label = "orders"
        managed = False  # Don't create table

    # Override to prevent database operations
    def save(self, *args, **kwargs):
        pass


class TestAbstractBaseOrderProperties(TestCase):
    """Test AbstractBaseOrder computed properties and methods."""

    def test_is_paid_when_paid(self):
        """Test is_paid returns True when payment status is PAID."""
        order = ConcreteTestOrder()
        order.payment_status = PaymentStatus.PAID.value
        self.assertTrue(order.is_paid)

    def test_is_paid_when_unpaid(self):
        """Test is_paid returns False when payment status is UNPAID."""
        order = ConcreteTestOrder()
        order.payment_status = PaymentStatus.UNPAID.value
        self.assertFalse(order.is_paid)

    def test_is_paid_when_partial(self):
        """Test is_paid returns False when payment status is PARTIAL."""
        order = ConcreteTestOrder()
        order.payment_status = PaymentStatus.PARTIAL.value
        self.assertFalse(order.is_paid)

    def test_is_complete_when_delivered(self):
        """Test is_complete returns True when status is DELIVERED."""
        order = ConcreteTestOrder()
        order.status = BaseOrderStatus.DELIVERED.value
        self.assertTrue(order.is_complete)

    def test_is_complete_when_cancelled(self):
        """Test is_complete returns True when status is CANCELLED."""
        order = ConcreteTestOrder()
        order.status = BaseOrderStatus.CANCELLED.value
        self.assertTrue(order.is_complete)

    def test_is_complete_when_pending(self):
        """Test is_complete returns False when status is PENDING."""
        order = ConcreteTestOrder()
        order.status = BaseOrderStatus.PENDING.value
        self.assertFalse(order.is_complete)

    def test_has_outstanding_balance_with_balance(self):
        """Test has_outstanding_balance returns True when balance exists."""
        order = ConcreteTestOrder()
        order.outstanding_amount = Decimal("100.00")
        self.assertTrue(order.has_outstanding_balance)

    def test_has_outstanding_balance_zero(self):
        """Test has_outstanding_balance returns False when balance is zero."""
        order = ConcreteTestOrder()
        order.outstanding_amount = Decimal("0.00")
        self.assertFalse(order.has_outstanding_balance)

    def test_has_outstanding_balance_none(self):
        """Test has_outstanding_balance returns False when balance is None."""
        order = ConcreteTestOrder()
        order.outstanding_amount = None
        self.assertFalse(order.has_outstanding_balance)


class TestAbstractBaseOrderMethods(TestCase):
    """Test AbstractBaseOrder methods."""

    def test_calculate_outstanding_full_amount(self):
        """Test calculate_outstanding with no payment."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        outstanding = order.calculate_outstanding(Decimal("0.00"))
        self.assertEqual(outstanding, Decimal("1000.00"))

    def test_calculate_outstanding_partial_payment(self):
        """Test calculate_outstanding with partial payment."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        outstanding = order.calculate_outstanding(Decimal("300.00"))
        self.assertEqual(outstanding, Decimal("700.00"))

    def test_calculate_outstanding_full_payment(self):
        """Test calculate_outstanding with full payment."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        outstanding = order.calculate_outstanding(Decimal("1000.00"))
        self.assertEqual(outstanding, Decimal("0.00"))

    def test_calculate_outstanding_overpayment(self):
        """Test calculate_outstanding with overpayment returns zero."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        outstanding = order.calculate_outstanding(Decimal("1200.00"))
        self.assertEqual(outstanding, Decimal("0.00"))

    def test_calculate_outstanding_none_total(self):
        """Test calculate_outstanding with no total amount."""
        order = ConcreteTestOrder()
        order.total_amount = None
        outstanding = order.calculate_outstanding(Decimal("500.00"))
        self.assertEqual(outstanding, Decimal("0.00"))

    def test_update_payment_status_unpaid(self):
        """Test update_payment_status sets UNPAID when no payment."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        order.update_payment_status(Decimal("0.00"))
        self.assertEqual(order.payment_status, PaymentStatus.UNPAID.value)
        self.assertEqual(order.outstanding_amount, Decimal("1000.00"))

    def test_update_payment_status_partial(self):
        """Test update_payment_status sets PARTIAL when partial payment."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        order.update_payment_status(Decimal("500.00"))
        self.assertEqual(order.payment_status, PaymentStatus.PARTIAL.value)
        self.assertEqual(order.outstanding_amount, Decimal("500.00"))

    def test_update_payment_status_paid(self):
        """Test update_payment_status sets PAID when full payment."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        order.update_payment_status(Decimal("1000.00"))
        self.assertEqual(order.payment_status, PaymentStatus.PAID.value)
        self.assertEqual(order.outstanding_amount, Decimal("0.00"))

    def test_update_payment_status_overpayment(self):
        """Test update_payment_status sets PAID with overpayment."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        order.update_payment_status(Decimal("1500.00"))
        self.assertEqual(order.payment_status, PaymentStatus.PAID.value)
        self.assertEqual(order.outstanding_amount, Decimal("0.00"))

    def test_update_payment_status_none_total(self):
        """Test update_payment_status does nothing with no total."""
        order = ConcreteTestOrder()
        order.total_amount = None
        order.payment_status = PaymentStatus.UNPAID.value
        order.update_payment_status(Decimal("500.00"))
        # Should not change when total is None
        self.assertEqual(order.payment_status, PaymentStatus.UNPAID.value)


class TestOrderMethodsMixin(TestCase):
    """Test OrderMethodsMixin with string values (as used by existing models)."""

    def test_mixin_is_paid_with_string_value(self):
        """Test is_paid works with string value."""
        order = ConcreteTestOrder()
        order.payment_status = "paid"  # String value, not enum
        self.assertTrue(order.is_paid)

    def test_mixin_is_complete_with_string_value(self):
        """Test is_complete works with string value."""
        order = ConcreteTestOrder()
        order.status = "delivered"  # String value
        self.assertTrue(order.is_complete)

    def test_mixin_update_payment_status_sets_string_values(self):
        """Test update_payment_status sets string values (not enums)."""
        order = ConcreteTestOrder()
        order.total_amount = Decimal("1000.00")
        order.update_payment_status(Decimal("500.00"))
        # Should set string value
        self.assertEqual(order.payment_status, "partial")
        self.assertIsInstance(order.payment_status, str)
