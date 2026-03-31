"""
Tests for Inquiries app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from datetime import date, timedelta
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryStatusChoices,
    InquirySourceChoices,
    InquiryEntityTypeChoices,
    InquiryTemplate,
)
from tenant_apps.suppliers.models import Supplier
from tenant_apps.customers.models import Customer
from apps.tenants.models import Tenant, TenantUser


class InquiryModelTest(TestCase):
    """Test cases for Inquiry model."""

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

    def test_create_customer_inquiry(self):
        """Test creating an inquiry for a customer."""
        inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            status=InquiryStatusChoices.DRAFT,
            source_type=InquirySourceChoices.INBOUND_CALL,
            tenant=self.tenant,
        )
        
        self.assertIsNotNone(inquiry.inquiry_number)
        self.assertTrue(inquiry.inquiry_number.startswith("INQ-"))
        self.assertEqual(inquiry.entity_type, "customer")
        self.assertEqual(inquiry.customer, self.customer)
        self.assertIsNone(inquiry.supplier)
        self.assertEqual(inquiry.tenant, self.tenant)

    def test_create_supplier_inquiry(self):
        """Test creating an inquiry for a supplier."""
        inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.SUPPLIER,
            supplier=self.supplier,
            status=InquiryStatusChoices.PENDING,
            source_type=InquirySourceChoices.EMAIL,
            tenant=self.tenant,
        )
        
        self.assertIsNotNone(inquiry.inquiry_number)
        self.assertEqual(inquiry.entity_type, "supplier")
        self.assertEqual(inquiry.supplier, self.supplier)
        self.assertIsNone(inquiry.customer)

    def test_inquiry_auto_number_generation(self):
        """Test auto-generation of inquiry numbers."""
        i1 = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            tenant=self.tenant,
        )
        i2 = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            tenant=self.tenant,
        )
        
        # Both should have unique inquiry numbers
        self.assertNotEqual(i1.inquiry_number, i2.inquiry_number)
        # Both should follow the pattern
        self.assertRegex(i1.inquiry_number, r"INQ-\d{4}-\d{5}")
        self.assertRegex(i2.inquiry_number, r"INQ-\d{4}-\d{5}")

    def test_inquiry_status_choices(self):
        """Test different inquiry statuses."""
        for status in [InquiryStatusChoices.DRAFT, InquiryStatusChoices.PENDING]:
            inquiry = Inquiry.objects.create(
                entity_type=InquiryEntityTypeChoices.CUSTOMER,
                customer=self.customer,
                status=status,
                tenant=self.tenant,
            )
            self.assertEqual(inquiry.status, status)

    def test_inquiry_with_contact_snapshot(self):
        """Test inquiry with contact information snapshot."""
        inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            contact_name="John Buyer",
            contact_email="john@customer.com",
            contact_phone="555-123-4567",
            contact_company="Customer Corp",
            contact_position="Procurement Manager",
            tenant=self.tenant,
        )
        
        self.assertEqual(inquiry.contact_name, "John Buyer")
        self.assertEqual(inquiry.contact_email, "john@customer.com")
        self.assertEqual(inquiry.contact_position, "Procurement Manager")

    def test_inquiry_with_validity_dates(self):
        """Test inquiry with validity period."""
        valid_until = date.today() + timedelta(days=7)
        inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            valid_until=valid_until,
            tenant=self.tenant,
        )
        
        self.assertEqual(inquiry.valid_until, valid_until)
        self.assertFalse(inquiry.is_expired)
        
        # Test expired inquiry
        expired_inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            valid_until=date.today() - timedelta(days=1),
            tenant=self.tenant,
        )
        self.assertTrue(expired_inquiry.is_expired)

    def test_inquiry_entity_property(self):
        """Test entity property returns correct linked entity."""
        customer_inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            tenant=self.tenant,
        )
        supplier_inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.SUPPLIER,
            supplier=self.supplier,
            tenant=self.tenant,
        )
        
        self.assertEqual(customer_inquiry.entity, self.customer)
        self.assertEqual(supplier_inquiry.entity, self.supplier)

    def test_inquiry_tenant_isolation(self):
        """Test that inquiries are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create inquiry for first tenant
        i1 = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
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
        other_customer = Customer.objects.create(
            name=f"Other Customer {unique_id}",
            tenant=other_tenant,
        )
        
        # Create inquiry for second tenant
        i2 = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=other_customer,
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_inquiries = Inquiry.objects.for_tenant(self.tenant)
        Inquiry.objects.for_tenant(other_tenant)
        
        self.assertIn(i1, tenant1_inquiries)
        self.assertNotIn(i2, tenant1_inquiries)

    def test_inquiry_str_representation(self):
        """Test string representation of inquiry."""
        inquiry = Inquiry.objects.create(
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            tenant=self.tenant,
        )
        
        self.assertIn(inquiry.inquiry_number, str(inquiry))
        self.assertIn(self.customer.name, str(inquiry))


class InquiryTemplateModelTest(TestCase):
    """Test cases for InquiryTemplate model."""

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

    def test_create_inquiry_template(self):
        """Test creating an inquiry template."""
        template = InquiryTemplate.objects.create(
            name="Weekly Beef Order",
            description="Standard weekly beef inquiry",
            entity_type=InquiryEntityTypeChoices.SUPPLIER,
            default_valid_days=7,
            tenant=self.tenant,
        )
        
        self.assertEqual(template.name, "Weekly Beef Order")
        self.assertEqual(template.entity_type, "supplier")
        self.assertEqual(template.default_valid_days, 7)
        self.assertTrue(template.is_active)
        self.assertEqual(template.use_count, 0)

    def test_template_str_representation(self):
        """Test string representation of template."""
        template = InquiryTemplate.objects.create(
            name="Customer Pork Inquiry",
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            tenant=self.tenant,
        )
        
        self.assertIn("Customer Pork Inquiry", str(template))
        self.assertIn("customer", str(template))

    def test_template_tenant_isolation(self):
        """Test that templates are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create template for first tenant
        t1 = InquiryTemplate.objects.create(
            name="Template 1",
            entity_type=InquiryEntityTypeChoices.SUPPLIER,
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
        
        # Create template for second tenant
        t2 = InquiryTemplate.objects.create(
            name="Template 2",
            entity_type=InquiryEntityTypeChoices.SUPPLIER,
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_templates = InquiryTemplate.objects.for_tenant(self.tenant)
        tenant2_templates = InquiryTemplate.objects.for_tenant(other_tenant)
        
        self.assertEqual(tenant1_templates.count(), 1)
        self.assertEqual(tenant2_templates.count(), 1)
        self.assertIn(t1, tenant1_templates)
        self.assertNotIn(t2, tenant1_templates)


class InquiryRLSMigrationTest(TestCase):
    """Tests that verify RLS migration SQL is correctly defined for Inquiry and InquiryTemplate."""

    def _get_migration_content(self):
        import os
        migration_path = os.path.join(
            os.path.dirname(__file__),
            'migrations',
            '0004_add_rls_policies_batch.py',
        )
        with open(migration_path) as f:
            return f.read()

    def test_rls_migration_exists(self):
        """Verify the RLS migration file exists for inquiries."""
        import os
        migration_path = os.path.join(
            os.path.dirname(__file__),
            'migrations',
            '0004_add_rls_policies_batch.py',
        )
        self.assertTrue(
            os.path.exists(migration_path),
            "RLS migration file 0004_add_rls_policies_batch.py must exist for inquiries",
        )

    def test_rls_migration_enables_rls_on_inquiry(self):
        """Verify the RLS migration enables row-level security on inquiries_inquiry."""
        content = self._get_migration_content()
        self.assertIn('ENABLE ROW LEVEL SECURITY', content)
        self.assertIn('inquiries_inquiry', content)

    def test_rls_migration_enables_rls_on_inquirytemplate(self):
        """Verify the RLS migration enables row-level security on inquiries_inquirytemplate."""
        content = self._get_migration_content()
        self.assertIn('inquiries_inquirytemplate', content)
        self.assertIn('inquirytemplate_tenant_isolation', content)

    def test_rls_migration_uses_app_current_tenant(self):
        """Verify the RLS migration uses the app.current_tenant session variable."""
        content = self._get_migration_content()
        self.assertIn("app.current_tenant", content)
        self.assertIn('tenant_id', content)

    def test_rls_migration_has_insert_policies(self):
        """Verify the RLS migration creates INSERT policies for both models."""
        content = self._get_migration_content()
        self.assertIn('inquiry_tenant_insert', content)
        self.assertIn('inquirytemplate_tenant_insert', content)
        self.assertIn('FOR INSERT', content)
        self.assertIn('WITH CHECK', content)

    def test_rls_migration_has_reverse_sql(self):
        """Verify the RLS migration includes reverse SQL for rollback."""
        content = self._get_migration_content()
        self.assertIn('DISABLE ROW LEVEL SECURITY', content)
        self.assertIn('DROP POLICY IF EXISTS', content)

    def test_inquiry_model_has_tenant_fk(self):
        """Verify Inquiry model has a tenant ForeignKey."""
        from django.db import models
        tenant_field = Inquiry._meta.get_field('tenant')
        self.assertIsInstance(tenant_field, models.ForeignKey)
        self.assertEqual(tenant_field.related_model.__name__, 'Tenant')

    def test_inquirytemplate_model_has_tenant_fk(self):
        """Verify InquiryTemplate model has a tenant ForeignKey."""
        from django.db import models
        tenant_field = InquiryTemplate._meta.get_field('tenant')
        self.assertIsInstance(tenant_field, models.ForeignKey)
        self.assertEqual(tenant_field.related_model.__name__, 'Tenant')
