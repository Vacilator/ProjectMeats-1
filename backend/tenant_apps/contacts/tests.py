"""
Tests for Contacts API endpoints.

Validates contact creation, validation, tenant isolation, and error handling.
Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from tenant_apps.contacts.models import Contact
from apps.tenants.models import Tenant, TenantUser


class ContactAPITests(APITestCase):
    """Test cases for Contact API endpoints."""

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

    def test_create_contact_success(self):
        """Test creating a contact with valid data."""
        url = reverse("contacts:contact-list")
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "phone": "123-456-7890",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Contact.objects.count(), 1)
        contact = Contact.objects.first()
        self.assertEqual(contact.first_name, "John")
        self.assertEqual(contact.last_name, "Doe")
        self.assertEqual(contact.tenant, self.tenant)

    def test_create_contact_without_first_name(self):
        """Test that creating a contact without first name fails."""
        url = reverse("contacts:contact-list")
        data = {
            "last_name": "Doe",
            "email": "john.doe@example.com",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Contact.objects.count(), 0)

    def test_create_contact_without_last_name(self):
        """Test that creating a contact without last name fails."""
        url = reverse("contacts:contact-list")
        data = {
            "first_name": "John",
            "email": "john.doe@example.com",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Contact.objects.count(), 0)

    def test_create_contact_with_invalid_email(self):
        """Test that creating a contact with invalid email fails."""
        url = reverse("contacts:contact-list")
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "invalid-email",
        }

        response = self.client.post(url, data, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Contact.objects.count(), 0)
