# Generated manually for Phase 2.5: Enhanced Inheritance

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0019_add_form_versioning'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantformfield',
            name='inherit_from_parent',
            field=models.BooleanField(
                default=False,
                help_text='Inherit validation rules from parent entity field definition'
            ),
        ),
        migrations.AddField(
            model_name='tenantformfield',
            name='strict_type_checking',
            field=models.BooleanField(
                default=True,
                help_text='Enforce strict type validation based on field_type'
            ),
        ),
        migrations.AddField(
            model_name='tenantformfield',
            name='computed_validation',
            field=models.JSONField(
                default=dict,
                blank=True,
                help_text='Computed validation rules inherited from entity model'
            ),
        ),
    ]
