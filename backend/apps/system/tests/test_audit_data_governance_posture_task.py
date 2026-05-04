from __future__ import annotations

from unittest.mock import patch

from django.test import TestCase

from apps.system.tasks import audit_data_governance_posture
from apps.tenants.models import Tenant


class AuditDataGovernancePostureTaskTests(TestCase):
    def setUp(self) -> None:
        self.tenant_a = Tenant.objects.create(
            name="ACME Meats",
            slug="acme-meats",
            schema_name="acme_meats",
            contact_email="ops@acme-meats.example",
            is_active=True,
        )
        self.tenant_b = Tenant.objects.create(
            name="Bravo Meats",
            slug="bravo-meats",
            schema_name="bravo_meats",
            contact_email="ops@bravo-meats.example",
            is_active=True,
        )

    @patch("apps.core.services.data_governance.build_governance_posture_report")
    def test_task_continues_when_one_tenant_audit_raises(self, mock_build):
        mock_build.side_effect = [
            RuntimeError("boom"),
            {
                "tenant_id": str(self.tenant_b.id),
                "tenant_slug": self.tenant_b.slug,
                "overall_status": "healthy",
                "warnings": [],
            },
        ]

        summary = audit_data_governance_posture(lookback_days=14)

        self.assertEqual(summary["tenant_count"], 2)
        self.assertEqual(summary["overall_status"], "warning")
        self.assertTrue(
            any(
                report["tenant_slug"] is None and "Governance audit failed" in report["warnings"][0]
                for report in summary["tenant_reports"]
            )
        )
        self.assertTrue(
            any(report["tenant_slug"] == self.tenant_b.slug for report in summary["tenant_reports"])
        )
