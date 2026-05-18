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
        from apps.tenants.models import Tenant, TenantUser
        from django.contrib.auth import get_user_model

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
            membership = TenantUser.objects.filter(
                tenant=tenant, is_active=True, role__in=["owner", "admin"]
            ).select_related("user").first()
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
        ]
        if scenario_arg == "all":
            scenarios = all_scenarios
        else:
            scenarios = [s.strip() for s in scenario_arg.split(",") if s.strip()]
            invalid = set(scenarios) - set(all_scenarios)
            if invalid:
                raise CommandError(
                    f"Unknown scenarios: {', '.join(invalid)}.\n"
                    f"Valid: {', '.join(all_scenarios)}"
                )

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(f"  Seeding {len(scenarios)} trade scenarios")
        self.stdout.write(f"  Tenant: {tenant.name} ({tenant.slug})")
        self.stdout.write(f"  User:   {user.username}")
        self.stdout.write(f"{'='*60}\n")

        with transaction.atomic():
            # Ensure master data exists
            suppliers = self._ensure_suppliers(tenant)
            customers = self._ensure_customers(tenant)
            plants = self._ensure_plants(tenant, suppliers)
            products = self._ensure_products(tenant)

            for scenario in scenarios:
                handler = getattr(self, f"_seed_{scenario}", None)
                if not handler:
                    self.stdout.write(self.style.WARNING(f"  ⚠ No handler for: {scenario}"))
                    continue
                handler(tenant=tenant, user=user, suppliers=suppliers,
                        customers=customers, plants=plants, products=products)

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

    def _ensure_plants(self, tenant, suppliers):
        from tenant_apps.plants.models import Plant

        plant_data = [
            {"name": "Tyson - Springdale #1", "supplier": suppliers[0], "city": "Springdale", "state": "AR", "plant_est_num": "EST-001"},
            {"name": "Cargill - Dodge City", "supplier": suppliers[1], "city": "Dodge City", "state": "KS", "plant_est_num": "EST-045"},
            {"name": "JBS - Grand Island", "supplier": suppliers[2], "city": "Grand Island", "state": "NE", "plant_est_num": "EST-089"},
            {"name": "National Beef - Liberal", "supplier": suppliers[3], "city": "Liberal", "state": "KS", "plant_est_num": "EST-112"},
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
            {"name": "80/20 Ground Beef (Fresh)", "protein": "beef"},
            {"name": "Boneless Skinless Chicken Breast", "protein": "chicken"},
            {"name": "Pork Loin Boneless", "protein": "pork"},
            {"name": "Beef Ribeye CAB Choice", "protein": "beef"},
            {"name": "Chicken Thighs Bone-In", "protein": "chicken"},
        ]
        products = []
        for data in product_data:
            product, created = Product.objects.get_or_create(
                name=data["name"],
                defaults={
                    "protein": data.get("protein", ""),
                    "is_active": True,
                },
            )
            products.append(product)
            if created:
                self.stdout.write(f"  + Product: {product.name}")
        return products

    # ─── Inquiry / Trade Helpers ──────────────────────────────────────────────

    def _create_inquiry(self, *, tenant, user, entity_type, supplier=None, customer=None,
                        route="BROKER", status="draft", description="", products_data=None):
        from tenant_apps.inquiries.models import (
            Inquiry, InquiryProduct, InquiryProductSupplierBid, TradeSession,
        )
        from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

        inquiry = Inquiry.objects.create(
            tenant=tenant,
            entity_type=entity_type,
            supplier=supplier,
            customer=customer,
            route_decision=route,
            status=status,
            source_type="other",
            description=description or f"Test inquiry ({SEED_MARKER})",
            inquiry_date=date.today(),
            valid_until=date.today() + timedelta(days=14),
            created_by=user,
            custom_data={"_seed": SEED_MARKER},
        )

        # Create trade session
        trade_session, _ = get_or_create_trade_session(tenant=tenant, inquiry=inquiry)

        # Add products
        inquiry_products = []
        for pdata in (products_data or []):
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
        from tenant_apps.purchase_orders.models import CarrierPurchaseOrder
        from tenant_apps.carriers.models import Carrier

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

    # ─── Scenario Handlers ────────────────────────────────────────────────────

    def _seed_inquiry_draft(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 1: Fresh inquiry, no products yet."""
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="draft",
            description="New trade request from Sysco — need 80/20 ground beef pricing",
        )
        self.stdout.write(self.style.SUCCESS(
            f"  ✓ inquiry_draft: {trade_session.trade_id} | Inquiry {inquiry.inquiry_number} (draft, no products)"
        ))

    def _seed_inquiry_with_bids(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 2: Inquiry with products and pending supplier bids."""
        products_data = [
            {
                "product": products[0],  # 80/20 Ground Beef
                "quantity": Decimal("40000"),
                "price": Decimal("2.45"),
                "total": Decimal("98000.00"),
                "bids": [
                    {"supplier": suppliers[0], "plant": plants[0], "status": "draft",
                     "price": Decimal("2.40"), "quantity": Decimal("40000"), "total": Decimal("96000.00")},
                    {"supplier": suppliers[1], "plant": plants[1], "status": "requested",
                     "price": None, "quantity": None, "total": None,
                     "notes": "Bid requested — awaiting response"},
                ],
            },
            {
                "product": products[3],  # Ribeye CAB Choice
                "quantity": Decimal("10000"),
                "price": Decimal("12.50"),
                "total": Decimal("125000.00"),
                "bids": [
                    {"supplier": suppliers[2], "plant": plants[2], "status": "received",
                     "price": Decimal("12.25"), "quantity": Decimal("10000"), "total": Decimal("122500.00"),
                     "notes": "Competitive bid received 05/15"},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="pending",
            description="Sysco weekly order — ground beef + premium steaks",
            products_data=products_data,
        )
        self.stdout.write(self.style.SUCCESS(
            f"  ✓ inquiry_with_bids: {trade_session.trade_id} | {inquiry.inquiry_number} (2 products, 3 bids)"
        ))

    def _seed_inquiry_quoted(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 3: Inquiry fully quoted, waiting for customer acceptance."""
        products_data = [
            {
                "product": products[1],  # Chicken Breast
                "quantity": Decimal("25000"),
                "price": Decimal("3.80"),
                "total": Decimal("95000.00"),
                "bids": [
                    {"supplier": suppliers[0], "plant": plants[0], "status": "accepted",
                     "price": Decimal("3.65"), "quantity": Decimal("25000"), "total": Decimal("91250.00"),
                     "notes": "Best price — accepted"},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[1],
            route="BROKER",
            status="quoted",
            description="US Foods bulk chicken breast order",
            products_data=products_data,
        )
        self.stdout.write(self.style.SUCCESS(
            f"  ✓ inquiry_quoted: {trade_session.trade_id} | {inquiry.inquiry_number} (quoted, awaiting acceptance)"
        ))

    def _seed_inquiry_accepted(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 4: Inquiry accepted — ready to advance to PO creation."""
        products_data = [
            {
                "product": products[2],  # Pork Loin
                "quantity": Decimal("15000"),
                "price": Decimal("4.20"),
                "total": Decimal("63000.00"),
                "bids": [
                    {"supplier": suppliers[3], "plant": plants[3], "status": "accepted",
                     "price": Decimal("4.10"), "quantity": Decimal("15000"), "total": Decimal("61500.00")},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
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

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ inquiry_accepted: {trade_session.trade_id} | {inquiry.inquiry_number} (accepted → advance to PO)"
        ))

    def _seed_broker_rfq_sent(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 5: BROKER route with RFQ sent, awaiting supplier reply."""
        from tenant_apps.inquiries.models import InquirySupplierRFQ

        products_data = [
            {
                "product": products[0],
                "quantity": Decimal("50000"),
                "price": Decimal("2.55"),
                "total": Decimal("127500.00"),
                "bids": [
                    {"supplier": suppliers[0], "plant": plants[0], "status": "requested",
                     "notes": "RFQ sent via email on 05/16"},
                    {"supplier": suppliers[1], "plant": plants[1], "status": "requested",
                     "notes": "RFQ sent via email on 05/16"},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="pending",
            description="Sysco large ground beef order — supplier RFQs sent",
            products_data=products_data,
        )
        # Create RFQ audit records
        for supplier in suppliers[:2]:
            InquirySupplierRFQ.objects.create(
                tenant=tenant,
                inquiry=inquiry,
                supplier=supplier,
                rfq_status="sent",
                sent_at=timezone.now() - timedelta(hours=4),
            )

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ broker_rfq_sent: {trade_session.trade_id} | {inquiry.inquiry_number} (RFQs sent, awaiting replies)"
        ))

    def _seed_broker_po_draft(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 6: BROKER route — supplier PO drafted, needs approval."""
        products_data = [
            {
                "product": products[4],  # Chicken Thighs
                "quantity": Decimal("30000"),
                "price": Decimal("2.10"),
                "total": Decimal("63000.00"),
                "bids": [
                    {"supplier": suppliers[2], "plant": plants[2], "status": "accepted",
                     "price": Decimal("2.05"), "quantity": Decimal("30000"), "total": Decimal("61500.00")},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[1],
            route="BROKER",
            status="accepted",
            description="US Foods chicken thighs — PO ready for approval",
            products_data=products_data,
        )
        # Create the supplier PO
        po = self._create_purchase_order(
            tenant=tenant, supplier=suppliers[2],
            trade_session=trade_session, status="pending_approval",
        )
        # Link back
        inquiry.supplier_purchase_order = po
        inquiry.save(update_fields=["supplier_purchase_order"])
        trade_session.status = "ordered"
        trade_session.save(update_fields=["status"])

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ broker_po_draft: {trade_session.trade_id} | PO {po.order_number} pending approval"
        ))

    def _seed_fulfill_so_draft(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 7: FULFILL route — sales order drafted."""
        products_data = [
            {
                "product": products[1],
                "quantity": Decimal("20000"),
                "price": Decimal("3.90"),
                "total": Decimal("78000.00"),
                "bids": [
                    {"supplier": suppliers[0], "plant": plants[0], "status": "accepted",
                     "price": Decimal("3.75"), "quantity": Decimal("20000"), "total": Decimal("75000.00")},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="supplier",
            supplier=suppliers[0],
            route="FULFILL",
            status="accepted",
            description="Tyson direct fulfillment — SO ready for customer confirmation",
            products_data=products_data,
        )
        # Create SO
        so = self._create_sales_order(
            tenant=tenant, supplier=suppliers[0], customer=customers[0],
            trade_session=trade_session, status="draft",
        )
        inquiry.sales_order = so
        inquiry.save(update_fields=["sales_order"])
        trade_session.status = "ordered"
        trade_session.save(update_fields=["status"])

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ fulfill_so_draft: {trade_session.trade_id} | SO {so.our_sales_order_num} (draft)"
        ))

    def _seed_logistics_pending(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 8: Carrier PO drafted, awaiting logistics confirmation."""
        products_data = [
            {
                "product": products[3],
                "quantity": Decimal("8000"),
                "price": Decimal("13.00"),
                "total": Decimal("104000.00"),
                "bids": [
                    {"supplier": suppliers[2], "plant": plants[2], "status": "accepted",
                     "price": Decimal("12.80"), "quantity": Decimal("8000"), "total": Decimal("102400.00")},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[2],
            route="BROKER",
            status="fulfilled",
            description="PFG ribeye — logistics being arranged",
            products_data=products_data,
        )
        # Create linked docs
        po = self._create_purchase_order(
            tenant=tenant, supplier=suppliers[2],
            trade_session=trade_session, status="approved",
        )
        so = self._create_sales_order(
            tenant=tenant, supplier=suppliers[2], customer=customers[2],
            trade_session=trade_session, status="approved",
        )
        cpo = self._create_carrier_po(
            tenant=tenant, supplier=suppliers[2],
            trade_session=trade_session, status="draft",
        )
        inquiry.supplier_purchase_order = po
        inquiry.sales_order = so
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["supplier_purchase_order", "sales_order", "carrier_purchase_order"])
        trade_session.status = "logistics"
        trade_session.save(update_fields=["status"])

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ logistics_pending: {trade_session.trade_id} | Carrier PO pending, all other docs approved"
        ))

    def _seed_near_complete(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 9: All docs created, just needs final invoice + payment tracking."""
        products_data = [
            {
                "product": products[2],
                "quantity": Decimal("12000"),
                "price": Decimal("4.50"),
                "total": Decimal("54000.00"),
                "bids": [
                    {"supplier": suppliers[3], "plant": plants[3], "status": "accepted",
                     "price": Decimal("4.35"), "quantity": Decimal("12000"), "total": Decimal("52200.00")},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[0],
            route="BROKER",
            status="fulfilled",
            description="Sysco pork — delivered, awaiting invoice",
            products_data=products_data,
        )
        po = self._create_purchase_order(
            tenant=tenant, supplier=suppliers[3],
            trade_session=trade_session, status="delivered",
        )
        so = self._create_sales_order(
            tenant=tenant, supplier=suppliers[3], customer=customers[0],
            trade_session=trade_session, status="approved",
        )
        cpo = self._create_carrier_po(
            tenant=tenant, supplier=suppliers[3],
            trade_session=trade_session, status="delivered",
        )
        inquiry.supplier_purchase_order = po
        inquiry.sales_order = so
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["supplier_purchase_order", "sales_order", "carrier_purchase_order"])
        trade_session.status = "logistics"
        trade_session.save(update_fields=["status"])

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ near_complete: {trade_session.trade_id} | All delivered — needs invoice generation"
        ))

    def _seed_broker_full(self, *, tenant, user, suppliers, customers, plants, products):
        """Scenario 10: Full completed BROKER trade with all entities linked."""
        products_data = [
            {
                "product": products[0],
                "quantity": Decimal("45000"),
                "price": Decimal("2.60"),
                "total": Decimal("117000.00"),
                "bids": [
                    {"supplier": suppliers[1], "plant": plants[1], "status": "accepted",
                     "price": Decimal("2.48"), "quantity": Decimal("45000"), "total": Decimal("111600.00")},
                ],
            },
            {
                "product": products[4],
                "quantity": Decimal("20000"),
                "price": Decimal("2.20"),
                "total": Decimal("44000.00"),
                "bids": [
                    {"supplier": suppliers[1], "plant": plants[1], "status": "accepted",
                     "price": Decimal("2.10"), "quantity": Decimal("20000"), "total": Decimal("42000.00")},
                ],
            },
        ]
        inquiry, trade_session, _ = self._create_inquiry(
            tenant=tenant, user=user,
            entity_type="customer",
            customer=customers[1],
            route="BROKER",
            status="fulfilled",
            description="US Foods completed deal — full broker E2E reference",
            products_data=products_data,
        )
        po = self._create_purchase_order(
            tenant=tenant, supplier=suppliers[1],
            trade_session=trade_session, status="delivered",
        )
        so = self._create_sales_order(
            tenant=tenant, supplier=suppliers[1], customer=customers[1],
            trade_session=trade_session, status="approved",
        )
        cpo = self._create_carrier_po(
            tenant=tenant, supplier=suppliers[1],
            trade_session=trade_session, status="delivered",
        )
        inquiry.supplier_purchase_order = po
        inquiry.sales_order = so
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["supplier_purchase_order", "sales_order", "carrier_purchase_order"])
        trade_session.status = "completed"
        trade_session.completed_at = timezone.now()
        trade_session.save(update_fields=["status", "completed_at"])

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ broker_full: {trade_session.trade_id} | COMPLETED — full E2E reference trade"
        ))

    # ─── Cleanup ──────────────────────────────────────────────────────────────

    def _clean_seeded_data(self, tenant):
        """Remove all data seeded by this command (identified by custom_data marker)."""
        from tenant_apps.inquiries.models import Inquiry, TradeSession
        from tenant_apps.purchase_orders.models import PurchaseOrder, CarrierPurchaseOrder
        from tenant_apps.sales_orders.models import SalesOrder

        self.stdout.write(f"\nCleaning seeded data for tenant: {tenant.name}")

        # Delete in reverse dependency order
        filter_kwargs = {"tenant": tenant, "custom_data__contains": {"_seed": SEED_MARKER}}

        counts = {}
        for model, label in [
            (CarrierPurchaseOrder, "Carrier POs"),
            (SalesOrder, "Sales Orders"),
            (PurchaseOrder, "Purchase Orders"),
        ]:
            qs = model.objects.filter(**filter_kwargs)
            counts[label] = qs.count()
            qs.delete()

        # Trade sessions + inquiries (cascade handles products/bids)
        inquiries = Inquiry.objects.filter(**filter_kwargs)
        counts["Inquiries"] = inquiries.count()
        # Trade sessions will cascade-delete via OneToOne
        inquiries.delete()

        for label, count in counts.items():
            if count:
                self.stdout.write(f"  🗑 Deleted {count} {label}")

        self.stdout.write(self.style.SUCCESS("✅ Cleanup complete"))
