# Generated to fix Phase 2 migration issues
# - Remove Phase 2.5 fields from TenantFormField (never added to model)
# - Rename TenantFormVersion timestamps to match TenantAwareModel inheritance
# - Add missing custom_data field to TenantFormVersion

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0001_initial"),
        ("workflows", "0020_add_enhanced_inheritance"),
    ]

    operations = [
        # Remove Phase 2.5 fields that were never added to TenantFormField model
        migrations.RemoveField(
            model_name="tenantformfield",
            name="computed_validation",
        ),
        migrations.RemoveField(
            model_name="tenantformfield",
            name="inherit_from_parent",
        ),
        migrations.RemoveField(
            model_name="tenantformfield",
            name="strict_type_checking",
        ),
        # Rename timestamp fields to match TenantAwareModel inheritance
        # This preserves existing data while aligning with TimestampModel
        migrations.RenameField(
            model_name="tenantformversion",
            old_name="created_at",
            new_name="created_on",
        ),
        migrations.RenameField(
            model_name="tenantformversion",
            old_name="updated_at",
            new_name="modified_on",
        ),
        # Add missing custom_data field (inherited from TenantAwareModel)
        migrations.AddField(
            model_name="tenantformversion",
            name="custom_data",
            field=models.JSONField(
                blank=True, default=dict, help_text="Extensible schema data for dynamic fields defined in Blueprints."
            ),
        ),
        # Fix tenant field to include help_text from TenantAwareModel
        migrations.AlterField(
            model_name="tenantformversion",
            name="tenant",
            field=models.ForeignKey(
                help_text="Tenant this entity belongs to",
                on_delete=django.db.models.deletion.CASCADE,
                to="tenants.tenant",
            ),
        ),
    ]
