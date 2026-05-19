"""Deactivate Heart/offal products from the active product list.

These products are retained for historical reference but should not appear in
active product selection dropdowns or trade workflows.

Usage:
    python manage.py deactivate_heart_products
"""

from django.core.management.base import BaseCommand

from apps.system.models import Product


class Command(BaseCommand):
    help = "Deactivate Heart/offal products from active product lists"

    def handle(self, *args, **options):
        hearts = Product.objects.filter(product_code__icontains="HEART", is_active=True)
        count = hearts.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No active Heart products found — already clean."))
            return

        self.stdout.write(f"Deactivating {count} Heart products:")
        for p in hearts:
            self.stdout.write(f"  ⊘ {p.product_code}: {p.name}")

        hearts.update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"\n✓ Deactivated {count} Heart/offal products."))
