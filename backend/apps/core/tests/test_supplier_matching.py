import uuid

from django.contrib.auth.models import User
from django.test import TestCase

from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquiryRouteDecisionChoices,
    InquiryShippingTypeChoices,
    InquirySourceChoices,
)
from tenant_apps.locations.models import Location, LocationAssociatedMasterProduct, LocationTypeChoices
from tenant_apps.plants.models import Plant, PlantAssociatedMasterProduct
from tenant_apps.products.models import MasterProduct
from tenant_apps.suppliers.models import Supplier, SupplierAvailableItem, SupplierPlant

from apps.core.models import Protein, ProteinTypeChoices, ShippingOfferedChoices
from apps.core.services.supplier_matching import SupplierMatchFilters, match_suppliers_for_inquiry
from apps.system.models import Product
from apps.tenants.models import Tenant, TenantUser


class SupplierMatchingServiceTests(TestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"supplier-match-{unique_id}",
            email=f"supplier-match-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"Supplier Match {unique_id}",
            slug=f"supplier-match-{unique_id}",
            contact_email=f"supplier-match-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.customer = Customer.objects.create(name=f"Customer {unique_id}", tenant=self.tenant)
        self.beef, _ = Protein.objects.get_or_create(name="Beef")

        self.system_product = Product.objects.create(
            product_code=f"BEEF-RIBEYE-{unique_id}",
            name="Ribeye",
            protein_type=ProteinTypeChoices.BEEF,
            category="BEEF",
            is_active=True,
        )
        self.master_product = MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name="Ribeye",
            type="flat",
            trim="trimmed",
            system_product=self.system_product,
        )
        self.inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            requested_master_product=self.master_product,
            requested_protein=ProteinTypeChoices.BEEF,
            created_by=self.user,
        )

    def create_supplier(self, name: str, **overrides) -> Supplier:
        defaults = {
            "tenant": self.tenant,
            "name": name,
            "shipping_offered": ShippingOfferedChoices.YES_DOMESTIC,
        }
        defaults.update(overrides)
        return Supplier.objects.create(**defaults)

    def add_available_item(self, supplier: Supplier) -> None:
        SupplierAvailableItem.objects.create(
            tenant=self.tenant,
            supplier=supplier,
            product=self.system_product,
            is_active=True,
        )

    def add_linked_plant_affinity(self, supplier: Supplier, name: str) -> Plant:
        plant = Plant.objects.create(tenant=self.tenant, name=name, is_active=True)
        SupplierPlant.objects.create(tenant=self.tenant, supplier=supplier, plant=plant)
        PlantAssociatedMasterProduct.objects.create(
            tenant=self.tenant,
            plant=plant,
            master_product=self.master_product,
        )
        return plant

    def add_location_affinity(self, supplier: Supplier, name: str) -> Location:
        location = Location.objects.create(
            tenant=self.tenant,
            supplier=supplier,
            name=name,
            location_type=LocationTypeChoices.PLANT_PROCESSING,
            is_active=True,
        )
        LocationAssociatedMasterProduct.objects.create(
            tenant=self.tenant,
            location=location,
            master_product=self.master_product,
        )
        return location

    def test_match_orders_exact_affinity_then_protein_fallback(self):
        alpha = self.create_supplier("Alpha Exact")
        self.add_available_item(alpha)

        beta = self.create_supplier("Beta Plant")
        linked_plant = self.add_linked_plant_affinity(beta, "Beta Plant Facility")

        gamma = self.create_supplier("Gamma Protein", preferred_protein_types=[ProteinTypeChoices.BEEF])
        delta = self.create_supplier("Delta Protein")
        delta.proteins.add(self.beef)

        result = match_suppliers_for_inquiry(tenant=self.tenant, inquiry=self.inquiry)

        self.assertEqual(result.reason, "supplier_candidates_found")
        self.assertEqual(
            [candidate.supplier_name for candidate in result.candidates],
            ["Alpha Exact", "Beta Plant", "Delta Protein", "Gamma Protein"],
        )
        self.assertTrue(result.candidates[0].has_active_available_item)
        self.assertEqual(result.candidates[1].matched_plant_ids, (linked_plant.id,))
        self.assertIn("plant_master_product_affinity", result.candidates[1].reasons)
        self.assertEqual(result.candidates[2].score, result.candidates[3].score)

    def test_location_affinity_and_commercial_filters_only_narrow_results(self):
        self.inquiry.shipping_type = InquiryShippingTypeChoices.SUPPLIER_DELIVERING
        self.inquiry.save(update_fields=["shipping_type"])

        preferred = self.create_supplier(
            "Preferred Exporter",
            offer_contracts=True,
            offers_export_documents=True,
            shipping_offered=ShippingOfferedChoices.YES_EXPORTED,
        )
        location = self.add_location_affinity(preferred, "Preferred Export Plant")

        no_delivery = self.create_supplier(
            "No Delivery Exporter",
            offer_contracts=True,
            offers_export_documents=True,
            shipping_offered=ShippingOfferedChoices.NO,
        )
        self.add_location_affinity(no_delivery, "No Delivery Plant")

        no_contracts = self.create_supplier(
            "No Contracts Exporter",
            offer_contracts=False,
            offers_export_documents=True,
            shipping_offered=ShippingOfferedChoices.YES_EXPORTED,
        )
        self.add_location_affinity(no_contracts, "No Contracts Plant")

        result = match_suppliers_for_inquiry(
            tenant=self.tenant,
            inquiry=self.inquiry,
            filters=SupplierMatchFilters(require_contracts=True, require_export_documents=True),
        )

        self.assertEqual(result.candidate_count, 1)
        self.assertEqual(result.candidates[0].supplier_name, "Preferred Exporter")
        self.assertEqual(result.candidates[0].matched_location_ids, (location.id,))
        self.assertIn("location_master_product_affinity", result.candidates[0].reasons)

    def test_cross_tenant_suppliers_are_ignored(self):
        local_supplier = self.create_supplier("Local Protein", preferred_protein_types=[ProteinTypeChoices.BEEF])

        other_user = User.objects.create_user(
            username="other-supplier-match",
            email="other-supplier-match@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Other Supplier Match",
            slug="other-supplier-match",
            contact_email="other-supplier-match@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner")
        other_supplier = Supplier.objects.create(tenant=other_tenant, name="Other Exact")
        SupplierAvailableItem.objects.create(
            tenant=other_tenant,
            supplier=other_supplier,
            product=self.system_product,
            is_active=True,
        )

        result = match_suppliers_for_inquiry(tenant=self.tenant, inquiry=self.inquiry)

        self.assertEqual(result.candidate_count, 1)
        self.assertEqual(result.candidates[0].supplier_id, local_supplier.id)

    def test_cross_tenant_plant_and_location_links_are_ignored_at_source(self):
        other_user = User.objects.create_user(
            username="other-cross-tenant-source",
            email="other-cross-tenant-source@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Other Cross Tenant Source",
            slug="other-cross-tenant-source",
            contact_email="other-cross-tenant-source@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner")
        other_supplier = Supplier.objects.create(tenant=other_tenant, name="Other Source Supplier")

        plant = Plant.objects.create(
            tenant=self.tenant,
            supplier=other_supplier,
            name="Cross Tenant Plant",
            is_active=True,
        )
        PlantAssociatedMasterProduct.objects.create(
            tenant=self.tenant,
            plant=plant,
            master_product=self.master_product,
        )

        location = Location.objects.create(
            tenant=self.tenant,
            supplier=other_supplier,
            name="Cross Tenant Location",
            location_type=LocationTypeChoices.PLANT_PROCESSING,
            is_active=True,
        )
        LocationAssociatedMasterProduct.objects.create(
            tenant=self.tenant,
            location=location,
            master_product=self.master_product,
        )

        result = match_suppliers_for_inquiry(tenant=self.tenant, inquiry=self.inquiry)

        self.assertEqual(result.reason, "no_supplier_candidates")
        self.assertEqual(result.candidate_count, 0)
        self.assertEqual(result.candidates, ())

    def test_non_broker_inquiry_fails_closed(self):
        self.add_available_item(self.create_supplier("Fulfill Supplier"))
        self.inquiry.route_decision = InquiryRouteDecisionChoices.FULFILL
        self.inquiry.save(update_fields=["route_decision"])

        result = match_suppliers_for_inquiry(tenant=self.tenant, inquiry=self.inquiry)

        self.assertEqual(result.reason, "non_broker_inquiry")
        self.assertEqual(result.candidate_count, 0)
        self.assertEqual(result.candidates, ())

    def test_unmapped_system_product_fails_closed(self):
        self.master_product.system_product = None
        self.master_product.save(update_fields=["system_product"])

        result = match_suppliers_for_inquiry(tenant=self.tenant, inquiry=self.inquiry)

        self.assertEqual(result.reason, "unmapped_system_product")
        self.assertEqual(result.candidate_count, 0)
