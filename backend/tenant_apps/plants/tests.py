"""
Tests for Plants app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory

from tenant_apps.plants.models import Plant
from tenant_apps.plants.serializers import PlantSerializer
from tenant_apps.suppliers.models import Supplier
from apps.tenants.models import Tenant, TenantUser


class PlantModelTest(TestCase):
    """Test cases for Plant model."""

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

    def test_create_plant(self):
        """Test creating a plant."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Processing Plant {unique_id}",
            code=f"PP-{unique_id}",
            plant_est_num=f"EST-{unique_id}",
            plant_type="processing",
            city="Chicago",
            state="IL",
            country="USA",
            tenant=self.tenant,
        )
        
        self.assertEqual(plant.name, f"Processing Plant {unique_id}")
        self.assertEqual(plant.code, f"PP-{unique_id}")
        self.assertEqual(plant.plant_type, "processing")
        self.assertEqual(plant.tenant, self.tenant)

    def test_create_plant_without_code_generates_code(self):
        """Plant code should be optional in API input (auto-generated if blank)."""
        unique_id = uuid.uuid4().hex[:8]

        factory = APIRequestFactory()
        request = factory.post('/api/v1/plants/', {})
        request.user = self.user
        request.tenant = self.tenant

        serializer = PlantSerializer(
            data={
                'name': f"Processing Plant {unique_id}",
                'plant_type': 'processing',
                'supplier': self.supplier.id,
                'code': '',
            },
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        plant = serializer.save(tenant=self.tenant)

        self.assertTrue(isinstance(plant.code, str) and plant.code)
        self.assertIn('-', plant.code)
        self.assertEqual(plant.tenant, self.tenant)

    def test_plant_str_representation(self):
        """Test the string representation of a plant."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Distribution Center {unique_id}",
            code=f"DC-{unique_id}",
            tenant=self.tenant,
        )
        
        self.assertIn(f"DC-{unique_id}", str(plant))
        self.assertIn("Distribution Center", str(plant))

    def test_plant_with_supplier(self):
        """Test creating a plant associated with a supplier."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Supplier Plant {unique_id}",
            code=f"SP-{unique_id}",
            supplier=self.supplier,
            tenant=self.tenant,
        )
        
        self.assertEqual(plant.supplier, self.supplier)
        self.assertIn(plant, self.supplier.supplier_plants.all())

    def test_plant_types(self):
        """Test different plant types."""
        unique_id = uuid.uuid4().hex[:8]
        
        for plant_type, _ in Plant.PLANT_TYPE_CHOICES:
            plant = Plant.objects.create(
                name=f"Plant {plant_type} {unique_id}",
                code=f"P-{plant_type[:3]}-{unique_id}",
                plant_type=plant_type,
                tenant=self.tenant,
            )
            self.assertEqual(plant.plant_type, plant_type)

    def test_plant_tenant_isolation(self):
        """Test that plants are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create plant for first tenant
        plant1 = Plant.objects.create(
            name=f"Plant 1 {unique_id}",
            code=f"P1-{unique_id}",
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
        
        # Create plant for second tenant
        plant2 = Plant.objects.create(
            name=f"Plant 2 {unique_id}",
            code=f"P2-{unique_id}",
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_plants = Plant.objects.for_tenant(self.tenant)
        tenant2_plants = Plant.objects.for_tenant(other_tenant)
        
        self.assertEqual(tenant1_plants.count(), 1)
        self.assertEqual(tenant2_plants.count(), 1)
        self.assertIn(plant1, tenant1_plants)
        self.assertNotIn(plant2, tenant1_plants)

    def test_plant_with_capacity(self):
        """Test plant with capacity information."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Large Plant {unique_id}",
            code=f"LP-{unique_id}",
            capacity=10000,
            tenant=self.tenant,
        )
        
        self.assertEqual(plant.capacity, 10000)

    def test_plant_contact_info(self):
        """Test plant with contact information."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Contact Plant {unique_id}",
            code=f"CP-{unique_id}",
            phone="555-123-4567",
            email=f"plant-{unique_id}@test.com",
            manager="John Manager",
            tenant=self.tenant,
        )
        
        self.assertEqual(plant.phone, "555-123-4567")
        self.assertEqual(plant.manager, "John Manager")
        self.assertTrue(plant.is_active)
