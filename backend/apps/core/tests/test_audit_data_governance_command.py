"""Command coverage for the GA-03.4 governance posture audit."""

from __future__ import annotations

import json
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from apps.core.models import ArchiveBatch, ArchiveLegalHold
from apps.tenants.models import Tenant


class AuditDataGovernanceCommandTests(TestCase):
    def setUp(self) -> None:
        self.tenant = Tenant.objects.create(
            name="ACME Meats",
            slug="acme-meats",
            schema_name="acme_meats",
            contact_email="ops@acme-meats.example",
            is_active=True,
        )

    def test_json_output_reports_archive_and_observability_posture(self) -> None:
        ArchiveBatch.objects.create(
            tenant=self.tenant,
            run_key="governance-ok",
            mode=ArchiveBatch.Mode.EXECUTE,
            status=ArchiveBatch.Status.COMPLETED,
            cutoff_date=timezone.now().date(),
            approved_by_email="approver@example.com",
            archived_record_count=2,
            summary={"archived_record_count": 2},
        )
        ArchiveLegalHold.objects.create(
            tenant=self.tenant,
            scope_model="tenant_apps.purchase_orders.models.PurchaseOrder",
            scope_selector={"object_ids": ["1"]},
            reason_code="litigation",
            placed_by_email="legal@example.com",
        )

        out = StringIO()
        call_command(
            "audit_data_governance",
            "--tenant-slug",
            self.tenant.slug,
            "--format",
            "json",
            stdout=out,
        )

        rendered = json.loads(out.getvalue())
        self.assertEqual(rendered["overall_status"], "healthy")
        self.assertEqual(rendered["tenant_count"], 1)
        tenant_report = rendered["tenant_reports"][0]
        self.assertEqual(tenant_report["archive_evidence"]["recent_execute_batch_count"], 1)
        self.assertEqual(tenant_report["archive_evidence"]["active_legal_hold_count"], 1)
        self.assertTrue(tenant_report["observability"]["logging_redaction_configured"])
        self.assertTrue(tenant_report["observability"]["sentry_send_default_pii_disabled"])
        self.assertEqual(len(tenant_report["retention_contract"]["checksum"]), 64)

    def test_strict_mode_raises_for_failed_archive_batches(self) -> None:
        ArchiveBatch.objects.create(
            tenant=self.tenant,
            run_key="governance-failed",
            mode=ArchiveBatch.Mode.EXECUTE,
            status=ArchiveBatch.Status.FAILED,
            cutoff_date=timezone.now().date(),
            approved_by_email="approver@example.com",
            failure_message="snapshot failure",
        )

        with self.assertRaises(CommandError):
            call_command(
                "audit_data_governance",
                "--tenant-slug",
                self.tenant.slug,
                "--strict",
                stdout=StringIO(),
            )
