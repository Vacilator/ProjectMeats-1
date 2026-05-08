"""Add attachment_data JSONField to EmailLog for storing extracted attachment content.

Additive-only migration. The new field stores attachment metadata and extracted
text from the attachment processing pipeline.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("integrations", "0006_alter_emaillog_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="emaillog",
            name="attachment_data",
            field=models.JSONField(
                blank=True,
                null=True,
                default=None,
                help_text="Attachment metadata and extracted text from AI processing",
            ),
        ),
    ]
