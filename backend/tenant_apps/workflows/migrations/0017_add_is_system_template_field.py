# Generated manually for phase 2.2 - Template Library

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("workflows", "0016_remove_formsubmission_workflows_f_tenant__8314a5_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenantform",
            name="is_system_template",
            field=models.BooleanField(default=False, help_text="True if this is an industry-standard system template"),
        ),
    ]
