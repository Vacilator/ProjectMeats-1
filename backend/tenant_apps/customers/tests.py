"""
Tests for Customers API endpoints.

Validates customer creation, validation, tenant isolation, and error handling.
Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from tenant_apps.customers.models import Customer
from apps.tenants.models import Tenant, TenantUser


class CustomerAPITests(APITestCase):
    """Test cases for Customer API endpoints."""

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

    def test_create_customer_success(self):
        """Test creating a customer with valid data."""
        url = reverse("customers:customer-list")
        data = {
            "name": "Test Customer",
            "email": "customer@example.com",
            "phone": "123-456-7890",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Customer.objects.count(), 1)
        customer = Customer.objects.first()
        self.assertEqual(customer.name, "Test Customer")
        self.assertEqual(customer.tenant, self.tenant)

    def test_create_customer_without_name(self):
        """Test that creating a customer without a name fails."""
        url = reverse("customers:customer-list")
        data = {
            "email": "customer@example.com",
            "phone": "123-456-7890",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Customer.objects.count(), 0)

    def test_create_customer_with_invalid_email(self):
        """Test that creating a customer with invalid email fails."""
        url = reverse("customers:customer-list")
        data = {
            "name": "Test Customer",
            "email": "invalid-email",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Customer.objects.count(), 0)


class CustomerRLSMigrationTest(TestCase):
    """Tests that verify RLS migration SQL is correctly defined for Customer."""

    def test_rls_migration_exists(self):
        """Verify the RLS migration file exists for customers."""
        import os
        migration_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'customers',
            'migrations',
            '0010_add_rls_policies_batch.py',
        )
        self.assertTrue(
            os.path.exists(migration_path),
            "RLS migration file 0010_add_rls_policies_batch.py must exist for customers",
        )

    def test_rls_migration_enables_rls_on_customer(self):
        """Verify the RLS migration enables row-level security on customers_customer."""
        import os
        migration_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'customers',
            'migrations',
            '0010_add_rls_policies_batch.py',
        )
        with open(migration_path) as f:
            content = f.read()
        self.assertIn('ENABLE ROW LEVEL SECURITY', content)
        self.assertIn('customers_customer', content)
        self.assertIn('customer_tenant_isolation', content)
        self.assertIn("app.current_tenant", content)

    def test_rls_migration_has_insert_policy(self):
        """Verify the RLS migration creates an INSERT policy."""
        import os
        migration_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'customers',
            'migrations',
            '0010_add_rls_policies_batch.py',
        )
        with open(migration_path) as f:
            content = f.read()
        self.assertIn('customer_tenant_insert', content)
        self.assertIn('FOR INSERT', content)
        self.assertIn('WITH CHECK', content)


class CustomerAPIExtendedTests(APITestCase):
    """Extended API tests for Customer CRUD, tenant isolation, and search."""

    def setUp(self):
        """Set up test data."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        self.client.force_login(self.user)

        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

    def test_list_customers_filtered_by_tenant(self):
        """Test that list returns only the requesting tenant's customers."""
        Customer.objects.create(name="Own Customer", tenant=self.tenant)

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
        Customer.objects.create(name="Other Customer", tenant=other_tenant)

        url = reverse("customers:customer-list")
        response = self.client.get(url, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "Own Customer")

    def test_retrieve_customer_detail(self):
        """Test GET single customer returns all expected fields."""
        customer = Customer.objects.create(
            name="Detail Customer",
            email="detail@example.com",
            phone="555-1234",
            tenant=self.tenant,
        )

        response = self.client.get(
            f"/api/v1/customers/{customer.id}/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Detail Customer")
        self.assertEqual(response.data["email"], "detail@example.com")
        self.assertEqual(response.data["phone"], "555-1234")
        self.assertIn("id", response.data)
        self.assertIn("created_on", response.data)

    def test_update_customer_success(self):
        """Test PATCH updates customer name and email."""
        customer = Customer.objects.create(
            name="Old Name",
            email="old@example.com",
            tenant=self.tenant,
        )

        response = self.client.patch(
            f"/api/v1/customers/{customer.id}/",
            {"name": "New Name", "email": "new@example.com"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertEqual(customer.name, "New Name")
        self.assertEqual(customer.email, "new@example.com")

    def test_delete_customer(self):
        """Test DELETE removes the customer."""
        customer = Customer.objects.create(
            name="Delete Me",
            tenant=self.tenant,
        )

        response = self.client.delete(
            f"/api/v1/customers/{customer.id}/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Customer.objects.filter(id=customer.id).exists())

    def test_cannot_access_other_tenant_customer(self):
        """Test that accessing a customer from another tenant returns 404."""
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
        other_customer = Customer.objects.create(
            name="Other Tenant Customer",
            tenant=other_tenant,
        )

        response = self.client.get(
            f"/api/v1/customers/{other_customer.id}/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_customers_with_search(self):
        """Test ?search= filters customers by name."""
        Customer.objects.create(name="Alpha Corp", tenant=self.tenant)
        Customer.objects.create(name="Beta Corp", tenant=self.tenant)
        Customer.objects.create(name="Gamma Ltd", tenant=self.tenant)

        url = reverse("customers:customer-list")
        response = self.client.get(
            url,
            {"search": "Alpha"},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in response.data["results"]]
        self.assertIn("Alpha Corp", names)
        self.assertNotIn("Beta Corp", names)
        self.assertNotIn("Gamma Ltd", names)

    def test_create_customer_with_full_fields(self):
        """Test creating a customer with industry, contact_title, and phone."""
        url = reverse("customers:customer-list")
        data = {
            "name": "Full Fields Customer",
            "email": "full@example.com",
            "phone": "555-0001",
            "industry": "Pet Sector",
            "contact_title": "Vice President",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        customer = Customer.objects.get(name="Full Fields Customer")
        self.assertEqual(customer.email, "full@example.com")
        self.assertEqual(customer.phone, "555-0001")
        self.assertEqual(customer.industry, "Pet Sector")
        self.assertEqual(customer.contact_title, "Vice President")
