from __future__ import annotations

from django.db import connection
from django.test import TransactionTestCase


class WorkflowRlsUuidCastSafetyTestCase(TransactionTestCase):
    """Regression test for invalid UUID casts when app.current_tenant = ''."""

    def test_workflows_policies_use_nullif_current_setting(self):
        if connection.vendor != "postgresql":
            self.skipTest("RLS policy introspection requires PostgreSQL")

        expected_policy_fields = {
            # (table, policy): field in pg_policies to inspect
            ("workflows_tenantlist", "tenantlist_tenant_isolation"): "qual",
            ("workflows_tenantlist", "tenantlist_tenant_insert"): "with_check",
            ("workflows_tenantform", "tenantform_tenant_isolation"): "qual",
            ("workflows_tenantform", "tenantform_tenant_insert"): "with_check",
            ("workflows_tenantworkflow", "tenantworkflow_tenant_isolation"): "qual",
            ("workflows_tenantworkflow", "tenantworkflow_tenant_insert"): "with_check",
            ("workflows_workflowexecutionlog", "workflowexecutionlog_tenant_isolation"): "qual",
            ("workflows_workflowexecutionlog", "workflowexecutionlog_tenant_insert"): "with_check",
            ("workflows_formsubmission", "formsubmission_tenant_isolation"): "qual",
            ("workflows_formstepsubmission", "formstepsubmission_tenant_isolation"): "qual",
            ("workflows_usernotification", "usernotification_tenant_isolation"): "qual",
        }

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT tablename, policyname, qual, with_check
                FROM pg_policies
                WHERE schemaname = current_schema()
                  AND tablename LIKE 'workflows_%'
                """
            )
            rows = cursor.fetchall()

        by_key = {(t, p): {"qual": q, "with_check": wc} for (t, p, q, wc) in rows}

        for key, field in expected_policy_fields.items():
            self.assertIn(key, by_key, msg=f"Missing policy in pg_policies: {key}")
            expr = by_key[key][field]
            self.assertTrue(expr, msg=f"Empty policy expression for {key} ({field})")

            s = str(expr).lower()
            self.assertIn("current_setting", s)
            self.assertIn("app.current_tenant", s)
            self.assertIn("nullif", s)
            self.assertIn("uuid", s)
