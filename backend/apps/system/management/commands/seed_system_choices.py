"""
Management command to seed system choice lists.

Seeds the database with default choice lists based on existing TextChoices
classes in apps/core/models.py.

Usage:
    python manage.py seed_system_choices
    python manage.py seed_system_choices --dry-run
    python manage.py seed_system_choices --force  # Recreate even if exists
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.system.models import SystemChoiceList, SystemChoiceItem


# Define choice lists based on existing TextChoices in apps/core/models.py
SYSTEM_CHOICE_LISTS = [
    {
        'slug': 'protein_type',
        'name': 'Protein Type',
        'description': 'Types of protein products (beef, pork, poultry, etc.)',
        'model_field_path': 'products.product.protein_type',
        'items': [
            {'value': 'BEEF', 'label': 'Beef', 'order': 1},
            {'value': 'PORK', 'label': 'Pork', 'order': 2},
            {'value': 'POULTRY', 'label': 'Poultry', 'order': 3},
            {'value': 'SEAFOOD', 'label': 'Seafood', 'order': 4},
            {'value': 'LAMB', 'label': 'Lamb', 'order': 5},
            {'value': 'OTHER', 'label': 'Other', 'order': 99},
        ]
    },
    {
        'slug': 'fresh_or_frozen',
        'name': 'Fresh or Frozen',
        'description': 'Product storage state',
        'model_field_path': 'products.product.fresh_or_frozen',
        'items': [
            {'value': 'FRESH', 'label': 'Fresh', 'order': 1},
            {'value': 'FROZEN', 'label': 'Frozen', 'order': 2},
        ]
    },
    {
        'slug': 'package_type',
        'name': 'Package Type',
        'description': 'Product packaging types',
        'model_field_path': 'products.product.package_type',
        'items': [
            {'value': 'COMBO_BIN', 'label': 'Combo Bin', 'order': 1},
            {'value': 'CASES', 'label': 'Cases', 'order': 2},
            {'value': 'BAGS', 'label': 'Bags', 'order': 3},
            {'value': 'BULK', 'label': 'Bulk', 'order': 4},
            {'value': 'VACUUM_SEALED', 'label': 'Vacuum Sealed', 'order': 5},
            {'value': 'OTHER', 'label': 'Other', 'order': 99},
        ]
    },
    {
        'slug': 'payment_terms',
        'name': 'Payment Terms',
        'description': 'Accounting payment terms',
        'model_field_path': 'customers.customer.payment_terms',
        'items': [
            {'value': 'NET7', 'label': 'Net 7', 'order': 1},
            {'value': 'NET10', 'label': 'Net 10', 'order': 2},
            {'value': 'NET15', 'label': 'Net 15', 'order': 3},
            {'value': 'NET30', 'label': 'Net 30', 'order': 4, 'is_default': True},
            {'value': 'NET45', 'label': 'Net 45', 'order': 5},
            {'value': 'NET60', 'label': 'Net 60', 'order': 6},
            {'value': 'NET90', 'label': 'Net 90', 'order': 7},
            {'value': 'COD', 'label': 'Cash on Delivery', 'order': 8},
            {'value': 'PREPAID', 'label': 'Prepaid', 'order': 9},
        ]
    },
    {
        'slug': 'credit_limit',
        'name': 'Credit Limit',
        'description': 'Customer credit limit brackets',
        'model_field_path': 'customers.customer.credit_limit',
        'items': [
            {'value': '0', 'label': '$0 (No Credit)', 'order': 1},
            {'value': '5000', 'label': '$5,000', 'order': 2},
            {'value': '10000', 'label': '$10,000', 'order': 3},
            {'value': '25000', 'label': '$25,000', 'order': 4},
            {'value': '50000', 'label': '$50,000', 'order': 5},
            {'value': '100000', 'label': '$100,000', 'order': 6},
            {'value': 'UNLIMITED', 'label': 'Unlimited', 'order': 99},
        ]
    },
    {
        'slug': 'weight_unit',
        'name': 'Weight Unit',
        'description': 'Unit of measure for weight',
        'model_field_path': 'products.product.weight_unit',
        'items': [
            {'value': 'LBS', 'label': 'Pounds (lbs)', 'order': 1, 'is_default': True},
            {'value': 'KG', 'label': 'Kilograms (kg)', 'order': 2},
            {'value': 'OZ', 'label': 'Ounces (oz)', 'order': 3},
            {'value': 'G', 'label': 'Grams (g)', 'order': 4},
        ]
    },
    {
        'slug': 'contact_type',
        'name': 'Contact Type',
        'description': 'Types of contacts',
        'model_field_path': 'contacts.contact.contact_type',
        'items': [
            {'value': 'PRIMARY', 'label': 'Primary Contact', 'order': 1},
            {'value': 'SALES', 'label': 'Sales', 'order': 2},
            {'value': 'ACCOUNTING', 'label': 'Accounting', 'order': 3},
            {'value': 'SHIPPING', 'label': 'Shipping', 'order': 4},
            {'value': 'RECEIVING', 'label': 'Receiving', 'order': 5},
            {'value': 'TECHNICAL', 'label': 'Technical', 'order': 6},
            {'value': 'OTHER', 'label': 'Other', 'order': 99},
        ]
    },
    {
        'slug': 'plant_type',
        'name': 'Plant Type',
        'description': 'Types of processing plants',
        'model_field_path': 'plants.plant.plant_type',
        'items': [
            {'value': 'SLAUGHTER', 'label': 'Slaughter', 'order': 1},
            {'value': 'PROCESSING', 'label': 'Processing', 'order': 2},
            {'value': 'COLD_STORAGE', 'label': 'Cold Storage', 'order': 3},
            {'value': 'DISTRIBUTION', 'label': 'Distribution', 'order': 4},
            {'value': 'COMBINED', 'label': 'Combined', 'order': 5},
        ]
    },
    {
        'slug': 'certificate_type',
        'name': 'Certificate Type',
        'description': 'Types of certifications',
        'model_field_path': 'suppliers.supplier.certificate_type',
        'items': [
            {'value': 'USDA', 'label': 'USDA', 'order': 1},
            {'value': 'FDA', 'label': 'FDA', 'order': 2},
            {'value': 'ORGANIC', 'label': 'Organic', 'order': 3},
            {'value': 'HALAL', 'label': 'Halal', 'order': 4},
            {'value': 'KOSHER', 'label': 'Kosher', 'order': 5},
            {'value': 'NON_GMO', 'label': 'Non-GMO', 'order': 6},
            {'value': 'OTHER', 'label': 'Other', 'order': 99},
        ]
    },
    {
        'slug': 'country_origin',
        'name': 'Country of Origin',
        'description': 'Product country of origin',
        'model_field_path': 'products.product.country_origin',
        'items': [
            {'value': 'USA', 'label': 'United States', 'order': 1, 'is_default': True},
            {'value': 'CAN', 'label': 'Canada', 'order': 2},
            {'value': 'MEX', 'label': 'Mexico', 'order': 3},
            {'value': 'AUS', 'label': 'Australia', 'order': 4},
            {'value': 'NZL', 'label': 'New Zealand', 'order': 5},
            {'value': 'BRA', 'label': 'Brazil', 'order': 6},
            {'value': 'ARG', 'label': 'Argentina', 'order': 7},
            {'value': 'OTHER', 'label': 'Other', 'order': 99},
        ]
    },
    {
        'slug': 'shipping_offered',
        'name': 'Shipping Offered',
        'description': 'Shipping options offered',
        'model_field_path': 'suppliers.supplier.shipping_offered',
        'items': [
            {'value': 'FOB', 'label': 'FOB', 'order': 1},
            {'value': 'DELIVERED', 'label': 'Delivered', 'order': 2},
            {'value': 'PICKUP', 'label': 'Pickup', 'order': 3},
            {'value': 'FOB_AND_DELIVERED', 'label': 'FOB & Delivered', 'order': 4},
        ]
    },
    {
        'slug': 'edible_inedible',
        'name': 'Edible/Inedible',
        'description': 'Whether product is for human consumption',
        'model_field_path': 'products.product.edible_inedible',
        'items': [
            {'value': 'EDIBLE', 'label': 'Edible', 'order': 1, 'is_default': True},
            {'value': 'INEDIBLE', 'label': 'Inedible', 'order': 2},
        ]
    },
    {
        'slug': 'po_status',
        'name': 'Purchase Order Status',
        'description': 'Status of purchase orders',
        'model_field_path': 'purchase_orders.purchaseorder.status',
        'items': [
            {'value': 'DRAFT', 'label': 'Draft', 'order': 1, 'is_default': True},
            {'value': 'PENDING', 'label': 'Pending Approval', 'order': 2},
            {'value': 'APPROVED', 'label': 'Approved', 'order': 3},
            {'value': 'SENT', 'label': 'Sent to Supplier', 'order': 4},
            {'value': 'CONFIRMED', 'label': 'Confirmed', 'order': 5},
            {'value': 'IN_TRANSIT', 'label': 'In Transit', 'order': 6},
            {'value': 'RECEIVED', 'label': 'Received', 'order': 7},
            {'value': 'INVOICED', 'label': 'Invoiced', 'order': 8},
            {'value': 'PAID', 'label': 'Paid', 'order': 9},
            {'value': 'CANCELLED', 'label': 'Cancelled', 'order': 99},
        ]
    },
    {
        'slug': 'so_status',
        'name': 'Sales Order Status',
        'description': 'Status of sales orders',
        'model_field_path': 'sales_orders.salesorder.status',
        'items': [
            {'value': 'DRAFT', 'label': 'Draft', 'order': 1, 'is_default': True},
            {'value': 'PENDING', 'label': 'Pending Approval', 'order': 2},
            {'value': 'APPROVED', 'label': 'Approved', 'order': 3},
            {'value': 'CONFIRMED', 'label': 'Confirmed', 'order': 4},
            {'value': 'PICKING', 'label': 'Picking', 'order': 5},
            {'value': 'SHIPPED', 'label': 'Shipped', 'order': 6},
            {'value': 'DELIVERED', 'label': 'Delivered', 'order': 7},
            {'value': 'INVOICED', 'label': 'Invoiced', 'order': 8},
            {'value': 'PAID', 'label': 'Paid', 'order': 9},
            {'value': 'CANCELLED', 'label': 'Cancelled', 'order': 99},
        ]
    },
]


class Command(BaseCommand):
    help = 'Seed system choice lists with default values'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without making changes',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recreate lists even if they already exist',
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made\n'))
        
        created_lists = 0
        created_items = 0
        skipped_lists = 0
        
        with transaction.atomic():
            for list_def in SYSTEM_CHOICE_LISTS:
                slug = list_def['slug']
                items = list_def.pop('items')
                
                # Check if exists
                exists = SystemChoiceList.objects.filter(slug=slug).exists()
                
                if exists and not force:
                    skipped_lists += 1
                    self.stdout.write(f'  SKIP: {slug} (already exists)')
                    continue
                
                if dry_run:
                    self.stdout.write(f'  CREATE: {slug} ({len(items)} items)')
                    created_lists += 1
                    created_items += len(items)
                    continue
                
                # Create or update the list
                if exists and force:
                    SystemChoiceList.objects.filter(slug=slug).delete()
                
                choice_list = SystemChoiceList.objects.create(**list_def)
                created_lists += 1
                
                # Create items
                for item_def in items:
                    SystemChoiceItem.objects.create(
                        choice_list=choice_list,
                        tenant=None,  # System-defined
                        **item_def
                    )
                    created_items += 1
                
                self.stdout.write(self.style.SUCCESS(
                    f'  CREATED: {slug} ({len(items)} items)'
                ))
        
        # Summary
        self.stdout.write('')
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'Would create {created_lists} lists with {created_items} items'
            ))
            self.stdout.write(self.style.WARNING(
                f'Would skip {skipped_lists} existing lists'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Created {created_lists} lists with {created_items} items'
            ))
            if skipped_lists:
                self.stdout.write(
                    f'Skipped {skipped_lists} existing lists (use --force to recreate)'
                )
