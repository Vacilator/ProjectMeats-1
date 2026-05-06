"""
Tests for Inquiries app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from types import SimpleNamespace
from django.test import TestCase
from django.contrib.auth.models import User
from datetime import date, timedelta
from django.utils import timezone
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryRouteDecisionChoices,
    InquiryStatusChoices,
    InquirySourceChoices,
    InquiryEntityTypeChoices,
    InquiryTemplate,
)
from tenant_apps.inquiries.serializers import InquiryCreateSerializer, InquiryDetailSerializer
from tenant_apps.products.models import MasterProduct
from tenant_apps.suppliers.models import Supplier, SupplierAvailableItem
from apps.system.models import Product
from tenant_apps.customers.models import Customer
from apps.integrations.models import EmailLog, ExternalAuthProvider
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

    def test_inquiry_core_trading_contract_fields_exist(self):
        """CTE-01.1 contract fields are present on Inquiry before automation lands."""
        route_decision_field = Inquiry._meta.get_field('route_decision')
        self.assertEqual(route_decision_field.choices, InquiryRouteDecisionChoices.choices)
        self.assertTrue(route_decision_field.db_index)

        requested_master_product_field = Inquiry._meta.get_field('requested_master_product')
        self.assertEqual(
            requested_master_product_field.related_model.__name__,
            'MasterProduct',
        )

        source_email_field = Inquiry._meta.get_field('source_email')
        self.assertEqual(source_email_field.related_model.__name__, 'EmailLog')

        supplier_po_field = Inquiry._meta.get_field('supplier_purchase_order')
        self.assertEqual(supplier_po_field.related_model.__name__, 'PurchaseOrder')

        sales_order_field = Inquiry._meta.get_field('sales_order')
        self.assertEqual(sales_order_field.related_model.__name__, 'SalesOrder')

        carrier_po_field = Inquiry._meta.get_field('carrier_purchase_order')
        self.assertEqual(
            carrier_po_field.related_model.__name__,
            'CarrierPurchaseOrder',
        )


class InquiryTradingContractSerializerTest(TestCase):
    """Focused contract tests for CTE-01.1 inquiry routing fields."""

    @classmethod
    def setUpTestData(cls):
        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"contract-user-{unique_id}",
            email=f"contract-{unique_id}@example.com",
            password="testpass123",
        )
        cls.tenant = Tenant.objects.create(
            name=f"Contract Tenant {unique_id}",
            slug=f"contract-tenant-{unique_id}",
            contact_email=f"contract-{unique_id}@example.com",
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="owner")
        cls.customer = Customer.objects.create(name=f"Customer {unique_id}", tenant=cls.tenant)
        cls.master_product = MasterProduct.objects.create(
            tenant=cls.tenant,
            protein='beef',
            item_name='Brisket',
            type='whole',
            trim='trimmed',
        )
        cls.system_product = Product.objects.create(
            product_code=f'BEEF-BRISKET-{unique_id}',
            name='Brisket',
            protein_type='beef',
            category='BEEF',
        )
        cls.master_product.system_product = cls.system_product
        cls.master_product.save(update_fields=['system_product'])
        cls.fulfill_supplier = Supplier.objects.create(
            tenant=cls.tenant,
            name=f'Contract Supplier {unique_id}',
        )
        SupplierAvailableItem.objects.create(
            tenant=cls.tenant,
            supplier=cls.fulfill_supplier,
            product=cls.system_product,
            is_active=True,
        )
        cls.provider = ExternalAuthProvider.objects.create(
            tenant=cls.tenant,
            provider_type='microsoft',
            connected_email=f"inbox-{unique_id}@example.com",
            is_active=True,
            token_expiry=timezone.now() + timedelta(days=1),
        )
        cls.email_log = EmailLog.objects.create(
            tenant=cls.tenant,
            provider=cls.provider,
            message_id=f"message-{unique_id}",
            thread_id=f"thread-{unique_id}",
            subject='Need beef',
            sender_email='buyer@example.com',
            received_at=timezone.now(),
            body_text='Please quote brisket.',
        )

        other_user = User.objects.create_user(
            username=f"other-contract-user-{unique_id}",
            email=f"other-contract-{unique_id}@example.com",
            password="testpass123",
        )
        cls.other_tenant = Tenant.objects.create(
            name=f"Other Contract Tenant {unique_id}",
            slug=f"other-contract-tenant-{unique_id}",
            contact_email=f"other-contract-{unique_id}@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=cls.other_tenant, user=other_user, role="owner")
        cls.other_master_product = MasterProduct.objects.create(
            tenant=cls.other_tenant,
            protein='pork',
            item_name='Belly',
            type='flat',
            trim='trimmed',
        )
        other_provider = ExternalAuthProvider.objects.create(
            tenant=cls.other_tenant,
            provider_type='microsoft',
            connected_email=f"other-inbox-{unique_id}@example.com",
            is_active=True,
            token_expiry=timezone.now() + timedelta(days=1),
        )
        cls.other_email_log = EmailLog.objects.create(
            tenant=cls.other_tenant,
            provider=other_provider,
            message_id=f"other-message-{unique_id}",
            thread_id=f"other-thread-{unique_id}",
            subject='Wrong tenant',
            sender_email='other@example.com',
            received_at=timezone.now(),
            body_text='Do not link me.',
        )

    def test_create_serializer_snapshots_email_lineage_and_protein_anchor(self):
        serializer = InquiryCreateSerializer(
            data={
                'entity_type': InquiryEntityTypeChoices.CUSTOMER,
                'customer': self.customer.id,
                'source_type': InquirySourceChoices.EMAIL,
                'source_email': self.email_log.id,
                'requested_master_product': self.master_product.id,
                'route_decision': InquiryRouteDecisionChoices.BROKER,
            },
            context={'request': SimpleNamespace(tenant=self.tenant, user=self.user)},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        inquiry = serializer.save()
        self.assertEqual(
            inquiry.source_email_message_id,
            self.email_log.message_id,
        )
        self.assertEqual(
            inquiry.source_email_thread_id,
            self.email_log.thread_id,
        )
        self.assertEqual(
            inquiry.requested_protein,
            self.master_product.protein,
        )
        self.assertEqual(inquiry.route_decision, InquiryRouteDecisionChoices.FULFILL)

    def test_create_serializer_routes_broker_when_master_product_is_unmapped(self):
        unmapped_master_product = MasterProduct.objects.create(
            tenant=self.tenant,
            protein='beef',
            item_name='Chuck',
            type='whole',
            trim='trimmed',
        )
        serializer = InquiryCreateSerializer(
            data={
                'entity_type': InquiryEntityTypeChoices.CUSTOMER,
                'customer': self.customer.id,
                'source_type': InquirySourceChoices.EMAIL,
                'source_email': self.email_log.id,
                'requested_master_product': unmapped_master_product.id,
            },
            context={'request': SimpleNamespace(tenant=self.tenant, user=self.user)},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        inquiry = serializer.save()
        self.assertEqual(inquiry.route_decision, InquiryRouteDecisionChoices.BROKER)

    def test_create_serializer_rejects_cross_tenant_contract_references(self):
        serializer = InquiryCreateSerializer(
            data={
                'entity_type': InquiryEntityTypeChoices.CUSTOMER,
                'customer': self.customer.id,
                'source_type': InquirySourceChoices.EMAIL,
                'source_email': self.other_email_log.id,
                'requested_master_product': self.other_master_product.id,
            },
            context={'request': SimpleNamespace(tenant=self.tenant, user=self.user)},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('source_email', serializer.errors)

    def test_detail_serializer_exposes_trading_contract_fields(self):
        serializer = InquiryDetailSerializer()
        field_names = serializer.get_fields().keys()

        for field_name in (
            'route_decision',
            'source_email',
            'source_email_message_id',
            'source_email_thread_id',
            'requested_master_product',
            'requested_protein',
            'supplier_purchase_order',
            'sales_order',
            'carrier_purchase_order',
        ):
            self.assertIn(field_name, field_names)


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
