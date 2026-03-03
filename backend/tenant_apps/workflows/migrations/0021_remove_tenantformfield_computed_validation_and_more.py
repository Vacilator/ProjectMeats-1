# Generated to fix Phase 2 migration issues
# - Remove Phase 2.5 fields from TenantFormField (never added to model)
# - Add missing inherited fields to TenantFormVersion (created_on, modified_on, custom_data)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
        ('workflows', '0020_add_enhanced_inheritance'),
    ]

    operations = [
        # Remove Phase 2.5 fields that were never added to TenantFormField model
        migrations.RemoveField(
            model_name='tenantformfield',
            name='computed_validation',
        ),
        migrations.RemoveField(
            model_name='tenantformfield',
            name='inherit_from_parent',
        ),
        migrations.RemoveField(
            model_name='tenantformfield',
            name='strict_type_checking',
        ),
        
        # Add missing inherited fields to TenantFormVersion
        # (These come from TenantAwareModel -> TimestampModel)
        migrations.AddField(
            model_name='tenantformversion',
            name='created_on',
            field=models.DateTimeField(auto_now_add=True, default='2026-01-01T00:00:00Z'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='tenantformversion',
            name='modified_on',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='tenantformversion',
            name='custom_data',
            field=models.JSONField(blank=True, default=dict, help_text='Extensible schema data for dynamic fields defined in Blueprints.'),
        ),
        
        # Fix tenant field to include help_text from TenantAwareModel
        migrations.AlterField(
            model_name='tenantformversion',
            name='tenant',
            field=models.ForeignKey(help_text='Tenant this entity belongs to', on_delete=django.db.models.deletion.CASCADE, to='tenants.tenant'),
        ),
        
        # Remove incorrectly named fields from migration 0019
        migrations.RemoveField(
            model_name='tenantformversion',
            name='created_at',
        ),
        migrations.RemoveField(
            model_name='tenantformversion',
            name='updated_at',
        ),
    ]
