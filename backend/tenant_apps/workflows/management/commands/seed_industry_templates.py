"""
Management command to seed industry-standard workflow templates.

These templates provide new tenants with proven meat industry workflows
instead of starting from a blank canvas.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.tenants.models import Tenant
from tenant_apps.workflows.models import TenantForm, TenantFormEntity, TenantFormField, WorkflowStatus


class Command(BaseCommand):
    help = 'Seed industry-standard workflow templates for all tenants'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='Seed templates for a specific tenant slug (optional - defaults to all tenants)'
        )

    def handle(self, *args, **options):
        tenant_slug = options.get('tenant')
        
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

        self.stdout.write(self.style.SUCCESS('\n✅ Industry templates seeded successfully'))

    @transaction.atomic
    def _seed_tenant_templates(self, tenant):
        """Seed workflow templates for a single tenant."""
        self.stdout.write(f"\n📦 Processing tenant: {tenant.name}")

        templates_created = 0

        # Template 1: Standard Beef Purchase Order
        if not TenantForm.objects.filter(tenant=tenant, name="Standard Beef Purchase", is_system_template=True).exists():
            beef_po_template = self._create_beef_purchase_template(tenant)
            templates_created += 1
            self.stdout.write(f"  ✓ Created: {beef_po_template.name}")

        # Template 2: Customer Credit Check Workflow
        if not TenantForm.objects.filter(tenant=tenant, name="Customer Credit Check", is_system_template=True).exists():
            credit_check_template = self._create_credit_check_template(tenant)
            templates_created += 1
            self.stdout.write(f"  ✓ Created: {credit_check_template.name}")

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
                            "description": "Manually initiated by user"
                        }
                    },
                    {
                        "id": "action-1",
                        "type": "action",
                        "position": {"x": 100, "y": 250},
                        "data": {
                            "label": "Create Purchase Order",
                            "actionType": "create_record",
                            "entityType": "purchase_order",
                            "description": "Create new beef purchase order record"
                        }
                    },
                    {
                        "id": "action-2",
                        "type": "action",
                        "position": {"x": 100, "y": 400},
                        "data": {
                            "label": "Log to Sentry",
                            "actionType": "send_notification",
                            "description": "Log PO creation event for monitoring"
                        }
                    },
                    {
                        "id": "action-3",
                        "type": "action",
                        "position": {"x": 100, "y": 550},
                        "data": {
                            "label": "Email Supplier",
                            "actionType": "send_email",
                            "description": "Notify supplier of new purchase order"
                        }
                    }
                ],
                "edges": [
                    {"id": "e1", "source": "trigger-1", "target": "action-1"},
                    {"id": "e2", "source": "action-1", "target": "action-2"},
                    {"id": "e3", "source": "action-2", "target": "action-3"}
                ]
            }
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
                            "description": "Triggered when customer email received"
                        }
                    },
                    {
                        "id": "action-1",
                        "type": "action",
                        "position": {"x": 100, "y": 250},
                        "data": {
                            "label": "AI Parse Email",
                            "actionType": "run_workflow",
                            "description": "Use OpenAI to extract customer info and order details"
                        }
                    },
                    {
                        "id": "action-2",
                        "type": "action",
                        "position": {"x": 100, "y": 400},
                        "data": {
                            "label": "Check Balance",
                            "actionType": "run_workflow",
                            "description": "Verify customer account balance and credit limit"
                        }
                    },
                    {
                        "id": "condition-1",
                        "type": "condition",
                        "position": {"x": 100, "y": 550},
                        "data": {
                            "label": "Credit Approved?",
                            "description": "Branch based on credit check result"
                        }
                    },
                    {
                        "id": "action-3-approved",
                        "type": "action",
                        "position": {"x": 300, "y": 700},
                        "data": {
                            "label": "Auto-Approve Order",
                            "actionType": "update_record",
                            "description": "Automatically approve and process order"
                        }
                    },
                    {
                        "id": "action-3-rejected",
                        "type": "action",
                        "position": {"x": -100, "y": 700},
                        "data": {
                            "label": "Send for Manual Review",
                            "actionType": "send_notification",
                            "description": "Notify credit manager for manual review"
                        }
                    }
                ],
                "edges": [
                    {"id": "e1", "source": "trigger-1", "target": "action-1"},
                    {"id": "e2", "source": "action-1", "target": "action-2"},
                    {"id": "e3", "source": "action-2", "target": "condition-1"},
                    {"id": "e4", "source": "condition-1", "target": "action-3-approved", "label": "Approved"},
                    {"id": "e5", "source": "condition-1", "target": "action-3-rejected", "label": "Rejected"}
                ]
            }
        )
        
        return form
