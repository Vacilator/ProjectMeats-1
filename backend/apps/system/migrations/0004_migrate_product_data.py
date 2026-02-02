"""
Data migration to populate system.Product from tenant_apps.products.

This migration:
1. Deduplicates products by product_code
2. Creates system.Product records
3. Creates TenantProductPreference for tenant associations
4. Is reversible (deletes created records on rollback)
"""
from django.db import migrations
from collections import defaultdict


def migrate_products_forward(apps, schema_editor):
    """Migrate products from tenant_apps to system app."""
    TenantProduct = apps.get_model('products', 'Product')
    SystemProduct = apps.get_model('system', 'Product')
    TenantProductPreference = apps.get_model('system', 'TenantProductPreference')
    
    # Skip if no tenant products exist
    if not TenantProduct.objects.exists():
        return
    
    # Map protein types to categories
    protein_to_category = {
        'BEEF': 'BEEF',
        'PORK': 'PORK',
        'CHICKEN': 'POULTRY',
        'POULTRY': 'POULTRY',
        'TURKEY': 'POULTRY',
        'SEAFOOD': 'SEAFOOD',
        'FISH': 'SEAFOOD',
        'LAMB': 'LAMB',
        'VEAL': 'VEAL',
        'GAME': 'GAME',
    }
    
    # Get all tenant products
    tenant_products = TenantProduct.objects.select_related('tenant', 'supplier').all()
    
    # Group by product_code
    products_by_code = defaultdict(list)
    for tp in tenant_products:
        products_by_code[tp.product_code].append(tp)
    
    # Create system products and preferences
    for product_code, tenant_products_list in products_by_code.items():
        source = tenant_products_list[0]
        
        # Determine category
        protein = source.type_of_protein.upper() if source.type_of_protein else ''
        category = protein_to_category.get(protein, 'OTHER')
        
        # Check if system product already exists
        if SystemProduct.objects.filter(product_code=product_code).exists():
            system_product = SystemProduct.objects.get(product_code=product_code)
        else:
            # Create system product
            system_product = SystemProduct.objects.create(
                product_code=product_code,
                name=source.description_of_product_item[:255] if source.description_of_product_item else product_code,
                description=source.description_of_product_item or '',
                category=category,
                protein_type=source.type_of_protein or '',
                fresh_or_frozen=source.fresh_or_frozen or '',
                package_type=source.package_type or '',
                carton_type=source.carton_type or '',
                unit_weight=source.unit_weight,
                uom=source.uom or 'LB',
                pcs_per_carton=source.pcs_per_carton or '',
                namp_code=source.namp or '',
                usda_code=source.usda or '',
                ub_code=source.ub or '',
                edible_or_inedible=source.edible_or_inedible or '',
                net_or_catch=source.net_or_catch or '',
                tested_product=source.tested_product,
                is_active=source.is_active,
                legacy_tenant_product_id=source.id,
            )
        
        # Create tenant preferences
        for tp in tenant_products_list:
            if tp.tenant_id:
                if not TenantProductPreference.objects.filter(
                    tenant_id=tp.tenant_id,
                    product=system_product
                ).exists():
                    TenantProductPreference.objects.create(
                        tenant_id=tp.tenant_id,
                        product=system_product,
                        supplier_item_number=tp.supplier_item_number or '',
                        preferred_supplier_id=tp.supplier_id,
                        is_active=tp.is_active,
                    )


def migrate_products_reverse(apps, schema_editor):
    """Reverse migration - remove migrated products."""
    SystemProduct = apps.get_model('system', 'Product')
    TenantProductPreference = apps.get_model('system', 'TenantProductPreference')
    
    # Delete preferences first (FK constraint)
    TenantProductPreference.objects.all().delete()
    
    # Delete products that came from migration (have legacy_tenant_product_id)
    SystemProduct.objects.filter(legacy_tenant_product_id__isnull=False).delete()


class Migration(migrations.Migration):
    
    dependencies = [
        ('system', '0003_add_tenant_product_preference'),
        ('products', '0001_initial'),  # Ensure tenant products exist
    ]
    
    operations = [
        migrations.RunPython(
            migrate_products_forward,
            migrate_products_reverse,
        ),
    ]
