"""
Tests for Products app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User

from apps.system.models import Product
from tenant_apps.products.models import MasterProduct
from tenant_apps.products.serializers import ProductSerializer
from apps.tenants.models import Tenant, TenantUser
from apps.core.models import ProteinTypeChoices


class MasterProductModelTest(TestCase):
    """Test cases for MasterProduct model."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

    def test_display_name_auto_generated(self):
        mp = MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name='Brisket',
            type='flat',
            trim='trimmed',
        )

        self.assertIn('Brisket', mp.display_name)
        self.assertTrue(mp.display_name)
        self.assertEqual(str(mp), mp.display_name)

    def test_unique_constraint_per_tenant(self):
        MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name='Brisket',
            type='flat',
            trim='trimmed',
        )

        with self.assertRaises(Exception):
            MasterProduct.objects.create(
                tenant=self.tenant,
                protein=ProteinTypeChoices.BEEF,
                item_name='Brisket',
                type='flat',
                trim='trimmed',
            )

    def test_tenant_isolation_manager(self):
        mp1 = MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name='Brisket',
            type='flat',
            trim='trimmed',
        )

        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123',
        )
        other_tenant = Tenant.objects.create(
            name='Other Company',
            slug='other-company',
            contact_email='admin@othercompany.com',
            created_by=other_user,
        )
        MasterProduct.objects.create(
            tenant=other_tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name='Brisket',
            type='flat',
            trim='trimmed',
        )

        self.assertEqual(MasterProduct.objects.for_tenant(self.tenant).count(), 1)
        self.assertEqual(MasterProduct.objects.for_tenant(other_tenant).count(), 1)
        self.assertEqual(MasterProduct.objects.for_tenant(self.tenant).first().id, mp1.id)

    def test_product_serializer_accepts_matching_system_product_bridge(self):
        system_product = Product.objects.create(
            product_code='BEEF-BRISKET-SERIALIZER',
            name='Brisket',
            protein_type='beef',
            category='BEEF',
        )
        serializer = ProductSerializer(
            data={
                'protein': ProteinTypeChoices.BEEF,
                'item_name': 'Brisket',
                'type': 'flat',
                'trim': 'trimmed',
                'system_product': str(system_product.id),
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_product_serializer_rejects_mismatched_system_product_bridge(self):
        system_product = Product.objects.create(
            product_code='PORK-BELLY-SERIALIZER',
            name='Pork Belly',
            protein_type='pork',
            category='PORK',
        )
        serializer = ProductSerializer(
            data={
                'protein': ProteinTypeChoices.BEEF,
                'item_name': 'Brisket',
                'type': 'flat',
                'trim': 'trimmed',
                'system_product': str(system_product.id),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('system_product', serializer.errors)

