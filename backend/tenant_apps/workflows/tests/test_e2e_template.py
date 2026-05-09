"""Tests for RT-01.1: EndToEndInquiryToPOProcess template and registration."""

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
        self.assertEqual(data["version"], "1.2.0")
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
        self.assertEqual(groups[0]["data"]["nodeType"], "formProcessGroup")

    def test_template_has_form_steps_for_inquiry_sales_and_po_variants(self):
        data = get_e2e_template_data()
        form_steps = [n for n in data["nodes"] if n["type"] == "formStep"]
        self.assertEqual(len(form_steps), 4)
        labels = [node["data"]["label"] for node in form_steps]
        self.assertIn("Form Node 1: Inquiry", labels)
        self.assertIn("Form Node 2: Sales Order", labels)
        self.assertIn("Form Node 3: Purchase Order (Customer Tree)", labels)
        self.assertIn("Form Node 4: Purchase Order (Trader to Supplier)", labels)

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
        self.assertTrue(bid_nodes[0]["data"]["outputContract"]["displayInCockpit"])

    def test_template_has_generate_and_send_sales_order(self):
        data = get_e2e_template_data()
        action_types = [n["data"].get("actionType") for n in data["nodes"]]
        self.assertIn("generate_sales_order", action_types)
        self.assertIn("send_email", action_types)
        sales_order_node = next(
            n for n in data["nodes"] if n["data"].get("actionType") == "generate_sales_order"
        )
        self.assertEqual(
            sales_order_node["data"]["outputContract"]["supplierContactPath"],
            "records.sales_order.contact_routing.supplier_contact",
        )

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
        self.assertEqual(config["orderRoles"]["billing_contact"], "accounting")

    def test_template_purchase_order_variants_expose_contact_prepopulation(self):
        data = get_e2e_template_data()
        po_steps = [
            n
            for n in data["nodes"]
            if n["type"] == "formStep" and n["data"].get("entityType") == "purchase_order"
        ]
        self.assertEqual(len(po_steps), 2)
        for node in po_steps:
            config = node["data"]["entityConfig"]["contactPrepopulation"]
            self.assertEqual(config["supplierContactRole"], "supplier_contact")
            self.assertEqual(config["billingContactRole"], "billing_contact")
            self.assertEqual(config["shippingContactRole"], "shipping_contact")

    def test_template_has_approval_gate(self):
        data = get_e2e_template_data()
        approval_nodes = [n for n in data["nodes"] if n["type"] == "approvalGate"]
        self.assertEqual(len(approval_nodes), 1)
        gate = approval_nodes[0]
        self.assertEqual(gate["id"], "approval-gate-margin")
        config = gate["data"]["approvalConfig"]
        self.assertEqual(len(config["rules"]), 3)
        rule_types = [r["ruleType"] for r in config["rules"]]
        self.assertIn("margin_threshold", rule_types)
        self.assertIn("order_amount", rule_types)
        self.assertIn("supplier_risk", rule_types)
        self.assertEqual(config["approverRouting"]["contactType"], "Accounting")
        self.assertEqual(config["timeoutHours"], 48)

    def test_approval_gate_wired_between_bid_selection_and_sales_order(self):
        data = get_e2e_template_data()
        edges = data["edges"]
        # bid-selection -> approval-gate-margin
        bs_to_ag = [e for e in edges if e["source"] == "bid-selection" and e["target"] == "approval-gate-margin"]
        self.assertEqual(len(bs_to_ag), 1)
        # approval-gate-margin -> form-step-sales-order (approved)
        ag_to_f2 = [e for e in edges if e["source"] == "approval-gate-margin" and e["target"] == "form-step-sales-order"]
        self.assertEqual(len(ag_to_f2), 1)
        self.assertEqual(ag_to_f2[0].get("label"), "approved")
        # approval-gate-margin -> rejection escalation
        ag_to_rej = [e for e in edges if e["source"] == "approval-gate-margin" and e["target"] == "approval-rejected-escalation"]
        self.assertEqual(len(ag_to_rej), 1)
        self.assertEqual(ag_to_rej[0].get("label"), "rejected")

    def test_metadata_accuracy(self):
        data = get_e2e_template_data()
        meta = data["metadata"]
        self.assertEqual(meta["triggerCount"], 5)
        self.assertEqual(meta["nodeCount"], len(data["nodes"]))
        self.assertEqual(meta["edgeCount"], len(data["edges"]))
        self.assertEqual(meta["formStepCount"], 4)


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
