"""
Data migration to update plant FK references in orders to point to new Location records.

This migration:
1. Updates PurchaseOrder.plant to point to Location (via legacy_plant_id lookup)
2. Updates CarrierPurchaseOrder.plant to point to Location
3. Updates SalesOrder.plant to point to Location
"""
from django.db import migrations


def update_order_plant_references(apps, schema_editor):
    """Update plant FK in orders to point to migrated Location records."""
    PurchaseOrder = apps.get_model('purchase_orders', 'PurchaseOrder')
    CarrierPurchaseOrder = apps.get_model('purchase_orders', 'CarrierPurchaseOrder')
    SalesOrder = apps.get_model('sales_orders', 'SalesOrder')
    Location = apps.get_model('locations', 'Location')
    
    # Build mapping of legacy_plant_id -> location_id
    plant_to_location = {}
    for loc in Location.objects.filter(legacy_plant_id__isnull=False):
        plant_to_location[loc.legacy_plant_id] = loc.id
    
    if not plant_to_location:
        print("No plant-to-location mappings found, skipping FK updates")
        return
    
    # Update PurchaseOrder
    updated_po = 0
    for po in PurchaseOrder.objects.filter(plant_id__isnull=False):
        new_location_id = plant_to_location.get(po.plant_id)
        if new_location_id:
            po.plant_id = new_location_id
            po.save(update_fields=['plant_id'])
            updated_po += 1
    
    # Update CarrierPurchaseOrder
    updated_cpo = 0
    for cpo in CarrierPurchaseOrder.objects.filter(plant_id__isnull=False):
        new_location_id = plant_to_location.get(cpo.plant_id)
        if new_location_id:
            cpo.plant_id = new_location_id
            cpo.save(update_fields=['plant_id'])
            updated_cpo += 1
    
    # Update SalesOrder
    updated_so = 0
    for so in SalesOrder.objects.filter(plant_id__isnull=False):
        new_location_id = plant_to_location.get(so.plant_id)
        if new_location_id:
            so.plant_id = new_location_id
            so.save(update_fields=['plant_id'])
            updated_so += 1
    
    print(f"Updated FK references: {updated_po} POs, {updated_cpo} CPOs, {updated_so} SOs")


def reverse_update(apps, schema_editor):
    """
    Reverse is not straightforward since we changed the FK target.
    This is a one-way migration - to reverse, restore from backup.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('locations', '0005_migrate_plants_data'),
        ('purchase_orders', '0010_update_plant_fk_to_location'),
        ('sales_orders', '0010_update_plant_fk_to_location'),
    ]

    operations = [
        migrations.RunPython(
            update_order_plant_references,
            reverse_code=reverse_update,
        ),
    ]
