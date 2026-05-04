"""Regression coverage for the GA-03.1 retention contract."""

from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from apps.core.services.data_governance import (
    ARCHIVE_TARGETS,
    ARCHIVE_TARGET_DETAILS,
    EXEMPTION_RULES,
    LEGAL_HOLD_CONTRACT,
    OPERATOR_EVIDENCE_FIELDS,
    RETENTION_YEARS,
    RESTORE_CONTRACT,
    _logging_redaction_configured,
    build_eligibility_q,
    default_retention_cutoff,
    get_retention_contract_checksum,
    get_retention_contract,
    subtract_years,
)


class DataGovernanceContractTest(SimpleTestCase):
    """Keep the GA-03.1 retention inventory stable until archive automation ships."""

    def test_archive_targets_stay_transaction_focused(self):
        labels = {target.model_label for target in ARCHIVE_TARGETS}

        self.assertEqual(RETENTION_YEARS, 7)
        self.assertIn("tenant_apps.purchase_orders.models.PurchaseOrder", labels)
        self.assertIn("tenant_apps.sales_orders.models.SalesOrder", labels)
        self.assertIn("tenant_apps.invoices.models.Invoice", labels)
        self.assertIn("tenant_apps.invoices.models.PaymentTransaction", labels)
        self.assertNotIn("tenant_apps.customers.models.Customer", labels)
        self.assertNotIn("tenant_apps.ai_assistant.models.CommunicationLog", labels)

    def test_legal_hold_contract_names_required_fields(self):
        required_fields = LEGAL_HOLD_CONTRACT["required_fields"]

        self.assertIn("tenant_id", required_fields)
        self.assertIn("scope_model", required_fields)
        self.assertIn("placed_by", required_fields)
        self.assertIn("released_at", required_fields)

    def test_restore_contract_stays_operator_only(self):
        self.assertEqual(RESTORE_CONTRACT["mode"], "operator-only")
        self.assertIn("tenant-explicit batch restore", RESTORE_CONTRACT["scope"])
        self.assertIn("restored_by", OPERATOR_EVIDENCE_FIELDS)

    def test_contract_payload_is_serializable(self):
        payload = get_retention_contract()

        self.assertEqual(payload["retention_years"], 7)
        self.assertGreaterEqual(len(payload["archive_targets"]), 10)
        self.assertTrue(payload["archive_targets"][0]["legal_hold_required"])
        self.assertTrue(any(rule["scope"] == "tenant master data" for rule in payload["exemptions"]))

    def test_retention_contract_checksum_is_stable(self):
        checksum = get_retention_contract_checksum()

        self.assertEqual(len(checksum), 64)
        self.assertEqual(checksum, get_retention_contract_checksum())

    def test_exemptions_keep_redaction_and_workflow_scope_out_of_ga_03_1(self):
        scopes = {rule.scope: rule.deferred_to for rule in EXEMPTION_RULES}

        self.assertEqual(scopes["AI documents, communications, and observability payloads"], "GA-03.3")
        self.assertEqual(scopes["workflow definitions and execution telemetry"], "GA-03.4")

    def test_every_archive_target_has_execution_details(self):
        labels = {target.model_label for target in ARCHIVE_TARGETS}

        self.assertTrue(labels.issubset(set(ARCHIVE_TARGET_DETAILS)))
        self.assertIn("purchase_order__order_date", ARCHIVE_TARGET_DETAILS["tenant_apps.purchase_orders.models.PurchaseOrderItem"]["eligibility_fields"])

    def test_cutoff_defaults_to_seven_year_window(self):
        cutoff = default_retention_cutoff()

        self.assertEqual(cutoff, subtract_years(timezone.now().date()))

    def test_eligibility_q_uses_first_non_null_precedence(self):
        query = build_eligibility_q(("resolution_date", "claim_date"), default_retention_cutoff())

        self.assertIn("resolution_date__isnull", repr(query))
        self.assertIn("claim_date__lte", repr(query))

    @override_settings(LOGGING={"formatters": {}, "handlers": {}, "filters": {}})
    def test_logging_redaction_check_fails_when_expected_handlers_are_missing(self):
        self.assertFalse(_logging_redaction_configured())
