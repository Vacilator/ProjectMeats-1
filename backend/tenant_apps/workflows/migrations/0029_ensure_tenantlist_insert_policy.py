from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("workflows", "0028_usernotificationpreferences_tenant_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE workflows_tenantlist ENABLE ROW LEVEL SECURITY;
            ALTER TABLE workflows_tenantlist FORCE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS tenantlist_tenant_insert ON workflows_tenantlist;
            DROP POLICY IF EXISTS tenantlist_tenant_isolation ON workflows_tenantlist;

            CREATE POLICY tenantlist_tenant_isolation ON workflows_tenantlist
              USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

            CREATE POLICY tenantlist_tenant_insert ON workflows_tenantlist
              FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
            """,
            reverse_sql="""
            DROP POLICY IF EXISTS tenantlist_tenant_insert ON workflows_tenantlist;
            DROP POLICY IF EXISTS tenantlist_tenant_isolation ON workflows_tenantlist;
            """,
        ),
    ]
