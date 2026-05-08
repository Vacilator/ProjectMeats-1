from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tenant_integrations", "0003_settlementevent_matched_invoice_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="settlementevent",
            name="review_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="settlementevent",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="settlementevent",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="reviewed_settlement_events",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
