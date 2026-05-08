import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        ("tenants", "0015_alter_tenantinvitation_role_alter_tenantuser_role"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0004_tenantauditevent"),
    ]

    operations = [
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_on", models.DateTimeField(auto_now_add=True)),
                ("modified_on", models.DateTimeField(auto_now=True)),
                (
                    "custom_data",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Extensible schema data for dynamic fields defined in Blueprints.",
                    ),
                ),
                (
                    "object_id",
                    models.CharField(db_index=True, help_text="Primary key of the related entity", max_length=255),
                ),
                (
                    "entity_type",
                    models.CharField(db_index=True, help_text="Canonical entity type slug", max_length=100),
                ),
                ("body", models.TextField(help_text="Comment body")),
                ("mentions", models.JSONField(blank=True, default=list, help_text="Mentioned tenant user ids")),
                (
                    "content_type",
                    models.ForeignKey(
                        help_text="Type of entity this comment belongs to",
                        on_delete=django.db.models.deletion.CASCADE,
                        to="contenttypes.contenttype",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        help_text="User who authored this comment",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="core_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        help_text="Tenant this entity belongs to",
                        on_delete=django.db.models.deletion.CASCADE,
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_on"],
            },
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["tenant", "entity_type", "object_id"], name="core_comment_tenant_entity_idx"),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["tenant", "-created_on"], name="core_comment_tenant_created_idx"),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["content_type", "object_id"], name="core_comment_content_object_idx"),
        ),
    ]
