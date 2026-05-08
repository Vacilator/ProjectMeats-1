"""
Management command to migrate products from tenant_apps.products to system.Product.

This command:
1. Deduplicates products by product_code (235 tenant copies → ~32 unique)
2. Creates system.Product records for unique products
3. Creates TenantProductPreference for each tenant's product usage
4. Tracks legacy IDs for rollback capability

Usage:
    python manage.py migrate_products_to_system --dry-run  # Preview changes
    python manage.py migrate_products_to_system            # Execute migration
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Migrate products from tenant_apps.products to system.Product"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without making them",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show detailed output",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        verbose = options["verbose"]

        self.stdout.write(
            self.style.MIGRATE_HEADING(f"{'[DRY RUN] ' if dry_run else ''}Migrating products to system app...")
        )

        # Import models
        from tenant_apps.products.models import Product as TenantProduct

        from apps.system.models import Product as SystemProduct
        from apps.system.models import TenantProductPreference

        # Get all tenant products
        tenant_products = TenantProduct.objects.select_related("tenant", "supplier").all()
        total_tenant_products = tenant_products.count()

        self.stdout.write(f"Found {total_tenant_products} tenant products")

        # Group by product_code to find unique products
        products_by_code = defaultdict(list)
        for tp in tenant_products:
            products_by_code[tp.product_code].append(tp)

        unique_count = len(products_by_code)
        self.stdout.write(f"Found {unique_count} unique product codes")
        self.stdout.write(f"Deduplication: {total_tenant_products} → {unique_count} products")

        # Map protein types to categories
        protein_to_category = {
            "BEEF": "BEEF",
            "PORK": "PORK",
            "CHICKEN": "POULTRY",
            "POULTRY": "POULTRY",
            "TURKEY": "POULTRY",
            "SEAFOOD": "SEAFOOD",
            "FISH": "SEAFOOD",
            "LAMB": "LAMB",
            "VEAL": "VEAL",
            "GAME": "GAME",
        }

        if dry_run:
            self.stdout.write(self.style.WARNING("\n[DRY RUN] Would create:"))
            self._preview_migration(products_by_code, protein_to_category, verbose)
            return

        # Execute migration
        created_products = 0
        created_preferences = 0
        errors = []

        with transaction.atomic():
            for product_code, tenant_products_list in products_by_code.items():
                # Use the first product as the canonical source
                source = tenant_products_list[0]

                # Determine category from protein type
                protein = source.type_of_protein.upper() if source.type_of_protein else ""
                category = protein_to_category.get(protein, "OTHER")

                try:
                    # Create system product
                    system_product, created = SystemProduct.objects.get_or_create(
                        product_code=product_code,
                        defaults={
                            "name": source.description_of_product_item[:255]
                            if source.description_of_product_item
                            else product_code,
                            "description": source.description_of_product_item or "",
                            "category": category,
                            "protein_type": source.type_of_protein or "",
                            "fresh_or_frozen": source.fresh_or_frozen or "",
                            "package_type": source.package_type or "",
                            "carton_type": source.carton_type or "",
                            "unit_weight": source.unit_weight,
                            "uom": source.uom or "LB",
                            "pcs_per_carton": source.pcs_per_carton or "",
                            "namp_code": source.namp or "",
                            "usda_code": source.usda or "",
                            "ub_code": source.ub or "",
                            "edible_or_inedible": source.edible_or_inedible or "",
                            "net_or_catch": source.net_or_catch or "",
                            "tested_product": source.tested_product,
                            "is_active": source.is_active,
                            "legacy_tenant_product_id": source.id,
                        },
                    )

                    if created:
                        created_products += 1
                        if verbose:
                            self.stdout.write(f"  Created product: {product_code}")

                    # Create tenant preferences for each tenant that had this product
                    for tp in tenant_products_list:
                        if tp.tenant_id:
                            pref, pref_created = TenantProductPreference.objects.get_or_create(
                                tenant_id=tp.tenant_id,
                                product=system_product,
                                defaults={
                                    "supplier_item_number": tp.supplier_item_number or "",
                                    "preferred_supplier_id": tp.supplier_id,
                                    "is_active": tp.is_active,
                                },
                            )
                            if pref_created:
                                created_preferences += 1
                                if verbose:
                                    self.stdout.write(f"    Created preference for tenant {tp.tenant_id}")

                except Exception as e:
                    errors.append(f"{product_code}: {str(e)}")
                    self.stdout.write(self.style.ERROR(f"  Error migrating {product_code}: {e}"))

        # Summary
        self.stdout.write(self.style.SUCCESS(f"\n✓ Migration complete!"))
        self.stdout.write(f"  System products created: {created_products}")
        self.stdout.write(f"  Tenant preferences created: {created_preferences}")

        if errors:
            self.stdout.write(self.style.ERROR(f"  Errors: {len(errors)}"))
            for error in errors:
                self.stdout.write(self.style.ERROR(f"    - {error}"))

    def _preview_migration(self, products_by_code, protein_to_category, verbose):
        """Preview what the migration would do."""
        for product_code, tenant_products_list in products_by_code.items():
            source = tenant_products_list[0]
            protein = source.type_of_protein.upper() if source.type_of_protein else ""
            category = protein_to_category.get(protein, "OTHER")

            tenant_count = len(tenant_products_list)
            name = source.description_of_product_item[:50] if source.description_of_product_item else product_code

            if verbose:
                self.stdout.write(f"  {product_code}: {name}")
                self.stdout.write(f"    Category: {category}, Tenants: {tenant_count}")
            else:
                self.stdout.write(f"  {product_code} → {category} ({tenant_count} tenants)")

        self.stdout.write(self.style.SUCCESS(f"\nWould create {len(products_by_code)} system products"))
