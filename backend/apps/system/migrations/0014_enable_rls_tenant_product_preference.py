from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("system", "0013_seed_default_choice_lists"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE tenant_product_preference ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS tenant_product_preference_tenant_isolation ON tenant_product_preference;
            CREATE POLICY tenant_product_preference_tenant_isolation ON tenant_product_preference
                USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
                WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
            """,
            reverse_sql="""
            DROP POLICY IF EXISTS tenant_product_preference_tenant_isolation ON tenant_product_preference;
            ALTER TABLE tenant_product_preference DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
