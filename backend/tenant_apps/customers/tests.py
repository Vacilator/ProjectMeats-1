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
        self.client.force_authenticate(user=self.user)

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
