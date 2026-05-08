import uuid

from django.contrib.auth.models import User
from django.test import TestCase

from tenant_apps.products.models import MasterProduct
from tenant_apps.suppliers.models import Supplier, SupplierAvailableItem

from apps.core.models import ProteinTypeChoices
from apps.core.services.inventory_availability import evaluate_inquiry_route
from apps.system.models import Product
from apps.tenants.models import Tenant, TenantUser


class InventoryAvailabilityRoutingTests(TestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"inventory-user-{unique_id}",
            email=f"inventory-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"Inventory Tenant {unique_id}",
            slug=f"inventory-tenant-{unique_id}",
            contact_email=f"inventory-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.system_product = Product.objects.create(
            product_code=f"BEEF-RIBEYE-{unique_id}",
            name="Ribeye",
            protein_type="beef",
            category="BEEF",
            is_active=True,
        )
        self.master_product = MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name="Ribeye",
            type="flat",
            trim="trimmed",
            system_product=self.system_product,
        )

    def test_mapped_active_supplier_availability_routes_fulfill(self):
        supplier = Supplier.objects.create(tenant=self.tenant, name="Available Supplier")
        SupplierAvailableItem.objects.create(
            tenant=self.tenant,
            supplier=supplier,
            product=self.system_product,
            is_active=True,
        )

        evaluation = evaluate_inquiry_route(
            tenant=self.tenant,
            requested_master_product=self.master_product,
            requested_protein=self.master_product.protein,
        )

        self.assertEqual(evaluation.route_decision, "FULFILL")
        self.assertEqual(evaluation.reason, "active_supplier_available_item_match")
        self.assertEqual(evaluation.available_supplier_count, 1)

    def test_missing_availability_routes_broker(self):
        evaluation = evaluate_inquiry_route(
            tenant=self.tenant,
            requested_master_product=self.master_product,
            requested_protein=self.master_product.protein,
        )

        self.assertEqual(evaluation.route_decision, "BROKER")
        self.assertEqual(evaluation.reason, "no_active_supplier_availability")

    def test_cross_tenant_availability_is_ignored(self):
        other_user = User.objects.create_user(
            username="inventory-other-user",
            email="inventory-other@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Inventory Other Tenant",
            slug="inventory-other-tenant",
            contact_email="inventory-other@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner")
        other_supplier = Supplier.objects.create(tenant=other_tenant, name="Other Supplier")
        SupplierAvailableItem.objects.create(
            tenant=other_tenant,
            supplier=other_supplier,
            product=self.system_product,
            is_active=True,
        )

        evaluation = evaluate_inquiry_route(
            tenant=self.tenant,
            requested_master_product=self.master_product,
            requested_protein=self.master_product.protein,
        )

        self.assertEqual(evaluation.route_decision, "BROKER")
        self.assertEqual(evaluation.reason, "no_active_supplier_availability")

    def test_missing_system_product_bridge_routes_broker(self):
        self.master_product.system_product = None
        self.master_product.save(update_fields=["system_product"])

        evaluation = evaluate_inquiry_route(
            tenant=self.tenant,
            requested_master_product=self.master_product,
            requested_protein=self.master_product.protein,
        )

        self.assertEqual(evaluation.route_decision, "BROKER")
        self.assertEqual(evaluation.reason, "unmapped_system_product")
