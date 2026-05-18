"""
Management command: seed_trade_scenarios

Creates realistic E2E trade workflow test data for admin test accounts.
Seeds multiple trade scenarios at various pipeline stages so QA and admins
can exercise the full workflow without needing to manually create entities.

Usage:
    python manage.py seed_trade_scenarios --tenant-slug=test-development-1
    python manage.py seed_trade_scenarios --tenant-slug=test-development-1 --scenarios=all
    python manage.py seed_trade_scenarios --tenant-slug=test-development-1 --scenarios=inquiry_draft,broker_full
    python manage.py seed_trade_scenarios --clean  # Remove previously seeded test data

Scenarios:
    1. inquiry_draft       — Fresh inquiry, no products yet (stage 0)
    2. inquiry_with_bids   — Inquiry with products + supplier bids pending (stage 0)
    3. inquiry_quoted      — Inquiry quoted, awaiting acceptance (stage 0)
    4. inquiry_accepted    — Inquiry accepted, ready to advance to PO (stage 0→1)
    5. broker_rfq_sent     — BROKER route: RFQ sent, awaiting supplier reply (stage 0)
    6. broker_po_draft     — BROKER route: supplier PO drafted, needs approval (stage 1)
    7. fulfill_so_draft    — FULFILL route: sales order drafted (stage 2)
    8. logistics_pending   — Carrier PO drafted, awaiting logistics confirmation (stage 3)
    9. near_complete       — All docs created, just needs invoice + payment (stage 5)
    10. broker_full        — Full BROKER E2E with all entities linked (complete)
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

# Test data marker — used to identify seeded data for cleanup
SEED_MARKER = "E2E_TEST_SEED"


class Command(BaseCommand):
    help = "Seed realistic trade workflow scenarios for E2E testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant-slug",
            required=True,
            help="Slug of the tenant to seed data into",
        )
        parser.add_argument(
            "--scenarios",
            default="all",
            help="Comma-separated scenario names or 'all' (default: all)",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove previously seeded test data (identified by marker)",
        )
        parser.add_argument(
            "--user",
            default=None,
            help="Username to assign as created_by (default: first admin user in tenant)",
        )

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model

        from apps.tenants.models import Tenant, TenantUser

        User = get_user_model()

        tenant_slug = options["tenant_slug"]
        try:
            tenant = Tenant.objects.get(slug=tenant_slug, is_active=True)
        except Tenant.DoesNotExist:
            raise CommandError(f"Tenant '{tenant_slug}' not found or inactive.")

        if options["clean"]:
            self._clean_seeded_data(tenant)
            return

        # Resolve user
        username = options["user"]
        if username:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                raise CommandError(f"User '{username}' not found.")
        else:
            membership = (
                TenantUser.objects.filter(tenant=tenant, is_active=True, role__in=["owner", "admin"])
                .select_related("user")
                .first()
            )
            if not membership:
                raise CommandError(f"No admin user found in tenant '{tenant_slug}'.")
            user = membership.user

        # Parse scenarios
        scenario_arg = options["scenarios"].strip().lower()
        all_scenarios = [
            "inquiry_draft",
            "inquiry_with_bids",
            "inquiry_quoted",
            "inquiry_accepted",
            "broker_rfq_sent",
            "broker_po_draft",
            "fulfill_so_draft",
            "logistics_pending",
            "near_complete",
            "broker_full",
            "email_sourced",
            "multi_approval",
        ]
        if scenario_arg == "all":
            scenarios = all_scenarios
        else:
            scenarios = [s.strip() for s in scenario_arg.split(",") if s.strip()]
            invalid = set(scenarios) - set(all_scenarios)
            if invalid:
                raise CommandError(f"Unknown scenarios: {', '.join(invalid)}.\n" f"Valid: {', '.join(all_scenarios)}")

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(f"  Seeding {len(scenarios)} trade scenarios")
        self.stdout.write(f"  Tenant: {tenant.name} ({tenant.slug})")
        self.stdout.write(f"  User:   {user.username}")
        self.stdout.write(f"{'='*60}\n")

        with transaction.atomic():
            # Ensure master data exists
            suppliers = self._ensure_suppliers(tenant)
            customers = self._ensure_customers(tenant)
            contacts = self._ensure_contacts(tenant, suppliers, customers)
            plants = self._ensure_plants(tenant, suppliers)
            products = self._ensure_products(tenant)

            for scenario in scenarios:
                handler = getattr(self, f"_seed_{scenario}", None)
                if not handler:
                    self.stdout.write(self.style.WARNING(f"  ⚠ No handler for: {scenario}"))
                    continue
                handler(
                    tenant=tenant,
                    user=user,
                    suppliers=suppliers,
                    customers=customers,
                    plants=plants,
                    products=products,
                    contacts=contacts,
                )

        self.stdout.write(self.style.SUCCESS(f"\n✅ All {len(scenarios)} scenarios seeded successfully!"))
        self.stdout.write(f"\nYou can now log in as '{user.username}' and navigate to My Trades.")

    # ─── Master Data Helpers ──────────────────────────────────────────────────

    def _ensure_suppliers(self, tenant):
        from tenant_apps.suppliers.models import Supplier

        supplier_data = [
            {"name": "Tyson Fresh Meats", "email": "sales@tyson-test.com", "city": "Springdale", "state": "AR"},
            {"name": "Cargill Protein", "email": "orders@cargill-test.com", "city": "Wichita", "state": "KS"},
            {"name": "JBS USA Holdings", "email": "procurement@jbs-test.com", "city": "Greeley", "state": "CO"},
            {"name": "National Beef", "email": "bids@nationalbeef-test.com", "city": "Dodge City", "state": "KS"},
        ]
        suppliers = []
        for data in supplier_data:
            supplier, created = Supplier.objects.get_or_create(
                tenant=tenant,
                name=data["name"],
                defaults={
                    "email": data["email"],
                    "city": data.get("city", ""),
                    "state": data.get("state", ""),
                    "is_active": True,
                    "custom_data": {"_seed": SEED_MARKER},
                },
            )
            suppliers.append(supplier)
            if created:
                self.stdout.write(f"  + Supplier: {supplier.name}")
        return suppliers

    def _ensure_customers(self, tenant):
        from tenant_apps.customers.models import Customer

        customer_data = [
            {"name": "Sysco Corporation", "email": "purchasing@sysco-test.com", "city": "Houston", "state": "TX"},
            {"name": "US Foods Inc", "email": "orders@usfoods-test.com", "city": "Rosemont", "state": "IL"},
            {"name": "Performance Food Group", "email": "buyer@pfg-test.com", "city": "Richmond", "state": "VA"},
        ]
        customers = []
        for data in customer_data:
            customer, created = Customer.objects.get_or_create(
                tenant=tenant,
                name=data["name"],
                defaults={
                    "email": data["email"],
                    "city": data.get("city", ""),
                    "state": data.get("state", ""),
                    "is_active": True,
                    "custom_data": {"_seed": SEED_MARKER},
                },
            )
            customers.append(customer)
            if created:
                self.stdout.write(f"  + Customer: {customer.name}")
        return customers

    def _ensure_contacts(self, tenant, suppliers, customers):
        from tenant_apps.contacts.models import Contact

        contacts = []
        supplier_contacts = [
            {
                "first_name": "Mike",
                "last_name": "Johnson",
                "email": "mike.j@tyson-test.com",
                "supplier": suppliers[0],
                "department": "sales",
            },
            {
                "first_name": "Sarah",
                "last_name": "Chen",
                "email": "sarah.c@cargill-test.com",
                "supplier": suppliers[1],
                "department": "sales",
            },
            {
                "first_name": "Carlos",
                "last_name": "Rivera",
                "email": "carlos.r@jbs-test.com",
                "supplier": suppliers[2],
                "department": "sales",
            },
            {
                "first_name": "Amanda",
                "last_name": "Foster",
                "email": "amanda.f@nationalbeef-test.com",
                "supplier": suppliers[3],
                "department": "sales",
            },
        ]
        for data in supplier_contacts:
            contact, created = Contact.objects.get_or_create(
                tenant=tenant,
                email=data["email"],
                defaults={
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                    "supplier": data["supplier"],
                    "department": data.get("department", ""),
                    "custom_data": {"_seed": SEED_MARKER},
                },
            )
            contacts.append(contact)
            if created:
                self.stdout.write(f"  + Contact: {contact.first_name} {contact.last_name} ({contact.email})")

        customer_contacts = [
            {
                "first_name": "David",
                "last_name": "Park",
                "email": "david.p@sysco-test.com",
                "customer": customers[0],
                "department": "sales",
            },
            {
                "first_name": "Lisa",
                "last_name": "Wong",
                "email": "lisa.w@usfoods-test.com",
                "customer": customers[1],
                "department": "sales",
            },
            {
                "first_name": "Robert",
                "last_name": "Taylor",
                "email": "robert.t@pfg-test.com",
                "customer": customers[2],
                "department": "sales",
            },
        ]
        for data in customer_contacts:
            contact, created = Contact.objects.get_or_create(
                tenant=tenant,
                email=data["email"],
                defaults={
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                    "customer": data["customer"],
                    "department": data.get("department", ""),
                    "custom_data": {"_seed": SEED_MARKER},
                },
            )
            contacts.append(contact)
            if created:
                self.stdout.write(f"  + Contact: {contact.first_name} {contact.last_name} ({contact.email})")

        return contacts

    def _ensure_plants(self, tenant, suppliers):
        from tenant_apps.plants.models import Plant

        plant_data = [
            {
                "name": "Tyson - Springdale #1",
                "supplier": suppliers[0],
                "city": "Springdale",
                "state": "AR",
                "plant_est_num": "EST-001",
            },
            {
                "name": "Cargill - Dodge City",
                "supplier": suppliers[1],
                "city": "Dodge City",
                "state": "KS",
                "plant_est_num": "EST-045",
            },
            {
                "name": "JBS - Grand Island",
                "supplier": suppliers[2],
                "city": "Grand Island",
                "state": "NE",
                "plant_est_num": "EST-089",
            },
            {
                "name": "National Beef - Liberal",
                "supplier": suppliers[3],
                "city": "Liberal",
                "state": "KS",
                "plant_est_num": "EST-112",
            },
        ]
        plants = []
        for data in plant_data:
            plant, created = Plant.objects.get_or_create(
                tenant=tenant,
                name=data["name"],
                defaults={
                    "supplier": data["supplier"],
                    "city": data.get("city", ""),
                    "state": data.get("state", ""),
                    "plant_est_num": data.get("plant_est_num", ""),
                    "country": "US",
                    "is_active": True,
                    "custom_data": {"_seed": SEED_MARKER},
                },
            )
            plants.append(plant)
            if created:
                self.stdout.write(f"  + Plant: {plant.name}")
        return plants

    def _ensure_products(self, tenant):
        from apps.system.models import Product

        product_data = [
            {"product_code": "SEED-GB80-20", "name": "80/20 Ground Beef (Fresh)", "protein_type": "beef"},
            {
                "product_code": "SEED-CHICK-BRST",
                "name": "Boneless Skinless Chicken Breast",
                "protein_type": "chicken",
            },
            {"product_code": "SEED-PORK-LOIN", "name": "Pork Loin Boneless", "protein_type": "pork"},
            {"product_code": "SEED-BEEF-RIBEYE", "name": "Beef Ribeye CAB Choice", "protein_type": "beef"},
            {
                "product_code": "SEED-CHICK-THIGH",
                "name": "Chicken Thighs Bone-In",
                "protein_type": "chicken",
            },
        ]
        products = []
        for data in product_data:
            product, created = Product.objects.get_or_create(
                product_code=data["product_code"],
                defaults={
                    "name": data["name"],
                    "protein_type": data.get("protein_type", ""),
                    "is_active": True,
                },
            )
            products.append(product)
            if created:
                self.stdout.write(f"  + Product: {product.name}")
        return products

    # ─── Inquiry / Trade Helpers ──────────────────────────────────────────────

    def _create_inquiry(
        self,
        *,
        tenant,
        user,
        entity_type,
        supplier=None,
        customer=None,
        route="BROKER",
        status="draft",
        description="",
        products_data=None,
    ):
        from tenant_apps.inquiries.models import Inquiry, InquiryProduct, InquiryProductSupplierBid
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry = Inquiry.objects.create(
            tenant=tenant,
            entity_type=entity_type,
            supplier=supplier,
            customer=customer,
            route_decision=route,
            status=status,
            source_type="other",
            notes=description or f"Test inquiry ({SEED_MARKER})",
            inquiry_date=date.today(),
            valid_until=date.today() + timedelta(days=14),
            created_by=user,
            custom_data={"_seed": SEED_MARKER},
        )

        # Create trade session
        trade_session, _ = get_or_create_trade_session(tenant=tenant, inquiry=inquiry)

        # Add products
        inquiry_products = []
        for pdata in products_data or []:
            ip = InquiryProduct.objects.create(
                tenant=tenant,
                inquiry=inquiry,
                product=pdata.get("product"),
                quantity=pdata.get("quantity", Decimal("40000")),
                desired_price_per_unit=pdata.get("price", Decimal("2.50")),
                desired_total=pdata.get("total", Decimal("100000.00")),
                desired_uom=pdata.get("uom", "LBS"),
                desired_uom_value=pdata.get("quantity", Decimal("40000")),
            )
            inquiry_products.append(ip)

            # Add supplier bids if specified
            for bid_data in pdata.get("bids", []):
                InquiryProductSupplierBid.objects.create(
                    tenant=tenant,
                    inquiry_product=ip,
                    supplier=bid_data["supplier"],
                    plant=bid_data.get("plant"),
                    bid_price_per_unit=bid_data.get("price"),
                    bid_total=bid_data.get("total"),
                    bid_uom=bid_data.get("uom", "LBS"),
                    bid_quantity=bid_data.get("quantity"),
                    bid_status=bid_data.get("status", "draft"),
                    bid_notes=bid_data.get("notes", ""),
                )

        return inquiry, trade_session, inquiry_products

    def _create_purchase_order(self, *, tenant, supplier, trade_session, status="draft"):
        from tenant_apps.purchase_orders.models import PurchaseOrder

        po = PurchaseOrder.objects.create(
            tenant=tenant,
            supplier=supplier,
            trade_session=trade_session,
            order_date=date.today(),
            status=status,
            total_amount=Decimal("100000.00"),
            custom_data={"_seed": SEED_MARKER},
        )
        return po

    def _create_sales_order(self, *, tenant, supplier, customer, trade_session, status="draft"):
        from tenant_apps.sales_orders.models import SalesOrder

        so = SalesOrder.objects.create(
            tenant=tenant,
            supplier=supplier,
            customer=customer,
            trade_session=trade_session,
            status=status,
            custom_data={"_seed": SEED_MARKER},
        )
        return so

    def _create_carrier_po(self, *, tenant, supplier, trade_session, status="draft"):
        from tenant_apps.carriers.models import Carrier
        from tenant_apps.purchase_orders.models import CarrierPurchaseOrder

        carrier, _ = Carrier.objects.get_or_create(
            tenant=tenant,
            name="Swift Transportation (Test)",
            defaults={"code": "SWT001", "custom_data": {"_seed": SEED_MARKER}},
        )
        cpo = CarrierPurchaseOrder.objects.create(
            tenant=tenant,
            carrier=carrier,
            supplier=supplier,
            trade_session=trade_session,
            status=status,
            custom_data={"_seed": SEED_MARKER},
        )
        return cpo

    def _create_fulfillment(self, *, tenant, inquiry, supplier, customer, carrier=None, status="pending"):
        from tenant_apps.carriers.models import Carrier
        from tenant_apps.fulfillments.models import Fulfillment

        if not carrier:
            carrier, _ = Carrier.objects.get_or_create(
                tenant=tenant,
                name="Swift Transportation (Test)",
                defaults={"code": "SWT001", "custom_data": {"_seed": SEED_MARKER}},
            )
        fulfillment = Fulfillment.objects.create(
            tenant=tenant,
            inquiry=inquiry,
            supplier=supplier,
            customer=customer,
            carrier=carrier,
            status=status,
            custom_data={"_seed": SEED_MARKER},
        )
        return fulfillment

    def _create_invoice(self, *, tenant, customer, sales_order=None, status="draft"):
        from tenant_apps.invoices.models import Invoice

        invoice = Invoice.objects.create(
            tenant=tenant,
            customer=customer,
            sales_order=sales_order,
            invoice_number=f"INV-TEST-{uuid.uuid4().hex[:8].upper()}",
            status=status,
            custom_data={"_seed": SEED_MARKER},
        )
        return invoice

    # ─── Scenario Handlers ────────────────────────────────────────────────────

    def _seed_inquiry_draft(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 1: Fresh inquiry, no products yet."""
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="draft",
            description="New trade request from Sysco — need 80/20 ground beef pricing",
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ inquiry_draft: {trade_session.trade_id} | Inquiry {inquiry.inquiry_number} (draft, no products)"
            )
        )

    def _seed_inquiry_with_bids(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 2: Inquiry with products and pending supplier bids."""
        products_data = [
            {
                "product": products[0],  # 80/20 Ground Beef
                "quantity": Decimal("40000"),
                "price": Decimal("2.45"),
                "total": Decimal("98000.00"),
                "bids": [
                    {
                        "supplier": suppliers[0],
                        "plant": plants[0],
                        "status": "draft",
                        "price": Decimal("2.40"),
                        "quantity": Decimal("40000"),
                        "total": Decimal("96000.00"),
                    },
                    {
                        "supplier": suppliers[1],
                        "plant": plants[1],
                        "status": "requested",
                        "price": None,
                        "quantity": None,
                        "total": None,
                        "notes": "Bid requested — awaiting response",
                    },
                ],
            },
            {
                "product": products[3],  # Ribeye CAB Choice
                "quantity": Decimal("10000"),
                "price": Decimal("12.50"),
                "total": Decimal("125000.00"),
                "bids": [
                    {
                        "supplier": suppliers[2],
                        "plant": plants[2],
                        "status": "received",
                        "price": Decimal("12.25"),
                        "quantity": Decimal("10000"),
                        "total": Decimal("122500.00"),
                        "notes": "Competitive bid received 05/15",
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="pending",
            description="Sysco weekly order — ground beef + premium steaks",
            products_data=products_data,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ inquiry_with_bids: {trade_session.trade_id} | {inquiry.inquiry_number} (2 products, 3 bids)"
            )
        )

    def _seed_inquiry_quoted(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 3: Inquiry fully quoted, waiting for customer acceptance."""
        products_data = [
            {
                "product": products[1],  # Chicken Breast
                "quantity": Decimal("25000"),
                "price": Decimal("3.80"),
                "total": Decimal("95000.00"),
                "bids": [
                    {
                        "supplier": suppliers[0],
                        "plant": plants[0],
                        "status": "accepted",
                        "price": Decimal("3.65"),
                        "quantity": Decimal("25000"),
                        "total": Decimal("91250.00"),
                        "notes": "Best price — accepted",
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[1],
            route="BROKER",
            status="quoted",
            description="US Foods bulk chicken breast order",
            products_data=products_data,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ inquiry_quoted: {trade_session.trade_id} | {inquiry.inquiry_number} (quoted, awaiting acceptance)"
            )
        )

    def _seed_inquiry_accepted(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 4: Inquiry accepted — ready to advance to PO creation."""
        products_data = [
            {
                "product": products[2],  # Pork Loin
                "quantity": Decimal("15000"),
                "price": Decimal("4.20"),
                "total": Decimal("63000.00"),
                "bids": [
                    {
                        "supplier": suppliers[3],
                        "plant": plants[3],
                        "status": "accepted",
                        "price": Decimal("4.10"),
                        "quantity": Decimal("15000"),
                        "total": Decimal("61500.00"),
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[2],
            route="BROKER",
            status="accepted",
            description="PFG pork loin order — accepted, ready for PO",
            products_data=products_data,
        )
        # Update trade session status
        trade_session.status = "sourcing"
        trade_session.save(update_fields=["status"])

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ inquiry_accepted: {trade_session.trade_id} | {inquiry.inquiry_number} (accepted → advance to PO)"
            )
        )

    def _seed_broker_rfq_sent(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 5: BROKER route with RFQ sent, awaiting supplier reply."""
        from tenant_apps.inquiries.models import InquirySupplierRFQ

        products_data = [
            {
                "product": products[0],
                "quantity": Decimal("50000"),
                "price": Decimal("2.55"),
                "total": Decimal("127500.00"),
                "bids": [
                    {
                        "supplier": suppliers[0],
                        "plant": plants[0],
                        "status": "requested",
                        "notes": "RFQ sent via email on 05/16",
                    },
                    {
                        "supplier": suppliers[1],
                        "plant": plants[1],
                        "status": "requested",
                        "notes": "RFQ sent via email on 05/16",
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="pending",
            description="Sysco large ground beef order — supplier RFQs sent",
            products_data=products_data,
        )
        # Create RFQ audit records
        for supplier in suppliers[:2]:
            recipient = next(
                (contact for contact in contacts or [] if getattr(contact, "supplier_id", None) == supplier.id), None
            )
            InquirySupplierRFQ.objects.create(
                tenant=tenant,
                inquiry=inquiry,
                supplier=supplier,
                recipient_email=getattr(recipient, "email", "") or supplier.email or "rfq-seed@test.invalid",
                recipient_name=(
                    f"{recipient.first_name} {recipient.last_name}".strip() if recipient else supplier.name
                ),
                status="sent",
                sent_at=timezone.now() - timedelta(hours=4),
            )

        self.stdout.write(
            self.style.SUCCESS(
                "  ✓ broker_rfq_sent: "
                f"{trade_session.trade_id} | {inquiry.inquiry_number} "
                "(RFQs sent, awaiting replies)"
            )
        )

    def _seed_broker_po_draft(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 6: BROKER route — supplier PO drafted, needs approval."""
        products_data = [
            {
                "product": products[4],  # Chicken Thighs
                "quantity": Decimal("30000"),
                "price": Decimal("2.10"),
                "total": Decimal("63000.00"),
                "bids": [
                    {
                        "supplier": suppliers[2],
                        "plant": plants[2],
                        "status": "accepted",
                        "price": Decimal("2.05"),
                        "quantity": Decimal("30000"),
                        "total": Decimal("61500.00"),
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[1],
            route="BROKER",
            status="accepted",
            description="US Foods chicken thighs — PO ready for approval",
            products_data=products_data,
        )
        # Create the supplier PO
        po = self._create_purchase_order(
            tenant=tenant,
            supplier=suppliers[2],
            trade_session=trade_session,
            status="pending_approval",
        )
        # Link back
        inquiry.supplier_purchase_order = po
        inquiry.save(update_fields=["supplier_purchase_order"])
        trade_session.status = "ordered"
        trade_session.save(update_fields=["status"])

        self.stdout.write(
            self.style.SUCCESS(f"  ✓ broker_po_draft: {trade_session.trade_id} | PO {po.order_number} pending approval")
        )

    def _seed_fulfill_so_draft(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 7: FULFILL route — sales order drafted."""
        products_data = [
            {
                "product": products[1],
                "quantity": Decimal("20000"),
                "price": Decimal("3.90"),
                "total": Decimal("78000.00"),
                "bids": [
                    {
                        "supplier": suppliers[0],
                        "plant": plants[0],
                        "status": "accepted",
                        "price": Decimal("3.75"),
                        "quantity": Decimal("20000"),
                        "total": Decimal("75000.00"),
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="supplier",
            supplier=suppliers[0],
            route="FULFILL",
            status="accepted",
            description="Tyson direct fulfillment — SO ready for customer confirmation",
            products_data=products_data,
        )
        # Create SO
        so = self._create_sales_order(
            tenant=tenant,
            supplier=suppliers[0],
            customer=customers[0],
            trade_session=trade_session,
            status="draft",
        )
        inquiry.sales_order = so
        inquiry.save(update_fields=["sales_order"])
        trade_session.status = "ordered"
        trade_session.save(update_fields=["status"])

        self.stdout.write(
            self.style.SUCCESS(f"  ✓ fulfill_so_draft: {trade_session.trade_id} | SO {so.our_sales_order_num} (draft)")
        )

    def _seed_logistics_pending(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 8: Carrier PO drafted, awaiting logistics confirmation."""
        products_data = [
            {
                "product": products[3],
                "quantity": Decimal("8000"),
                "price": Decimal("13.00"),
                "total": Decimal("104000.00"),
                "bids": [
                    {
                        "supplier": suppliers[2],
                        "plant": plants[2],
                        "status": "accepted",
                        "price": Decimal("12.80"),
                        "quantity": Decimal("8000"),
                        "total": Decimal("102400.00"),
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[2],
            route="BROKER",
            status="fulfilled",
            description="PFG ribeye — logistics being arranged",
            products_data=products_data,
        )
        # Create linked docs
        po = self._create_purchase_order(
            tenant=tenant,
            supplier=suppliers[2],
            trade_session=trade_session,
            status="approved",
        )
        so = self._create_sales_order(
            tenant=tenant,
            supplier=suppliers[2],
            customer=customers[2],
            trade_session=trade_session,
            status="approved",
        )
        cpo = self._create_carrier_po(
            tenant=tenant,
            supplier=suppliers[2],
            trade_session=trade_session,
            status="draft",
        )
        inquiry.supplier_purchase_order = po
        inquiry.sales_order = so
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["supplier_purchase_order", "sales_order", "carrier_purchase_order"])
        trade_session.status = "logistics"
        trade_session.save(update_fields=["status"])

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ logistics_pending: {trade_session.trade_id} | Carrier PO pending, all other docs approved"
            )
        )

    def _seed_near_complete(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 9: All docs created, just needs final invoice + payment tracking."""
        products_data = [
            {
                "product": products[2],
                "quantity": Decimal("12000"),
                "price": Decimal("4.50"),
                "total": Decimal("54000.00"),
                "bids": [
                    {
                        "supplier": suppliers[3],
                        "plant": plants[3],
                        "status": "accepted",
                        "price": Decimal("4.35"),
                        "quantity": Decimal("12000"),
                        "total": Decimal("52200.00"),
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="fulfilled",
            description="Sysco pork — delivered, awaiting invoice",
            products_data=products_data,
        )
        po = self._create_purchase_order(
            tenant=tenant,
            supplier=suppliers[3],
            trade_session=trade_session,
            status="delivered",
        )
        so = self._create_sales_order(
            tenant=tenant,
            supplier=suppliers[3],
            customer=customers[0],
            trade_session=trade_session,
            status="approved",
        )
        cpo = self._create_carrier_po(
            tenant=tenant,
            supplier=suppliers[3],
            trade_session=trade_session,
            status="delivered",
        )
        inquiry.supplier_purchase_order = po
        inquiry.sales_order = so
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["supplier_purchase_order", "sales_order", "carrier_purchase_order"])
        fulfillment = self._create_fulfillment(
            tenant=tenant,
            inquiry=inquiry,
            supplier=suppliers[3],
            customer=customers[0],
            carrier=cpo.carrier,
            status="delivered",
        )
        inquiry.custom_data = {**(inquiry.custom_data or {}), "fulfillment_id": str(fulfillment.id)}
        inquiry.save(update_fields=["custom_data"])
        trade_session.status = "logistics"
        trade_session.save(update_fields=["status"])

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ near_complete: {trade_session.trade_id} | All delivered — needs invoice generation"
            )
        )

    def _seed_broker_full(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 10: Full completed BROKER trade with all entities linked."""
        products_data = [
            {
                "product": products[0],
                "quantity": Decimal("45000"),
                "price": Decimal("2.60"),
                "total": Decimal("117000.00"),
                "bids": [
                    {
                        "supplier": suppliers[1],
                        "plant": plants[1],
                        "status": "accepted",
                        "price": Decimal("2.48"),
                        "quantity": Decimal("45000"),
                        "total": Decimal("111600.00"),
                    },
                ],
            },
            {
                "product": products[4],
                "quantity": Decimal("20000"),
                "price": Decimal("2.20"),
                "total": Decimal("44000.00"),
                "bids": [
                    {
                        "supplier": suppliers[1],
                        "plant": plants[1],
                        "status": "accepted",
                        "price": Decimal("2.10"),
                        "quantity": Decimal("20000"),
                        "total": Decimal("42000.00"),
                    },
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[1],
            route="BROKER",
            status="fulfilled",
            description="US Foods completed deal — full broker E2E reference",
            products_data=products_data,
        )
        po = self._create_purchase_order(
            tenant=tenant,
            supplier=suppliers[1],
            trade_session=trade_session,
            status="delivered",
        )
        so = self._create_sales_order(
            tenant=tenant,
            supplier=suppliers[1],
            customer=customers[1],
            trade_session=trade_session,
            status="approved",
        )
        cpo = self._create_carrier_po(
            tenant=tenant,
            supplier=suppliers[1],
            trade_session=trade_session,
            status="delivered",
        )
        inquiry.supplier_purchase_order = po
        inquiry.sales_order = so
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["supplier_purchase_order", "sales_order", "carrier_purchase_order"])
        fulfillment = self._create_fulfillment(
            tenant=tenant,
            inquiry=inquiry,
            supplier=suppliers[1],
            customer=customers[1],
            carrier=cpo.carrier,
            status="completed",
        )
        invoice = self._create_invoice(
            tenant=tenant,
            customer=customers[1],
            sales_order=so,
            status="paid",
        )
        inquiry.custom_data = {
            **(inquiry.custom_data or {}),
            "fulfillment_id": str(fulfillment.id),
            "invoice_id": str(invoice.id),
        }
        inquiry.save(update_fields=["custom_data"])
        trade_session.status = "completed"
        trade_session.completed_at = timezone.now()
        trade_session.save(update_fields=["status", "completed_at"])

        self.stdout.write(
            self.style.SUCCESS(f"  ✓ broker_full: {trade_session.trade_id} | COMPLETED — full E2E reference trade")
        )

    def _seed_email_sourced(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 11: Email-sourced inquiry with AI approval pending."""
        from tenant_apps.ai_assistant.models import AIFeedbackLog

        products_data = [
            {
                "product": products[0],
                "quantity": Decimal("35000"),
                "price": Decimal("2.55"),
                "total": Decimal("89250.00"),
                "bids": [],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant,
            user=user,
            entity_type="customer",
            customer=customers[0],
            supplier=suppliers[0],
            route="BROKER",
            status="draft",
            description="[Email] New PO request from Sysco — 35,000 lbs ground beef 80/20",
            products_data=products_data,
        )
        inquiry.source_type = "email"
        inquiry.source_email_message_id = f"seed-msg-{uuid.uuid4()}"
        inquiry.source_email_thread_id = f"seed-thread-{uuid.uuid4()}"
        inquiry.save(update_fields=["source_type", "source_email_message_id", "source_email_thread_id"])

        AIFeedbackLog.objects.create(
            tenant=tenant,
            document_id=uuid.uuid4(),
            document_type="purchase_order",
            original_extracted_data={
                "sender": "david.p@sysco-test.com",
                "subject": "PO Request: 35,000 lbs Ground Beef 80/20 — Delivery by June 15",
                "customer_name": "Sysco Corporation",
                "supplier_name": "Tyson Fresh Meats",
                "product": "80/20 Ground Beef (Fresh)",
                "quantity": "35,000 lbs",
                "price_per_lb": "$2.55",
                "total_value": "$89,250.00",
                "delivery_date": "2026-06-15",
                "payment_terms": "Net 30",
                "inquiry_id": str(inquiry.id),
                "trade_session_id": str(trade_session.id),
            },
            confidence_score=0.92,
            custom_data={"_seed": SEED_MARKER},
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✓ email_sourced: {trade_session.trade_id} | Email-sourced inquiry + AI approval pending"
            )
        )

    def _seed_multi_approval(self, *, tenant, user, suppliers, customers, plants, products, contacts=None):
        """Scenario 12: Multiple trade entities pending AI approval (batch test)."""
        from tenant_apps.ai_assistant.models import AIFeedbackLog

        email_scenarios = [
            {
                "subject": "Quote Request: Boneless Chicken Breast — 25K lbs weekly",
                "sender": "lisa.w@usfoods-test.com",
                "document_type": "rfq_response",
                "customer": "US Foods Inc",
                "supplier": "Cargill Protein",
                "product": "Boneless Skinless Chicken Breast",
                "quantity": "25,000 lbs/week",
                "confidence": 0.88,
            },
            {
                "subject": "RE: Invoice #INV-2026-0412 Payment Confirmation",
                "sender": "ap@pfg-test.com",
                "document_type": "invoice",
                "customer": "Performance Food Group",
                "supplier": None,
                "product": None,
                "quantity": None,
                "confidence": 0.95,
            },
            {
                "subject": "Shipping Update: Load #TRK-9921 Departed Dodge City",
                "sender": "dispatch@cargill-test.com",
                "document_type": "shipment_update",
                "customer": "Sysco Corporation",
                "supplier": "Cargill Protein",
                "product": "Pork Loin Boneless",
                "quantity": "12,000 lbs",
                "confidence": 0.91,
            },
        ]

        for scenario in email_scenarios:
            AIFeedbackLog.objects.create(
                tenant=tenant,
                document_id=uuid.uuid4(),
                document_type=scenario["document_type"],
                original_extracted_data={
                    "sender": scenario["sender"],
                    "subject": scenario["subject"],
                    "customer_name": scenario["customer"],
                    "supplier_name": scenario["supplier"],
                    "product": scenario["product"],
                    "quantity": scenario["quantity"],
                },
                confidence_score=scenario["confidence"],
                custom_data={"_seed": SEED_MARKER},
            )

        self.stdout.write(
            self.style.SUCCESS("  ✓ multi_approval: 3 AI feedback entries created for batch approval testing")
        )

    # ─── Cleanup ──────────────────────────────────────────────────────────────

    def _clean_seeded_data(self, tenant):
        """Remove all data seeded by this command (identified by custom_data marker)."""
        from tenant_apps.ai_assistant.models import AIFeedbackLog
        from tenant_apps.carriers.models import Carrier
        from tenant_apps.contacts.models import Contact
        from tenant_apps.customers.models import Customer
        from tenant_apps.fulfillments.models import Fulfillment
        from tenant_apps.inquiries.models import Inquiry
        from tenant_apps.invoices.models import Invoice
        from tenant_apps.plants.models import Plant
        from tenant_apps.purchase_orders.models import CarrierPurchaseOrder, PurchaseOrder
        from tenant_apps.sales_orders.models import SalesOrder
        from tenant_apps.suppliers.models import Supplier

        self.stdout.write(f"\nCleaning seeded data for tenant: {tenant.name}")

        filter_kwargs = {"tenant": tenant, "custom_data__contains": {"_seed": SEED_MARKER}}

        counts = {}
        for model, label in [
            (AIFeedbackLog, "AI Feedback Logs"),
            (Invoice, "Invoices"),
            (Fulfillment, "Fulfillments"),
            (CarrierPurchaseOrder, "Carrier POs"),
            (SalesOrder, "Sales Orders"),
            (PurchaseOrder, "Purchase Orders"),
        ]:
            qs = model.objects.filter(**filter_kwargs)
            counts[label] = qs.count()
            qs.delete()

        inquiries = Inquiry.objects.filter(**filter_kwargs)
        counts["Inquiries"] = inquiries.count()
        inquiries.delete()

        for model, label in [
            (Contact, "Contacts"),
            (Plant, "Plants"),
            (Customer, "Customers"),
            (Supplier, "Suppliers"),
            (Carrier, "Carriers"),
        ]:
            qs = model.objects.filter(**filter_kwargs)
            counts[label] = qs.count()
            qs.delete()

        for label, count in counts.items():
            if count:
                self.stdout.write(f"  🗑 Deleted {count} {label}")

        self.stdout.write(self.style.SUCCESS("✅ Cleanup complete"))
