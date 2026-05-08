from __future__ import annotations

from django.db import connection
from django.test import TransactionTestCase


class EmailIntegrationRlsUuidCastSafetyTestCase(TransactionTestCase):
    """Regression test for invalid UUID casts when app.current_tenant = ''."""

    def test_email_integration_policies_use_nullif_current_setting(self):
        if connection.vendor != "postgresql":
            self.skipTest("RLS policy introspection requires PostgreSQL")

        expected_policy_fields = {
            ("email_accounts", "email_accounts_tenant_isolation"): "qual",
            ("email_actions", "email_actions_tenant_isolation"): "qual",
            ("email_triggers", "email_triggers_tenant_isolation"): "qual",
            ("email_logs", "email_logs_tenant_isolation"): "qual",
        }

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT tablename, policyname, qual
                FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename IN ('email_accounts', 'email_actions', 'email_triggers', 'email_logs')
                """
            )
            rows = cursor.fetchall()

        by_key = {(t, p): q for (t, p, q) in rows}

        for key, field in expected_policy_fields.items():
            self.assertIn(key, by_key, msg=f"Missing policy in pg_policies: {key}")
            expr = by_key[key]
            self.assertTrue(expr, msg=f"Empty policy expression for {key} ({field})")

            s = str(expr).lower()
            self.assertIn("current_setting", s)
            self.assertIn("app.current_tenant", s)
            self.assertIn("nullif", s)
            self.assertIn("uuid", s)
