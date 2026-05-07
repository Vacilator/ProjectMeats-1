"""Tests for RT-01.1: EndToEndInquiryToPOProcess template and registration."""

import json
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase

from apps.core.tests.factories import TenantFactory
from tenant_apps.workflows.models import TenantForm
from tenant_apps.workflows.services.template_registry import (
    E2E_TEMPLATE_FILE,
    E2E_TEMPLATE_NAME,
    get_e2e_template_data,
    register_e2e_template,
    validate_template_schema,
)


class TemplateFileTest(TestCase):
    """Verify the JSON template file is valid and complete."""

    def test_template_file_exists(self):
        self.assertTrue(E2E_TEMPLATE_FILE.exists())

    def test_template_is_valid_json(self):
        data = get_e2e_template_data()
        self.assertIsInstance(data, dict)

    def test_template_has_required_fields(self):
        data = get_e2e_template_data()
        self.assertEqual(data["templateId"], "end-to-end-inquiry-to-po-process")
        self.assertEqual(data["version"], "1.0.0")
        self.assertEqual(data["category"], "trading")
        self.assertTrue(data["isSystemTemplate"])

    def test_template_has_5_triggers(self):
        data = get_e2e_template_data()
        self.assertEqual(len(data["triggers"]), 5)
        trigger_labels = [t["data"]["label"] for t in data["triggers"]]
        self.assertIn("New Inquiry", trigger_labels)
        self.assertIn("Direct Customer PO", trigger_labels)
        self.assertIn("Standalone Bid", trigger_labels)
        self.assertIn("Manual Sales Order", trigger_labels)
        self.assertIn("Trader PO", trigger_labels)

    def test_all_triggers_have_precondition_check(self):
        data = get_e2e_template_data()
        for trigger in data["triggers"]:
            self.assertEqual(
                trigger["data"]["preconditionCheck"],
                "no_preceding_process",
                f"Trigger '{trigger['data']['label']}' missing safety check",
            )

    def test_all_triggers_have_telemetry(self):
        data = get_e2e_template_data()
        for trigger in data["triggers"]:
            self.assertTrue(
                trigger["data"].get("telemetryEvent"),
                f"Trigger '{trigger['data']['label']}' missing telemetry event",
            )

    def test_all_nodes_have_telemetry(self):
        data = get_e2e_template_data()
        for node in data["nodes"]:
            self.assertTrue(
                node["data"].get("telemetryEvent"),
                f"Node '{node['data']['label']}' missing telemetry event",
            )

    def test_template_has_form_process_group(self):
        data = get_e2e_template_data()
        groups = [n for n in data["nodes"] if n["type"] == "group"]
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["data"]["groupType"], "form_process")

    def test_template_has_for_each_supplier_loop(self):
        data = get_e2e_template_data()
        loops = [n for n in data["nodes"] if n["type"] == "loop"]
        for_each = [l for l in loops if l["data"]["loopType"] == "for_each"]
        self.assertEqual(len(for_each), 1)
        self.assertEqual(for_each[0]["data"]["iteratorSource"], "context.matched_suppliers")

    def test_template_has_do_until_loops(self):
        data = get_e2e_template_data()
        loops = [n for n in data["nodes"] if n["type"] == "loop"]
        do_until = [l for l in loops if l["data"]["loopType"] == "do_until"]
        self.assertEqual(len(do_until), 2)  # bid wait + PO wait

    def test_template_has_bid_selection_with_margin_logic(self):
        data = get_e2e_template_data()
        bid_nodes = [n for n in data["nodes"] if n["data"].get("actionType") == "bid_selection"]
        self.assertEqual(len(bid_nodes), 1)
        criteria = bid_nodes[0]["data"]["selectionCriteria"]
        self.assertTrue(criteria["marginCalculation"])
        self.assertEqual(criteria["minimumMarginPercent"], 5.0)

    def test_template_has_generate_and_send_sales_order(self):
        data = get_e2e_template_data()
        action_types = [n["data"].get("actionType") for n in data["nodes"]]
        self.assertIn("generate_sales_order", action_types)
        self.assertIn("send_email", action_types)

    def test_template_has_po_wait_logic(self):
        data = get_e2e_template_data()
        po_wait = [n for n in data["nodes"] if "Await Customer PO" in n["data"].get("label", "")]
        self.assertEqual(len(po_wait), 1)
        self.assertEqual(po_wait[0]["data"]["loopType"], "do_until")

    def test_template_has_contact_resolution(self):
        data = get_e2e_template_data()
        resolve = [n for n in data["nodes"] if n["data"].get("actionType") == "resolve_contacts"]
        self.assertEqual(len(resolve), 1)
        config = resolve[0]["data"]["contactResolution"]
        self.assertEqual(config["plantContactType"], "dropdown")
        self.assertTrue(config["filterByResponsibility"])
        self.assertTrue(config["includeDocumentAttachments"])

    def test_metadata_accuracy(self):
        data = get_e2e_template_data()
        meta = data["metadata"]
        self.assertEqual(meta["triggerCount"], 5)
        self.assertEqual(meta["nodeCount"], len(data["nodes"]))
        self.assertEqual(meta["edgeCount"], len(data["edges"]))


class TemplateValidationTest(TestCase):
    """Test the validation function."""

    def test_valid_template_passes(self):
        data = get_e2e_template_data()
        errors = validate_template_schema(data)
        self.assertEqual(errors, [])

    def test_missing_template_id_fails(self):
        data = get_e2e_template_data()
        del data["templateId"]
        errors = validate_template_schema(data)
        self.assertIn("Missing required field: templateId", errors)

    def test_missing_triggers_fails(self):
        data = get_e2e_template_data()
        data["triggers"] = []
        errors = validate_template_schema(data)
        self.assertIn("Missing required field: triggers (at least 1 trigger required)", errors)

    def test_trigger_without_precondition_fails(self):
        data = get_e2e_template_data()
        data["triggers"][0]["data"]["preconditionCheck"] = ""
        errors = validate_template_schema(data)
        self.assertTrue(any("preconditionCheck" in e for e in errors))

    def test_invalid_edge_reference_fails(self):
        data = get_e2e_template_data()
        data["edges"].append({"id": "bad-edge", "source": "nonexistent", "target": "also-bad"})
        errors = validate_template_schema(data)
        self.assertTrue(any("nonexistent" in e for e in errors))


class TemplateRegistrationTest(TestCase):
    """Test runtime registration of the template."""

    def setUp(self):
        self.tenant = TenantFactory()

    def test_register_creates_tenant_form(self):
        form = register_e2e_template(self.tenant)
        self.assertIsNotNone(form.pk)
        self.assertEqual(form.name, E2E_TEMPLATE_NAME)
        self.assertTrue(form.is_system_template)
        self.assertEqual(form.tenant_id, self.tenant.pk)

    def test_register_stores_flow_data(self):
        form = register_e2e_template(self.tenant)
        self.assertIn("nodes", form.flow_data)
        self.assertIn("edges", form.flow_data)
        self.assertIn("metadata", form.flow_data)
        # nodes should include triggers + workflow nodes
        self.assertGreater(len(form.flow_data["nodes"]), 10)

    def test_register_is_idempotent(self):
        form1 = register_e2e_template(self.tenant)
        form2 = register_e2e_template(self.tenant)
        self.assertEqual(form1.pk, form2.pk)
        self.assertEqual(TenantForm.objects.filter(tenant=self.tenant, name=E2E_TEMPLATE_NAME).count(), 1)

    def test_register_force_updates(self):
        form = register_e2e_template(self.tenant)
        original_flow = form.flow_data.copy()
        # Force update
        form2 = register_e2e_template(self.tenant, force=True)
        self.assertEqual(form.pk, form2.pk)
        self.assertEqual(form2.flow_data["metadata"]["triggerCount"], 5)

    def test_register_sets_quick_action(self):
        form = register_e2e_template(self.tenant)
        self.assertTrue(form.is_quick_action_enabled)

    def test_flow_data_has_all_5_triggers(self):
        form = register_e2e_template(self.tenant)
        trigger_nodes = [n for n in form.flow_data["nodes"] if n["type"] == "trigger"]
        self.assertEqual(len(trigger_nodes), 5)
