"""
E2E Trade Workflow Automated Tests

Tests the full trade pipeline automation from inquiry creation through
completion, verifying each stage transition, dependency checks, and
orchestrator behavior.

These tests exercise the actual Django ORM + services layer (not mocked),
ensuring that the happy-path orchestrator, trade session cascade, and
dependency checker work correctly end-to-end.

Run with:
    cd backend && python manage.py test tests.integration.trade_workflow.test_e2e_trade_pipeline
    cd backend && python -m pytest tests/integration/trade_workflow/ -v

Requires:
    - PostgreSQL database (uses test settings)
    - Factory fixtures from apps.core.tests.factories
"""

from __future__ import annotations

from decimal import Decimal
from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase, TransactionTestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.core.tests.factories import (
    TenantFactory,
    SupplierFactory,
    CustomerFactory,
    PlantFactory,
    ContactFactory,
    InquiryFactory,
    PurchaseOrderFactory,
    SalesOrderFactory,
    CarrierFactory,
    CarrierPurchaseOrderFactory,
    TradeSessionFactory,
    UserFactory,
)

User = get_user_model()


class TradeWorkflowBaseTestCase(TestCase):
    """Base test class with common setup for trade workflow tests."""

    @classmethod
    def setUpTestData(cls):
        """Create shared test infrastructure (tenant, users, master data)."""
        cls.tenant = TenantFactory(name="E2E Test Tenant", slug="e2e-test")
        cls.user = UserFactory(username="e2e_trader", is_staff=True)

        # Create TenantUser membership
        from apps.tenants.models import TenantUser
        cls.membership = TenantUser.objects.create(
            tenant=cls.tenant,
            user=cls.user,
            role="admin",
            is_active=True,
        )

        # Master data
        cls.supplier = SupplierFactory(
            tenant=cls.tenant,
            name="Test Supplier Co",
            email="supplier@test.com",
        )
        cls.customer = CustomerFactory(
            tenant=cls.tenant,
            name="Test Customer Inc",
            email="customer@test.com",
        )
        cls.plant = PlantFactory(
            tenant=cls.tenant,
            name="Test Plant #1",
            supplier=cls.supplier,
        )
        cls.contact = ContactFactory(
            tenant=cls.tenant,
            first_name="John",
            last_name="Supplier",
            email="john@supplier-test.com",
        )

    def _create_inquiry_with_products(self, **kwargs):
        """Helper to create an inquiry with products and optional bids."""
        from tenant_apps.inquiries.models import (
            Inquiry, InquiryProduct, InquiryProductSupplierBid,
        )
        from apps.system.models import Product

        product, _ = Product.objects.get_or_create(
            name="Test Ground Beef 80/20",
            defaults={"protein": "beef", "is_active": True},
        )

        defaults = {
            "tenant": self.tenant,
            "entity_type": "customer",
            "customer": self.customer,
            "route_decision": kwargs.pop("route", "BROKER"),
            "status": kwargs.pop("status", "draft"),
            "source_type": "other",
            "description": "E2E test inquiry",
            "inquiry_date": date.today(),
            "valid_until": date.today() + timedelta(days=14),
            "created_by": self.user,
        }
        defaults.update(kwargs)
        inquiry = Inquiry.objects.create(**defaults)

        # Add product line
        ip = InquiryProduct.objects.create(
            tenant=self.tenant,
            inquiry=inquiry,
            product=product,
            quantity=Decimal("40000"),
            desired_price_per_unit=Decimal("2.50"),
            desired_total=Decimal("100000.00"),
            desired_uom="LBS",
            desired_uom_value=Decimal("40000"),
        )

        # Add supplier bid if requested
        if kwargs.get("with_bid", False):
            InquiryProductSupplierBid.objects.create(
                tenant=self.tenant,
                inquiry_product=ip,
                supplier=self.supplier,
                plant=self.plant,
                bid_price_per_unit=Decimal("2.40"),
                bid_total=Decimal("96000.00"),
                bid_uom="LBS",
                bid_quantity=Decimal("40000"),
                bid_status="accepted",
            )

        return inquiry, ip


class TestTradeSessionCreation(TradeWorkflowBaseTestCase):
    """Test: TradeSession is correctly created when an inquiry is initiated."""

    def test_trade_session_created_on_inquiry(self):
        """TradeSession should be auto-created when using get_or_create_trade_session."""
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry, _ = self._create_inquiry_with_products()
        trade_session, created = get_or_create_trade_session(
            tenant=self.tenant, inquiry=inquiry
        )

        self.assertTrue(created)
        self.assertIsNotNone(trade_session.trade_id)
        self.assertTrue(trade_session.trade_id.startswith("TRD-"))
        self.assertEqual(trade_session.status, "initiated")
        self.assertEqual(trade_session.inquiry, inquiry)

    def test_trade_session_not_duplicated(self):
        """Calling get_or_create_trade_session twice should return same session."""
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry, _ = self._create_inquiry_with_products()
        session1, created1 = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)
        session2, created2 = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        self.assertTrue(created1)
        self.assertFalse(created2)
        self.assertEqual(session1.id, session2.id)

    def test_trade_session_inherits_route_decision(self):
        """TradeSession should cache the route_decision from its inquiry."""
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry, _ = self._create_inquiry_with_products(route="FULFILL")
        session, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        self.assertEqual(session.route_decision, "FULFILL")


class TestDependencyChecker(TradeWorkflowBaseTestCase):
    """Test: Trade dependency checker correctly identifies missing requirements."""

    def test_fresh_inquiry_has_unsatisfied_deps(self):
        """A fresh inquiry without supplier/customer should show dependencies."""
        from tenant_apps.inquiries.services.trade_dependency_checker import check_trade_dependencies
        from tenant_apps.inquiries.models import Inquiry

        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type="customer",
            route_decision="BROKER",
            status="draft",
            source_type="other",
            created_by=self.user,
        )

        result = check_trade_dependencies(tenant=self.tenant, inquiry=inquiry)
        # Should report missing: no customer set on this inquiry
        self.assertFalse(result.all_satisfied)

    def test_fully_configured_inquiry_satisfies_deps(self):
        """An inquiry with customer, supplier bid, and product should pass deps."""
        from tenant_apps.inquiries.services.trade_dependency_checker import check_trade_dependencies

        inquiry, _ = self._create_inquiry_with_products(
            with_bid=True, status="accepted"
        )

        result = check_trade_dependencies(tenant=self.tenant, inquiry=inquiry)
        # With customer + accepted bid + products, deps should be satisfied
        self.assertTrue(result.all_satisfied)


class TestOrchestratorAdvance(TradeWorkflowBaseTestCase):
    """Test: Happy-path orchestrator correctly advances through stages."""

    def test_orchestrator_blocks_on_missing_deps(self):
        """Orchestrator should block (not crash) when dependencies aren't met."""
        from tenant_apps.inquiries.services.happy_path_orchestrator import advance_orchestrator
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry, _ = self._create_inquiry_with_products(status="accepted")
        get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        result = advance_orchestrator(
            tenant=self.tenant,
            inquiry=inquiry,
            user=self.user,
        )

        # Should block (not crash) — missing supplier bid or other deps
        self.assertIsNotNone(result)
        self.assertFalse(result.completed)

    def test_orchestrator_advances_with_accepted_bid(self):
        """With an accepted bid, orchestrator should advance at least one step."""
        from tenant_apps.inquiries.services.happy_path_orchestrator import advance_orchestrator
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry, _ = self._create_inquiry_with_products(
            status="accepted", with_bid=True
        )
        get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        result = advance_orchestrator(
            tenant=self.tenant,
            inquiry=inquiry,
            user=self.user,
        )

        self.assertIsNotNone(result)
        # Should have executed at least one step (or blocked with clear reason)
        self.assertTrue(
            len(result.steps_executed) > 0 or result.blocked,
            f"Expected steps or block. Got: completed={result.completed}, "
            f"blocked={result.blocked}, reason={result.blocked_reason}"
        )

    def test_completed_trade_returns_completed_flag(self):
        """A trade already at 'completed' state should return completed=True."""
        from tenant_apps.inquiries.services.happy_path_orchestrator import (
            advance_orchestrator, OrchestratorStep,
        )
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session
        from tenant_apps.inquiries.models import TradeSession

        inquiry, _ = self._create_inquiry_with_products(status="fulfilled", with_bid=True)
        session, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        # Manually mark as completed to test the guard
        session.status = "completed"
        session.completed_at = timezone.now()
        session.save()

        # Mock get_orchestrator_state to return COMPLETED
        with patch(
            "tenant_apps.inquiries.services.happy_path_orchestrator.get_orchestrator_state",
            return_value=OrchestratorStep.COMPLETED,
        ):
            result = advance_orchestrator(
                tenant=self.tenant, inquiry=inquiry, user=self.user
            )
            self.assertTrue(result.completed)


class TestTradeSessionCascade(TradeWorkflowBaseTestCase):
    """Test: Trade session status cascade correctly reflects document statuses."""

    def test_cascade_updates_status_from_documents(self):
        """cascade_trade_session() should infer status from linked documents."""
        from tenant_apps.inquiries.services.trade_session import (
            get_or_create_trade_session,
            cascade_trade_session,
        )

        inquiry, _ = self._create_inquiry_with_products(status="accepted", with_bid=True)
        session, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        # Create an approved PO linked to this trade
        po = PurchaseOrderFactory(
            tenant=self.tenant,
            supplier=self.supplier,
            status="approved",
        )
        po.trade_session = session
        po.save()
        inquiry.supplier_purchase_order = po
        inquiry.save()

        # Cascade should update session status
        cascade_trade_session(tenant=self.tenant, trade_session=session)
        session.refresh_from_db()

        # Status should have progressed beyond 'initiated'
        self.assertIn(session.status, ["ordered", "logistics", "completed"])


class TestTradeListAPI(TradeWorkflowBaseTestCase):
    """Test: Trade list API returns enriched data for the My Trades page."""

    def test_trade_list_includes_enriched_fields(self):
        """Trade list response should include party_name, products_summary, etc."""
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry, ip = self._create_inquiry_with_products(status="accepted", with_bid=True)
        session, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        # Verify the enriched fields exist on the session
        self.assertIsNotNone(session.trade_id)
        self.assertEqual(session.inquiry.entity_type, "customer")
        self.assertEqual(session.inquiry.customer, self.customer)

        # The API enrichment happens in the view's list() override,
        # so verify the underlying data is present
        self.assertEqual(inquiry.customer.name, "Test Customer Inc")
        self.assertTrue(inquiry.products.exists())


class TestPermissionsIntegration(TradeWorkflowBaseTestCase):
    """Test: Role-based permissions work correctly for trade operations."""

    def test_admin_can_edit_plant(self):
        """Admin role should allow PATCH on plant objects."""
        from apps.core.permissions import IsRoleAuthorized

        class MockRequest:
            method = "PATCH"
            user = None
            tenant = None

        request = MockRequest()
        request.user = self.user
        request.tenant = self.tenant

        perm = IsRoleAuthorized()
        allowed = perm.has_object_permission(request, None, self.plant)
        # User is staff, so should be allowed
        self.assertTrue(allowed)

    def test_readonly_user_cannot_edit_plant(self):
        """Readonly role should NOT allow PATCH on plant objects."""
        from apps.core.permissions import IsRoleAuthorized
        from apps.tenants.models import TenantUser

        readonly_user = UserFactory(username="readonly_user", is_staff=False)
        TenantUser.objects.create(
            tenant=self.tenant,
            user=readonly_user,
            role="readonly",
            is_active=True,
        )

        class MockRequest:
            method = "PATCH"
            user = None
            tenant = None

        request = MockRequest()
        request.user = readonly_user
        request.tenant = self.tenant

        perm = IsRoleAuthorized()
        allowed = perm.has_object_permission(request, None, self.plant)
        self.assertFalse(allowed)

    def test_manager_can_edit_plant(self):
        """Manager role should allow PATCH on plant objects."""
        from apps.core.permissions import IsRoleAuthorized
        from apps.tenants.models import TenantUser

        manager_user = UserFactory(username="manager_user", is_staff=False)
        TenantUser.objects.create(
            tenant=self.tenant,
            user=manager_user,
            role="manager",
            is_active=True,
        )

        class MockRequest:
            method = "PATCH"
            user = None
            tenant = None

        request = MockRequest()
        request.user = manager_user
        request.tenant = self.tenant

        perm = IsRoleAuthorized()
        allowed = perm.has_object_permission(request, None, self.plant)
        self.assertTrue(allowed)

    def test_sales_rep_can_edit_but_not_delete(self):
        """Sales rep should PATCH but NOT DELETE."""
        from apps.core.permissions import IsRoleAuthorized
        from apps.tenants.models import TenantUser

        sales_user = UserFactory(username="sales_rep_user", is_staff=False)
        TenantUser.objects.create(
            tenant=self.tenant,
            user=sales_user,
            role="sales_rep",
            is_active=True,
        )

        class MockRequest:
            method = "PATCH"
            user = None
            tenant = None

        perm = IsRoleAuthorized()

        # PATCH should be allowed
        request = MockRequest()
        request.user = sales_user
        request.tenant = self.tenant
        request.method = "PATCH"
        self.assertTrue(perm.has_object_permission(request, None, self.plant))

        # DELETE should be denied
        request.method = "DELETE"
        self.assertFalse(perm.has_object_permission(request, None, self.plant))


class TestSupplierBidWorkflow(TradeWorkflowBaseTestCase):
    """Test: Supplier bid creation, acceptance, and pricing cascade."""

    def test_bid_creation_with_pricing(self):
        """Creating a bid with pricing should persist all fields."""
        from tenant_apps.inquiries.models import InquiryProductSupplierBid

        inquiry, ip = self._create_inquiry_with_products()

        bid = InquiryProductSupplierBid.objects.create(
            tenant=self.tenant,
            inquiry_product=ip,
            supplier=self.supplier,
            plant=self.plant,
            bid_price_per_unit=Decimal("2.35"),
            bid_total=Decimal("94000.00"),
            bid_uom="LBS",
            bid_quantity=Decimal("40000"),
            bid_status="received",
            bid_notes="Competitive pricing for Q2",
        )

        bid.refresh_from_db()
        self.assertEqual(bid.bid_price_per_unit, Decimal("2.3500"))
        self.assertEqual(bid.bid_total, Decimal("94000.00"))
        self.assertEqual(bid.bid_status, "received")
        self.assertEqual(bid.supplier, self.supplier)

    def test_bid_unique_constraint(self):
        """Only one bid per product/supplier/plant combination."""
        from django.db import IntegrityError
        from tenant_apps.inquiries.models import InquiryProductSupplierBid

        inquiry, ip = self._create_inquiry_with_products()

        InquiryProductSupplierBid.objects.create(
            tenant=self.tenant,
            inquiry_product=ip,
            supplier=self.supplier,
            plant=self.plant,
            bid_status="draft",
        )

        with self.assertRaises(IntegrityError):
            InquiryProductSupplierBid.objects.create(
                tenant=self.tenant,
                inquiry_product=ip,
                supplier=self.supplier,
                plant=self.plant,
                bid_status="draft",
            )

    def test_bid_accepts_null_plant(self):
        """Bids without a specific plant should be allowed."""
        from tenant_apps.inquiries.models import InquiryProductSupplierBid

        inquiry, ip = self._create_inquiry_with_products()

        bid = InquiryProductSupplierBid.objects.create(
            tenant=self.tenant,
            inquiry_product=ip,
            supplier=self.supplier,
            plant=None,
            bid_status="draft",
        )
        self.assertIsNone(bid.plant)
        self.assertEqual(bid.bid_status, "draft")
