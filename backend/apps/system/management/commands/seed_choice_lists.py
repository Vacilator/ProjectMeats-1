"""
Management command to seed meat industry-specific choice lists with STRICT IDEMPOTENCY.

Seeds the database with meat industry defaults:
- protein_types: Beef, Pork, Poultry, Seafood, Lamb, Veal, Game, Plant-Based
- packaging_types: Fresh, Frozen, Vacuum-Sealed, MAP, Cryovac, Bulk
- processing_grades: Prime, Choice, Select, Standard, Commercial, Utility, Cull
- cut_types: Primal, Subprimal, Retail, Ground, Portion-Control

**Idempotency Guarantees:**
- Uses update_or_create() to prevent duplicates (NEVER delete existing records)
- Soft-deactivates items not in seed JSON (is_active=False)
- Preserves UUIDs and foreign key relationships
- Safe to run multiple times without side effects
- See docs/GOLDEN_PIPELINE.md and POSTGRESQL_MIGRATION_GUIDE.md

Usage:
    python manage.py seed_choice_lists --dry-run  # Preview changes
    python manage.py seed_choice_lists             # Apply changes
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
    help = 'Seed meat industry-specific choice lists with STRICT IDEMPOTENCY (Tier-1)'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without applying them (RECOMMENDED first run)',
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('=' * 70))
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No database changes will be made'))
            self.stdout.write(self.style.WARNING('=' * 70))
            self.stdout.write('')
        
        stats = {
            'lists_created': 0,
            'lists_updated': 0,
            'items_created': 0,
            'items_updated': 0,
            'items_deactivated': 0,
        }
        
        with transaction.atomic():
            for list_def in MEAT_INDUSTRY_CHOICE_LISTS:
                slug = list_def['slug']
                items_data = list_def.pop('items')  # Extract items for separate processing
                
                # ============================================================
                # STEP 1: Update or create SystemChoiceList (IDEMPOTENT)
                # Note: SystemChoiceList is system-wide (no tenant field)
                # ============================================================
                if dry_run:
                    exists = SystemChoiceList.objects.filter(slug=slug).exists()
                    if exists:
                        self.stdout.write(f'  UPDATE: {slug}')
                        stats['lists_updated'] += 1
                    else:
                        self.stdout.write(self.style.SUCCESS(f'  CREATE: {slug}'))
                        stats['lists_created'] += 1
                else:
                    choice_list, created = SystemChoiceList.objects.update_or_create(
                        slug=slug,
                        defaults={
                            'name': list_def['name'],
                            'description': list_def.get('description', ''),
                            'model_field_path': list_def.get('model_field_path', ''),
                            'is_extensible': list_def.get('is_extensible', True),
                            'is_reorderable': list_def.get('is_reorderable', True),
                            'is_active': True,
                        }
                    )
                    
                    if created:
                        self.stdout.write(self.style.SUCCESS(f'  CREATED: {slug}'))
                        stats['lists_created'] += 1
                    else:
                        self.stdout.write(f'  UPDATED: {slug}')
                        stats['lists_updated'] += 1
                
                # ============================================================
                # STEP 2: Update or create SystemChoiceItem (IDEMPOTENT)
                # Note: Items have tenant=None for system-defined choices
                # ============================================================
                if not dry_run:
                    # Get choice_list for actual updates
                    choice_list = SystemChoiceList.objects.get(slug=slug)
                
                # Track which values are in the seed data
                seed_values = {item['value'] for item in items_data}
                
                for item_def in items_data:
                    value = item_def['value']
                    
                    if dry_run:
                        exists = SystemChoiceItem.objects.filter(
                            choice_list__slug=slug,
                            value=value,
                            tenant=None
                        ).exists()
                        
                        if exists:
                            self.stdout.write(f'    UPDATE ITEM: {value} ({item_def["label"]})')
                            stats['items_updated'] += 1
                        else:
                            self.stdout.write(self.style.SUCCESS(f'    CREATE ITEM: {value} ({item_def["label"]})'))
                            stats['items_created'] += 1
                    else:
                        item, created = SystemChoiceItem.objects.update_or_create(
                            choice_list=choice_list,
                            value=value,
                            tenant=None,  # Tier-1 system choices have no tenant
                            defaults={
                                'label': item_def['label'],
                                'order': item_def.get('order', 0),
                                'is_default': item_def.get('is_default', False),
                                'extra_data': item_def.get('extra_data', {}),
                                'is_active': True,  # Reactivate if previously deactivated
                            }
                        )
                        
                        if created:
                            self.stdout.write(self.style.SUCCESS(f'    CREATED ITEM: {value} ({item_def["label"]})'))
                            stats['items_created'] += 1
                        else:
                            self.stdout.write(f'    UPDATED ITEM: {value} ({item_def["label"]})')
                            stats['items_updated'] += 1
                
                # ============================================================
                # STEP 3: Soft-deactivate items NOT in seed (NEVER DELETE)
                # ============================================================
                if dry_run:
                    obsolete_items = SystemChoiceItem.objects.filter(
                        choice_list__slug=slug,
                        tenant=None,
                        is_active=True
                    ).exclude(value__in=seed_values)
                    
                    if obsolete_items.exists():
                        for item in obsolete_items:
                            self.stdout.write(self.style.WARNING(
                                f'    DEACTIVATE: {item.value} ({item.label}) [not in seed]'
                            ))
                            stats['items_deactivated'] += 1
                else:
                    deactivated_count = SystemChoiceItem.objects.filter(
                        choice_list=choice_list,
                        tenant=None,
                        is_active=True
                    ).exclude(value__in=seed_values).update(is_active=False)
                    
                    if deactivated_count > 0:
                        self.stdout.write(self.style.WARNING(
                            f'    DEACTIVATED: {deactivated_count} obsolete items'
                        ))
                        stats['items_deactivated'] += deactivated_count
                
                self.stdout.write('')  # Blank line between lists
        
        # ================================================================
        # SUMMARY
        # ================================================================
        self.stdout.write('=' * 70)
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN SUMMARY (no changes applied):'))
        else:
            self.stdout.write(self.style.SUCCESS('SEEDING COMPLETE:'))
        
        self.stdout.write(f'  Lists created:      {stats["lists_created"]}')
        self.stdout.write(f'  Lists updated:      {stats["lists_updated"]}')
        self.stdout.write(f'  Items created:      {stats["items_created"]}')
        self.stdout.write(f'  Items updated:      {stats["items_updated"]}')
        self.stdout.write(f'  Items deactivated:  {stats["items_deactivated"]}')
        self.stdout.write('=' * 70)
        
        if dry_run:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('✓ No duplicates will be created (idempotent)'))
            self.stdout.write(self.style.SUCCESS('✓ UUIDs and foreign keys will be preserved'))
            self.stdout.write(self.style.SUCCESS('✓ Run without --dry-run to apply changes'))
        else:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('✓ All Tier-1 meat industry choices synchronized'))
            self.stdout.write(self.style.SUCCESS('✓ Safe to re-run anytime (idempotent)'))
