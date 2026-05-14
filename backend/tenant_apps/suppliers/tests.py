"""
Tests for Suppliers API endpoints.

Validates supplier creation, validation, tenant isolation, and error handling.
Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from tenant_apps.suppliers.models import Supplier
from apps.tenants.models import Tenant, TenantUser


class SupplierAPITests(APITestCase):
    """Test cases for Supplier API endpoints."""

    def setUp(self):
        """Set up test data."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}", 
            email=f"test-{unique_id}@example.com", 
            password="testpass123"
        )
        # Use session auth so TenantMiddleware can resolve X-Tenant-ID.
        self.client.force_login(self.user)

        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )

        # Associate user with tenant
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

    def test_create_supplier_success(self):
        """Test creating a supplier with valid data."""
        url = reverse("suppliers:supplier-list")
        data = {
            "name": "Test Supplier",
            "email": "supplier@example.com",
            "phone": "123-456-7890",
        }

        # Set tenant header
        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Supplier.objects.count(), 1)
        supplier = Supplier.objects.first()
        self.assertEqual(supplier.name, "Test Supplier")
        self.assertEqual(supplier.tenant, self.tenant)

    def test_create_supplier_without_name(self):
        """Test that creating a supplier without a name fails."""
        url = reverse("suppliers:supplier-list")
        data = {
            "email": "supplier@example.com",
            "phone": "123-456-7890",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Supplier.objects.count(), 0)

    def test_create_supplier_with_empty_name(self):
        """Test that creating a supplier with empty name fails."""
        url = reverse("suppliers:supplier-list")
        data = {
            "name": "",
            "email": "supplier@example.com",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Supplier.objects.count(), 0)

    def test_create_supplier_with_invalid_email(self):
        """Test that creating a supplier with invalid email fails."""
        url = reverse("suppliers:supplier-list")
        data = {
            "name": "Test Supplier",
            "email": "invalid-email",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Supplier.objects.count(), 0)

    def test_create_supplier_without_tenant(self):
        """
        Test that a single-membership user still gets the middleware safe default.

        TenantMiddleware may safely resolve the user's only active tenant when
        there is no ambiguity, so the create should still succeed without an
        explicit X-Tenant-ID header.
        """
        url = reverse("suppliers:supplier-list")
        data = {
            "name": "Test Supplier",
        }

        # Don't send tenant header - middleware should resolve the user's only tenant.
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Supplier.objects.count(), 1)
        supplier = Supplier.objects.first()
        self.assertEqual(supplier.name, "Test Supplier")
        self.assertEqual(supplier.tenant, self.tenant)

    def test_create_supplier_requires_explicit_tenant_when_multi_membership(self):
        """Test that ambiguous tenant context fails closed on create."""
        unique_id = uuid.uuid4().hex[:8]
        other_tenant = Tenant.objects.create(
            name=f"Other Company {unique_id}",
            slug=f"other-company-{unique_id}",
            contact_email=f"other-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=self.user, role="admin", is_active=True)

        url = reverse("suppliers:supplier-list")

        response = self.client.post(url, {"name": "Ambiguous Supplier"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Supplier.objects.count(), 0)
        self.assertEqual(response.data.get("error"), "Validation failed")
        self.assertIn(
            "Tenant context is required to create a supplier. Please ensure you are associated with a tenant.",
            response.data.get("details", []),
        )

        response = self.client.post(
            url,
            {"name": "Explicit Supplier"},
            HTTP_X_TENANT_ID=str(other_tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        supplier = Supplier.objects.get()
        self.assertEqual(supplier.name, "Explicit Supplier")
        self.assertEqual(supplier.tenant, other_tenant)
        
    def test_create_supplier_without_tenant_and_no_tenant_user(self):
        """Test that creating a supplier fails when user has no TenantUser association."""
        # Create a new user with no TenantUser association
        unique_id = uuid.uuid4().hex[:8]
        new_user = User.objects.create_user(
            username=f"newuser-{unique_id}", 
            email=f"newuser-{unique_id}@example.com", 
            password="testpass123"
        )
        # Use session auth so TenantMiddleware can resolve X-Tenant-ID.
        self.client.force_login(new_user)
        
        url = reverse("suppliers:supplier-list")
        data = {
            "name": "Test Supplier",
        }

        # Don't send tenant header and user has no TenantUser
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_list_suppliers_filtered_by_tenant(self):
        """Test that suppliers are filtered by tenant."""
        # Create supplier for this tenant
        Supplier.objects.create(name="Supplier 1", tenant=self.tenant)

        # Create another tenant and supplier
        unique_id = uuid.uuid4().hex[:8]
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
        Supplier.objects.create(name="Supplier 2", tenant=other_tenant)

        url = reverse("suppliers:supplier-list")
        response = self.client.get(url, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "Supplier 1")

    def test_retrieve_supplier_detail(self):
        """Test GET single supplier returns all expected fields."""
        supplier = Supplier.objects.create(
            name="Detail Supplier",
            email="detail@supplier.com",
            phone="555-9876",
            tenant=self.tenant,
        )

        response = self.client.get(
            f"/api/v1/suppliers/{supplier.id}/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Detail Supplier")
        self.assertEqual(response.data["email"], "detail@supplier.com")
        self.assertEqual(response.data["phone"], "555-9876")
        self.assertIn("id", response.data)
        self.assertIn("created_on", response.data)

    def test_update_supplier_success(self):
        """Test PATCH updates supplier name."""
        supplier = Supplier.objects.create(
            name="Old Supplier Name",
            tenant=self.tenant,
        )

        response = self.client.patch(
            f"/api/v1/suppliers/{supplier.id}/",
            {"name": "New Supplier Name"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        supplier.refresh_from_db()
        self.assertEqual(supplier.name, "New Supplier Name")

    def test_delete_supplier(self):
        """Test DELETE removes the supplier."""
        supplier = Supplier.objects.create(
            name="Delete Me",
            tenant=self.tenant,
        )

        response = self.client.delete(
            f"/api/v1/suppliers/{supplier.id}/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Supplier.objects.filter(id=supplier.id).exists())

    def test_cannot_access_other_tenant_supplier(self):
        """Test that accessing a supplier from another tenant returns 404."""
        unique_id = uuid.uuid4().hex[:8]
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
            name="Other Tenant Supplier",
            tenant=other_tenant,
        )

        response = self.client.get(
            f"/api/v1/suppliers/{other_supplier.id}/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_suppliers_with_search(self):
        """Test ?search= filters suppliers by name."""
        Supplier.objects.create(name="Alpha Meats", tenant=self.tenant)
        Supplier.objects.create(name="Beta Foods", tenant=self.tenant)
        Supplier.objects.create(name="Gamma Supply", tenant=self.tenant)

        url = reverse("suppliers:supplier-list")
        response = self.client.get(
            url,
            {"search": "Alpha"},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [s["name"] for s in response.data["results"]]
        self.assertIn("Alpha Meats", names)
        self.assertNotIn("Beta Foods", names)
        self.assertNotIn("Gamma Supply", names)

    def test_create_supplier_with_full_fields(self):
        """Test creating a supplier with contact_person, phone_mobile, phone_office."""
        url = reverse("suppliers:supplier-list")
        data = {
            "name": "Full Fields Supplier",
            "email": "full@supplier.com",
            "contact_person": "John Doe",
            "phone_mobile": "555-1111",
            "phone_office": "555-2222",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        supplier = Supplier.objects.get(name="Full Fields Supplier")
        self.assertEqual(supplier.contact_person, "John Doe")
        self.assertEqual(supplier.phone_mobile, "555-1111")
        self.assertEqual(supplier.phone_office, "555-2222")
