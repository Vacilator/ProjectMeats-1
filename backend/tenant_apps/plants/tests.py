"""
Tests for Plants app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from tenant_apps.contacts.models import Contact
from tenant_apps.plants.models import Plant, PlantProteinOffered, PlantProteinTested
from tenant_apps.plants.serializers import PlantSerializer
from tenant_apps.suppliers.models import Supplier

from apps.core.models import Protein
from apps.core.permissions import IsRoleAuthorized
from apps.tenants.models import Tenant, TenantUser


class PlantModelTest(TestCase):
    """Test cases for Plant model."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}", email=f"test-{unique_id}@example.com", password="testpass123"
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
            plant_est_num=f"EST-{unique_id}",
            plant_type="processing",
            city="Chicago",
            state="IL",
            country="USA",
            tenant=self.tenant,
        )

        self.assertEqual(plant.name, f"Processing Plant {unique_id}")
        self.assertEqual(plant.plant_est_num, f"EST-{unique_id}")
        self.assertEqual(plant.plant_type, "processing")
        self.assertEqual(plant.tenant, self.tenant)

    def test_create_plant_via_serializer(self):
        """Plant should be creatable via serializer without legacy fields."""
        unique_id = uuid.uuid4().hex[:8]

        factory = APIRequestFactory()
        request = factory.post("/api/v1/plants/", {})
        request.user = self.user
        request.tenant = self.tenant

        serializer = PlantSerializer(
            data={
                "name": f"Processing Plant {unique_id}",
                "plant_type": "processing",
                "supplier": self.supplier.id,
            },
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        plant = serializer.save(tenant=self.tenant)

        self.assertEqual(plant.tenant, self.tenant)
        self.assertEqual(plant.name, f"Processing Plant {unique_id}")

    def test_plant_str_representation(self):
        """Test the string representation of a plant."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Distribution Center {unique_id}",
            plant_est_num=f"EST-{unique_id}",
            tenant=self.tenant,
        )

        self.assertIn(f"EST-{unique_id}", str(plant))
        self.assertIn("Distribution Center", str(plant))

    def test_plant_with_supplier(self):
        """Test creating a plant associated with a supplier."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Supplier Plant {unique_id}",
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
            tenant=self.tenant,
        )

        # Create second tenant
        other_user = User.objects.create_user(
            username=f"otheruser-{unique_id}", email=f"other-{unique_id}@example.com", password="testpass123"
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
            capacity=10000,
            tenant=self.tenant,
        )

        self.assertEqual(plant.capacity, 10000)

    def test_plant_operational_flags(self):
        """Test plant operational flags."""
        unique_id = uuid.uuid4().hex[:8]
        plant = Plant.objects.create(
            name=f"Plant {unique_id}",
            tenant=self.tenant,
        )

        self.assertTrue(plant.is_active)
        self.assertFalse(plant.fcfs)

    def test_role_authorized_plant_manager_restrictions(self):
        unique_id = uuid.uuid4().hex[:8]

        pm_user = User.objects.create_user(
            username=f"pm-{unique_id}",
            email=f"pm-{unique_id}@example.com",
            password="testpass123",
        )
        membership = TenantUser.objects.create(tenant=self.tenant, user=pm_user, role="plant_manager")

        plant_allowed = Plant.objects.create(name=f"Allowed {unique_id}", tenant=self.tenant)
        plant_denied = Plant.objects.create(name=f"Denied {unique_id}", tenant=self.tenant)

        membership.restricted_plants.add(plant_allowed)

        contact_allowed = Contact.objects.create(
            tenant=self.tenant,
            first_name="A",
            last_name="User",
            email=f"a-{unique_id}@example.com",
            plant=plant_allowed,
        )
        contact_denied = Contact.objects.create(
            tenant=self.tenant,
            first_name="D",
            last_name="User",
            email=f"d-{unique_id}@example.com",
            plant=plant_denied,
        )

        factory = APIRequestFactory()
        req = factory.patch("/api/v1/plants/", {})
        req.user = pm_user
        req.tenant = self.tenant

        perm = IsRoleAuthorized()
        self.assertTrue(perm.has_object_permission(req, None, plant_allowed))
        self.assertFalse(perm.has_object_permission(req, None, plant_denied))
        self.assertTrue(perm.has_object_permission(req, None, contact_allowed))
        self.assertFalse(perm.has_object_permission(req, None, contact_denied))


class PlantProteinsAPITests(APITestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"plant-proteins-{unique_id}",
            email=f"plant-proteins-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)

        self.tenant = Tenant.objects.create(
            name=f"Plant Proteins Tenant {unique_id}",
            slug=f"plant-proteins-tenant-{unique_id}",
            contact_email=f"plant-proteins-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)

        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f"Plant Supplier {unique_id}",
        )

        # core.Protein is global (tenant-agnostic).
        self.protein_a = Protein.objects.create(name=f"Beef-{unique_id}")
        self.protein_b = Protein.objects.create(name=f"Pork-{unique_id}")

        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_create_plant_with_export_and_proteins(self):
        payload = {
            "name": "Protein Plant",
            "plant_type": "processing",
            "supplier": self.supplier.id,
            "export_approved": True,
            "export_documents_handled": ["COA", "FSIS"],
            # Serializer accepts protein names (UI uses choice values like "Beef").
            "proteins_offered": [self.protein_a.name],
            "proteins_tested": [self.protein_a.name, self.protein_b.name],
        }

        response = self.client.post(
            "/api/v1/plants/",
            payload,
            format="json",
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        plant = Plant.objects.get(id=response.data["id"], tenant=self.tenant)
        self.assertTrue(plant.export_approved)
        self.assertEqual(plant.export_documents_handled, ["COA", "FSIS"])

        offered_ids = list(
            PlantProteinOffered.objects.filter(tenant=self.tenant, plant=plant).values_list("protein_id", flat=True)
        )
        tested_ids = list(
            PlantProteinTested.objects.filter(tenant=self.tenant, plant=plant).values_list("protein_id", flat=True)
        )
        self.assertEqual(offered_ids, [self.protein_a.id])
        self.assertEqual(set(tested_ids), {self.protein_a.id, self.protein_b.id})

        # Serializer representation should return names.
        self.assertEqual(response.data["proteins_offered"], [self.protein_a.name])
        self.assertEqual(set(response.data["proteins_tested"]), {self.protein_a.name, self.protein_b.name})

    def test_patch_plant_replaces_proteins(self):
        plant = Plant.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            name="Patch Plant",
            export_approved=True,
            export_documents_handled=["COA"],
        )
        PlantProteinOffered.objects.create(tenant=self.tenant, plant=plant, protein=self.protein_a)
        PlantProteinTested.objects.create(tenant=self.tenant, plant=plant, protein=self.protein_a)

        response = self.client.patch(
            f"/api/v1/plants/{plant.id}/",
            {
                "export_approved": False,
                "proteins_offered": [],
                "proteins_tested": [self.protein_b.name],
            },
            format="json",
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        plant.refresh_from_db()
        self.assertFalse(plant.export_approved)
        self.assertEqual(plant.export_documents_handled, [])

        self.assertEqual(
            PlantProteinOffered.objects.filter(tenant=self.tenant, plant=plant).count(),
            0,
        )
        tested_ids = list(
            PlantProteinTested.objects.filter(tenant=self.tenant, plant=plant).values_list("protein_id", flat=True)
        )
        self.assertEqual(tested_ids, [self.protein_b.id])


class PlantNestedContactsAPITests(APITestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"plant-api-{unique_id}",
            email=f"plant-api-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)

        self.tenant = Tenant.objects.create(
            name=f"Plant Tenant {unique_id}",
            slug=f"plant-tenant-{unique_id}",
            contact_email=f"plant-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)

        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f"Plant Supplier {unique_id}",
        )
        self.plant = Plant.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            name=f"Plant {unique_id}",
        )
        self.contact = Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            department="sales",
            first_name="Initial",
            last_name="Contact",
            email=f"initial-{unique_id}@example.com",
            title="Original Title",
        )
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_patch_plant_with_nested_contacts_upserts_contacts(self):
        response = self.client.patch(
            f"/api/v1/plants/{self.plant.id}/",
            {
                "contacts": [
                    {
                        "id": self.contact.id,
                        "department": "sales",
                        "first_name": "Updated",
                        "last_name": "Contact",
                        "email": "updated@example.com",
                        "title": "Sales Manager",
                        "notes": "Updated via plant patch",
                        "documents_responsible_for": ["BOL"],
                    },
                    {
                        "department": "certification",
                        "first_name": "Cert",
                        "last_name": "Owner",
                        "email": "cert@example.com",
                        "title": "Certification Lead",
                        "documents_responsible_for": ["COA", "Halal"],
                    },
                ],
            },
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.contact.refresh_from_db()
        self.assertEqual(self.contact.first_name, "Updated")
        self.assertEqual(self.contact.email, "updated@example.com")
        self.assertEqual(self.contact.title, "Sales Manager")
        self.assertEqual(self.contact.notes, "Updated via plant patch")
        self.assertEqual(self.contact.documents_responsible_for, ["BOL"])

        created_contact = Contact.objects.get(
            tenant=self.tenant,
            plant=self.plant,
            email="cert@example.com",
        )
        self.assertEqual(created_contact.department, "certification")
        self.assertEqual(created_contact.documents_responsible_for, ["COA", "Halal"])
        self.assertEqual(
            Contact.objects.filter(tenant=self.tenant, plant=self.plant).count(),
            2,
        )
