from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("email_integration", "0003_emailaccount_tenant_emailaction_tenant_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Email Integration (apps.email_integration)
            -- Enable & FORCE RLS + tenant isolation policies.

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = 'email_accounts'
                      AND policyname = 'email_accounts_tenant_isolation'
                ) THEN
                    ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE email_accounts FORCE ROW LEVEL SECURITY;
                    CREATE POLICY email_accounts_tenant_isolation ON email_accounts
                        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = 'email_actions'
                      AND policyname = 'email_actions_tenant_isolation'
                ) THEN
                    ALTER TABLE email_actions ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE email_actions FORCE ROW LEVEL SECURITY;
                    CREATE POLICY email_actions_tenant_isolation ON email_actions
                        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = 'email_triggers'
                      AND policyname = 'email_triggers_tenant_isolation'
                ) THEN
                    ALTER TABLE email_triggers ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE email_triggers FORCE ROW LEVEL SECURITY;
                    CREATE POLICY email_triggers_tenant_isolation ON email_triggers
                        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = 'email_logs'
                      AND policyname = 'email_logs_tenant_isolation'
                ) THEN
                    ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE email_logs FORCE ROW LEVEL SECURITY;
                    CREATE POLICY email_logs_tenant_isolation ON email_logs
                        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
                END IF;
            END $$;
            """,
            reverse_sql="""
            DROP POLICY IF EXISTS email_accounts_tenant_isolation ON email_accounts;
            ALTER TABLE email_accounts DISABLE ROW LEVEL SECURITY;
            ALTER TABLE email_accounts NO FORCE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS email_actions_tenant_isolation ON email_actions;
            ALTER TABLE email_actions DISABLE ROW LEVEL SECURITY;
            ALTER TABLE email_actions NO FORCE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS email_triggers_tenant_isolation ON email_triggers;
            ALTER TABLE email_triggers DISABLE ROW LEVEL SECURITY;
            ALTER TABLE email_triggers NO FORCE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS email_logs_tenant_isolation ON email_logs;
            ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;
            ALTER TABLE email_logs NO FORCE ROW LEVEL SECURITY;
            """,
        ),
    ]
