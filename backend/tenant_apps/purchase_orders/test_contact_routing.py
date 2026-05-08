import uuid
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase

from tenant_apps.contacts.models import Contact, ContactDepartmentChoices
from tenant_apps.plants.models import Plant
from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
from tenant_apps.suppliers.models import Supplier

from apps.tenants.models import Tenant, TenantUser


class PurchaseOrderContactRoutingTests(TestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"po-contact-{unique_id}",
            email=f"po-contact-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"PO Contact Tenant {unique_id}",
            slug=f"po-contact-{unique_id}",
            contact_email=f"po-contact-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name="Typed Contact Supplier",
            email="supplier@example.com",
            phone="800-555-1000",
            contact_person="Legacy Supplier Contact",
            address="100 Supplier Way",
            street_address="100 Supplier Way",
            city="Dallas",
            state="TX",
            zip_code="75001",
        )
        self.plant = Plant.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            name="North Plant",
            plant_est_num="EST-1",
            address="200 Plant Rd",
            city="Fort Worth",
            state="TX",
            zip_code="76101",
        )
        Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            first_name="Sally",
            last_name="Sales",
            email="sales@plant.example.com",
            office_phone="800-555-2000",
            department=ContactDepartmentChoices.SALES,
            title="Account Manager",
        )
        Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            first_name="Andy",
            last_name="Accounting",
            email="ap@plant.example.com",
            office_phone="800-555-3000",
            department=ContactDepartmentChoices.ACCOUNTING,
            title="Accounts Payable",
            documents_responsible_for=["Statements", "Bills"],
        )
        Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            first_name="Lana",
            last_name="Loadout",
            email="shipping@plant.example.com",
            office_phone="800-555-4000",
            department=ContactDepartmentChoices.SHIPPING,
            title="Shipping Supervisor",
            documents_responsible_for=["BOLs", "Loading Instructions"],
        )

    def test_purchase_order_prefills_typed_supplier_contact_roles(self):
        purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            status=PurchaseOrderStatus.DRAFT,
            order_date=date(2026, 5, 7),
            total_amount="0.00",
        )

        self.assertEqual(purchase_order.supplier_contact_name, "Sally Sales")
        self.assertEqual(purchase_order.supplier_contact_email, "sales@plant.example.com")
        self.assertEqual(purchase_order.supplier_contact_phone, "800-555-2000")
        self.assertEqual(purchase_order.billing_contact_name, "Andy Accounting")
        self.assertEqual(purchase_order.billing_contact_email, "ap@plant.example.com")
        self.assertEqual(purchase_order.billing_contact_title, "Accounts Payable")
        self.assertEqual(purchase_order.shipping_contact_name, "Lana Loadout")
        self.assertEqual(purchase_order.shipping_contact_email, "shipping@plant.example.com")
        self.assertEqual(purchase_order.shipping_contact_title, "Shipping Supervisor")
        self.assertEqual(
            purchase_order.custom_data["contact_routing"]["billing_contact"]["department"],
            ContactDepartmentChoices.ACCOUNTING,
        )
        self.assertEqual(
            purchase_order.custom_data["contact_routing"]["shipping_contact"]["responsible_documents"],
            ["BOLs", "Loading Instructions"],
        )

    def test_purchase_order_keeps_legacy_supplier_fallback_when_no_typed_contacts_exist(self):
        supplier = Supplier.objects.create(
            tenant=self.tenant,
            name="Legacy Supplier",
            email="legacy@example.com",
            phone="800-555-9999",
            contact_person="Legacy Contact",
            address="300 Legacy Way",
            street_address="300 Legacy Way",
            city="Austin",
            state="TX",
            zip_code="73301",
        )

        purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=supplier,
            status=PurchaseOrderStatus.DRAFT,
            order_date=date(2026, 5, 7),
            total_amount="0.00",
        )

        self.assertEqual(purchase_order.supplier_contact_name, "Legacy Contact")
        self.assertEqual(purchase_order.supplier_contact_email, "legacy@example.com")
        self.assertEqual(purchase_order.billing_contact_name, "Legacy Contact")
        self.assertEqual(
            purchase_order.custom_data["contact_routing"]["billing_contact"]["source"],
            "supplier_email",
        )
