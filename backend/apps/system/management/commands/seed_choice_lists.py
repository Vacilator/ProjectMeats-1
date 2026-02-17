"""
Management command to seed meat industry-specific choice lists.

Seeds the database with meat industry defaults:
- protein_types: Beef, Pork, Poultry, Seafood, Lamb, Veal, Game, Plant-Based
- packaging_types: Fresh, Frozen, Vacuum-Sealed, MAP, Cryovac, Bulk
- processing_grades: Prime, Choice, Select, Standard, Commercial, Utility, Cull
- cut_types: Primal, Subprimal, Retail, Ground, Portion-Control

Usage:
    python manage.py seed_choice_lists
    python manage.py seed_choice_lists --dry-run
    python manage.py seed_choice_lists --force  # Recreate even if exists
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.system.models import SystemChoiceList, SystemChoiceItem


# Meat industry-specific choice lists
MEAT_INDUSTRY_CHOICE_LISTS = [
    {
        'slug': 'protein_types',
        'name': 'Protein Types',
        'description': 'Types of protein/meat products',
        'model_field_path': 'products.Product.protein_type',
        'is_extensible': True,
        'is_reorderable': True,
        'items': [
            {'value': 'BEEF', 'label': 'Beef', 'order': 10},
            {'value': 'PORK', 'label': 'Pork', 'order': 20},
            {'value': 'POULTRY', 'label': 'Poultry', 'order': 30},
            {'value': 'SEAFOOD', 'label': 'Seafood', 'order': 40},
            {'value': 'LAMB', 'label': 'Lamb', 'order': 50},
            {'value': 'VEAL', 'label': 'Veal', 'order': 60},
            {'value': 'GAME', 'label': 'Game', 'order': 70},
            {'value': 'PLANT_BASED', 'label': 'Plant-Based', 'order': 80},
        ]
    },
    {
        'slug': 'packaging_types',
        'name': 'Packaging Types',
        'description': 'Product packaging and storage methods',
        'model_field_path': 'products.Product.packaging_type',
        'is_extensible': True,
        'is_reorderable': True,
        'items': [
            {'value': 'FRESH', 'label': 'Fresh', 'order': 10},
            {'value': 'FROZEN', 'label': 'Frozen', 'order': 20},
            {'value': 'VACUUM_SEALED', 'label': 'Vacuum-Sealed', 'order': 30},
            {'value': 'MAP', 'label': 'MAP (Modified Atmosphere)', 'order': 40, 
             'extra_data': {'description': 'Modified Atmosphere Packaging'}},
            {'value': 'CRYOVAC', 'label': 'Cryovac', 'order': 50},
            {'value': 'BULK', 'label': 'Bulk', 'order': 60},
        ]
    },
    {
        'slug': 'processing_grades',
        'name': 'Processing Grades',
        'description': 'USDA quality grades for meat processing',
        'model_field_path': 'products.Product.grade',
        'is_extensible': False,  # USDA grades are standardized
        'is_reorderable': False,  # Order matters for grading hierarchy
        'items': [
            {'value': 'PRIME', 'label': 'Prime', 'order': 10,
             'extra_data': {'description': 'Highest quality, abundant marbling'}},
            {'value': 'CHOICE', 'label': 'Choice', 'order': 20,
             'extra_data': {'description': 'High quality, moderate marbling'}},
            {'value': 'SELECT', 'label': 'Select', 'order': 30,
             'extra_data': {'description': 'Leaner, less marbling'}},
            {'value': 'STANDARD', 'label': 'Standard', 'order': 40,
             'extra_data': {'description': 'Lower quality, minimal marbling'}},
            {'value': 'COMMERCIAL', 'label': 'Commercial', 'order': 50,
             'extra_data': {'description': 'Older cattle, typically processed'}},
            {'value': 'UTILITY', 'label': 'Utility', 'order': 60,
             'extra_data': {'description': 'Used for ground beef, processed products'}},
            {'value': 'CULL', 'label': 'Cull', 'order': 70,
             'extra_data': {'description': 'Lowest grade, typically pet food or rendering'}},
        ]
    },
    {
        'slug': 'cut_types',
        'name': 'Cut Types',
        'description': 'Meat cut categories',
        'model_field_path': 'products.Product.cut_type',
        'is_extensible': True,
        'is_reorderable': True,
        'items': [
            {'value': 'PRIMAL', 'label': 'Primal', 'order': 10,
             'extra_data': {'description': 'Large wholesale cuts'}},
            {'value': 'SUBPRIMAL', 'label': 'Subprimal', 'order': 20,
             'extra_data': {'description': 'Sections from primal cuts'}},
            {'value': 'RETAIL', 'label': 'Retail', 'order': 30,
             'extra_data': {'description': 'Consumer-ready cuts'}},
            {'value': 'GROUND', 'label': 'Ground', 'order': 40,
             'extra_data': {'description': 'Ground or minced meat'}},
            {'value': 'PORTION_CONTROL', 'label': 'Portion-Control', 'order': 50,
             'extra_data': {'description': 'Pre-portioned for food service'}},
        ]
    },
]


class Command(BaseCommand):
    help = 'Seed meat industry-specific choice lists with default values'
    
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
            for list_def in MEAT_INDUSTRY_CHOICE_LISTS:
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
                    self.stdout.write(self.style.WARNING(f'  DELETED: {slug} (recreating)'))
                
                choice_list = SystemChoiceList.objects.create(**list_def)
                created_lists += 1
                
                # Create items (system-defined, no tenant)
                for item_def in items:
                    SystemChoiceItem.objects.create(
                        choice_list=choice_list,
                        tenant=None,  # System-defined items
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
            if skipped_lists:
                self.stdout.write(self.style.WARNING(
                    f'Would skip {skipped_lists} existing lists'
                ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created {created_lists} lists with {created_items} items'
            ))
            if skipped_lists:
                self.stdout.write(
                    f'  Skipped {skipped_lists} existing lists (use --force to recreate)'
                )
