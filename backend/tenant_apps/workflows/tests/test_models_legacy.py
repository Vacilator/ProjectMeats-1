"""
Tests for Tenant Workflows (Bundle Two).

Tests for TenantForm, TenantWorkflow, and TenantList functionality.
"""

from django.contrib.auth.models import User
from django.test import TestCase

from apps.tenants.models import Tenant

from ..models import (
    ActionType,
    FormStatus,
    OperatorType,
    TenantForm,
    TenantFormEntity,
    TenantFormField,
    TenantFormRule,
    TenantList,
    TenantWorkflow,
    TenantWorkflowAction,
    TenantWorkflowCondition,
    TriggerType,
    WorkflowExecutionLog,
    WorkflowStatus,
)


class TenantListModelTest(TestCase):
    """Test TenantList model functionality."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            contact_email="test@example.com",
            created_by=self.user,
        )

    def test_create_tenant_list(self):
        """Test creating a tenant-specific option list."""
        option_list = TenantList.objects.create(
            tenant=self.tenant,
            name="Payment Terms",
            description="Available payment terms",
            options=[
                {"value": "net30", "label": "Net 30"},
                {"value": "net60", "label": "Net 60"},
                {"value": "cod", "label": "Cash on Delivery"},
            ],
            created_by=self.user,
        )

        self.assertEqual(option_list.name, "Payment Terms")
        self.assertEqual(option_list.tenant, self.tenant)
        self.assertEqual(len(option_list.options), 3)
        self.assertTrue(option_list.is_active)

    def test_unique_name_per_tenant(self):
        """Test that list names are unique within a tenant."""
        TenantList.objects.create(tenant=self.tenant, name="My List", created_by=self.user)

        # Same name in same tenant should fail
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            TenantList.objects.create(tenant=self.tenant, name="My List", created_by=self.user)


class TenantFormModelTest(TestCase):
    """Test TenantForm model functionality."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            contact_email="test@example.com",
            created_by=self.user,
        )

    def test_create_single_entity_form(self):
        """Test creating a single-entity form."""
        form = TenantForm.objects.create(
            tenant=self.tenant,
            name="Quick Customer Form",
            description="Simplified customer entry",
            created_by=self.user,
        )

        # Add single entity
        TenantFormEntity.objects.create(form=form, entity_type="customer", order=0)

        self.assertEqual(form.name, "Quick Customer Form")
        self.assertEqual(form.status, FormStatus.DRAFT)
        self.assertFalse(form.is_multi_entity)
        self.assertTrue(form.can_be_default)

    def test_create_multi_entity_form(self):
        """Test creating a multi-entity (progressive) form."""
        form = TenantForm.objects.create(
            tenant=self.tenant,
            name="Full Order Form",
            description="Complete order entry with customer and PO",
            created_by=self.user,
        )

        # Add multiple entities (steps)
        TenantFormEntity.objects.create(form=form, entity_type="customer", step_name="Customer Information", order=0)
        TenantFormEntity.objects.create(form=form, entity_type="purchase_order", step_name="Order Details", order=1)

        self.assertTrue(form.is_multi_entity)
        self.assertFalse(form.can_be_default)
        self.assertEqual(form.entities.count(), 2)

    def test_form_field_configuration(self):
        """Test configuring fields within a form."""
        form = TenantForm.objects.create(tenant=self.tenant, name="Custom Form", created_by=self.user)

        entity = TenantFormEntity.objects.create(form=form, entity_type="supplier", order=0)

        # Configure fields
        TenantFormField.objects.create(
            form_entity=entity,
            field_key="name",
            is_visible=True,
            is_required=True,
            order=0,
            custom_label="Supplier Name",
        )

        TenantFormField.objects.create(
            form_entity=entity, field_key="phone", is_visible=True, is_required=False, order=1
        )

        TenantFormField.objects.create(
            form_entity=entity, field_key="internal_notes", is_visible=False, order=2  # Hidden field
        )

        self.assertEqual(entity.fields.count(), 3)
        self.assertEqual(entity.fields.filter(is_visible=True).count(), 2)

    def test_form_conditional_rule(self):
        """Test creating conditional rules for forms."""
        form = TenantForm.objects.create(tenant=self.tenant, name="Conditional Form", created_by=self.user)

        rule = TenantFormRule.objects.create(
            form=form,
            name="Show shipping fields for physical products",
            conditions=[{"field": "product_type", "operator": "eq", "value": "physical"}],
            actions=[{"action": "display_fields", "params": {"fields": ["shipping_address", "shipping_method"]}}],
            order=0,
        )

        self.assertEqual(form.rules.count(), 1)
        self.assertTrue(rule.is_active)
        self.assertEqual(rule.condition_logic, "and")


class TenantWorkflowModelTest(TestCase):
    """Test TenantWorkflow model functionality."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            contact_email="test@example.com",
            created_by=self.user,
        )

    def test_create_workflow(self):
        """Test creating a basic workflow."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name="New Order Notification",
            description="Send notification when new order is created",
            trigger_type=TriggerType.RECORD_CREATED,
            entity_type="purchase_order",
            created_by=self.user,
        )

        self.assertEqual(workflow.name, "New Order Notification")
        self.assertEqual(workflow.status, WorkflowStatus.DRAFT)
        self.assertEqual(workflow.trigger_type, TriggerType.RECORD_CREATED)
        self.assertEqual(workflow.run_count, 0)

    def test_workflow_with_conditions_and_actions(self):
        """Test workflow with conditions and actions."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name="High Value Order Alert",
            trigger_type=TriggerType.RECORD_CREATED,
            entity_type="purchase_order",
            created_by=self.user,
        )

        # Add condition: total > 10000
        TenantWorkflowCondition.objects.create(
            workflow=workflow,
            field_path="total_amount",
            operator=OperatorType.GREATER_THAN,
            compare_value=10000,
            order=0,
        )

        # Add actions
        TenantWorkflowAction.objects.create(
            workflow=workflow,
            action_type=ActionType.SEND_EMAIL,
            config={
                "to": "manager@example.com",
                "subject": "High Value Order Alert",
                "body": "A new order over $10,000 has been created.",
            },
            order=0,
        )

        TenantWorkflowAction.objects.create(
            workflow=workflow,
            action_type=ActionType.SEND_NOTIFICATION,
            config={"title": "High Value Order", "message": "Review the new high-value order", "users": ["manager"]},
            order=1,
        )

        self.assertEqual(workflow.conditions.count(), 1)
        self.assertEqual(workflow.actions.count(), 2)

    def test_scheduled_workflow(self):
        """Test creating a scheduled workflow."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name="Weekly Report",
            description="Generate weekly sales report",
            trigger_type=TriggerType.SCHEDULED,
            trigger_config={"cron": "0 9 * * 1", "timezone": "America/New_York"},  # Monday at 9am
            created_by=self.user,
        )

        self.assertEqual(workflow.trigger_type, TriggerType.SCHEDULED)
        self.assertIn("cron", workflow.trigger_config)

    def test_manual_workflow(self):
        """Test creating a manual-trigger workflow."""
        workflow = TenantWorkflow.objects.create(
            tenant=self.tenant, name="Send Custom Email", trigger_type=TriggerType.MANUAL, created_by=self.user
        )

        self.assertEqual(workflow.trigger_type, TriggerType.MANUAL)


class WorkflowExecutionLogTest(TestCase):
    """Test WorkflowExecutionLog functionality."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            contact_email="test@example.com",
            created_by=self.user,
        )
        self.workflow = TenantWorkflow.objects.create(
            tenant=self.tenant,
            name="Test Workflow",
            trigger_type=TriggerType.MANUAL,
            status=WorkflowStatus.ACTIVE,
            created_by=self.user,
        )

    def test_create_execution_log(self):
        """Test creating an execution log."""
        log = WorkflowExecutionLog.objects.create(
            workflow=self.workflow,
            trigger_type="manual",
            trigger_data={"user_id": self.user.id},
            triggered_by=self.user,
        )

        self.assertEqual(log.status, "started")
        self.assertEqual(log.actions_executed, 0)
        self.assertIsNotNone(log.started_at)

    def test_complete_execution_log(self):
        """Test completing an execution log."""
        from django.utils import timezone

        log = WorkflowExecutionLog.objects.create(workflow=self.workflow, trigger_type="manual", triggered_by=self.user)

        # Simulate successful completion
        log.status = "success"
        log.completed_at = timezone.now()
        log.actions_executed = 2
        log.execution_log = [
            {"action": "send_email", "status": "success", "duration_ms": 150},
            {"action": "send_notification", "status": "success", "duration_ms": 50},
        ]
        log.save()

        self.assertEqual(log.status, "success")
        self.assertEqual(log.actions_executed, 2)
        self.assertEqual(len(log.execution_log), 2)


class EntityPersistenceServiceTest(TestCase):
    """Test EntityPersistenceService functionality."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            contact_email="test@example.com",
            created_by=self.user,
        )
        # Create a test form
        self.form = TenantForm.objects.create(
            tenant=self.tenant,
            name="New Supplier Form",
            description="Add a new supplier",
            status=FormStatus.ACTIVE,
            created_by=self.user,
        )
        # Add a step
        self.step = TenantFormEntity.objects.create(
            form=self.form, entity_type="supplier", step_name="Supplier Information", order=0
        )

    def test_entity_model_registry(self):
        """Test that all entity types in registry are valid."""
        from django.apps import apps

        from ..services.entity_persistence import ENTITY_MODEL_REGISTRY

        for entity_type, (app, model) in ENTITY_MODEL_REGISTRY.items():
            try:
                model_class = apps.get_model(app, model)
                self.assertIsNotNone(model_class)
            except LookupError:
                self.fail(f"Model not found: {app}.{model} for entity type: {entity_type}")

    def test_create_supplier_from_form(self):
        """Test creating a Supplier from form submission data."""
        from tenant_apps.suppliers.models import Supplier

        from ..models import FormSubmission
        from ..services.entity_persistence import EntityPersistenceService

        # Create a submission with supplier data
        submission = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.user,
            data={
                str(self.step.id): {
                    "name": "Acme Foods",
                    "email": "contact@acme.com",
                    "phone": "555-1234",
                    "address": "123 Main St",
                }
            },
        )

        # Run persistence
        service = EntityPersistenceService(submission, user=self.user)
        result = service.persist_all()

        # Verify success
        self.assertTrue(result["success"])
        self.assertIn(str(self.step.id), result["created_entities"])

        # Verify supplier was created
        supplier_info = result["created_entities"][str(self.step.id)]
        self.assertEqual(supplier_info["entity_type"], "supplier")

        # Fetch from DB
        supplier = Supplier.objects.get(pk=supplier_info["entity_id"])
        self.assertEqual(supplier.name, "Acme Foods")
        self.assertEqual(supplier.email, "contact@acme.com")
        self.assertEqual(supplier.tenant, self.tenant)

    def test_skip_empty_steps(self):
        """Test that steps with no data are skipped."""
        from ..models import FormSubmission
        from ..services.entity_persistence import EntityPersistenceService

        # Create submission with empty data
        submission = FormSubmission.objects.create(
            tenant=self.tenant, form=self.form, created_by=self.user, data={}  # No data for any step
        )

        service = EntityPersistenceService(submission)
        result = service.persist_all()

        # Should succeed with no entities created
        self.assertTrue(result["success"])
        self.assertEqual(len(result["created_entities"]), 0)

    def test_persist_stores_entity_refs_in_submission(self):
        """Test that created entity references are stored in submission."""
        from ..models import FormSubmission
        from ..services.entity_persistence import EntityPersistenceService

        submission = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.user,
            data={
                str(self.step.id): {
                    "name": "Test Supplier",
                }
            },
        )

        service = EntityPersistenceService(submission, user=self.user)
        result = service.persist_all()

        # Refresh from DB
        submission.refresh_from_db()

        # Check that __created_entities__ was stored
        self.assertIn("__created_entities__", submission.data)
        self.assertEqual(submission.data["__created_entities__"], result["created_entities"])


# =============================================================================
# WAVE 3: FORMS & FLOWS ENHANCEMENT TESTS
# =============================================================================


class FormStatusHistoryModelTest(TestCase):
    """Test FormStatusHistory model functionality."""

    @classmethod
    def setUpTestData(cls):
        import uuid

        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"statususer_{unique_id}", email=f"statususer_{unique_id}@example.com", password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Status Tenant {unique_id}",
            slug=f"status-tenant-{unique_id}",
            contact_email=f"statususer_{unique_id}@example.com",
            created_by=cls.user,
        )
        cls.form = TenantForm.objects.create(
            tenant=cls.tenant,
            name="Test Form for Status",
            description="A test form",
            status=FormStatus.ACTIVE,
            created_by=cls.user,
        )

    def test_create_status_history(self):
        """Test creating a status history entry."""
        from ..models import FormStatusHistory, FormSubmission, FormSubmissionStatus

        submission = FormSubmission.objects.create(
            tenant=self.tenant, form=self.form, status=FormSubmissionStatus.DRAFT, created_by=self.user
        )

        history = FormStatusHistory.objects.create(
            submission=submission,
            from_status="",
            to_status=FormSubmissionStatus.DRAFT,
            changed_by=self.user,
            comment="Initial creation",
        )

        self.assertEqual(history.from_status, "")
        self.assertEqual(history.to_status, "draft")
        self.assertEqual(history.changed_by, self.user)
        self.assertIn("Initial", history.comment)

    def test_status_transition(self):
        """Test recording a status transition."""
        from ..models import FormStatusHistory, FormSubmission, FormSubmissionStatus

        submission = FormSubmission.objects.create(
            tenant=self.tenant, form=self.form, status=FormSubmissionStatus.DRAFT, created_by=self.user
        )

        # Create history for transition
        history = FormStatusHistory.objects.create(
            submission=submission,
            from_status=FormSubmissionStatus.DRAFT,
            to_status=FormSubmissionStatus.IN_PROGRESS,
            changed_by=self.user,
            comment="Started working on submission",
        )

        self.assertEqual(str(history), f"{submission} - draft → in_progress")


class StepAssignmentModelTest(TestCase):
    """Test StepAssignment model functionality."""

    @classmethod
    def setUpTestData(cls):
        import uuid

        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"assignuser_{unique_id}", email=f"assignuser_{unique_id}@example.com", password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Assign Tenant {unique_id}",
            slug=f"assign-tenant-{unique_id}",
            contact_email=f"assignuser_{unique_id}@example.com",
            created_by=cls.user,
        )
        cls.form = TenantForm.objects.create(
            tenant=cls.tenant,
            name="Test Form for Assignment",
            description="A test form",
            status=FormStatus.ACTIVE,
            created_by=cls.user,
        )
        cls.step = TenantFormEntity.objects.create(
            form=cls.form, entity_type="supplier", step_name="Supplier Info", order=0
        )

    def test_create_user_assignment(self):
        """Test creating a user-based step assignment."""
        from ..models import AssignmentType, StepAssignment

        assignment = StepAssignment.objects.create(
            tenant=self.tenant,
            form=self.form,
            step=self.step,
            assignment_type=AssignmentType.USER,
            assigned_user=self.user,
            is_required=True,
            due_days=3,
            created_by=self.user,
        )

        self.assertEqual(assignment.assignment_type, "user")
        self.assertEqual(assignment.assigned_user, self.user)
        self.assertEqual(assignment.due_days, 3)
        self.assertTrue(assignment.is_required)

    def test_create_role_assignment(self):
        """Test creating a role-based step assignment."""
        from ..models import AssignmentType, StepAssignment

        assignment = StepAssignment.objects.create(
            tenant=self.tenant,
            form=self.form,
            step=self.step,
            assignment_type=AssignmentType.ROLE,
            assigned_role="manager",
            is_required=True,
            created_by=self.user,
        )

        self.assertEqual(assignment.assignment_type, "role")
        self.assertEqual(assignment.assigned_role, "manager")
        self.assertEqual(str(assignment), f"Supplier Info → manager")


class UserNotificationModelTest(TestCase):
    """Test UserNotification model functionality."""

    @classmethod
    def setUpTestData(cls):
        import uuid

        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"notifyuser_{unique_id}", email=f"notifyuser_{unique_id}@example.com", password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Notify Tenant {unique_id}",
            slug=f"notify-tenant-{unique_id}",
            contact_email=f"notifyuser_{unique_id}@example.com",
            created_by=cls.user,
        )

    def test_create_notification(self):
        """Test creating a notification."""
        from ..models import NotificationPriority, NotificationType, UserNotification

        notification = UserNotification.objects.create(
            tenant=self.tenant,
            user=self.user,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="New Task Assigned",
            message="You have been assigned a new task: Review supplier form",
            priority=NotificationPriority.HIGH,
        )

        self.assertEqual(notification.notification_type, "task_assigned")
        self.assertEqual(notification.priority, "high")
        self.assertFalse(notification.is_read)
        self.assertFalse(notification.is_dismissed)

    def test_mark_read(self):
        """Test marking a notification as read."""
        from ..models import NotificationType, UserNotification

        notification = UserNotification.objects.create(
            tenant=self.tenant,
            user=self.user,
            notification_type=NotificationType.TASK_COMPLETED,
            title="Task Completed",
            message="Your task has been completed",
        )

        self.assertFalse(notification.is_read)
        self.assertIsNone(notification.read_at)

        notification.mark_read()

        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_dismiss(self):
        """Test dismissing a notification."""
        from ..models import NotificationType, UserNotification

        notification = UserNotification.objects.create(
            tenant=self.tenant,
            user=self.user,
            notification_type=NotificationType.SYSTEM,
            title="System Update",
            message="System will be updated tonight",
        )

        self.assertFalse(notification.is_dismissed)

        notification.dismiss()

        self.assertTrue(notification.is_dismissed)


class UserNotificationPreferencesModelTest(TestCase):
    """Test UserNotificationPreferences model functionality."""

    @classmethod
    def setUpTestData(cls):
        import uuid

        from apps.tenants.models import Tenant

        unique_id = uuid.uuid4().hex[:8]
        cls.tenant = Tenant.objects.create(
            name=f"Prefs Tenant {unique_id}",
            slug=f"prefs-tenant-{unique_id}",
            contact_email=f"prefs-tenant-{unique_id}@example.com",
        )
        cls.user = User.objects.create_user(
            username=f"prefuser_{unique_id}", email=f"prefuser_{unique_id}@example.com", password="testpass123"
        )

    def test_create_preferences(self):
        """Test creating notification preferences."""
        from ..models import UserNotificationPreferences

        prefs = UserNotificationPreferences.objects.create(
            tenant=self.tenant,
            user=self.user,
            notifications_enabled=True,
            email_enabled=True,
            sms_enabled=False,
            push_enabled=True,
        )

        self.assertTrue(prefs.notifications_enabled)
        self.assertTrue(prefs.email_enabled)
        self.assertFalse(prefs.sms_enabled)
        self.assertTrue(prefs.push_enabled)

    def test_should_notify_with_disabled_master(self):
        """Test should_notify returns False when master switch is off."""
        from ..models import DeliveryChannel, UserNotificationPreferences

        prefs = UserNotificationPreferences.objects.create(
            tenant=self.tenant,
            user=self.user,
            notifications_enabled=False,
            email_enabled=True,
        )

        result = prefs.should_notify("task_assigned", DeliveryChannel.EMAIL)
        self.assertFalse(result)

    def test_should_notify_with_disabled_channel(self):
        """Test should_notify returns False when channel is disabled."""
        from ..models import DeliveryChannel, UserNotificationPreferences

        prefs = UserNotificationPreferences.objects.create(
            tenant=self.tenant,
            user=self.user,
            notifications_enabled=True,
            email_enabled=False,
        )

        result = prefs.should_notify("task_assigned", DeliveryChannel.EMAIL)
        self.assertFalse(result)

    def test_should_notify_with_type_preferences(self):
        """Test should_notify respects type-specific preferences."""
        from ..models import DeliveryChannel, UserNotificationPreferences

        prefs = UserNotificationPreferences.objects.create(
            tenant=self.tenant,
            user=self.user,
            notifications_enabled=True,
            email_enabled=True,
            type_preferences={"task_assigned": ["in_app", "email"], "mention": ["in_app"]},
        )

        # Task assigned should allow email
        self.assertTrue(prefs.should_notify("task_assigned", DeliveryChannel.EMAIL))

        # Mention should not allow email (only in_app in preferences)
        self.assertFalse(prefs.should_notify("mention", DeliveryChannel.EMAIL))

        # Unknown type defaults to in_app only
        self.assertTrue(prefs.should_notify("unknown_type", DeliveryChannel.IN_APP))
        self.assertFalse(prefs.should_notify("unknown_type", DeliveryChannel.EMAIL))

    def test_get_defaults(self):
        """Test default preferences are returned correctly."""
        from ..models import DeliveryChannel, NotificationType, UserNotificationPreferences

        defaults = UserNotificationPreferences.get_defaults()

        # Task assigned should have in_app and email
        self.assertIn(DeliveryChannel.IN_APP.value, defaults[NotificationType.TASK_ASSIGNED.value])
        self.assertIn(DeliveryChannel.EMAIL.value, defaults[NotificationType.TASK_ASSIGNED.value])

        # Task completed should have in_app only
        self.assertIn(DeliveryChannel.IN_APP.value, defaults[NotificationType.TASK_COMPLETED.value])
        self.assertNotIn(DeliveryChannel.EMAIL.value, defaults[NotificationType.TASK_COMPLETED.value])


class FormSubmissionAssignedToFilterTest(TestCase):
    """Test FormSubmission filtering by assigned_to parameter."""

    def setUp(self):
        """Set up test data."""
        import uuid

        unique_id = uuid.uuid4().hex[:8]

        # Create users
        self.user1 = User.objects.create_user(
            username=f"user1_{unique_id}", email=f"user1_{unique_id}@example.com", password="testpass123"
        )
        self.user2 = User.objects.create_user(
            username=f"user2_{unique_id}", email=f"user2_{unique_id}@example.com", password="testpass123"
        )
        self.admin_user = User.objects.create_user(
            username=f"admin_{unique_id}", email=f"admin_{unique_id}@example.com", password="testpass123", is_staff=True
        )

        # Create tenant
        self.tenant = Tenant.objects.create(
            name=f"Test Tenant {unique_id}",
            slug=f"test-tenant-{unique_id}",
            contact_email=f"admin_{unique_id}@example.com",
            created_by=self.admin_user,
        )

        # Ensure RLS-protected queries can see this tenant's rows.
        # (TenantMiddleware normally sets these per-request.)
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("SET app.current_tenant_id = %s", [str(self.tenant.id)])
            cursor.execute("SET app.current_tenant = %s", [str(self.tenant.id)])

        # Create form
        from ..models import AssignmentType, FormSubmission, FormSubmissionStatus, StepAssignment

        self.form = TenantForm.objects.create(tenant=self.tenant, name="Test Form", created_by=self.user1)

        # Create form steps
        self.step1 = TenantFormEntity.objects.create(
            form=self.form, entity_type="customer", step_name="Customer Info", order=0
        )
        self.step2 = TenantFormEntity.objects.create(
            form=self.form, entity_type="supplier", step_name="Supplier Info", order=1
        )

        # Create step assignments
        StepAssignment.objects.create(
            tenant=self.tenant,
            form=self.form,
            step=self.step1,
            assignment_type=AssignmentType.USER,
            assigned_user=self.user1,
        )
        StepAssignment.objects.create(
            tenant=self.tenant,
            form=self.form,
            step=self.step2,
            assignment_type=AssignmentType.USER,
            assigned_user=self.user2,
        )

        # Create form submissions
        self.submission1 = FormSubmission.objects.create(
            tenant=self.tenant, form=self.form, created_by=self.user1, status=FormSubmissionStatus.IN_PROGRESS
        )
        self.submission2 = FormSubmission.objects.create(
            tenant=self.tenant, form=self.form, created_by=self.user2, status=FormSubmissionStatus.IN_PROGRESS
        )

        # Create form without assignments for negative testing
        self.form_no_assignments = TenantForm.objects.create(
            tenant=self.tenant, name="Form Without Assignments", created_by=self.user1
        )
        self.submission_no_assignments = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form_no_assignments,
            created_by=self.user1,
            status=FormSubmissionStatus.IN_PROGRESS,
        )

    def test_filter_assigned_to_me_user1(self):
        """Test filtering by assigned_to=me for user1."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        request = factory.get("/api/workflows/form-submissions/?assigned_to=me")
        request.user = self.user1
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # User1 is assigned to step1 of self.form, so submission1 and submission2 should appear
        # (both submissions use self.form which has user1 assigned to step1)
        submission_ids = [str(s.id) for s in queryset]
        self.assertIn(str(self.submission1.id), submission_ids)
        self.assertIn(str(self.submission2.id), submission_ids)

        # submission_no_assignments should NOT appear (no assignments)
        self.assertNotIn(str(self.submission_no_assignments.id), submission_ids)

    def test_filter_assigned_to_me_user2(self):
        """Test filtering by assigned_to=me for user2."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        request = factory.get("/api/workflows/form-submissions/?assigned_to=me")
        request.user = self.user2
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # User2 is assigned to step2 of self.form, so submission1 and submission2 should appear
        submission_ids = [str(s.id) for s in queryset]
        self.assertIn(str(self.submission1.id), submission_ids)
        self.assertIn(str(self.submission2.id), submission_ids)

        # submission_no_assignments should NOT appear (no assignments)
        self.assertNotIn(str(self.submission_no_assignments.id), submission_ids)

    def test_filter_assigned_to_specific_user_as_admin(self):
        """Test filtering by specific user ID as admin."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        request = factory.get(f"/api/workflows/form-submissions/?assigned_to={self.user1.id}")
        request.user = self.admin_user
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # Admin filtering by user1's ID should get submissions with user1 assigned
        submission_ids = [str(s.id) for s in queryset]
        self.assertIn(str(self.submission1.id), submission_ids)
        self.assertIn(str(self.submission2.id), submission_ids)

    def test_filter_assigned_to_without_assignments(self):
        """Test that submissions without step assignments are not returned."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        request = factory.get("/api/workflows/form-submissions/?assigned_to=me")
        request.user = self.user1
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # submission_no_assignments should NOT appear (no step assignments)
        submission_ids = [str(s.id) for s in queryset]
        self.assertNotIn(str(self.submission_no_assignments.id), submission_ids)

    def test_filter_assigned_to_invalid_user_id(self):
        """Test filtering by invalid numeric user ID returns empty queryset."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        request = factory.get("/api/workflows/form-submissions/?assigned_to=99999")
        request.user = self.admin_user
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # Invalid user ID should return empty queryset
        self.assertEqual(queryset.count(), 0)

    def test_filter_assigned_to_malformed_user_id(self):
        """Test filtering by malformed (non-numeric) user ID returns empty queryset."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        # Try with a non-numeric string
        request = factory.get("/api/workflows/form-submissions/?assigned_to=invalid_string")
        request.user = self.admin_user
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # Malformed user ID should return empty queryset (ValueError caught)
        self.assertEqual(queryset.count(), 0)

        # Invalid user ID should return empty queryset
        self.assertEqual(queryset.count(), 0)

    def test_filter_no_assigned_to_parameter(self):
        """Test that without assigned_to parameter, all submissions are returned."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        request = factory.get("/api/workflows/form-submissions/")
        request.user = self.admin_user
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # Without assigned_to filter, all submissions should be returned for admin
        self.assertEqual(queryset.count(), 3)

    def test_filter_assigned_to_non_admin_with_user_id(self):
        """Test that non-admin users cannot filter by specific user ID (security)."""
        from rest_framework.test import APIRequestFactory

        from ..views import FormSubmissionViewSet

        factory = APIRequestFactory()
        # Non-admin user tries to filter by another user's ID
        request = factory.get(f"/api/workflows/form-submissions/?assigned_to={self.user2.id}")
        request.user = self.user1
        request.tenant = self.tenant

        viewset = FormSubmissionViewSet()
        from rest_framework.request import Request

        drf_request = Request(request)
        drf_request.user = request.user
        drf_request.tenant = request.tenant
        viewset.request = drf_request
        viewset.format_kwarg = None

        queryset = viewset.get_queryset()

        # Non-admin users should get empty queryset when trying to use user IDs
        # This prevents user ID enumeration attacks
        self.assertEqual(queryset.count(), 0)
