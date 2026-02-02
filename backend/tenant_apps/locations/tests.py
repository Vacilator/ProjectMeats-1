"""
Tests for Locations app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from tenant_apps.locations.models import Location
from tenant_apps.suppliers.models import Supplier
from tenant_apps.customers.models import Customer
from apps.tenants.models import Tenant, TenantUser


class LocationModelTest(TestCase):
    """Test cases for Location model."""

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
            tenant=self.tenant,
        )
        self.customer = Customer.objects.create(
            name=f"Test Customer {unique_id}",
            tenant=self.tenant,
        )

    def test_create_location(self):
        """Test creating a location."""
        unique_id = uuid.uuid4().hex[:8]
        location = Location.objects.create(
            name=f"Warehouse {unique_id}",
            code=f"WH-{unique_id}",
            location_type="warehouse",
            address="123 Main St",
            city="Chicago",
            state="IL",
            zip_code="60601",
            country="USA",
            tenant=self.tenant,
        )
        
        self.assertEqual(location.name, f"Warehouse {unique_id}")
        self.assertEqual(location.code, f"WH-{unique_id}")
        self.assertEqual(location.location_type, "warehouse")
        self.assertEqual(location.city, "Chicago")
        self.assertEqual(location.tenant, self.tenant)

    def test_location_str_representation(self):
        """Test the string representation of a location."""
        unique_id = uuid.uuid4().hex[:8]
        location = Location.objects.create(
            name=f"Distribution Center {unique_id}",
            city="Dallas",
            tenant=self.tenant,
        )
        
        self.assertIn("Distribution Center", str(location))
        self.assertIn("Dallas", str(location))

    def test_location_with_supplier(self):
        """Test creating a location associated with a supplier."""
        unique_id = uuid.uuid4().hex[:8]
        location = Location.objects.create(
            name=f"Supplier Warehouse {unique_id}",
            supplier=self.supplier,
            city="Houston",
            tenant=self.tenant,
        )
        
        self.assertEqual(location.supplier, self.supplier)
        self.assertIn(location, self.supplier.supplier_locations.all())

    def test_location_with_customer(self):
        """Test creating a location associated with a customer."""
        unique_id = uuid.uuid4().hex[:8]
        location = Location.objects.create(
            name=f"Customer Store {unique_id}",
            customer=self.customer,
            city="Austin",
            tenant=self.tenant,
        )
        
        self.assertEqual(location.customer, self.customer)
        self.assertIn(location, self.customer.customer_locations.all())

    def test_location_tenant_isolation(self):
        """Test that locations are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create location for first tenant
        loc1 = Location.objects.create(
            name=f"Location 1 {unique_id}",
            city="Phoenix",
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
        
        # Create location for second tenant
        loc2 = Location.objects.create(
            name=f"Location 2 {unique_id}",
            city="Denver",
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_locations = Location.objects.for_tenant(self.tenant)
        tenant2_locations = Location.objects.for_tenant(other_tenant)
        
        self.assertEqual(tenant1_locations.count(), 1)
        self.assertEqual(tenant2_locations.count(), 1)
        self.assertIn(loc1, tenant1_locations)
        self.assertNotIn(loc2, tenant1_locations)

    def test_location_contact_info(self):
        """Test location with contact information."""
        unique_id = uuid.uuid4().hex[:8]
        location = Location.objects.create(
            name=f"Office {unique_id}",
            phone="555-123-4567",
            email=f"office-{unique_id}@test.com",
            contact_name="John Smith",
            tenant=self.tenant,
        )
        
        self.assertEqual(location.phone, "555-123-4567")
        self.assertEqual(location.contact_name, "John Smith")
        self.assertTrue(location.is_active)
