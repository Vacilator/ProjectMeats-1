"""
Data migration to copy Plant records to Location model.

This migration:
1. Copies all Plant records to Location with appropriate location_type
2. Maps plant_type values to LocationTypeChoices
3. Stores legacy_plant_id for reference
4. Does NOT delete Plant records (that happens in a separate migration)
"""
from django.db import migrations


# Mapping from Plant.plant_type to Location.location_type
PLANT_TYPE_MAPPING = {
    'processing': 'plant_processing',
    'distribution': 'plant_distribution',
    'warehouse': 'plant_warehouse',
    'retail': 'plant_retail',
    'other': 'plant_other',
}


def migrate_plants_to_locations(apps, schema_editor):
    """Copy Plant records to Location model."""
    Plant = apps.get_model('plants', 'Plant')
    Location = apps.get_model('locations', 'Location')
    
    plants = Plant.objects.all()
    locations_to_create = []
    
    for plant in plants:
        # Map plant_type to location_type
        location_type = PLANT_TYPE_MAPPING.get(plant.plant_type, 'plant_other')
        
        # Create Location record
        location = Location(
            tenant_id=plant.tenant_id,
            name=plant.name,
            code=plant.code,
            location_type=location_type,
            address=plant.address,
            city=plant.city,
            state=plant.state,
            zip_code=plant.zip_code,
            country=plant.country,
            phone=plant.phone,
            email=plant.email,
            contact_name=plant.manager,  # Map manager to contact_name
            is_active=plant.is_active,
            supplier_id=plant.supplier_id,
            # Plant-specific fields
            plant_est_num=plant.plant_est_num,
            manager=plant.manager,
            capacity=plant.capacity,
            created_by_id=plant.created_by_id,
            legacy_plant_id=plant.id,
        )
        locations_to_create.append(location)
    
    # Bulk create for efficiency
    Location.objects.bulk_create(locations_to_create, ignore_conflicts=True)
    
    print(f"Migrated {len(locations_to_create)} plants to locations")


def reverse_migration(apps, schema_editor):
    """Remove migrated plant locations."""
    Location = apps.get_model('locations', 'Location')
    # Only delete locations that were migrated from plants
    Location.objects.filter(legacy_plant_id__isnull=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('locations', '0004_add_plant_fields'),
        ('plants', '0006_fix_address_fields_blank'),  # Latest plants migration
    ]

    operations = [
        migrations.RunPython(
            migrate_plants_to_locations,
            reverse_code=reverse_migration,
        ),
    ]
