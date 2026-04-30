"""End-to-end dry-run command coverage for GA-01.2."""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.core.models import ETLImportBatch, ETLImportRowJournal
from apps.tenants.models import Tenant
from tenant_apps.suppliers.models import Supplier


DRY_RUN_MANIFEST_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "etl" / "dry_run_manifest.json"
)


class ImportGoldenLegacyDataCommandTests(TestCase):
    """Exercise the journal-write-only ETL dry-run path."""

    def setUp(self) -> None:
        self.tenant = Tenant.objects.create(
            name="ACME Meats",
            slug="acme-meats",
            schema_name="acme_meats",
            contact_email="ops@acme-meats.example",
            is_active=True,
        )
        self.other_tenant = Tenant.objects.create(
            name="Other Meats",
            slug="other-meats",
            schema_name="other_meats",
            contact_email="ops@other-meats.example",
            is_active=True,
        )
        Supplier.objects.create(
            tenant=self.tenant,
            name='Existing Supplier',
            email='existing-supplier@example.com',
            phone='5551112222',
        )
        Supplier.objects.create(
            tenant=self.tenant,
            name='Update Supplier',
            email='update-supplier@example.com',
            phone='5550001111',
        )
        Supplier.objects.create(
            tenant=self.other_tenant,
            name='Cross Tenant Supplier',
            email='cross-tenant@example.com',
            phone='5558889999',
        )

    def test_command_persists_dry_run_journals_without_writing_business_rows(self) -> None:
        out = StringIO()

        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(DRY_RUN_MANIFEST_PATH),
            '--format',
            'json',
            stdout=out,
        )

        rendered = json.loads(out.getvalue())
        summary = rendered['batch_run']['summary']

        self.assertEqual(summary['would_create_count'], 1)
        self.assertEqual(summary['would_update_count'], 1)
        self.assertEqual(summary['would_skip_count'], 1)
        self.assertEqual(summary['error_count'], 1)

        self.assertEqual(ETLImportBatch.objects.count(), 1)
        self.assertEqual(ETLImportRowJournal.objects.count(), 4)
        self.assertEqual(Supplier.objects.filter(tenant=self.tenant).count(), 2)

        decisions = {
            journal.source_identifier or f'row-{journal.source_row_number}': journal.planned_action
            for journal in ETLImportRowJournal.objects.order_by('source_row_number')
        }
        self.assertEqual(decisions['name=Existing Supplier|email=existing-supplier@example.com'], 'would_skip')
        self.assertEqual(decisions['name=Update Supplier|email=update-supplier@example.com'], 'would_update')
        self.assertEqual(decisions['name=New Supplier|email=new-supplier@example.com'], 'would_create')
        self.assertEqual(
            ETLImportRowJournal.objects.get(error_code='missing_natural_key').planned_action,
            ETLImportRowJournal.PlannedAction.ERROR,
        )

    def test_rerun_reuses_same_batch_and_row_journals(self) -> None:
        first = StringIO()
        second = StringIO()

        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(DRY_RUN_MANIFEST_PATH),
            '--format',
            'json',
            stdout=first,
        )
        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(DRY_RUN_MANIFEST_PATH),
            '--format',
            'json',
            stdout=second,
        )

        self.assertEqual(ETLImportBatch.objects.count(), 1)
        self.assertEqual(ETLImportRowJournal.objects.count(), 4)

    def test_failed_source_load_marks_batch_failed(self) -> None:
        with TemporaryDirectory() as tmpdir:
            manifest_path = Path(tmpdir) / 'missing-source-manifest.json'
            manifest_path.write_text(
                json.dumps(
                    {
                        'batch_name': 'acme-failed-dry-run',
                        'source_system': 'legacy_json_bundle',
                        'tenant_slug': self.tenant.slug,
                        'sources': [
                            {
                                'entity': 'suppliers',
                                'format': 'json',
                                'path': 'missing-source.json',
                            }
                        ],
                    }
                ),
                encoding='utf-8',
            )

            with self.assertRaises(CommandError):
                call_command(
                    'import_golden_legacy_data',
                    '--manifest',
                    str(manifest_path),
                    '--format',
                    'json',
                    stdout=StringIO(),
                )

        batch = ETLImportBatch.objects.get(
            tenant=self.tenant,
            source_manifest__batch_name='acme-failed-dry-run',
        )
        self.assertEqual(batch.status, ETLImportBatch.Status.FAILED)
        self.assertIn('missing-source.json', batch.failure_message)
