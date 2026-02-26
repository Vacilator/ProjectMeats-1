"""
Management command to seed system-wide product catalog.

This creates the MASTER product list that all tenants reference.
Products are created ONCE at the system level, not per-tenant.

Usage:
    python manage.py seed_system_products --dry-run  # Preview
    python manage.py seed_system_products             # Execute
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.system.models import Product, ProductCategoryChoices


# System-wide product catalog (meat industry standards)
SYSTEM_PRODUCTS = [
    # === BEEF PRODUCTS ===
    {
        'product_code': 'BEEF-RIBEYE-001',
        'name': 'Ribeye Steak, Choice',
        'description': 'Choice grade ribeye steak, bone-in',
        'category': ProductCategoryChoices.BEEF,
        'protein_type': 'beef',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 16.00,
        'uom': 'LB',
        'pcs_per_carton': '4/10',
        'namp_code': '1112A',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    {
        'product_code': 'BEEF-STRIP-001',
        'name': 'Strip Loin, Choice',
        'description': 'Choice grade strip loin, boneless',
        'category': ProductCategoryChoices.BEEF,
        'protein_type': 'beef',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 14.00,
        'uom': 'LB',
        'pcs_per_carton': '2/14',
        'namp_code': '180',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    {
        'product_code': 'BEEF-GRND-001',
        'name': 'Ground Beef, 80/20',
        'description': 'Ground beef, 80% lean / 20% fat',
        'category': ProductCategoryChoices.BEEF,
        'protein_type': 'beef',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'BULK',
        'carton_type': 'Waxed Lined',
        'unit_weight': 10.00,
        'uom': 'LB',
        'pcs_per_carton': '10/10',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    {
        'product_code': 'BEEF-BRISK-001',
        'name': 'Brisket, Whole, Untrimmed',
        'description': 'Whole beef brisket, untrimmed',
        'category': ProductCategoryChoices.BEEF,
        'protein_type': 'beef',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 12.00,
        'uom': 'LB',
        'pcs_per_carton': '1/12',
        'namp_code': '120',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    
    # === PORK PRODUCTS ===
    {
        'product_code': 'PORK-LOIN-001',
        'name': 'Pork Loin, Center Cut',
        'description': 'Center cut pork loin, boneless',
        'category': ProductCategoryChoices.PORK,
        'protein_type': 'pork',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 8.00,
        'uom': 'LB',
        'pcs_per_carton': '2/8',
        'namp_code': '413',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    {
        'product_code': 'PORK-RIBS-001',
        'name': 'Pork Spare Ribs',
        'description': 'Pork spare ribs, full rack',
        'category': ProductCategoryChoices.PORK,
        'protein_type': 'pork',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 3.50,
        'uom': 'LB',
        'pcs_per_carton': '10/3.5',
        'namp_code': '416',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    {
        'product_code': 'PORK-SHLDR-001',
        'name': 'Pork Shoulder, Boston Butt',
        'description': 'Pork shoulder, Boston butt, bone-in',
        'category': ProductCategoryChoices.PORK,
        'protein_type': 'pork',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 7.00,
        'uom': 'LB',
        'pcs_per_carton': '2/7',
        'namp_code': '406',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    {
        'product_code': 'PORK-BELLY-001',
        'name': 'Pork Belly, Skinless',
        'description': 'Pork belly, skinless, whole',
        'category': ProductCategoryChoices.PORK,
        'protein_type': 'pork',
        'fresh_or_frozen': 'FROZEN',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 12.00,
        'uom': 'LB',
        'pcs_per_carton': '1/12',
        'namp_code': '408',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    
    # === POULTRY PRODUCTS ===
    {
        'product_code': 'CHKN-BRST-001',
        'name': 'Chicken Breast, Boneless Skinless',
        'description': 'Boneless skinless chicken breast',
        'category': ProductCategoryChoices.POULTRY,
        'protein_type': 'poultry',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 2.50,
        'uom': 'LB',
        'pcs_per_carton': '10/2.5',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    {
        'product_code': 'CHKN-THGH-001',
        'name': 'Chicken Thigh, Boneless Skinless',
        'description': 'Boneless skinless chicken thigh',
        'category': ProductCategoryChoices.POULTRY,
        'protein_type': 'poultry',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 2.00,
        'uom': 'LB',
        'pcs_per_carton': '10/2',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    {
        'product_code': 'CHKN-WING-001',
        'name': 'Chicken Wings, Whole',
        'description': 'Whole chicken wings',
        'category': ProductCategoryChoices.POULTRY,
        'protein_type': 'poultry',
        'fresh_or_frozen': 'FROZEN',
        'package_type': 'BULK',
        'carton_type': 'Waxed Lined',
        'unit_weight': 10.00,
        'uom': 'LB',
        'pcs_per_carton': '10/10',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    {
        'product_code': 'TURK-BRST-001',
        'name': 'Turkey Breast, Boneless',
        'description': 'Boneless turkey breast, whole',
        'category': ProductCategoryChoices.POULTRY,
        'protein_type': 'poultry',
        'fresh_or_frozen': 'FROZEN',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 6.00,
        'uom': 'LB',
        'pcs_per_carton': '2/6',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    
    # === SEAFOOD PRODUCTS ===
    {
        'product_code': 'FISH-SALM-001',
        'name': 'Salmon Fillet, Atlantic',
        'description': 'Atlantic salmon fillet, skin-on',
        'category': ProductCategoryChoices.SEAFOOD,
        'protein_type': 'seafood',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 1.50,
        'uom': 'LB',
        'pcs_per_carton': '10/1.5',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    {
        'product_code': 'FISH-SHMP-001',
        'name': 'Shrimp, 16/20 Count',
        'description': 'Peeled & deveined shrimp, 16/20 count',
        'category': ProductCategoryChoices.SEAFOOD,
        'protein_type': 'seafood',
        'fresh_or_frozen': 'FROZEN',
        'package_type': 'BULK',
        'carton_type': 'Waxed Lined',
        'unit_weight': 5.00,
        'uom': 'LB',
        'pcs_per_carton': '5/5',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    {
        'product_code': 'FISH-TUNA-001',
        'name': 'Tuna Steak, Yellowfin',
        'description': 'Yellowfin tuna steak, sushi grade',
        'category': ProductCategoryChoices.SEAFOOD,
        'protein_type': 'seafood',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 1.00,
        'uom': 'LB',
        'pcs_per_carton': '10/1',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    {
        'product_code': 'FISH-COD-001',
        'name': 'Cod Fillet, Atlantic',
        'description': 'Atlantic cod fillet, skinless',
        'category': ProductCategoryChoices.SEAFOOD,
        'protein_type': 'seafood',
        'fresh_or_frozen': 'FROZEN',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 2.00,
        'uom': 'LB',
        'pcs_per_carton': '5/2',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': True,
        'is_active': True,
    },
    
    # === LAMB PRODUCTS ===
    {
        'product_code': 'LAMB-LEG-001',
        'name': 'Lamb Leg, Boneless',
        'description': 'Boneless lamb leg, whole',
        'category': ProductCategoryChoices.LAMB,
        'protein_type': 'lamb',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 5.00,
        'uom': 'LB',
        'pcs_per_carton': '2/5',
        'namp_code': '234',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    {
        'product_code': 'LAMB-RACK-001',
        'name': 'Lamb Rack, Frenched',
        'description': 'Frenched lamb rack, 8-rib',
        'category': ProductCategoryChoices.LAMB,
        'protein_type': 'lamb',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 1.75,
        'uom': 'LB',
        'pcs_per_carton': '10/1.75',
        'namp_code': '204',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    
    # === VEAL PRODUCTS ===
    {
        'product_code': 'VEAL-CHOP-001',
        'name': 'Veal Chop, Bone-In',
        'description': 'Veal rib chop, bone-in',
        'category': ProductCategoryChoices.VEAL,
        'protein_type': 'veal',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 0.75,
        'uom': 'LB',
        'pcs_per_carton': '20/0.75',
        'namp_code': '1306',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
    {
        'product_code': 'VEAL-OSSO-001',
        'name': 'Veal Osso Buco',
        'description': 'Veal osso buco, cross-cut shank',
        'category': ProductCategoryChoices.VEAL,
        'protein_type': 'veal',
        'fresh_or_frozen': 'FRESH',
        'package_type': 'VACUUM_SEALED',
        'carton_type': 'Poly-Multiple',
        'unit_weight': 0.50,
        'uom': 'LB',
        'pcs_per_carton': '20/0.5',
        'namp_code': '337',
        'edible_or_inedible': 'EDIBLE',
        'net_or_catch': 'NET',
        'tested_product': False,
        'is_active': True,
    },
]


class Command(BaseCommand):
    help = 'Seed system-wide product catalog (ONE TIME, NOT PER TENANT)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without making them',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"{'[DRY RUN] ' if dry_run else ''}Seeding system product catalog..."
        ))
        
        if dry_run:
            self._preview_products()
            return
        
        created_count = 0
        updated_count = 0
        errors = []
        
        with transaction.atomic():
            for product_data in SYSTEM_PRODUCTS:
                try:
                    product, created = Product.objects.update_or_create(
                        product_code=product_data['product_code'],
                        defaults=product_data
                    )
                    
                    if created:
                        created_count += 1
                        self.stdout.write(f"  ✓ Created: {product.product_code} - {product.name}")
                    else:
                        updated_count += 1
                        self.stdout.write(f"  ↻ Updated: {product.product_code} - {product.name}")
                
                except Exception as e:
                    errors.append(f"{product_data['product_code']}: {str(e)}")
                    self.stdout.write(self.style.ERROR(
                        f"  ✗ Error: {product_data['product_code']} - {e}"
                    ))
        
        # Summary
        self.stdout.write(self.style.SUCCESS(f"\n✓ Seeding complete!"))
        self.stdout.write(f"  Products created: {created_count}")
        self.stdout.write(f"  Products updated: {updated_count}")
        self.stdout.write(f"  Total in catalog: {len(SYSTEM_PRODUCTS)}")
        
        if errors:
            self.stdout.write(self.style.ERROR(f"  Errors: {len(errors)}"))
            for error in errors:
                self.stdout.write(self.style.ERROR(f"    - {error}"))
        
        self.stdout.write(self.style.WARNING(
            "\n💡 Tip: Products are system-wide. Tenants customize via TenantProductPreference."
        ))
    
    def _preview_products(self):
        """Preview products that would be created."""
        self.stdout.write(self.style.WARNING("\n[DRY RUN] Would create/update these products:\n"))
        
        # Group by category
        by_category = {}
        for p in SYSTEM_PRODUCTS:
            category = p['category']
            by_category.setdefault(category, []).append(p)
        
        for category, products in sorted(by_category.items()):
            self.stdout.write(self.style.SUCCESS(f"\n{category}:"))
            for p in products:
                frozen_label = ' [FROZEN]' if p['fresh_or_frozen'] == 'FROZEN' else ''
                self.stdout.write(f"  {p['product_code']}: {p['name']}{frozen_label}")
        
        self.stdout.write(self.style.SUCCESS(
            f"\nTotal: {len(SYSTEM_PRODUCTS)} products across {len(by_category)} categories"
        ))
        self.stdout.write(self.style.WARNING(
            "\nRun without --dry-run to apply changes"
        ))
