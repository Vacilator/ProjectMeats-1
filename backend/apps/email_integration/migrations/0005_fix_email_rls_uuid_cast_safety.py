from django.db import migrations

SAFE_EXPR = "tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid"
UNSAFE_EXPR = "tenant_id = current_setting('app.current_tenant', true)::uuid"


def _alter_policy_sql(*, table: str, policy: str, expr: str) -> str:
    # Postgres supports ALTER POLICY ... USING (...)
    # We wrap in a DO block to be idempotent (policy may already exist).
    return f"""
    DO $$
    BEGIN
        -- Ensure RLS is enabled/forced even if the policy already exists.
        ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE {table} FORCE ROW LEVEL SECURITY;

        IF EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = '{table}'
              AND policyname = '{policy}'
        ) THEN
            ALTER POLICY {policy} ON {table}
                USING ({expr});
        ELSE
            CREATE POLICY {policy} ON {table}
                FOR ALL
                USING ({expr});
        END IF;
    END $$;
    """


class Migration(migrations.Migration):
    dependencies = [
        ("email_integration", "0004_enable_rls_email_integration"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Email Integration: harden UUID casting in RLS policies.
            """
            + _alter_policy_sql(
                table="email_accounts",
                policy="email_accounts_tenant_isolation",
                expr=SAFE_EXPR,
            )
            + _alter_policy_sql(
                table="email_actions",
                policy="email_actions_tenant_isolation",
                expr=SAFE_EXPR,
            )
            + _alter_policy_sql(
                table="email_triggers",
                policy="email_triggers_tenant_isolation",
                expr=SAFE_EXPR,
            )
            + _alter_policy_sql(
                table="email_logs",
                policy="email_logs_tenant_isolation",
                expr=SAFE_EXPR,
            ),
            reverse_sql="""
            -- Revert to legacy UUID casts (kept for rollback safety).
            """
            + _alter_policy_sql(
                table="email_accounts",
                policy="email_accounts_tenant_isolation",
                expr=UNSAFE_EXPR,
            )
            + _alter_policy_sql(
                table="email_actions",
                policy="email_actions_tenant_isolation",
                expr=UNSAFE_EXPR,
            )
            + _alter_policy_sql(
                table="email_triggers",
                policy="email_triggers_tenant_isolation",
                expr=UNSAFE_EXPR,
            )
            + _alter_policy_sql(
                table="email_logs",
                policy="email_logs_tenant_isolation",
                expr=UNSAFE_EXPR,
            ),
        ),
    ]
