# Generated manually for Phase 2.4: Form Version Control

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("workflows", "0018_add_cascade_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantFormVersion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="tenants.tenant")),
                (
                    "form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="workflows.tenantform",
                        help_text="Form this version belongs to",
                    ),
                ),
                ("version_number", models.PositiveIntegerField(help_text="Sequential version number (1, 2, 3...)")),
                (
                    "snapshot_data",
                    models.JSONField(help_text="Complete snapshot of form configuration at this version"),
                ),
                (
                    "change_summary",
                    models.TextField(blank=True, default="", help_text="Summary of changes made in this version"),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.SET_NULL,
                        null=True,
                        blank=True,
                        related_name="form_versions_created",
                        to="auth.user",
                        help_text="User who created this version",
                    ),
                ),
                (
                    "is_current",
                    models.BooleanField(default=False, help_text="Whether this is the current active version"),
                ),
            ],
            options={
                "verbose_name": "Form Version",
                "verbose_name_plural": "Form Versions",
                "ordering": ["form", "-version_number"],
                "unique_together": [["form", "version_number"]],
            },
        ),
        migrations.AddField(
            model_name="tenantform",
            name="current_version",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name="forms_at_this_version",
                to="workflows.tenantformversion",
                help_text="Current active version of this form",
            ),
        ),
        migrations.AddField(
            model_name="tenantform",
            name="version_enabled",
            field=models.BooleanField(default=False, help_text="Enable version control for this form"),
        ),
    ]
