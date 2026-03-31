"""workflows 0031 hotfix: ensure created_on/modified_on exist.

Production drift was observed where the tables below were missing TimestampModel columns
(created_on/modified_on), resulting in ProgrammingError when querying via ORM.

This migration is intentionally idempotent: it adds columns only when absent, and
backfills values from created_at/updated_at.

IMPORTANT: reverse is a NO-OP. Forward is conditional and may do nothing on a DB that
already has the columns; dropping columns on reverse would be unsafe.
"""

from django.db import migrations


_ADD_COLUMNS_SQL = """
DO $$
DECLARE
    t TEXT;
    src_col TEXT;
    dst_col TEXT;
BEGIN
    FOR t, src_col, dst_col IN VALUES
        ('workflows_tenantform',     'created_at', 'created_on'),
        ('workflows_tenantform',     'updated_at', 'modified_on'),
        ('workflows_tenantlist',     'created_at', 'created_on'),
        ('workflows_tenantlist',     'updated_at', 'modified_on'),
        ('workflows_tenantworkflow', 'created_at', 'created_on'),
        ('workflows_tenantworkflow', 'updated_at', 'modified_on')
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name  = t
              AND column_name = dst_col
        ) THEN
            -- Step 1: Add the column as nullable so no DEFAULT is needed.
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN %I timestamp with time zone',
                t, dst_col
            );
            -- Step 2: Back-fill every row from the corresponding source column.
            EXECUTE format(
                'UPDATE %I SET %I = %I WHERE %I IS NULL',
                t, dst_col, src_col, dst_col
            );
            -- Step 3: Add the NOT NULL constraint now that every row has a value.
            EXECUTE format(
                'ALTER TABLE %I ALTER COLUMN %I SET NOT NULL',
                t, dst_col
            );
        END IF;
    END LOOP;
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("workflows", "0030_tenantworkformexecution"),
    ]

    operations = [
        migrations.RunSQL(
            sql=_ADD_COLUMNS_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
