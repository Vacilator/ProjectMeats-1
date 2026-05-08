"""
Check if search data exists for the dev tenant.
Usage: python manage.py check_search_data
"""
from django.apps import apps
from django.core.management.base import BaseCommand

from apps.tenants.models import Tenant


class Command(BaseCommand):
    help = "Check if searchable data exists in the database"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("🔍 Checking search data availability..."))

        # Get dev tenant
        try:
            tenant = Tenant.objects.get(slug="dev")
            self.stdout.write(f"✅ Found tenant: {tenant.name} (ID: {tenant.id})")
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR("❌ Dev tenant not found"))
            # List all tenants
            tenants = Tenant.objects.all()
            self.stdout.write(f'Available tenants: {list(tenants.values_list("slug", "name"))}')
            if tenants.exists():
                tenant = tenants.first()
                self.stdout.write(f"Using first tenant: {tenant.name}")
            else:
                self.stdout.write(self.style.ERROR("No tenants exist!"))
                return

        # Check each searchable entity
        searchable_entities = {
            "Supplier": ("suppliers", "Supplier"),
            "Customer": ("customers", "Customer"),
            "PurchaseOrder": ("purchase_orders", "PurchaseOrder"),
            "SalesOrder": ("sales_orders", "SalesOrder"),
            "Product": ("products", "Product"),
            "Contact": ("contacts", "Contact"),
            "Invoice": ("invoices", "Invoice"),
            "Plant": ("plants", "Plant"),
            "Carrier": ("carriers", "Carrier"),
        }

        self.stdout.write("\n📊 Data counts by entity:")
        total_records = 0

        for name, (app_label, model_name) in searchable_entities.items():
            try:
                Model = apps.get_model(app_label, model_name)
                count = Model.objects.filter(tenant=tenant).count()
                total_records += count

                if count > 0:
                    self.stdout.write(f"  ✅ {name}: {count} records")
                    # Show sample
                    sample = Model.objects.filter(tenant=tenant).first()
                    if hasattr(sample, "name"):
                        self.stdout.write(f"     Sample: {sample.name}")
                else:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  {name}: 0 records"))

            except LookupError:
                self.stdout.write(self.style.ERROR(f"  ❌ {name}: Model not found ({app_label}.{model_name})"))

        self.stdout.write(f"\n📈 Total searchable records: {total_records}")

        if total_records == 0:
            self.stdout.write(self.style.ERROR("\n⚠️  NO DATA FOUND!"))
            self.stdout.write("Search will return empty results until data is seeded.")
            self.stdout.write("\nTo seed data, run:")
            self.stdout.write("  python manage.py seed_all_modules")
        else:
            self.stdout.write(self.style.SUCCESS(f"\n✅ Search should work with {total_records} records"))
