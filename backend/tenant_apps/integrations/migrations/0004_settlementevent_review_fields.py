from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('tenant_integrations', '0003_settlementevent_matched_invoice_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='settlementevent',
                    name='review_note',
                    field=models.TextField(blank=True, default=''),
                ),
                migrations.AddField(
                    model_name='settlementevent',
                    name='reviewed_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='settlementevent',
                    name='reviewed_by',
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name='reviewed_settlement_events',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    ALTER TABLE tenant_integrations_settlementevent
                        ADD COLUMN IF NOT EXISTS review_note text DEFAULT '' NOT NULL,
                        ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
                        ADD COLUMN IF NOT EXISTS reviewed_by_id bigint REFERENCES auth_user(id) ON DELETE SET NULL;
                    """,
                    reverse_sql="""
                    ALTER TABLE tenant_integrations_settlementevent
                        DROP COLUMN IF EXISTS review_note,
                        DROP COLUMN IF EXISTS reviewed_at,
                        DROP COLUMN IF EXISTS reviewed_by_id;
                    """,
                ),
            ],
        ),
    ]
