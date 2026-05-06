"""
Tests for Sales Orders app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from datetime import date
from django.test import TestCase
from django.contrib.auth.models import User
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderItem, SalesOrderStatus
from tenant_apps.sales_orders.serializers import SalesOrderSerializer
from tenant_apps.suppliers.models import Supplier
from tenant_apps.customers.models import Customer
from apps.tenants.models import Tenant, TenantUser
from apps.core.models import WeightUnitChoices


class SalesOrderModelTest(TestCase):
    """Test cases for SalesOrder model."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        
        self.supplier = Supplier.objects.create(
            name=f"Test Supplier {unique_id}",
            email=f"supplier-{unique_id}@test.com",
            tenant=self.tenant,
        )
        self.customer = Customer.objects.create(
            name=f"Test Customer {unique_id}",
            email=f"customer-{unique_id}@test.com",
            tenant=self.tenant,
        )

    def test_create_sales_order(self):
        """Test creating a sales order."""
        unique_id = uuid.uuid4().hex[:8]
        sales_order = SalesOrder.objects.create(
            our_sales_order_num=f"SO-{unique_id}",
            supplier=self.supplier,
            customer=self.customer,
            status=SalesOrderStatus.PENDING,
            quantity=100,
            total_weight=1000.50,
            weight_unit=WeightUnitChoices.LBS,
            tenant=self.tenant,
        )
        
        self.assertEqual(sales_order.our_sales_order_num, f"SO-{unique_id}")
        self.assertEqual(sales_order.supplier, self.supplier)
        self.assertEqual(sales_order.customer, self.customer)
        self.assertEqual(sales_order.status, "pending")
        self.assertEqual(sales_order.tenant, self.tenant)

    def test_sales_order_str_representation(self):
        """Test the string representation of a sales order."""
        unique_id = uuid.uuid4().hex[:8]
        sales_order = SalesOrder.objects.create(
            our_sales_order_num=f"SO-{unique_id}",
            supplier=self.supplier,
            customer=self.customer,
            tenant=self.tenant,
        )
        
        self.assertEqual(str(sales_order), f"SO-SO-{unique_id}")

    def test_sales_order_tenant_isolation(self):
        """Test that sales orders are isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create sales order for first tenant
        so1 = SalesOrder.objects.create(
            our_sales_order_num=f"SO1-{unique_id}",
            supplier=self.supplier,
            customer=self.customer,
            tenant=self.tenant,
        )
        
        # Create second tenant
        other_user = User.objects.create_user(
            username=f"otheruser-{unique_id}",
            email=f"other-{unique_id}@example.com",
            password="testpass123"
        )
        other_tenant = Tenant.objects.create(
            name=f"Other Company {unique_id}",
            slug=f"other-company-{unique_id}",
            contact_email=f"admin-{unique_id}@othercompany.com",
            created_by=other_user,
        )
        other_supplier = Supplier.objects.create(
            name=f"Other Supplier {unique_id}",
            tenant=other_tenant,
        )
        other_customer = Customer.objects.create(
            name=f"Other Customer {unique_id}",
            tenant=other_tenant,
        )
        
        # Create sales order for second tenant
        so2 = SalesOrder.objects.create(
            our_sales_order_num=f"SO2-{unique_id}",
            supplier=other_supplier,
            customer=other_customer,
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_orders = SalesOrder.objects.for_tenant(self.tenant)
        tenant2_orders = SalesOrder.objects.for_tenant(other_tenant)
        
        self.assertEqual(tenant1_orders.count(), 1)
        self.assertEqual(tenant2_orders.count(), 1)
        self.assertIn(so1, tenant1_orders)
        self.assertNotIn(so2, tenant1_orders)

    def test_sales_order_alias_fields_sync(self):
        """Canonical customer-facing aliases sync with legacy fields."""
        unique_id = uuid.uuid4().hex[:8]
        sales_order = SalesOrder.objects.create(
            our_sales_order_number_for_customer=f"SO-CANON-{unique_id}",
            delivery_po_number=f"DPO-{unique_id}",
            supplier=self.supplier,
            customer=self.customer,
            tenant=self.tenant,
        )

        self.assertEqual(sales_order.our_sales_order_num, f"SO-CANON-{unique_id}")
        self.assertEqual(sales_order.delivery_po_num, f"DPO-{unique_id}")

    def test_sales_order_item_inherits_tenant(self):
        """Sales order items inherit their parent tenant."""
        unique_id = uuid.uuid4().hex[:8]
        sales_order = SalesOrder.objects.create(
            our_sales_order_num=f"SO-{unique_id}",
            supplier=self.supplier,
            customer=self.customer,
            tenant=self.tenant,
        )

        item = SalesOrderItem.objects.create(
            sales_order=sales_order,
            quantity=4,
        )

        self.assertEqual(item.tenant, self.tenant)
        self.assertEqual(item.sales_order, sales_order)

    def test_sales_order_serializer_exposes_trade_invariants(self):
        unique_id = uuid.uuid4().hex[:8]
        sales_order = SalesOrder.objects.create(
            our_sales_order_num=f"SO-{unique_id}",
            supplier=self.supplier,
            customer=self.customer,
            quantity=100,
            total_weight=1000.50,
            weight_unit=WeightUnitChoices.LBS,
            pick_up_date=date(2026, 1, 8),
            delivery_date=date(2026, 1, 9),
            tenant=self.tenant,
        )

        data = SalesOrderSerializer(sales_order).data

        self.assertEqual(data["trade_weight"]["entered_unit"], "LBS")
        self.assertEqual(data["trade_weight"]["normalized_kg"], "453.82")
        self.assertEqual(data["trade_timeline"]["date_fields"]["delivery_date"], "2026-01-09")
