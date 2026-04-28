"""workflows 0036 hotfix: ensure legacy workflow tables have custom_data.

Production drift was observed where workflows_tenantlist was missing the
TenantAwareModel custom_data column, causing ORM queries and admin delete
collection to fail with ProgrammingError.

This migration is intentionally idempotent and additive:
- adds custom_data only when the table/column is missing
- backfills NULL values to {}
- preserves existing data

Reverse is a no-op because removing the column would be unsafe on live tenants.
"""

from django.db import migrations


_ADD_COLUMNS_SQL = """
ALTER TABLE IF EXISTS workflows_tenantlist
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantform
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformentity
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformfield
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformrule
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantworkflow
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantworkflowcondition
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantworkflowaction
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_workflowexecutionlog
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformversion
    ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
"""

_BACKFILL_SQL = """
UPDATE workflows_tenantlist SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantform SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantformentity SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantformfield SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantformrule SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantworkflow SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantworkflowcondition SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantworkflowaction SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_workflowexecutionlog SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
UPDATE workflows_tenantformversion SET custom_data = '{}'::jsonb WHERE custom_data IS NULL;
"""

_SET_NOT_NULL_SQL = """
ALTER TABLE IF EXISTS workflows_tenantlist ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantlist ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantform ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantform ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantformentity ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformentity ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantformfield ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformfield ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantformrule ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformrule ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantworkflow ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantworkflow ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantworkflowcondition ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantworkflowcondition ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantworkflowaction ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantworkflowaction ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_workflowexecutionlog ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_workflowexecutionlog ALTER COLUMN custom_data SET NOT NULL;
ALTER TABLE IF EXISTS workflows_tenantformversion ALTER COLUMN custom_data SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workflows_tenantformversion ALTER COLUMN custom_data SET NOT NULL;
"""


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("workflows", "0035_tenantworkformexecution_runtime_state"),
    ]

    operations = [
        migrations.RunSQL(sql=_ADD_COLUMNS_SQL, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=_BACKFILL_SQL, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=_SET_NOT_NULL_SQL, reverse_sql=migrations.RunSQL.noop),
    ]
