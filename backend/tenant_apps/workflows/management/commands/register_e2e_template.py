"""Management command to register the EndToEndInquiryToPOProcess template.

Usage:
    python manage.py register_e2e_template
    python manage.py register_e2e_template --tenant meat-co
    python manage.py register_e2e_template --force
    python manage.py register_e2e_template --validate-only
"""

from django.core.management.base import BaseCommand

from apps.tenants.models import Tenant
from tenant_apps.workflows.services.template_registry import (
    get_e2e_template_data,
    register_e2e_template,
    validate_template_schema,
)


class Command(BaseCommand):
    help = "Register the EndToEndInquiryToPOProcess workflow template for tenants"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            type=str,
            help="Register for a specific tenant slug (default: all active tenants)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force update existing template registration",
        )
        parser.add_argument(
            "--validate-only",
            action="store_true",
            help="Only validate the template JSON without registering",
        )

    def handle(self, *args, **options):
        # Always validate first
        template_data = get_e2e_template_data()
        errors = validate_template_schema(template_data)

        if errors:
            self.stdout.write(self.style.ERROR("❌ Template validation FAILED:"))
            for err in errors:
                self.stdout.write(f"  • {err}")
            return

        meta = template_data.get("metadata", {})
        self.stdout.write(self.style.SUCCESS("✅ Template validation passed"))
        self.stdout.write(f"   Name: {template_data['name']}")
        self.stdout.write(f"   Triggers: {meta.get('triggerCount', '?')}")
        self.stdout.write(f"   Nodes: {meta.get('nodeCount', '?')}")
        self.stdout.write(f"   Edges: {meta.get('edgeCount', '?')}")
        self.stdout.write(f"   Loops: {meta.get('loopCount', '?')}")

        if options["validate_only"]:
            return

        # Determine target tenants
        if options.get("tenant"):
            try:
                tenants = [Tenant.objects.get(slug=options["tenant"])]
            except Tenant.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"Tenant '{options['tenant']}' not found")
                )
                return
        else:
            tenants = list(Tenant.objects.filter(is_active=True))
            if not tenants:
                self.stdout.write(self.style.WARNING("No active tenants found"))
                return

        self.stdout.write(f"\nRegistering for {len(tenants)} tenant(s)...")

        for tenant in tenants:
            try:
                form = register_e2e_template(tenant, force=options["force"])
                self.stdout.write(f"  ✓ {tenant.slug}: {form.pk}")
            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"  ✗ {tenant.slug}: {exc}")
                )

        self.stdout.write(self.style.SUCCESS("\n✅ Registration complete"))
