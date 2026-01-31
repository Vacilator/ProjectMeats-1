"""
Tests for Tenant Workflows (Bundle Two).

Tests for TenantForm, TenantWorkflow, and TenantList functionality.
"""
from django.test import TestCase
from django.contrib.auth.models import User

from apps.tenants.models import Tenant
from .models import (
    TenantList, TenantForm, TenantFormEntity, TenantFormField, TenantFormRule,
    TenantWorkflow, TenantWorkflowCondition, TenantWorkflowAction,
    WorkflowExecutionLog, FormStatus, WorkflowStatus, TriggerType, ActionType, OperatorType
)


class TenantListModelTest(TestCase):
    """Test TenantList model functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant'
        )
    
    def test_create_tenant_list(self):
        """Test creating a tenant-specific option list."""
        option_list = TenantList.objects.create(
            tenant=self.tenant,
            name='Payment Terms',
            description='Available payment terms',
            options=[
                {'value': 'net30', 'label': 'Net 30'},
                {'value': 'net60', 'label': 'Net 60'},
                {'value': 'cod', 'label': 'Cash on Delivery'},
            ],
            created_by=self.user
        )
        
        self.assertEqual(option_list.name, 'Payment Terms')
        self.assertEqual(option_list.tenant, self.tenant)
        self.assertEqual(len(option_list.options), 3)
        self.assertTrue(option_list.is_active)
    
    def test_unique_name_per_tenant(self):
        """Test that list names are unique within a tenant."""
        TenantList.objects.create(
            tenant=self.tenant,
            name='My List',
            created_by=self.user
        )
        
        # Same name in same tenant should fail
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            TenantList.objects.create(
                tenant=self.tenant,
                name='My List',
                created_by=self.user
            )


class TenantFormModelTest(TestCase):
    """Test TenantForm model functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant'
        )
    
    def test_create_single_entity_form(self):
        """Test creating a single-entity form."""
        form = TenantForm.objects.create(
            tenant=self.tenant,
            name='Quick Customer Form',
            description='Simplified customer entry',
            created_by=self.user
        )
        
        # Add single entity
        entity = TenantFormEntity.objects.create(
            form=form,
            entity_type='customer',
            order=0
        )
        
        self.assertEqual(form.name, 'Quick Customer Form')
        self.assertEqual(form.status, FormStatus.DRAFT)
        self.assertFalse(form.is_multi_entity)
        self.assertTrue(form.can_be_default)
    
    def test_create_multi_entity_form(self):
        """Test creating a multi-entity (progressive) form."""
        form = TenantForm.objects.create(
            tenant=self.tenant,
            name='Full Order Form',
            description='Complete order entry with customer and PO',
            created_by=self.user
        )
        
        # Add multiple entities (steps)
        TenantFormEntity.objects.create(
            form=form,
            entity_type='customer',
            step_name='Customer Information',
            order=0
        )
        TenantFormEntity.objects.create(
            form=form,
            entity_type='purchase_order',
            step_name='Order Details',
            order=1
        )
        
        self.assertTrue(form.is_multi_entity)
        self.assertFalse(form.can_be_default)
        self.assertEqual(form.entities.count(), 2)
    
    def test_form_field_configuration(self):
        """Test configuring fields within a form."""
        form = TenantForm.objects.create(
            tenant=self.tenant,
            name='Custom Form',
            created_by=self.user
        )
        
        entity = TenantFormEntity.objects.create(
            form=form,
            entity_type='supplier',
            order=0
        )
        
        # Configure fields
        field1 = TenantFormField.objects.create(
            form_entity=entity,
            field_key='name',
            is_visible=True,
            is_required=True,
            order=0,
            custom_label='Supplier Name'
        )
        
        field2 = TenantFormField.objects.create(
            form_entity=entity,
            field_key='phone',
            is_visible=True,
            is_required=False,
            order=1
        )
        
        field3 = TenantFormField.objects.create(
            form_entity=entity,
            field_key='internal_notes',
            is_visible=False,  # Hidden field
            order=2
        )
        
        self.assertEqual(entity.fields.count(), 3)
        self.assertEqual(entity.fields.filter(is_visible=True).count(), 2)
    
    def test_form_conditional_rule(self):
        """Test creating conditional rules for forms."""
        form = TenantForm.objects.create(
            tenant=self.tenant,
            name='Conditional Form',
            created_by=self.user
        )
        
        rule = TenantFormRule.objects.create(
            form=form,
            name='Show shipping fields for physical products',
            conditions=[
                {'field': 'product_type', 'operator': 'eq', 'value': 'physical'}
            ],
            actions=[
                {'action': 'display_fields', 'params': {'fields': ['shipping_address', 'shipping_method']}}
            ],
            order=0
        )
        
        self.assertEqual(form.rules.count(), 1)
        self.assertTrue(rule.is_active)
        self.assertEqual(rule.condition_logic, 'and')


class TenantWorkflowModelTest(TestCase):
    """Test TenantWorkflow model functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant'
        )
    
    def test_create_workflow(self):
        """Test creating a basic workflow."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name='New Order Notification',
            description='Send notification when new order is created',
            trigger_type=TriggerType.RECORD_CREATED,
            entity_type='purchase_order',
            created_by=self.user
        )
        
        self.assertEqual(workflow.name, 'New Order Notification')
        self.assertEqual(workflow.status, WorkflowStatus.DRAFT)
        self.assertEqual(workflow.trigger_type, TriggerType.RECORD_CREATED)
        self.assertEqual(workflow.run_count, 0)
    
    def test_workflow_with_conditions_and_actions(self):
        """Test workflow with conditions and actions."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name='High Value Order Alert',
            trigger_type=TriggerType.RECORD_CREATED,
            entity_type='purchase_order',
            created_by=self.user
        )
        
        # Add condition: total > 10000
        condition = TenantWorkflowCondition.objects.create(
            workflow=workflow,
            field_path='total_amount',
            operator=OperatorType.GREATER_THAN,
            compare_value=10000,
            order=0
        )
        
        # Add actions
        action1 = TenantWorkflowAction.objects.create(
            workflow=workflow,
            action_type=ActionType.SEND_EMAIL,
            config={
                'to': 'manager@example.com',
                'subject': 'High Value Order Alert',
                'body': 'A new order over $10,000 has been created.'
            },
            order=0
        )
        
        action2 = TenantWorkflowAction.objects.create(
            workflow=workflow,
            action_type=ActionType.SEND_NOTIFICATION,
            config={
                'title': 'High Value Order',
                'message': 'Review the new high-value order',
                'users': ['manager']
            },
            order=1
        )
        
        self.assertEqual(workflow.conditions.count(), 1)
        self.assertEqual(workflow.actions.count(), 2)
    
    def test_scheduled_workflow(self):
        """Test creating a scheduled workflow."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name='Weekly Report',
            description='Generate weekly sales report',
            trigger_type=TriggerType.SCHEDULED,
            trigger_config={
                'cron': '0 9 * * 1',  # Monday at 9am
                'timezone': 'America/New_York'
            },
            created_by=self.user
        )
        
        self.assertEqual(workflow.trigger_type, TriggerType.SCHEDULED)
        self.assertIn('cron', workflow.trigger_config)
    
    def test_manual_workflow(self):
        """Test creating a manual-trigger workflow."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name='Send Custom Email',
            trigger_type=TriggerType.MANUAL,
            created_by=self.user
        )
        
        self.assertEqual(workflow.trigger_type, TriggerType.MANUAL)


class WorkflowExecutionLogTest(TestCase):
    """Test WorkflowExecutionLog functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant'
        )
        self.workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name='Test Workflow',
            trigger_type=TriggerType.MANUAL,
            status=WorkflowStatus.ACTIVE,
            created_by=self.user
        )
    
    def test_create_execution_log(self):
        """Test creating an execution log."""
        log = WorkflowExecutionLog.objects.create(
            workflow=self.workflow,
            trigger_type='manual',
            trigger_data={'user_id': self.user.id},
            triggered_by=self.user
        )
        
        self.assertEqual(log.status, 'started')
        self.assertEqual(log.actions_executed, 0)
        self.assertIsNotNone(log.started_at)
    
    def test_complete_execution_log(self):
        """Test completing an execution log."""
        from django.utils import timezone
        
        log = WorkflowExecutionLog.objects.create(
            workflow=self.workflow,
            trigger_type='manual',
            triggered_by=self.user
        )
        
        # Simulate successful completion
        log.status = 'success'
        log.completed_at = timezone.now()
        log.actions_executed = 2
        log.execution_log = [
            {'action': 'send_email', 'status': 'success', 'duration_ms': 150},
            {'action': 'send_notification', 'status': 'success', 'duration_ms': 50},
        ]
        log.save()
        
        self.assertEqual(log.status, 'success')
        self.assertEqual(log.actions_executed, 2)
        self.assertEqual(len(log.execution_log), 2)


class EntityPersistenceServiceTest(TestCase):
    """Test EntityPersistenceService functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant'
        )
        # Create a test form
        self.form = TenantForm.objects.create(
            tenant=self.tenant,
            name='New Supplier Form',
            description='Add a new supplier',
            status=FormStatus.ACTIVE,
            created_by=self.user
        )
        # Add a step
        self.step = TenantFormEntity.objects.create(
            form=self.form,
            entity_type='supplier',
            step_name='Supplier Information',
            order=0
        )
    
    def test_entity_model_registry(self):
        """Test that all entity types in registry are valid."""
        from .services.entity_persistence import ENTITY_MODEL_REGISTRY
        from django.apps import apps
        
        for entity_type, (app, model) in ENTITY_MODEL_REGISTRY.items():
            try:
                model_class = apps.get_model(app, model)
                self.assertIsNotNone(model_class)
            except LookupError:
                self.fail(f"Model not found: {app}.{model} for entity type: {entity_type}")
    
    def test_create_supplier_from_form(self):
        """Test creating a Supplier from form submission data."""
        from .services.entity_persistence import EntityPersistenceService
        from .models import FormSubmission
        from tenant_apps.suppliers.models import Supplier
        
        # Create a submission with supplier data
        submission = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.user,
            data={
                str(self.step.id): {
                    'name': 'Acme Foods',
                    'email': 'contact@acme.com',
                    'phone': '555-1234',
                    'address': '123 Main St',
                }
            }
        )
        
        # Run persistence
        service = EntityPersistenceService(submission, user=self.user)
        result = service.persist_all()
        
        # Verify success
        self.assertTrue(result['success'])
        self.assertIn(str(self.step.id), result['created_entities'])
        
        # Verify supplier was created
        supplier_info = result['created_entities'][str(self.step.id)]
        self.assertEqual(supplier_info['entity_type'], 'supplier')
        
        # Fetch from DB
        supplier = Supplier.objects.get(pk=supplier_info['entity_id'])
        self.assertEqual(supplier.name, 'Acme Foods')
        self.assertEqual(supplier.email, 'contact@acme.com')
        self.assertEqual(supplier.tenant, self.tenant)
    
    def test_skip_empty_steps(self):
        """Test that steps with no data are skipped."""
        from .services.entity_persistence import EntityPersistenceService
        from .models import FormSubmission
        
        # Create submission with empty data
        submission = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.user,
            data={}  # No data for any step
        )
        
        service = EntityPersistenceService(submission)
        result = service.persist_all()
        
        # Should succeed with no entities created
        self.assertTrue(result['success'])
        self.assertEqual(len(result['created_entities']), 0)
    
    def test_persist_stores_entity_refs_in_submission(self):
        """Test that created entity references are stored in submission."""
        from .services.entity_persistence import EntityPersistenceService
        from .models import FormSubmission
        
        submission = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.user,
            data={
                str(self.step.id): {
                    'name': 'Test Supplier',
                }
            }
        )
        
        service = EntityPersistenceService(submission, user=self.user)
        result = service.persist_all()
        
        # Refresh from DB
        submission.refresh_from_db()
        
        # Check that __created_entities__ was stored
        self.assertIn('__created_entities__', submission.data)
        self.assertEqual(
            submission.data['__created_entities__'],
            result['created_entities']
        )
