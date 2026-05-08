"""Tests for canonical model consolidation: mixins, services, helpers.

Covers:
- AddressMixin properties
- BusinessPartyMixin methods
- WeightMeasurementMixin conversions
- MonetaryFieldsMixin calculations
- ApprovalTrackingMixin state management
- LifecycleStateMixin transitions
- BusinessPartyService unified search/find_or_create
- TradeLifecycleService state aggregation
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase

from apps.core.model_mixins import (
    AddressMixin,
    ApprovalTrackingMixin,
    BusinessPartyMixin,
    LifecycleStateMixin,
    MonetaryFieldsMixin,
    WeightMeasurementMixin,
)

# ==============================================================================
# Mixin Tests (no database required — use mock objects)
# ==============================================================================


class MockAddressEntity:
    """Mock entity with AddressMixin fields."""

    def __init__(self, address="", city="", state="", zip_code="", country="USA"):
        self.address = address
        self.city = city
        self.state = state
        self.zip_code = zip_code
        self.country = country

    # Attach mixin properties
    full_address = AddressMixin.full_address
    has_address = AddressMixin.has_address


class AddressMixinTests(SimpleTestCase):
    """Tests for AddressMixin property methods."""

    def test_full_address_all_fields(self):
        entity = MockAddressEntity(
            address="123 Main St",
            city="Dallas",
            state="TX",
            zip_code="75001",
            country="USA",
        )
        self.assertEqual(entity.full_address, "123 Main St, Dallas, TX 75001")

    def test_full_address_non_us(self):
        entity = MockAddressEntity(
            address="456 Queen St",
            city="Toronto",
            state="ON",
            zip_code="M5V 2H1",
            country="Canada",
        )
        self.assertEqual(entity.full_address, "456 Queen St, Toronto, ON M5V 2H1, Canada")

    def test_full_address_minimal(self):
        entity = MockAddressEntity(city="Houston", state="TX")
        self.assertIn("Houston", entity.full_address)
        self.assertIn("TX", entity.full_address)

    def test_has_address_true(self):
        entity = MockAddressEntity(city="Austin", state="TX")
        self.assertTrue(entity.has_address)

    def test_has_address_false(self):
        entity = MockAddressEntity()
        self.assertFalse(entity.has_address)


class MockWeightEntity:
    """Mock entity with weight fields."""

    LBS_TO_KG = WeightMeasurementMixin.LBS_TO_KG
    KG_TO_LBS = WeightMeasurementMixin.KG_TO_LBS

    def __init__(self, total_weight=None, weight_unit="LBS"):
        self.total_weight = total_weight
        self.weight_unit = weight_unit

    get_weight_display = WeightMeasurementMixin.get_weight_display
    get_weight_in_lbs = WeightMeasurementMixin.get_weight_in_lbs
    get_weight_in_kg = WeightMeasurementMixin.get_weight_in_kg


class WeightMeasurementMixinTests(SimpleTestCase):
    """Tests for WeightMeasurementMixin."""

    def test_weight_display_lbs(self):
        entity = MockWeightEntity(total_weight=Decimal("5000.00"), weight_unit="LBS")
        self.assertEqual(entity.get_weight_display(), "5,000.00 LBS")

    def test_weight_display_none(self):
        entity = MockWeightEntity()
        self.assertEqual(entity.get_weight_display(), "")

    def test_weight_in_lbs_from_lbs(self):
        entity = MockWeightEntity(total_weight=Decimal("1000"), weight_unit="LBS")
        self.assertAlmostEqual(entity.get_weight_in_lbs(), 1000.0)

    def test_weight_in_lbs_from_kg(self):
        entity = MockWeightEntity(total_weight=Decimal("1000"), weight_unit="KG")
        result = entity.get_weight_in_lbs()
        self.assertAlmostEqual(result, 2204.62, places=1)

    def test_weight_in_kg_from_lbs(self):
        entity = MockWeightEntity(total_weight=Decimal("1000"), weight_unit="LBS")
        result = entity.get_weight_in_kg()
        self.assertAlmostEqual(result, 453.59, places=1)

    def test_weight_none_returns_none(self):
        entity = MockWeightEntity()
        self.assertIsNone(entity.get_weight_in_lbs())
        self.assertIsNone(entity.get_weight_in_kg())


class MockMonetaryEntity:
    """Mock entity with monetary fields."""

    def __init__(self, total_amount=None, outstanding_amount=None):
        self.total_amount = total_amount
        self.outstanding_amount = outstanding_amount

    is_fully_paid = MonetaryFieldsMixin.is_fully_paid
    payment_percentage = MonetaryFieldsMixin.payment_percentage
    amount_paid = MonetaryFieldsMixin.amount_paid


class MonetaryFieldsMixinTests(SimpleTestCase):
    """Tests for MonetaryFieldsMixin."""

    def test_fully_paid_zero_outstanding(self):
        entity = MockMonetaryEntity(
            total_amount=Decimal("10000"),
            outstanding_amount=Decimal("0"),
        )
        self.assertTrue(entity.is_fully_paid)

    def test_not_fully_paid(self):
        entity = MockMonetaryEntity(
            total_amount=Decimal("10000"),
            outstanding_amount=Decimal("5000"),
        )
        self.assertFalse(entity.is_fully_paid)

    def test_payment_percentage_half(self):
        entity = MockMonetaryEntity(
            total_amount=Decimal("10000"),
            outstanding_amount=Decimal("5000"),
        )
        self.assertAlmostEqual(entity.payment_percentage, 50.0)

    def test_payment_percentage_full(self):
        entity = MockMonetaryEntity(
            total_amount=Decimal("10000"),
            outstanding_amount=Decimal("0"),
        )
        self.assertAlmostEqual(entity.payment_percentage, 100.0)

    def test_payment_percentage_zero_total(self):
        entity = MockMonetaryEntity(total_amount=Decimal("0"), outstanding_amount=Decimal("0"))
        self.assertEqual(entity.payment_percentage, 0.0)

    def test_amount_paid(self):
        entity = MockMonetaryEntity(
            total_amount=Decimal("10000"),
            outstanding_amount=Decimal("3000"),
        )
        self.assertAlmostEqual(entity.amount_paid, 7000.0)


class MockApprovalEntity:
    """Mock entity with approval fields."""

    APPROVAL_PENDING = ApprovalTrackingMixin.APPROVAL_PENDING
    APPROVAL_APPROVED = ApprovalTrackingMixin.APPROVAL_APPROVED
    APPROVAL_REJECTED = ApprovalTrackingMixin.APPROVAL_REJECTED

    def __init__(self):
        self.approval_status = self.APPROVAL_PENDING
        self.approved_by = None
        self.approved_at = None
        self.approval_notes = ""

    is_approved = ApprovalTrackingMixin.is_approved
    is_pending_approval = ApprovalTrackingMixin.is_pending_approval
    approve = ApprovalTrackingMixin.approve
    reject = ApprovalTrackingMixin.reject


class ApprovalTrackingMixinTests(SimpleTestCase):
    """Tests for ApprovalTrackingMixin."""

    def test_initial_state_pending(self):
        entity = MockApprovalEntity()
        self.assertTrue(entity.is_pending_approval)
        self.assertFalse(entity.is_approved)

    def test_approve(self):
        entity = MockApprovalEntity()
        user = MagicMock()
        entity.approve(user, notes="Looks good")
        self.assertTrue(entity.is_approved)
        self.assertFalse(entity.is_pending_approval)
        self.assertEqual(entity.approved_by, user)
        self.assertEqual(entity.approval_notes, "Looks good")
        self.assertIsNotNone(entity.approved_at)

    def test_reject(self):
        entity = MockApprovalEntity()
        user = MagicMock()
        entity.reject(user, notes="Needs revision")
        self.assertFalse(entity.is_approved)
        self.assertFalse(entity.is_pending_approval)
        self.assertEqual(entity.approval_status, "rejected")
        self.assertEqual(entity.approval_notes, "Needs revision")


class MockLifecycleEntity:
    """Mock entity with lifecycle state fields."""

    VALID_TRANSITIONS = {
        "draft": ["active", "cancelled"],
        "active": ["completed", "paused"],
        "paused": ["active", "cancelled"],
        "completed": ["archived"],
    }

    def __init__(self, state="draft"):
        self.lifecycle_state = state
        self.lifecycle_changed_at = None
        self.lifecycle_changed_by = None

    can_transition_to = LifecycleStateMixin.can_transition_to
    transition_to = LifecycleStateMixin.transition_to


class LifecycleStateMixinTests(SimpleTestCase):
    """Tests for LifecycleStateMixin."""

    def test_valid_transition(self):
        entity = MockLifecycleEntity(state="draft")
        self.assertTrue(entity.can_transition_to("active"))
        self.assertTrue(entity.can_transition_to("cancelled"))

    def test_invalid_transition(self):
        entity = MockLifecycleEntity(state="draft")
        self.assertFalse(entity.can_transition_to("completed"))
        self.assertFalse(entity.can_transition_to("archived"))

    def test_transition_to_success(self):
        entity = MockLifecycleEntity(state="draft")
        result = entity.transition_to("active", user=MagicMock())
        self.assertTrue(result)
        self.assertEqual(entity.lifecycle_state, "active")
        self.assertIsNotNone(entity.lifecycle_changed_at)

    def test_transition_to_invalid_raises(self):
        entity = MockLifecycleEntity(state="draft")
        with self.assertRaises(ValueError) as ctx:
            entity.transition_to("archived")
        self.assertIn("Invalid transition", str(ctx.exception))

    def test_chained_transitions(self):
        entity = MockLifecycleEntity(state="draft")
        entity.transition_to("active")
        entity.transition_to("completed")
        entity.transition_to("archived")
        self.assertEqual(entity.lifecycle_state, "archived")


# ==============================================================================
# BusinessPartyMixin Tests
# ==============================================================================


class MockPartyEntity:
    """Mock entity with party fields."""

    __name__ = "Supplier"

    def __init__(self, name="", contact_person="", email="", phone=""):
        self.pk = 1
        self.name = name
        self.contact_person = contact_person
        self.email = email
        self.phone = phone
        self.ap_email = ""
        self.phone_office = ""
        self.phone_mobile = ""

    get_display_name = BusinessPartyMixin.get_display_name
    get_primary_email = BusinessPartyMixin.get_primary_email
    get_primary_phone = BusinessPartyMixin.get_primary_phone


class BusinessPartyMixinTests(SimpleTestCase):
    """Tests for BusinessPartyMixin."""

    def test_display_name_from_name(self):
        entity = MockPartyEntity(name="Tyson Foods")
        self.assertEqual(entity.get_display_name(), "Tyson Foods")

    def test_display_name_fallback_contact(self):
        entity = MockPartyEntity(contact_person="John Smith")
        self.assertEqual(entity.get_display_name(), "John Smith")

    def test_primary_email(self):
        entity = MockPartyEntity(email="test@example.com")
        self.assertEqual(entity.get_primary_email(), "test@example.com")

    def test_primary_email_fallback(self):
        entity = MockPartyEntity()
        entity.ap_email = "ap@example.com"
        self.assertEqual(entity.get_primary_email(), "ap@example.com")

    def test_primary_phone(self):
        entity = MockPartyEntity(phone="555-1234")
        self.assertEqual(entity.get_primary_phone(), "555-1234")

    def test_primary_phone_fallback(self):
        entity = MockPartyEntity()
        entity.phone_office = "555-5678"
        self.assertEqual(entity.get_primary_phone(), "555-5678")


# ==============================================================================
# Service Tests (require database)
# ==============================================================================


class BusinessPartyServiceTests(TestCase):
    """Tests for BusinessPartyService unified search."""

    def test_search_empty_returns_empty(self):
        from apps.core.services.party_service import BusinessPartyService

        tenant = MagicMock()
        tenant.id = "test-tenant"
        service = BusinessPartyService(tenant)

        # Mock the model lookups to return empty
        with patch.object(service, "_get_queryset") as mock_qs:
            mock_qs.return_value = MagicMock()
            mock_qs.return_value.filter.return_value = mock_qs.return_value
            mock_qs.return_value.__getitem__ = lambda self, key: []
            results = service.search("nonexistent")
            self.assertEqual(results, [])

    def test_get_counts_structure(self):
        from apps.core.services.party_service import BusinessPartyService

        tenant = MagicMock()
        service = BusinessPartyService(tenant)

        with patch.object(service, "_get_queryset") as mock_qs:
            mock_qs.return_value.count.return_value = 5
            counts = service.get_counts()
            self.assertIn("supplier", counts)
            self.assertIn("customer", counts)
            self.assertIn("carrier", counts)


class TradeLifecycleServiceTests(TestCase):
    """Tests for TradeLifecycleService."""

    def test_pipeline_summary_structure(self):
        from apps.core.services.trade_lifecycle import TradeLifecycleService

        tenant = MagicMock()
        tenant.id = "test-tenant"
        service = TradeLifecycleService(tenant)

        # When models can't be imported (test isolation), expect graceful degradation
        summary = service.get_pipeline_summary()
        self.assertIn("active_purchase_orders", summary)
        self.assertIn("active_sales_orders", summary)
        self.assertIn("total_active_trades", summary)

    def test_is_ready_for_next_step_no_session(self):
        from apps.core.services.trade_lifecycle import TradeLifecycleService

        tenant = MagicMock()
        service = TradeLifecycleService(tenant)

        with patch.object(service, "get_trade_state", return_value=None):
            result = service.is_ready_for_next_step("nonexistent")
            self.assertFalse(result["ready"])
            self.assertIn("not found", result["reason"])
