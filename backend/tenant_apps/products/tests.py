"""
Tests for Products app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from tenant_apps.products.models import Product
from tenant_apps.suppliers.models import Supplier
from apps.tenants.models import Tenant, TenantUser
from apps.core.models import (
    CartonTypeChoices,
    EdibleInedibleChoices,
    FreshOrFrozenChoices,
    OriginChoices,
    PackageTypeChoices,
    ProteinTypeChoices,
)


class ProductModelTest(TestCase):
    """Test cases for Product model."""

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

    def test_create_product(self):
        """Test creating a product."""
        unique_id = uuid.uuid4().hex[:8]
        product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            description_of_product_item="Test Beef Product",
            type_of_protein=ProteinTypeChoices.BEEF,
            fresh_or_frozen=FreshOrFrozenChoices.FROZEN,
            package_type=PackageTypeChoices.BOXED_WAX_LINED,
            tested_product=True,
            is_active=True,
            tenant=self.tenant,
        )
        
        self.assertEqual(product.product_code, f"TEST-{unique_id}")
        self.assertEqual(product.type_of_protein, "Beef")
        self.assertTrue(product.tested_product)
        self.assertTrue(product.is_active)

    def test_product_str_representation(self):
        """Test the string representation of a product."""
        unique_id = uuid.uuid4().hex[:8]
        product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            description_of_product_item="Test Chicken Product",
            tenant=self.tenant,
        )
        
        self.assertIn(f"TEST-{unique_id}", str(product))
        self.assertIn("Test Chicken Product", str(product))

    def test_product_with_supplier(self):
        """Test creating a product with supplier relationship."""
        unique_id = uuid.uuid4().hex[:8]
        product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            description_of_product_item="Test Product with Supplier",
            supplier=self.supplier,
            supplier_item_number=f"SUP-{unique_id}",
            plants_available="TX, WI, MI",
            origin=OriginChoices.DOMESTIC,
            tenant=self.tenant,
        )
        
        self.assertEqual(product.supplier, self.supplier)
        self.assertEqual(product.supplier_item_number, f"SUP-{unique_id}")
        self.assertEqual(product.plants_available, "TX, WI, MI")
        self.assertEqual(product.origin, "Domestic")

    def test_product_packaging_details(self):
        """Test product with packaging details from Excel schema."""
        unique_id = uuid.uuid4().hex[:8]
        product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            description_of_product_item="BF Trim 50's - TESTED",
            type_of_protein=ProteinTypeChoices.BEEF,
            fresh_or_frozen=FreshOrFrozenChoices.FRESH,
            carton_type=CartonTypeChoices.WAXED_LINED,
            pcs_per_carton="4/10",
            uom="LB",
            edible_or_inedible=EdibleInedibleChoices.EDIBLE,
            tested_product=True,
            tenant=self.tenant,
        )
        
        self.assertEqual(product.carton_type, "Waxed Lined")
        self.assertEqual(product.pcs_per_carton, "4/10")
        self.assertEqual(product.uom, "LB")
        self.assertTrue(product.tested_product)

    def test_product_codes(self):
        """Test product with NAMP, USDA, and UB codes."""
        unique_id = uuid.uuid4().hex[:8]
        product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            description_of_product_item="Test Product with Codes",
            namp="82265",
            usda="USDA123",
            ub="UB456",
            tenant=self.tenant,
        )
        
        self.assertEqual(product.namp, "82265")
        self.assertEqual(product.usda, "USDA123")
        self.assertEqual(product.ub, "UB456")

    def test_product_unit_weight(self):
        """Test product with unit weight."""
        unique_id = uuid.uuid4().hex[:8]
        product = Product.objects.create(
            product_code=f"TEST-{unique_id}",
            description_of_product_item="Test Product with Weight",
            unit_weight=Decimal("50.25"),
            tenant=self.tenant,
        )
        
        self.assertEqual(product.unit_weight, Decimal("50.25"))

    def test_product_tenant_isolation(self):
        """Test that products are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create product for first tenant
        product1 = Product.objects.create(
            product_code=f"TEST-{unique_id}-1",
            description_of_product_item="Product for Tenant 1",
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
        
        # Create product for second tenant
        product2 = Product.objects.create(
            product_code=f"TEST-{unique_id}-2",
            description_of_product_item="Product for Tenant 2",
            tenant=other_tenant,
        )
        
        # Verify tenant isolation using for_tenant manager
        tenant1_products = Product.objects.for_tenant(self.tenant)
        tenant2_products = Product.objects.for_tenant(other_tenant)
        
        self.assertEqual(tenant1_products.count(), 1)
        self.assertEqual(tenant2_products.count(), 1)
        self.assertEqual(tenant1_products.first().description_of_product_item, "Product for Tenant 1")
        self.assertEqual(tenant2_products.first().description_of_product_item, "Product for Tenant 2")


