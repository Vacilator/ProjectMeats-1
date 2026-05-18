"""
Management command: simulate_inbound_email

Simulates realistic inbound trade emails by creating AIFeedbackLog entries
that appear in the AI approval queue. This allows testing the full
email → AI parse → approval → entity creation flow without actual
Outlook/email integration.

Usage:
    python manage.py simulate_inbound_email --tenant-slug=test-development-1
    python manage.py simulate_inbound_email --tenant-slug=test-development-1 --scenario=new_po
    python manage.py simulate_inbound_email --tenant-slug=test-development-1 --scenario=all
    python manage.py simulate_inbound_email --tenant-slug=test-development-1 --clean
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

SEED_MARKER = "SIMULATED_EMAIL"

EMAIL_SCENARIOS = {
    "new_po": {
        "subject": "PO #SC-2026-0847: Ground Beef 80/20 — 40,000 lbs @ $2.52/lb",
        "sender": "purchasing@sysco-test.com",
        "sender_name": "David Park",
        "document_type": "purchase_order",
        "confidence": 0.94,
        "extracted_data": {
            "po_number": "SC-2026-0847",
            "customer_name": "Sysco Corporation",
            "product": "80/20 Ground Beef (Fresh)",
            "protein": "beef",
            "quantity": "40,000 lbs",
            "price_per_unit": "$2.52",
            "total_value": "$100,800.00",
            "delivery_date": (date.today() + timedelta(days=12)).isoformat(),
            "delivery_location": "Sysco Houston Distribution Center",
            "payment_terms": "Net 30",
            "special_instructions": "Temperature must be maintained at 34°F or below during transit",
        },
    },
    "rfq_response": {
        "subject": "RE: RFQ — Boneless Chicken Breast 25K lbs",
        "sender": "sales@tyson-test.com",
        "sender_name": "Mike Johnson",
        "document_type": "rfq_response",
        "confidence": 0.89,
        "extracted_data": {
            "supplier_name": "Tyson Fresh Meats",
            "product": "Boneless Skinless Chicken Breast",
            "protein": "chicken",
            "quantity": "25,000 lbs",
            "bid_price": "$3.72/lb",
            "total_bid": "$93,000.00",
            "availability": "Available from Springdale plant, EST-001",
            "lead_time": "5 business days",
            "valid_until": (date.today() + timedelta(days=7)).isoformat(),
            "notes": "Price includes USDA inspection. FOB origin.",
        },
    },
    "shipment_update": {
        "subject": "Load #TRK-2026-4419 Departed — ETA Tomorrow 6:00 AM",
        "sender": "dispatch@swift-transport-test.com",
        "sender_name": "Logistics Team",
        "document_type": "shipment_update",
        "confidence": 0.96,
        "extracted_data": {
            "tracking_number": "TRK-2026-4419",
            "carrier_name": "Swift Transportation",
            "origin": "JBS Grand Island, NE (EST-089)",
            "destination": "US Foods Rosemont, IL",
            "departure_time": timezone.now().isoformat(),
            "eta": (date.today() + timedelta(days=1)).isoformat() + "T06:00:00",
            "temperature": "33°F (within spec)",
            "weight": "38,500 lbs",
            "product": "Beef Ribeye CAB Choice",
            "seal_number": "SEAL-88721",
        },
    },
    "invoice": {
        "subject": "Invoice #INV-NB-2026-0156 — Pork Loin Delivery 05/14",
        "sender": "billing@nationalbeef-test.com",
        "sender_name": "Amanda Foster",
        "document_type": "invoice",
        "confidence": 0.93,
        "extracted_data": {
            "invoice_number": "INV-NB-2026-0156",
            "supplier_name": "National Beef",
            "product": "Pork Loin Boneless",
            "quantity": "15,000 lbs",
            "unit_price": "$4.35/lb",
            "total_amount": "$65,250.00",
            "delivery_date": (date.today() - timedelta(days=4)).isoformat(),
            "payment_due": (date.today() + timedelta(days=26)).isoformat(),
            "payment_terms": "Net 30",
            "reference_po": "PO-2026-0723",
        },
    },
    "price_inquiry": {
        "subject": "Checking availability — Chicken Thighs Bone-In, 30K lbs",
        "sender": "orders@usfoods-test.com",
        "sender_name": "Lisa Wong",
        "document_type": "new_order",
        "confidence": 0.85,
        "extracted_data": {
            "customer_name": "US Foods Inc",
            "product": "Chicken Thighs Bone-In",
            "protein": "chicken",
            "quantity": "30,000 lbs",
            "desired_price": "Market rate (under $2.20/lb preferred)",
            "delivery_window": "Week of " + (date.today() + timedelta(days=14)).strftime("%B %d"),
            "notes": "Flexible on delivery date. Need confirmation by EOD Thursday.",
            "urgency": "medium",
        },
    },
    "complaint": {
        "subject": "Quality Issue — Load #TRK-2026-4201 (Temperature Breach)",
        "sender": "qa@pfg-test.com",
        "sender_name": "Robert Taylor",
        "document_type": "complaint",
        "confidence": 0.91,
        "extracted_data": {
            "customer_name": "Performance Food Group",
            "issue_type": "temperature_breach",
            "load_number": "TRK-2026-4201",
            "product": "Boneless Skinless Chicken Breast",
            "received_temperature": "42°F",
            "required_temperature": "Below 40°F",
            "quantity_affected": "Full load — 25,000 lbs",
            "action_requested": "Full credit or replacement shipment",
            "delivery_date": (date.today() - timedelta(days=2)).isoformat(),
        },
    },
}


class Command(BaseCommand):
    help = "Simulate inbound trade emails by creating AI approval queue entries"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant-slug",
            required=True,
            help="Slug of the tenant to create entries for",
        )
        parser.add_argument(
            "--scenario",
            default="all",
            help=f"Scenario name or 'all'. Options: {', '.join(EMAIL_SCENARIOS.keys())}",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove previously simulated entries",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=1,
            help="Number of entries to create per scenario (default: 1)",
        )

    def handle(self, *args, **options):
        from tenant_apps.ai_assistant.models import AIFeedbackLog

        from apps.tenants.models import Tenant

        tenant_slug = options["tenant_slug"]
        try:
            tenant = Tenant.objects.get(slug=tenant_slug, is_active=True)
        except Tenant.DoesNotExist as exc:
            raise CommandError(f"Tenant '{tenant_slug}' not found or inactive.") from exc

        if options["clean"]:
            count = AIFeedbackLog.objects.filter(
                tenant=tenant,
                custom_data__contains={"_seed": SEED_MARKER},
            ).delete()[0]
            self.stdout.write(self.style.SUCCESS(f"✅ Removed {count} simulated email entries"))
            return

        scenario_arg = options["scenario"].strip().lower()
        if scenario_arg == "all":
            scenarios = list(EMAIL_SCENARIOS.keys())
        else:
            scenarios = [scenario.strip() for scenario in scenario_arg.split(",") if scenario.strip()]
            invalid = set(scenarios) - set(EMAIL_SCENARIOS.keys())
            if invalid:
                raise CommandError(
                    f"Unknown scenarios: {', '.join(sorted(invalid))}.\n" f"Valid: {', '.join(EMAIL_SCENARIOS.keys())}"
                )

        count_per = options["count"]
        if count_per < 1:
            raise CommandError("--count must be at least 1")

        total_created = 0

        self.stdout.write(f"\n{'=' * 60}")
        self.stdout.write(f"  Simulating {len(scenarios)} email scenario(s) × {count_per}")
        self.stdout.write(f"  Tenant: {tenant.name} ({tenant.slug})")
        self.stdout.write(f"{'=' * 60}\n")

        for scenario_name in scenarios:
            scenario = EMAIL_SCENARIOS[scenario_name]
            for index in range(count_per):
                AIFeedbackLog.objects.create(
                    tenant=tenant,
                    document_id=uuid.uuid4(),
                    document_type=scenario["document_type"],
                    original_extracted_data={
                        "sender": scenario["sender"],
                        "sender_name": scenario["sender_name"],
                        "subject": scenario["subject"],
                        **scenario["extracted_data"],
                    },
                    confidence_score=scenario["confidence"],
                    custom_data={"_seed": SEED_MARKER, "simulated": True},
                )
                total_created += 1
                suffix = f" (#{index + 1})" if count_per > 1 else ""
                self.stdout.write(
                    f"  ✓ {scenario_name}{suffix}: {scenario['subject'][:60]}... "
                    f"(confidence: {scenario['confidence']:.0%})"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Created {total_created} AI approval queue entries. "
                f"Log in and check My Tasks → AI Approvals tab."
            )
        )
