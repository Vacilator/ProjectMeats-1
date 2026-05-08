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
-- Step 1: Add columns as nullable (idempotent)
ALTER TABLE workflows_tenantform ADD COLUMN IF NOT EXISTS created_on timestamp with time zone;
ALTER TABLE workflows_tenantform ADD COLUMN IF NOT EXISTS modified_on timestamp with time zone;

ALTER TABLE workflows_tenantlist ADD COLUMN IF NOT EXISTS created_on timestamp with time zone;
ALTER TABLE workflows_tenantlist ADD COLUMN IF NOT EXISTS modified_on timestamp with time zone;

ALTER TABLE workflows_tenantworkflow ADD COLUMN IF NOT EXISTS created_on timestamp with time zone;
ALTER TABLE workflows_tenantworkflow ADD COLUMN IF NOT EXISTS modified_on timestamp with time zone;
"""

_BACKFILL_SQL = """
-- Step 2: Backfill values (idempotent)
UPDATE workflows_tenantform
SET created_on = COALESCE(created_on, created_at, NOW()),
    modified_on = COALESCE(modified_on, updated_at, NOW())
WHERE created_on IS NULL OR modified_on IS NULL;

UPDATE workflows_tenantlist
SET created_on = COALESCE(created_on, created_at, NOW()),
    modified_on = COALESCE(modified_on, updated_at, NOW())
WHERE created_on IS NULL OR modified_on IS NULL;

UPDATE workflows_tenantworkflow
SET created_on = COALESCE(created_on, created_at, NOW()),
    modified_on = COALESCE(modified_on, updated_at, NOW())
WHERE created_on IS NULL OR modified_on IS NULL;
"""

_SET_NOT_NULL_SQL = """
-- Step 3: Set NOT NULL constraints (DDL only)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflows_tenantform' AND column_name = 'created_on'
  ) THEN
    EXECUTE 'ALTER TABLE workflows_tenantform ALTER COLUMN created_on SET NOT NULL';
    EXECUTE 'ALTER TABLE workflows_tenantform ALTER COLUMN modified_on SET NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflows_tenantlist' AND column_name = 'created_on'
  ) THEN
    EXECUTE 'ALTER TABLE workflows_tenantlist ALTER COLUMN created_on SET NOT NULL';
    EXECUTE 'ALTER TABLE workflows_tenantlist ALTER COLUMN modified_on SET NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflows_tenantworkflow' AND column_name = 'created_on'
  ) THEN
    EXECUTE 'ALTER TABLE workflows_tenantworkflow ALTER COLUMN created_on SET NOT NULL';
    EXECUTE 'ALTER TABLE workflows_tenantworkflow ALTER COLUMN modified_on SET NOT NULL';
  END IF;
END $$;
"""


class Migration(migrations.Migration):
    # This migration performs DML (backfills) and then DDL (SET NOT NULL). On production
    # Postgres, doing both in a single transaction can fail with:
    #   cannot ALTER TABLE ... because it has pending trigger events
    # So we intentionally run it non-atomically to allow commits between steps.
    atomic = False

    dependencies = [
        ("workflows", "0030_tenantworkformexecution"),
    ]

    operations = [
        migrations.RunSQL(sql=_ADD_COLUMNS_SQL, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=_BACKFILL_SQL, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=_SET_NOT_NULL_SQL, reverse_sql=migrations.RunSQL.noop),
    ]
