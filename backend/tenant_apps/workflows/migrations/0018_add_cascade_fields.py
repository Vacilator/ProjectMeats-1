# Generated manually for Phase 2.3: Entity Cascading

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("workflows", "0017_add_is_system_template_field"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenantformfield",
            name="cascade_parent_field",
            field=models.ForeignKey(
                blank=True,
                help_text="Parent field that controls options for this field (e.g., protein type filters cuts)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cascade_children",
                to="workflows.tenantformfield",
            ),
        ),
        migrations.AddField(
            model_name="tenantformfield",
            name="cascade_filter_key",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Field key to filter by in related model (e.g., 'type_of_protein' in Product model)",
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name="tenantformfield",
            name="cascade_enabled",
            field=models.BooleanField(default=False, help_text="Enable cascading filter for this field"),
        ),
    ]
