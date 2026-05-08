"""
Management command to seed industry-standard workflow templates.

These templates provide new tenants with proven meat industry workflows
instead of starting from a blank canvas.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from tenant_apps.workflows.models import TenantForm, WorkflowStatus

from apps.tenants.models import Tenant


class Command(BaseCommand):
    help = "Seed industry-standard workflow templates for all tenants"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant", type=str, help="Seed templates for a specific tenant slug (optional - defaults to all tenants)"
        )

    def handle(self, *args, **options):
        tenant_slug = options.get("tenant")

        if tenant_slug:
            try:
                tenants = [Tenant.objects.get(slug=tenant_slug)]
                self.stdout.write(f"Seeding templates for tenant: {tenant_slug}")
            except Tenant.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Tenant '{tenant_slug}' not found"))
                return
        else:
            tenants = Tenant.objects.filter(is_active=True)
            self.stdout.write(f"Seeding templates for {tenants.count()} active tenant(s)")

        for tenant in tenants:
            self._seed_tenant_templates(tenant)

        self.stdout.write(self.style.SUCCESS("\n✅ Industry templates seeded successfully"))

    @transaction.atomic
    def _seed_tenant_templates(self, tenant):
        """Seed workflow templates for a single tenant."""
        self.stdout.write(f"\n📦 Processing tenant: {tenant.name}")

        templates_created = 0

        # Template 1: Standard Beef Purchase Order
        if not TenantForm.objects.filter(
            tenant=tenant, name="Standard Beef Purchase", is_system_template=True
        ).exists():
            beef_po_template = self._create_beef_purchase_template(tenant)
            templates_created += 1
            self.stdout.write(f"  ✓ Created: {beef_po_template.name}")

        # Template 2: Customer Credit Check Workflow
        if not TenantForm.objects.filter(tenant=tenant, name="Customer Credit Check", is_system_template=True).exists():
            credit_check_template = self._create_credit_check_template(tenant)
            templates_created += 1
            self.stdout.write(f"  ✓ Created: {credit_check_template.name}")

        # Template 3: Cold Storage Monitoring
        if not TenantForm.objects.filter(
            tenant=tenant, name="Cold Storage Monitoring", is_system_template=True
        ).exists():
            cold_storage_template = self._create_cold_storage_monitoring_template(tenant)
            templates_created += 1
            self.stdout.write(f"  ✓ Created: {cold_storage_template.name}")

        # Template 4: Quality Inspection Workflow
        if not TenantForm.objects.filter(
            tenant=tenant, name="Quality Inspection Workflow", is_system_template=True
        ).exists():
            quality_inspection_template = self._create_quality_inspection_template(tenant)
            templates_created += 1
            self.stdout.write(f"  ✓ Created: {quality_inspection_template.name}")

        # Template 5: Carrier Compliance Check
        if not TenantForm.objects.filter(
            tenant=tenant, name="Carrier Compliance Check", is_system_template=True
        ).exists():
            carrier_compliance_template = self._create_carrier_compliance_template(tenant)
            templates_created += 1
            self.stdout.write(f"  ✓ Created: {carrier_compliance_template.name}")

        if templates_created == 0:
            self.stdout.write("  ℹ️  All templates already exist")
        else:
            self.stdout.write(self.style.SUCCESS(f"  ✅ Created {templates_created} template(s)"))

    def _create_beef_purchase_template(self, tenant):
        """Create Standard Beef Purchase Order template."""
        form = TenantForm.objects.create(
            tenant=tenant,
            name="Standard Beef Purchase",
            description="Industry-standard workflow for beef purchase orders with automated supplier notifications",
            status=WorkflowStatus.ACTIVE,
            is_system_template=True,
            is_default=False,
            is_quick_action_enabled=True,
            icon="shopping-cart",
            flow_data={
                "nodes": [
                    {
                        "id": "trigger-1",
                        "type": "trigger",
                        "position": {"x": 100, "y": 100},
                        "data": {
                            "label": "Manual Trigger",
                            "triggerType": "manual",
                            "description": "Manually initiated by user",
                        },
                    },
                    {
                        "id": "action-1",
                        "type": "action",
                        "position": {"x": 100, "y": 250},
                        "data": {
                            "label": "Create Purchase Order",
                            "actionType": "create_record",
                            "entityType": "purchase_order",
                            "description": "Create new beef purchase order record",
                        },
                    },
                    {
                        "id": "action-2",
                        "type": "action",
                        "position": {"x": 100, "y": 400},
                        "data": {
                            "label": "Log to Sentry",
                            "actionType": "send_notification",
                            "description": "Log PO creation event for monitoring",
                        },
                    },
                    {
                        "id": "action-3",
                        "type": "action",
                        "position": {"x": 100, "y": 550},
                        "data": {
                            "label": "Email Supplier",
                            "actionType": "send_email",
                            "description": "Notify supplier of new purchase order",
                        },
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "trigger-1", "target": "action-1"},
                    {"id": "e2", "source": "action-1", "target": "action-2"},
                    {"id": "e3", "source": "action-2", "target": "action-3"},
                ],
            },
        )

        return form

    def _create_credit_check_template(self, tenant):
        """Create Customer Credit Check Workflow template."""
        form = TenantForm.objects.create(
            tenant=tenant,
            name="Customer Credit Check",
            description="Automated credit verification workflow with AI email parsing and balance checking",
            status=WorkflowStatus.ACTIVE,
            is_system_template=True,
            is_default=False,
            is_quick_action_enabled=True,
            icon="dollar-sign",
            flow_data={
                "nodes": [
                    {
                        "id": "trigger-1",
                        "type": "trigger",
                        "position": {"x": 100, "y": 100},
                        "data": {
                            "label": "Email Received",
                            "triggerType": "webhook",
                            "description": "Triggered when customer email received",
                        },
                    },
                    {
                        "id": "action-1",
                        "type": "action",
                        "position": {"x": 100, "y": 250},
                        "data": {
                            "label": "AI Parse Email",
                            "actionType": "run_workflow",
                            "description": "Use OpenAI to extract customer info and order details",
                        },
                    },
                    {
                        "id": "action-2",
                        "type": "action",
                        "position": {"x": 100, "y": 400},
                        "data": {
                            "label": "Check Balance",
                            "actionType": "run_workflow",
                            "description": "Verify customer account balance and credit limit",
                        },
                    },
                    {
                        "id": "condition-1",
                        "type": "condition",
                        "position": {"x": 100, "y": 550},
                        "data": {"label": "Credit Approved?", "description": "Branch based on credit check result"},
                    },
                    {
                        "id": "action-3-approved",
                        "type": "action",
                        "position": {"x": 300, "y": 700},
                        "data": {
                            "label": "Auto-Approve Order",
                            "actionType": "update_record",
                            "description": "Automatically approve and process order",
                        },
                    },
                    {
                        "id": "action-3-rejected",
                        "type": "action",
                        "position": {"x": -100, "y": 700},
                        "data": {
                            "label": "Send for Manual Review",
                            "actionType": "send_notification",
                            "description": "Notify credit manager for manual review",
                        },
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "trigger-1", "target": "action-1"},
                    {"id": "e2", "source": "action-1", "target": "action-2"},
                    {"id": "e3", "source": "action-2", "target": "condition-1"},
                    {"id": "e4", "source": "condition-1", "target": "action-3-approved", "label": "Approved"},
                    {"id": "e5", "source": "condition-1", "target": "action-3-rejected", "label": "Rejected"},
                ],
            },
        )

        return form

    def _create_cold_storage_monitoring_template(self, tenant):
        """Create Cold Storage Monitoring workflow template."""
        form = TenantForm.objects.create(
            tenant=tenant,
            name="Cold Storage Monitoring",
            description=(
                "Automated cold-chain integrity workflow: polls IoT sensors every 15 minutes, "
                "evaluates temperature against USDA thresholds, escalates alerts to QA, "
                "and logs every reading for regulatory audit."
            ),
            status=WorkflowStatus.ACTIVE,
            is_system_template=True,
            is_default=False,
            is_quick_action_enabled=True,
            icon="thermometer",
            flow_data={
                "nodes": [
                    {
                        "id": "trigger-1",
                        "type": "triggerScheduled",
                        "position": {"x": 100, "y": 50},
                        "data": {
                            "label": "Scheduled Sensor Poll",
                            "triggerType": "scheduled",
                            "cronExpression": "*/15 * * * *",
                            "description": "Poll IoT temperature sensors every 15 minutes",
                        },
                    },
                    {
                        "id": "action-1",
                        "type": "actionHTTP",
                        "position": {"x": 100, "y": 200},
                        "data": {
                            "label": "Pull Sensor Readings",
                            "actionType": "http_request",
                            "description": "Fetch latest temperature/humidity data from IoT gateway",
                        },
                    },
                    {
                        "id": "action-log",
                        "type": "actionCreateRecord",
                        "position": {"x": 100, "y": 350},
                        "data": {
                            "label": "Log Temperature Reading",
                            "actionType": "create_record",
                            "entityType": "cold_storage_entry",
                            "description": "Persist sensor reading for USDA audit trail",
                        },
                    },
                    {
                        "id": "condition-1",
                        "type": "conditionIf",
                        "position": {"x": 100, "y": 500},
                        "data": {
                            "label": "Temperature Breach?",
                            "description": "Branch if reading exceeds 40 F or falls below 28 F",
                            "conditions": [
                                {"field": "temperature_f", "operator": "gt", "value": 40},
                                {"field": "temperature_f", "operator": "lt", "value": 28},
                            ],
                            "condition_logic": "or",
                        },
                    },
                    {
                        "id": "action-alert",
                        "type": "actionEmail",
                        "position": {"x": 350, "y": 650},
                        "data": {
                            "label": "Alert QA Manager",
                            "actionType": "send_email",
                            "description": "Notify QA and cold-chain supervisor of temperature breach",
                        },
                    },
                    {
                        "id": "action-update",
                        "type": "actionUpdateRecord",
                        "position": {"x": 350, "y": 800},
                        "data": {
                            "label": "Flag Storage Zone",
                            "actionType": "update_record",
                            "entityType": "cold_storage_entry",
                            "description": "Mark storage zone as non-compliant pending investigation",
                        },
                    },
                    {
                        "id": "wait-approval",
                        "type": "waitApproval",
                        "position": {"x": 350, "y": 950},
                        "data": {
                            "label": "QA Disposition Approval",
                            "description": "QA manager reviews breach and approves corrective action",
                        },
                    },
                    {
                        "id": "terminal-ok",
                        "type": "terminalSuccess",
                        "position": {"x": -100, "y": 650},
                        "data": {
                            "label": "Reading Within Range",
                            "description": "Temperature compliant - no action required",
                        },
                    },
                    {
                        "id": "terminal-resolved",
                        "type": "terminalSuccess",
                        "position": {"x": 350, "y": 1100},
                        "data": {
                            "label": "Breach Resolved",
                            "description": "Corrective action approved and logged",
                        },
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "trigger-1", "target": "action-1"},
                    {"id": "e2", "source": "action-1", "target": "action-log"},
                    {"id": "e3", "source": "action-log", "target": "condition-1"},
                    {"id": "e4", "source": "condition-1", "target": "action-alert", "label": "Breach"},
                    {"id": "e5", "source": "condition-1", "target": "terminal-ok", "label": "OK"},
                    {"id": "e6", "source": "action-alert", "target": "action-update"},
                    {"id": "e7", "source": "action-update", "target": "wait-approval"},
                    {"id": "e8", "source": "wait-approval", "target": "terminal-resolved"},
                ],
            },
        )
        return form

    def _create_quality_inspection_template(self, tenant):
        """Create Quality Inspection Workflow template."""
        form = TenantForm.objects.create(
            tenant=tenant,
            name="Quality Inspection Workflow",
            description=(
                "HACCP-compliant incoming lot inspection: captures organoleptic checks, "
                "weight/yield measurements, and microbiological sample status. "
                "Triggers NCR and CAPA on non-conformance; archives CoA for every accepted lot."
            ),
            status=WorkflowStatus.ACTIVE,
            is_system_template=True,
            is_default=False,
            is_quick_action_enabled=True,
            icon="clipboard-check",
            flow_data={
                "nodes": [
                    {
                        "id": "trigger-1",
                        "type": "triggerManualStart",
                        "position": {"x": 100, "y": 50},
                        "data": {
                            "label": "Start Lot Inspection",
                            "triggerType": "manual",
                            "description": "QA inspector initiates incoming lot inspection",
                        },
                    },
                    {
                        "id": "form-1",
                        "type": "FormStepSingle",
                        "position": {"x": 100, "y": 200},
                        "data": {
                            "label": "Enter Lot Details",
                            "description": (
                                "Record lot number, supplier, species, weight, "
                                "internal temperature, and organoleptic scores"
                            ),
                        },
                    },
                    {
                        "id": "action-log",
                        "type": "actionCreateRecord",
                        "position": {"x": 100, "y": 350},
                        "data": {
                            "label": "Create Inspection Record",
                            "actionType": "create_record",
                            "entityType": "quality_inspection",
                            "description": "Persist inspection data for HACCP CCP audit trail",
                        },
                    },
                    {
                        "id": "condition-1",
                        "type": "conditionIf",
                        "position": {"x": 100, "y": 500},
                        "data": {
                            "label": "Passes Initial Check?",
                            "description": "Branch on temperature, appearance, and odour scores",
                        },
                    },
                    {
                        "id": "action-coa",
                        "type": "actionCreateRecord",
                        "position": {"x": -150, "y": 650},
                        "data": {
                            "label": "Archive Certificate of Analysis",
                            "actionType": "create_record",
                            "entityType": "document",
                            "description": "Attach and archive supplier CoA for accepted lot",
                        },
                    },
                    {
                        "id": "action-ncr",
                        "type": "actionCreateRecord",
                        "position": {"x": 350, "y": 650},
                        "data": {
                            "label": "Raise NCR",
                            "actionType": "create_record",
                            "entityType": "non_conformance_report",
                            "description": "Create Non-Conformance Report with defect details",
                        },
                    },
                    {
                        "id": "action-notify",
                        "type": "actionEmail",
                        "position": {"x": 350, "y": 800},
                        "data": {
                            "label": "Notify QA and Procurement",
                            "actionType": "send_email",
                            "description": "Alert QA manager and buyer of non-conformance",
                        },
                    },
                    {
                        "id": "wait-disposition",
                        "type": "waitApproval",
                        "position": {"x": 350, "y": 950},
                        "data": {
                            "label": "Disposition Approval",
                            "description": "QA manager approves: accept under waiver, rework, or reject",
                        },
                    },
                    {
                        "id": "action-capa",
                        "type": "actionCreateRecord",
                        "position": {"x": 350, "y": 1100},
                        "data": {
                            "label": "Initiate CAPA",
                            "actionType": "create_record",
                            "entityType": "corrective_action",
                            "description": "Open Corrective Action / Preventive Action record",
                        },
                    },
                    {
                        "id": "terminal-pass",
                        "type": "terminalSuccess",
                        "position": {"x": -150, "y": 800},
                        "data": {
                            "label": "Lot Accepted",
                            "description": "Lot passes inspection and is released to production",
                        },
                    },
                    {
                        "id": "terminal-fail",
                        "type": "terminalFailure",
                        "position": {"x": 350, "y": 1250},
                        "data": {
                            "label": "Lot Rejected",
                            "description": "Lot rejected; supplier notified; return/destroy initiated",
                        },
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "trigger-1", "target": "form-1"},
                    {"id": "e2", "source": "form-1", "target": "action-log"},
                    {"id": "e3", "source": "action-log", "target": "condition-1"},
                    {"id": "e4", "source": "condition-1", "target": "action-coa", "label": "Pass"},
                    {"id": "e5", "source": "condition-1", "target": "action-ncr", "label": "Fail"},
                    {"id": "e6", "source": "action-coa", "target": "terminal-pass"},
                    {"id": "e7", "source": "action-ncr", "target": "action-notify"},
                    {"id": "e8", "source": "action-notify", "target": "wait-disposition"},
                    {"id": "e9", "source": "wait-disposition", "target": "action-capa"},
                    {"id": "e10", "source": "action-capa", "target": "terminal-fail"},
                ],
            },
        )
        return form

    def _create_carrier_compliance_template(self, tenant):
        """Create Carrier Compliance Check workflow template."""
        form = TenantForm.objects.create(
            tenant=tenant,
            name="Carrier Compliance Check",
            description=(
                "End-to-end carrier vetting and load-readiness workflow: verifies FMCSA authority, "
                "insurance, and Carrier411 score; conducts pre-trip reefer inspection; "
                "generates BOL and captures e-signatures; reconciles POD for freight audit."
            ),
            status=WorkflowStatus.ACTIVE,
            is_system_template=True,
            is_default=False,
            is_quick_action_enabled=True,
            icon="truck",
            flow_data={
                "nodes": [
                    {
                        "id": "trigger-1",
                        "type": "triggerManualStart",
                        "position": {"x": 100, "y": 50},
                        "data": {
                            "label": "New Carrier Assignment",
                            "triggerType": "manual",
                            "description": "Logistics coordinator assigns carrier to a load",
                        },
                    },
                    {
                        "id": "action-vetting",
                        "type": "actionHTTP",
                        "position": {"x": 100, "y": 200},
                        "data": {
                            "label": "Fetch Carrier Compliance Data",
                            "actionType": "http_request",
                            "description": "Query FMCSA SAFER system and Carrier411 for authority and safety score",
                        },
                    },
                    {
                        "id": "condition-vetting",
                        "type": "conditionIf",
                        "position": {"x": 100, "y": 350},
                        "data": {
                            "label": "Carrier Approved?",
                            "description": "Pass if FMCSA authority active, insurance valid, Carrier411 >= 70",
                        },
                    },
                    {
                        "id": "action-reject-notify",
                        "type": "actionEmail",
                        "position": {"x": 400, "y": 500},
                        "data": {
                            "label": "Notify: Carrier Rejected",
                            "actionType": "send_email",
                            "description": "Alert logistics team; block carrier from load assignment",
                        },
                    },
                    {
                        "id": "form-pretrip",
                        "type": "FormStepSingle",
                        "position": {"x": -100, "y": 500},
                        "data": {
                            "label": "Pre-Trip Inspection Checklist",
                            "description": (
                                "Reefer unit function, door seals, cleanliness, "
                                "temperature recorder calibration, and seal number"
                            ),
                        },
                    },
                    {
                        "id": "condition-pretrip",
                        "type": "conditionIf",
                        "position": {"x": -100, "y": 650},
                        "data": {
                            "label": "Inspection Passed?",
                            "description": "All pre-trip checklist items must be marked compliant",
                        },
                    },
                    {
                        "id": "action-bol",
                        "type": "actionCreateRecord",
                        "position": {"x": -100, "y": 800},
                        "data": {
                            "label": "Generate Bill of Lading",
                            "actionType": "create_record",
                            "entityType": "bill_of_lading",
                            "description": "Create BOL with load details, seal number, and temp setpoints",
                        },
                    },
                    {
                        "id": "wait-esig",
                        "type": "waitApproval",
                        "position": {"x": -100, "y": 950},
                        "data": {
                            "label": "Driver E-Signature",
                            "description": "Capture electronic signature from driver on BOL",
                        },
                    },
                    {
                        "id": "wait-pod",
                        "type": "waitApproval",
                        "position": {"x": -100, "y": 1100},
                        "data": {
                            "label": "Proof of Delivery",
                            "description": "Wait for receiver to submit signed POD and temperature download",
                        },
                    },
                    {
                        "id": "action-freight-audit",
                        "type": "actionCreateRecord",
                        "position": {"x": -100, "y": 1250},
                        "data": {
                            "label": "Freight Audit Record",
                            "actionType": "create_record",
                            "entityType": "freight_audit",
                            "description": "Log POD, final temp, any claims, and invoice reconciliation",
                        },
                    },
                    {
                        "id": "terminal-rejected",
                        "type": "terminalFailure",
                        "position": {"x": 400, "y": 650},
                        "data": {
                            "label": "Carrier Disqualified",
                            "description": "Carrier flagged and removed from approved list",
                        },
                    },
                    {
                        "id": "terminal-pretrip-fail",
                        "type": "terminalFailure",
                        "position": {"x": 200, "y": 800},
                        "data": {
                            "label": "Load Held - Inspection Failed",
                            "description": "Load on hold until equipment defect resolved",
                        },
                    },
                    {
                        "id": "terminal-complete",
                        "type": "terminalSuccess",
                        "position": {"x": -100, "y": 1400},
                        "data": {
                            "label": "Delivery Complete",
                            "description": "Compliant delivery confirmed; freight audit closed",
                        },
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "trigger-1", "target": "action-vetting"},
                    {"id": "e2", "source": "action-vetting", "target": "condition-vetting"},
                    {"id": "e3", "source": "condition-vetting", "target": "form-pretrip", "label": "Approved"},
                    {"id": "e4", "source": "condition-vetting", "target": "action-reject-notify", "label": "Rejected"},
                    {"id": "e5", "source": "action-reject-notify", "target": "terminal-rejected"},
                    {"id": "e6", "source": "form-pretrip", "target": "condition-pretrip"},
                    {"id": "e7", "source": "condition-pretrip", "target": "action-bol", "label": "Pass"},
                    {"id": "e8", "source": "condition-pretrip", "target": "terminal-pretrip-fail", "label": "Fail"},
                    {"id": "e9", "source": "action-bol", "target": "wait-esig"},
                    {"id": "e10", "source": "wait-esig", "target": "wait-pod"},
                    {"id": "e11", "source": "wait-pod", "target": "action-freight-audit"},
                    {"id": "e12", "source": "action-freight-audit", "target": "terminal-complete"},
                ],
            },
        )
        return form
