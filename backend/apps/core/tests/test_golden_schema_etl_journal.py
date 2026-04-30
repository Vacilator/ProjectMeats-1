"""Tests for ETL journal helpers and restart-safe dry-run persistence."""

from __future__ import annotations

from django.test import TestCase

from apps.core.models import ETLImportBatch, ETLImportRowJournal
from apps.core.services.etl.journal import (
    build_command_options,
    build_run_key,
    checksum_manifest_payload,
    get_or_start_batch,
    upsert_row_journal,
)
from apps.tenants.models import Tenant


class GoldenSchemaETLJournalTests(TestCase):
    """Validate deterministic batch identity and row-journal upserts."""

    def setUp(self) -> None:
        self.tenant = Tenant.objects.create(
            name="ACME Meats",
            slug="acme-meats",
            schema_name="acme_meats",
            contact_email="ops@acme-meats.example",
            is_active=True,
        )
        self.manifest_payload = {
            "batch_name": "acme-dry-run",
            "source_system": "legacy_json_bundle",
            "tenant_slug": self.tenant.slug,
            "sources": [{"entity": "suppliers", "format": "json", "path": "supplier_rows.json"}],
        }
        self.command_options = build_command_options(output_format='json')

    def test_run_key_is_deterministic_for_same_manifest_and_options(self) -> None:
        checksum = checksum_manifest_payload(self.manifest_payload)

        first = build_run_key(
            tenant_id=str(self.tenant.id),
            manifest_checksum=checksum,
            command_options=self.command_options,
        )
        second = build_run_key(
            tenant_id=str(self.tenant.id),
            manifest_checksum=checksum,
            command_options=self.command_options,
        )

        self.assertEqual(first, second)

    def test_get_or_start_batch_reuses_existing_batch(self) -> None:
        checksum = checksum_manifest_payload(self.manifest_payload)

        batch, created = get_or_start_batch(
            tenant=self.tenant,
            manifest_payload=self.manifest_payload,
            manifest_checksum=checksum,
            command_options=self.command_options,
        )
        reused, reused_created = get_or_start_batch(
            tenant=self.tenant,
            manifest_payload=self.manifest_payload,
            manifest_checksum=checksum,
            command_options=self.command_options,
        )

        self.assertTrue(created)
        self.assertFalse(reused_created)
        self.assertEqual(batch.id, reused.id)
        self.assertEqual(ETLImportBatch.objects.count(), 1)

    def test_upsert_row_journal_is_restart_safe(self) -> None:
        checksum = checksum_manifest_payload(self.manifest_payload)
        batch, _ = get_or_start_batch(
            tenant=self.tenant,
            manifest_payload=self.manifest_payload,
            manifest_checksum=checksum,
            command_options=self.command_options,
        )

        upsert_row_journal(
            batch=batch,
            tenant=self.tenant,
            row_result={
                'entity': 'suppliers',
                'source_path': 'supplier_rows.json',
                'source_sheet': '',
                'source_row_number': 1,
                'source_identifier': 'name=Existing Supplier|email=existing-supplier@example.com',
                'normalized_lookup_key': 'name=Existing Supplier|email=existing-supplier@example.com',
                'row_fingerprint': 'fingerprint-1',
                'planned_action': ETLImportRowJournal.PlannedAction.WOULD_CREATE,
                'target_model': 'tenant_apps.suppliers.models.Supplier',
                'target_identifier': '',
                'status': ETLImportRowJournal.Status.PLANNED,
                'error_code': '',
                'error_message': '',
                'side_effects_suppressed': ['outbound_email'],
                'raw_payload': {'name': 'Existing Supplier'},
                'normalized_payload': {'name': 'Existing Supplier'},
                'warnings': [],
            },
        )
        upsert_row_journal(
            batch=batch,
            tenant=self.tenant,
            row_result={
                'entity': 'suppliers',
                'source_path': 'supplier_rows.json',
                'source_sheet': '',
                'source_row_number': 1,
                'source_identifier': 'name=Existing Supplier|email=existing-supplier@example.com',
                'normalized_lookup_key': 'name=Existing Supplier|email=existing-supplier@example.com',
                'row_fingerprint': 'fingerprint-1',
                'planned_action': ETLImportRowJournal.PlannedAction.WOULD_SKIP,
                'target_model': 'tenant_apps.suppliers.models.Supplier',
                'target_identifier': '123',
                'status': ETLImportRowJournal.Status.PLANNED,
                'error_code': '',
                'error_message': '',
                'side_effects_suppressed': ['outbound_email'],
                'raw_payload': {'name': 'Existing Supplier'},
                'normalized_payload': {'name': 'Existing Supplier'},
                'warnings': ['matching_strategy_pending'],
            },
        )

        self.assertEqual(ETLImportRowJournal.objects.count(), 1)
        journal = ETLImportRowJournal.objects.get()
        self.assertEqual(journal.planned_action, ETLImportRowJournal.PlannedAction.WOULD_SKIP)
        self.assertEqual(journal.target_identifier, '123')
        self.assertEqual(journal.warnings, ['matching_strategy_pending'])
