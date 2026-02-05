"""
Tests for Fulfillments app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from datetime import date
from tenant_apps.fulfillments.models import Fulfillment, FulfillmentStatusChoices
from tenant_apps.suppliers.models import Supplier
from tenant_apps.customers.models import Customer
from tenant_apps.carriers.models import Carrier
from tenant_apps.inquiries.models import Inquiry, InquiryStatusChoices, InquiryEntityTypeChoices
from apps.tenants.models import Tenant, TenantUser


class FulfillmentModelTest(TestCase):
    """Test cases for Fulfillment model."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data shared across all tests in this class."""
        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="owner")
        
        cls.supplier = Supplier.objects.create(
            name=f"Test Supplier {unique_id}",
            tenant=cls.tenant,
        )
        cls.customer = Customer.objects.create(
            name=f"Test Customer {unique_id}",
            tenant=cls.tenant,
        )
        cls.carrier = Carrier.objects.create(
            name=f"Test Carrier {unique_id}",
            code=f"TC-{unique_id[:4]}",
            tenant=cls.tenant,
        )
        
        # Create inquiry for fulfillment tests
        cls.inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=cls.customer,
            status=InquiryStatusChoices.ACCEPTED,
            tenant=cls.tenant,
        )

    def test_create_fulfillment(self):
        """Test creating a fulfillment."""
        fulfillment = Fulfillment.objects.create(
            inquiry=self.inquiry,
            supplier=self.supplier,
            customer=self.customer,
            carrier=self.carrier,
            status=FulfillmentStatusChoices.PENDING,
            tenant=self.tenant,
        )
        
        self.assertIsNotNone(fulfillment.fulfillment_number)
        self.assertTrue(fulfillment.fulfillment_number.startswith("FUL-"))
        self.assertEqual(fulfillment.status, "pending")
        self.assertEqual(fulfillment.tenant, self.tenant)

    def test_fulfillment_auto_number_generation(self):
        """Test auto-generation of fulfillment numbers."""
        f1 = Fulfillment.objects.create(
            inquiry=self.inquiry,
            tenant=self.tenant,
        )
        f2 = Fulfillment.objects.create(
            inquiry=self.inquiry,
            tenant=self.tenant,
        )
        
        # Both should have unique fulfillment numbers
        self.assertNotEqual(f1.fulfillment_number, f2.fulfillment_number)
        # Both should follow the pattern
        self.assertRegex(f1.fulfillment_number, r"FUL-\d{4}-\d{5}")
        self.assertRegex(f2.fulfillment_number, r"FUL-\d{4}-\d{5}")

    def test_fulfillment_status_choices(self):
        """Test different fulfillment statuses."""
        for status in [FulfillmentStatusChoices.PENDING, FulfillmentStatusChoices.SHIPPED]:
            fulfillment = Fulfillment.objects.create(
                inquiry=self.inquiry,
                status=status,
                tenant=self.tenant,
            )
            self.assertEqual(fulfillment.status, status)

    def test_fulfillment_with_dates(self):
        """Test fulfillment with shipping dates."""
        fulfillment = Fulfillment.objects.create(
            inquiry=self.inquiry,
            ship_date=date.today(),
            expected_delivery=date(2026, 2, 10),
            tenant=self.tenant,
        )
        
        self.assertEqual(fulfillment.ship_date, date.today())
        self.assertEqual(fulfillment.expected_delivery, date(2026, 2, 10))

    def test_fulfillment_with_tracking_numbers(self):
        """Test fulfillment with multiple tracking numbers."""
        tracking = ["TRACK123", "TRACK456", "TRACK789"]
        fulfillment = Fulfillment.objects.create(
            inquiry=self.inquiry,
            tracking_numbers=tracking,
            tenant=self.tenant,
        )
        
        self.assertEqual(fulfillment.tracking_numbers, tracking)
        self.assertEqual(len(fulfillment.tracking_numbers), 3)

    def test_fulfillment_tenant_isolation(self):
        """Test that fulfillments are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create fulfillment for first tenant
        f1 = Fulfillment.objects.create(
            inquiry=self.inquiry,
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
        other_customer = Customer.objects.create(
            name=f"Other Customer {unique_id}",
            tenant=other_tenant,
        )
        other_inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=other_customer,
            tenant=other_tenant,
        )
        
        # Create fulfillment for second tenant
        f2 = Fulfillment.objects.create(
            inquiry=other_inquiry,
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_fulfillments = Fulfillment.objects.for_tenant(self.tenant)
        tenant2_fulfillments = Fulfillment.objects.for_tenant(other_tenant)
        
        self.assertEqual(tenant1_fulfillments.count(), 1)
        self.assertEqual(tenant2_fulfillments.count(), 1)
        self.assertIn(f1, tenant1_fulfillments)
        self.assertNotIn(f2, tenant1_fulfillments)

    def test_fulfillment_str_representation(self):
        """Test string representation of fulfillment."""
        fulfillment = Fulfillment.objects.create(
            inquiry=self.inquiry,
            tenant=self.tenant,
        )
        
        self.assertIn(fulfillment.fulfillment_number, str(fulfillment))
        self.assertIn(self.inquiry.inquiry_number, str(fulfillment))

    def test_fulfillment_with_carrier(self):
        """Test fulfillment with carrier relationship."""
        fulfillment = Fulfillment.objects.create(
            inquiry=self.inquiry,
            carrier=self.carrier,
            tenant=self.tenant,
        )
        
        self.assertEqual(fulfillment.carrier, self.carrier)
        self.assertIn(fulfillment, self.carrier.fulfillments.all())
