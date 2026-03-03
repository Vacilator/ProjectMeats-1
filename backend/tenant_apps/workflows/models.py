"""
Tenant Workflows Models.

Bundle Two: System → Tenant Workflows & New Data Entities

This module provides models for:
1. TenantForm - Custom forms for creating/editing entity records
2. TenantWorkflow - Automation rules triggered by events
3. TenantList - Tenant-specific option lists

Architecture: Hybrid approach
- Frontend: UI logic (field visibility, filtering options, form flow)
- Backend: Actions (send email, run workflow, save data, notifications)
"""
import uuid
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from apps.tenants.models import Tenant
from apps.core.models import TenantAwareModel


# =============================================================================
# CHOICES AND CONSTANTS
# =============================================================================

class TriggerType(models.TextChoices):
    """Types of workflow triggers."""
    MANUAL = 'manual', 'Manual Run'
    SCHEDULED = 'scheduled', 'Scheduled Task'
    WEBHOOK = 'webhook', 'Webhook (External API)'
    EVENT = 'event', 'Database Event'
    FORM_SUBMIT = 'form_submit', 'Form Submission'
    RECORD_CREATED = 'record_created', 'New Record Created'  # Legacy - use EVENT
    RECORD_UPDATED = 'record_updated', 'Record Field Updated'  # Legacy - use EVENT


class OperatorType(models.TextChoices):
    """Operators for conditional rules."""
    EQUALS = 'eq', 'Equals (=)'
    NOT_EQUALS = 'neq', 'Not Equal To (≠)'
    GREATER_THAN = 'gt', 'Greater Than (>)'
    LESS_THAN = 'lt', 'Less Than (<)'
    GREATER_OR_EQUAL = 'gte', 'Greater Than or Equal (≥)'
    LESS_OR_EQUAL = 'lte', 'Less Than or Equal (≤)'
    CONTAINS = 'contains', 'Contains'
    NOT_CONTAINS = 'not_contains', 'Does Not Contain'
    IS_EMPTY = 'is_empty', 'Is Empty'
    IS_NOT_EMPTY = 'is_not_empty', 'Is Not Empty'


class ActionType(models.TextChoices):
    """Types of actions that can be performed."""
    # Field-level actions
    DISPLAY_FIELDS = 'display_fields', 'Display Field(s)'
    HIDE_FIELDS = 'hide_fields', 'Hide Field(s)'
    FILTER_OPTIONS = 'filter_options', 'Filter Field Options'
    SET_FIELD_VALUE = 'set_value', 'Set Field Value'
    # Step/Entity-level actions
    DISPLAY_STEPS = 'display_steps', 'Display Step(s)'
    HIDE_STEPS = 'hide_steps', 'Hide Step(s)'
    DISPLAY_ENTITIES = 'display_entities', 'Display Entities'  # Legacy alias
    # Workflow actions
    RUN_WORKFLOW = 'run_workflow', 'Run Custom Workflow'
    SEND_EMAIL = 'send_email', 'Send Email'
    SEND_NOTIFICATION = 'send_notification', 'Send In-App Notification'
    SEND_TEAMS_SLACK = 'send_teams_slack', 'Send to Teams/Slack'
    SEND_SMS = 'send_sms', 'Send Text Message'
    CREATE_RECORD = 'create_record', 'Create Record'
    UPDATE_RECORD = 'update_record', 'Update Record'


class FormStatus(models.TextChoices):
    """Status of a tenant form."""
    DRAFT = 'draft', 'Draft'
    ACTIVE = 'active', 'Active'
    INACTIVE = 'inactive', 'Inactive'


class WorkflowStatus(models.TextChoices):
    """Status of a workflow."""
    DRAFT = 'draft', 'Draft'
    ACTIVE = 'active', 'Active'
    PAUSED = 'paused', 'Paused'
    INACTIVE = 'inactive', 'Inactive'


# =============================================================================
# TENANT LIST MODEL
# =============================================================================

class TenantList(TenantAwareModel):
    """
    Tenant-specific option list for dropdown/multi-select fields.
    
    Unlike FieldOptionList (system-level), these are scoped to a single tenant
    and only visible to users of that tenant.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(
        max_length=255,
        help_text="Name of the option list"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Description of the list"
    )
    
    # Options stored as JSON array of {value, label} objects
    options = models.JSONField(
        default=list,
        help_text="List of options [{value: 'v1', label: 'Label 1'}, ...]"
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this list is active"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tenant_lists_created',
        help_text="User who created this list"
    )
    
    class Meta:
        verbose_name = "Tenant List"
        verbose_name_plural = "Tenant Lists"
        ordering = ['tenant', 'name']
        unique_together = [['tenant', 'name']]
    
    def __str__(self):
        return f"{self.name} ({len(self.options)} options)"


# =============================================================================
# TENANT FORM MODELS
# =============================================================================

class TenantForm(TenantAwareModel):
    """
    Custom form definition for a tenant.
    
    Allows tenants to create custom forms for entity record creation/editing.
    Can be single-entity or multi-entity (progressive/wizard) forms.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Form identification
    name = models.CharField(
        max_length=255,
        help_text="Name of the form"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Description of the form's purpose"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=FormStatus.choices,
        default=FormStatus.DRAFT,
        help_text="Current status of the form"
    )
    
    # If true, this form is used as the default when creating records
    # Only applicable for single-entity forms
    is_default = models.BooleanField(
        default=False,
        help_text="Use as default form for entity creation (single-entity forms only)"
    )
    
    # Icon and styling
    icon = models.CharField(
        max_length=50,
        blank=True,
        default='file-text',
        help_text="Icon identifier for UI"
    )
    
    # Quick Actions availability
    is_quick_action_enabled = models.BooleanField(
        default=False,
        help_text="Allow this form to be added to user Quick Actions menu"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tenant_forms_created',
        help_text="User who created this form"
    )
    
    # Visual editor flow data (Phase 2.1)
    flow_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Visual editor flow definition (nodes and edges)"
    )
    
    class Meta:
        verbose_name = "Tenant Form"
        verbose_name_plural = "Tenant Forms"
        ordering = ['tenant', 'name']
    
    def __str__(self):
        entity_count = self.entities.count()
        suffix = f" ({entity_count} entities)" if entity_count > 1 else ""
        return f"{self.name}{suffix}"
    
    @property
    def is_multi_entity(self):
        """Returns True if this is a multi-entity (progressive) form."""
        return self.entities.count() > 1
    
    @property
    def can_be_default(self):
        """Returns True if this form can be set as default (single entity only)."""
        return self.entities.count() == 1


class TenantFormEntity(TenantAwareModel):
    """
    Entity included in a tenant form.
    
    For multi-entity forms, each entity becomes a "step" in the progressive form.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(
        TenantForm,
        on_delete=models.CASCADE,
        related_name='entities',
        help_text="Form this entity belongs to"
    )
    
    # Reference to the entity type (e.g., 'supplier', 'customer', 'purchase_order')
    entity_type = models.CharField(
        max_length=100,
        help_text="Type of entity (model name in snake_case)"
    )
    
    # Display name for this step
    step_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Custom name for this step (defaults to entity name)"
    )
    
    # Order in the form (for multi-entity progressive forms)
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order of this entity in the form (step number)"
    )
    
    class Meta:
        verbose_name = "Form Entity"
        verbose_name_plural = "Form Entities"
        ordering = ['form', 'order']
        # Note: Removed unique_together constraint to allow multiple steps 
        # with the same entity type (e.g., two "Sales Order" steps in one form)
    
    def __str__(self):
        return f"Step {self.order + 1}: {self.step_name or self.entity_type}"


class TenantFormField(TenantAwareModel):
    """
    Field configuration within a form entity.
    
    Defines which fields are visible, their order, and any custom settings.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form_entity = models.ForeignKey(
        TenantFormEntity,
        on_delete=models.CASCADE,
        related_name='fields',
        help_text="Form entity this field belongs to"
    )
    
    # Reference to the actual field
    field_key = models.CharField(
        max_length=100,
        help_text="Field key/name from the entity model"
    )
    
    # Field type (stored explicitly to ensure correct rendering)
    field_type = models.CharField(
        max_length=30,
        default='text',
        help_text="Form field type: text, email, select, textarea, number, date, etc."
    )
    
    # Display settings
    is_visible = models.BooleanField(
        default=True,
        help_text="Whether this field is visible in the form"
    )
    is_required = models.BooleanField(
        default=False,
        help_text="Override: make this field required"
    )
    
    # Order in the form
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order of the field"
    )
    
    # Custom label override
    custom_label = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Custom label (overrides default field label)"
    )
    
    # Custom help text override
    custom_help_text = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Custom help text"
    )
    
    # Default value override
    default_value = models.JSONField(
        null=True,
        blank=True,
        help_text="Default value for this field in this form"
    )
    
    # Auto-population configuration (Phase 3)
    auto_populate_source_step = models.ForeignKey(
        TenantFormEntity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields_that_use_as_source',
        help_text="Step to pull auto-populate value from"
    )
    auto_populate_source_field = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Field key from source step to use for auto-population"
    )
    auto_populate_mode = models.CharField(
        max_length=20,
        blank=True,
        default='',
        choices=[
            ('', 'None'),
            ('copy', 'Copy Value'),
            ('lookup', 'Lookup Reference'),
        ],
        help_text="How to populate: copy=direct value, lookup=fetch related record"
    )
    
    # Validation rules (client and server side)
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Validation rules: min_length, max_length, pattern, min, max, etc."
    )
    
    # Phase 2.5: Enhanced Inheritance with Type Checking
    inherit_from_parent = models.BooleanField(
        default=False,
        help_text='Inherit validation rules from parent entity field definition'
    )
    strict_type_checking = models.BooleanField(
        default=True,
        help_text='Enforce strict type validation based on field_type'
    )
    computed_validation = models.JSONField(
        default=dict,
        blank=True,
        help_text='Computed validation rules inherited from entity model'
    )
    
    class Meta:
        verbose_name = "Form Field"
        verbose_name_plural = "Form Fields"
        ordering = ['form_entity', 'order']
        unique_together = [['form_entity', 'field_key']]
    
    def __str__(self):
        visibility = "👁" if self.is_visible else "🚫"
        return f"{visibility} {self.custom_label or self.field_key}"


class TenantFormRule(TenantAwareModel):
    """
    Conditional rule for a form.
    
    Implements the "When/Operator/Then" pattern for dynamic form behavior.
    Rules are evaluated on the frontend for immediate UI feedback.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(
        TenantForm,
        on_delete=models.CASCADE,
        related_name='rules',
        help_text="Form this rule belongs to"
    )
    
    name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Optional name for this rule"
    )
    
    # Rule is active/inactive
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this rule is active"
    )
    
    # Order of rule evaluation
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order in which rules are evaluated"
    )
    
    # WHEN: The condition(s) to check
    # Format: [{"field": "step1.field_name", "operator": "eq", "value": "xyz"}, ...]
    conditions = models.JSONField(
        default=list,
        help_text="Conditions to evaluate (AND logic between conditions)"
    )
    
    # Condition logic (AND/OR between multiple conditions)
    condition_logic = models.CharField(
        max_length=10,
        choices=[('and', 'AND - All must match'), ('or', 'OR - Any must match')],
        default='and',
        help_text="Logic for combining multiple conditions"
    )
    
    # THEN: The action(s) to perform
    # Format: [{"action": "display_fields", "params": {"fields": ["field1", "field2"]}}, ...]
    actions = models.JSONField(
        default=list,
        help_text="Actions to perform when conditions are met"
    )
    
    class Meta:
        verbose_name = "Form Rule"
        verbose_name_plural = "Form Rules"
        ordering = ['form', 'order']
    
    def __str__(self):
        return self.name or f"Rule {self.order + 1}"


# =============================================================================
# TENANT WORKFLOW MODELS
# =============================================================================

class TenantWorkflow(TenantAwareModel):
    """
    Workflow definition for a tenant.
    
    Workflows are automation rules that execute based on triggers.
    They run on the backend for security and reliability.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Workflow identification
    name = models.CharField(
        max_length=255,
        help_text="Name of the workflow"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Description of what this workflow does"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=WorkflowStatus.choices,
        default=WorkflowStatus.DRAFT,
        help_text="Current status of the workflow"
    )
    
    # Trigger type
    trigger_type = models.CharField(
        max_length=30,
        choices=TriggerType.choices,
        help_text="What triggers this workflow"
    )
    
    # Trigger configuration (depends on trigger_type)
    # For scheduled: {"cron": "0 9 * * 1", "timezone": "America/New_York"}
    # For record_created: {"entity_type": "purchase_order"}
    # For record_updated: {"entity_type": "purchase_order", "fields": ["status", "total"]}
    trigger_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configuration specific to the trigger type"
    )
    
    # Entity type this workflow applies to (if applicable)
    entity_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Entity type this workflow operates on"
    )
    
    # Icon for display
    icon = models.CharField(
        max_length=50,
        blank=True,
        default='zap',
        help_text="Icon identifier for UI"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workflows_created',
        help_text="User who created this workflow"
    )
    
    # Execution stats
    last_run_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this workflow last ran"
    )
    run_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times this workflow has run"
    )
    
    class Meta:
        verbose_name = "Workflow"
        verbose_name_plural = "Workflows"
        ordering = ['tenant', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.get_trigger_type_display()})"


class TenantWorkflowCondition(TenantAwareModel):
    """
    Condition that must be met for workflow actions to execute.
    
    Evaluated at runtime before actions are performed.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        TenantWorkflow,
        on_delete=models.CASCADE,
        related_name='conditions',
        help_text="Workflow this condition belongs to"
    )
    
    # Field to check
    field_path = models.CharField(
        max_length=255,
        help_text="Path to field (e.g., 'status', 'customer.name')"
    )
    
    # Operator
    operator = models.CharField(
        max_length=20,
        choices=OperatorType.choices,
        help_text="Comparison operator"
    )
    
    # Value to compare against
    compare_value = models.JSONField(
        null=True,
        blank=True,
        help_text="Value to compare against"
    )
    
    # Order
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order of condition evaluation"
    )
    
    class Meta:
        verbose_name = "Workflow Condition"
        verbose_name_plural = "Workflow Conditions"
        ordering = ['workflow', 'order']
    
    def __str__(self):
        return f"{self.field_path} {self.operator} {self.compare_value}"


class TenantWorkflowAction(TenantAwareModel):
    """
    Action to perform when workflow triggers and conditions are met.
    
    Actions are executed on the backend in order.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        TenantWorkflow,
        on_delete=models.CASCADE,
        related_name='actions',
        help_text="Workflow this action belongs to"
    )
    
    # Action type
    action_type = models.CharField(
        max_length=30,
        choices=ActionType.choices,
        help_text="Type of action to perform"
    )
    
    # Action-specific configuration
    # Examples:
    # send_email: {"to": "{{customer.email}}", "subject": "...", "body": "..."}
    # send_notification: {"title": "...", "message": "...", "users": ["owner"]}
    # set_value: {"field": "status", "value": "approved"}
    # run_workflow: {"workflow_id": "uuid-here"}
    config = models.JSONField(
        default=dict,
        help_text="Configuration specific to the action type"
    )
    
    # Order of execution
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order in which actions are executed"
    )
    
    # Whether to continue on error
    continue_on_error = models.BooleanField(
        default=False,
        help_text="Continue executing subsequent actions if this one fails"
    )
    
    class Meta:
        verbose_name = "Workflow Action"
        verbose_name_plural = "Workflow Actions"
        ordering = ['workflow', 'order']
    
    def __str__(self):
        return f"{self.order + 1}. {self.get_action_type_display()}"


class WorkflowExecutionLog(TenantAwareModel):
    """
    Log of workflow executions for auditing and debugging.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        TenantWorkflow,
        on_delete=models.CASCADE,
        related_name='execution_logs',
        help_text="Workflow that was executed"
    )
    
    # Trigger info
    trigger_type = models.CharField(
        max_length=30,
        help_text="What triggered this execution"
    )
    trigger_data = models.JSONField(
        default=dict,
        help_text="Data that triggered the workflow"
    )
    
    # Execution status
    status = models.CharField(
        max_length=20,
        choices=[
            ('started', 'Started'),
            ('success', 'Success'),
            ('failed', 'Failed'),
            ('partial', 'Partial Success'),
        ],
        default='started',
        help_text="Execution status"
    )
    
    # Timing
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Results
    actions_executed = models.PositiveIntegerField(
        default=0,
        help_text="Number of actions executed"
    )
    actions_failed = models.PositiveIntegerField(
        default=0,
        help_text="Number of actions that failed"
    )
    
    # Error info
    error_message = models.TextField(
        blank=True,
        default='',
        help_text="Error message if execution failed"
    )
    
    # Detailed log
    execution_log = models.JSONField(
        default=list,
        help_text="Detailed log of each action's execution"
    )
    
    # Who/what triggered it
    triggered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who triggered the workflow (if manual)"
    )
    
    class Meta:
        verbose_name = "Execution Log"
        verbose_name_plural = "Execution Logs"
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.workflow.name} - {self.status} ({self.started_at})"


# =============================================================================
# FORM SUBMISSION MODELS
# =============================================================================

class FormSubmissionStatus(models.TextChoices):
    """Status choices for form submissions."""
    DRAFT = 'draft', 'Draft'
    IN_PROGRESS = 'in_progress', 'In Progress'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class StepSubmissionStatus(models.TextChoices):
    """Status choices for individual step submissions."""
    NOT_STARTED = 'not_started', 'Not Started'
    IN_PROGRESS = 'in_progress', 'In Progress'
    ACTION_NEEDED = 'action_needed', 'Action Needed'
    COMPLETED = 'completed', 'Completed'
    SKIPPED = 'skipped', 'Skipped'


class FormSubmission(models.Model):
    """
    Tracks a single execution/submission of a TenantForm.
    
    Created when a user starts filling out a form from Quick Actions.
    Supports auto-save (draft mode) and step-by-step completion tracking.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(
        TenantForm,
        on_delete=models.CASCADE,
        related_name='submissions',
        help_text="The form being submitted"
    )
    
    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=FormSubmissionStatus.choices,
        default=FormSubmissionStatus.DRAFT,
        help_text="Current status of the submission"
    )
    
    # Current step (for multi-step forms)
    current_step = models.ForeignKey(
        TenantFormEntity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_submissions',
        help_text="The step the user is currently on"
    )
    
    # All submitted data (keyed by step_id.field_key)
    data = models.JSONField(
        default=dict,
        blank=True,
        help_text="All field values: { step_id: { field_key: value } }"
    )
    
    # Snapshot of form structure at creation time (for versioning)
    form_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of form structure at submission creation"
    )
    
    # Audit fields
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='form_submissions',
        help_text="User who created this submission"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when submission was completed"
    )
    
    class Meta:
        verbose_name = "Form Submission"
        verbose_name_plural = "Form Submissions"
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['created_by', 'status']),
            models.Index(fields=['form', 'status']),
        ]
    
    def __str__(self):
        return f"{self.form.name} - {self.status} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
    
    @property
    def progress(self):
        """Returns completion progress as (completed_steps, total_steps)."""
        total = self.step_submissions.count()
        completed = self.step_submissions.filter(
            status=StepSubmissionStatus.COMPLETED
        ).count()
        return (completed, total)
    
    @property
    def progress_percent(self):
        """Returns completion percentage."""
        completed, total = self.progress
        if total == 0:
            return 0
        return int((completed / total) * 100)


class FormStepSubmission(models.Model):
    """
    Tracks the status and data for a single step in a form submission.
    
    Each step can have its own status (action_needed, completed, etc.)
    and supports notes via ActivityLog (GenericForeignKey).
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        related_name='step_submissions',
        help_text="Parent form submission"
    )
    step = models.ForeignKey(
        TenantFormEntity,
        on_delete=models.CASCADE,
        related_name='step_submissions',
        help_text="The form step/entity"
    )
    
    # Step-specific status
    status = models.CharField(
        max_length=20,
        choices=StepSubmissionStatus.choices,
        default=StepSubmissionStatus.NOT_STARTED,
        help_text="Current status of this step"
    )
    
    # Step-specific data (subset of FormSubmission.data for this step)
    data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Field values for this step: { field_key: value }"
    )
    
    # Completion tracking
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when step was marked complete"
    )
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_step_submissions',
        help_text="User who completed this step"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Step Submission"
        verbose_name_plural = "Step Submissions"
        ordering = ['submission', 'step__order']
        unique_together = [['submission', 'step']]
    
    def __str__(self):
        return f"{self.submission.form.name} - {self.step.step_name} ({self.status})"
    
    def mark_completed(self, user=None):
        """Mark this step as completed."""
        self.status = StepSubmissionStatus.COMPLETED
        self.completed_at = timezone.now()
        self.completed_by = user
        self.save(update_fields=['status', 'completed_at', 'completed_by', 'updated_at'])
    
    def mark_action_needed(self, reason=None):
        """Mark this step as needing action."""
        self.status = StepSubmissionStatus.ACTION_NEEDED
        self.save(update_fields=['status', 'updated_at'])


def form_submission_upload_path(instance, filename):
    """Generate upload path for form submission files."""
    import os
    ext = os.path.splitext(filename)[1]
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    return f"form_submissions/{instance.submission.tenant.slug}/{instance.submission.id}/{safe_filename}"


class FormSubmissionFile(models.Model):
    """
    Stores files uploaded as part of a form submission.
    
    Files are associated with a specific field in a submission and can be
    images, documents, or other file types depending on the field configuration.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        related_name='files',
        help_text="The form submission this file belongs to"
    )
    field_key = models.CharField(
        max_length=100,
        help_text="The field key this file is associated with"
    )
    
    # File storage
    file = models.FileField(
        upload_to=form_submission_upload_path,
        help_text="The uploaded file"
    )
    original_name = models.CharField(
        max_length=255,
        help_text="Original filename as uploaded"
    )
    content_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="MIME type of the file"
    )
    size = models.PositiveIntegerField(
        default=0,
        help_text="File size in bytes"
    )
    
    # Audit fields
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_submission_files',
        help_text="User who uploaded this file"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Form Submission File"
        verbose_name_plural = "Form Submission Files"
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['submission', 'field_key']),
        ]
    
    def __str__(self):
        return f"{self.original_name} ({self.field_key})"
    
    @property
    def url(self):
        """Return the URL for the file."""
        return self.file.url if self.file else None
    
    @property
    def is_image(self):
        """Check if the file is an image."""
        return self.content_type.startswith('image/') if self.content_type else False


# =============================================================================
# FORM ANALYTICS MODELS
# =============================================================================

class FormSubmissionEventType(models.TextChoices):
    """Event types for form submission analytics."""
    FORM_STARTED = 'form_started', 'Form Started'
    STEP_ENTERED = 'step_entered', 'Step Entered'
    STEP_COMPLETED = 'step_completed', 'Step Completed'
    FIELD_FOCUSED = 'field_focused', 'Field Focused'
    FIELD_CHANGED = 'field_changed', 'Field Changed'
    FIELD_ERROR = 'field_error', 'Field Error'
    VALIDATION_ERROR = 'validation_error', 'Validation Error'
    AUTO_SAVED = 'auto_saved', 'Auto Saved'
    FORM_SUBMITTED = 'form_submitted', 'Form Submitted'
    FORM_ABANDONED = 'form_abandoned', 'Form Abandoned'


class FormSubmissionEvent(models.Model):
    """
    Tracks analytics events for form submissions.
    
    Used to calculate:
    - Form completion rates
    - Average completion times
    - Step drop-off analysis
    - Field error frequency
    - User interaction patterns
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        related_name='events',
        help_text="The form submission this event belongs to"
    )
    
    # Event details
    event_type = models.CharField(
        max_length=30,
        choices=FormSubmissionEventType.choices,
        help_text="Type of event"
    )
    step_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Step ID if event is step-related"
    )
    field_key = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Field key if event is field-related"
    )
    
    # Event metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event data (error messages, field values, etc.)"
    )
    
    # Timing
    created_at = models.DateTimeField(auto_now_add=True)
    duration_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Duration in milliseconds (for step/form completion)"
    )
    
    class Meta:
        verbose_name = "Form Submission Event"
        verbose_name_plural = "Form Submission Events"
        ordering = ['submission', 'created_at']
        indexes = [
            models.Index(fields=['submission', 'event_type']),
            models.Index(fields=['event_type', 'created_at']),
            models.Index(fields=['step_id', 'event_type']),
        ]
    
    def __str__(self):
        return f"{self.event_type} - {self.submission_id}"


# =============================================================================
# FORM STATUS HISTORY (Wave 3: Forms & Flows Enhancement)
# =============================================================================

class FormStatusHistory(models.Model):
    """
    Tracks status changes for form submissions.
    
    Provides a complete audit trail of when status changed, who changed it,
    and optional comments/reasons for the change. Used for:
    - Compliance and auditing
    - Status change analytics
    - Action items and notifications
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        related_name='status_history',
        help_text="The form submission this history entry belongs to"
    )
    
    # Status transition
    from_status = models.CharField(
        max_length=20,
        choices=FormSubmissionStatus.choices,
        blank=True,
        default='',
        help_text="Previous status (empty if initial creation)"
    )
    to_status = models.CharField(
        max_length=20,
        choices=FormSubmissionStatus.choices,
        help_text="New status after this change"
    )
    
    # Change metadata
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='form_status_changes',
        help_text="User who made this status change"
    )
    comment = models.TextField(
        blank=True,
        default='',
        help_text="Optional reason or comment for the status change"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Form Status History"
        verbose_name_plural = "Form Status Histories"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['submission', '-created_at']),
            models.Index(fields=['to_status', 'created_at']),
            models.Index(fields=['changed_by', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.submission} - {self.from_status or 'new'} → {self.to_status}"


# =============================================================================
# STEP ASSIGNMENT (Wave 3: Forms & Flows Enhancement)
# =============================================================================

class AssignmentType(models.TextChoices):
    """Types of step assignments."""
    USER = 'user', 'Specific User'
    ROLE = 'role', 'Role-Based'
    TEAM = 'team', 'Team-Based'
    POOL = 'pool', 'Shared Pool'


class StepAssignment(models.Model):
    """
    Assigns users or roles to specific form steps.
    
    Enables workflow routing based on:
    - Direct user assignment
    - Role-based assignment (e.g., "Manager Approval")
    - Team-based assignment
    - Pool assignment (first available picks up)
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Step being assigned
    form = models.ForeignKey(
        TenantForm,
        on_delete=models.CASCADE,
        related_name='step_assignments',
        help_text="The form this assignment applies to"
    )
    step = models.ForeignKey(
        TenantFormEntity,
        on_delete=models.CASCADE,
        related_name='assignments',
        help_text="The step being assigned"
    )
    
    # Assignment type and target
    assignment_type = models.CharField(
        max_length=20,
        choices=AssignmentType.choices,
        default=AssignmentType.USER,
        help_text="Type of assignment"
    )
    
    # For USER type: specific user
    assigned_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='step_assignments',
        help_text="Specific user assigned (for USER type)"
    )
    
    # For ROLE/TEAM type: role or team name stored as string
    assigned_role = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Role name for role-based assignment (e.g., 'manager', 'approver')"
    )
    
    # Assignment rules
    is_required = models.BooleanField(
        default=True,
        help_text="Whether this step must be completed (vs. skippable)"
    )
    due_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Number of days allowed to complete this step (SLA)"
    )
    escalation_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalation_assignments',
        help_text="User to notify if step exceeds due date"
    )
    
    # Audit
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_step_assignments',
        help_text="User who created this assignment"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Step Assignment"
        verbose_name_plural = "Step Assignments"
        ordering = ['form', 'step__order']
        unique_together = [['form', 'step', 'assigned_user'], ['form', 'step', 'assigned_role']]
        indexes = [
            models.Index(fields=['assigned_user', 'assignment_type']),
            models.Index(fields=['assigned_role']),
        ]
    
    def __str__(self):
        if self.assignment_type == AssignmentType.USER and self.assigned_user:
            return f"{self.step.name} → {self.assigned_user.username}"
        elif self.assignment_type in [AssignmentType.ROLE, AssignmentType.TEAM]:
            return f"{self.step.name} → {self.assigned_role}"
        return f"{self.step.name} → {self.assignment_type}"


# =============================================================================
# USER NOTIFICATIONS (Wave 3: Forms & Flows Enhancement)
# =============================================================================

class NotificationType(models.TextChoices):
    """Types of notifications."""
    TASK_ASSIGNED = 'task_assigned', 'Task Assigned'
    TASK_DUE_SOON = 'task_due_soon', 'Task Due Soon'
    TASK_OVERDUE = 'task_overdue', 'Task Overdue'
    TASK_COMPLETED = 'task_completed', 'Task Completed'
    FORM_SUBMITTED = 'form_submitted', 'Form Submitted'
    FORM_APPROVED = 'form_approved', 'Form Approved'
    FORM_REJECTED = 'form_rejected', 'Form Rejected'
    MENTION = 'mention', 'Mentioned You'
    COMMENT = 'comment', 'New Comment'
    STATUS_CHANGE = 'status_change', 'Status Changed'
    WORKFLOW_TRIGGER = 'workflow_trigger', 'Workflow Triggered'
    SYSTEM = 'system', 'System Notification'


class NotificationPriority(models.TextChoices):
    """Priority levels for notifications."""
    LOW = 'low', 'Low'
    NORMAL = 'normal', 'Normal'
    HIGH = 'high', 'High'
    URGENT = 'urgent', 'Urgent'


class UserNotification(models.Model):
    """
    Stores in-app notifications for users.
    
    Used for:
    - Action item alerts (task assigned, due soon, overdue)
    - Form submission updates
    - Workflow triggers and status changes
    - System announcements
    
    Supports:
    - Read/unread tracking
    - Entity linking (click to navigate)
    - Priority levels
    - Expiration (auto-cleanup)
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="User to receive this notification"
    )
    
    # Notification content
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        help_text="Type of notification"
    )
    title = models.CharField(
        max_length=200,
        help_text="Notification title (short, e.g., 'New Task Assigned')"
    )
    message = models.TextField(
        help_text="Full notification message"
    )
    priority = models.CharField(
        max_length=20,
        choices=NotificationPriority.choices,
        default=NotificationPriority.NORMAL,
        help_text="Notification priority level"
    )
    
    # Entity reference (for navigation)
    entity_type = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Entity type for linking (e.g., 'form_submission', 'purchase_order')"
    )
    entity_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="UUID of the related entity"
    )
    action_url = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="URL to navigate to when notification is clicked"
    )
    
    # State tracking
    is_read = models.BooleanField(
        default=False,
        help_text="Whether the notification has been read"
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the notification was read"
    )
    is_dismissed = models.BooleanField(
        default=False,
        help_text="Whether the user dismissed this notification"
    )
    
    # Metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional notification data"
    )
    
    # Audit and lifecycle
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this notification should auto-expire (for cleanup)"
    )
    
    class Meta:
        verbose_name = "User Notification"
        verbose_name_plural = "User Notifications"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
            models.Index(fields=['user', 'notification_type', '-created_at']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username}: {self.title}"
    
    def mark_read(self):
        """Mark this notification as read."""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
    
    def dismiss(self):
        """Dismiss this notification."""
        self.is_dismissed = True
        self.save(update_fields=['is_dismissed'])


# =============================================================================
# USER NOTIFICATION PREFERENCES (Wave 3: Forms & Flows Enhancement)
# =============================================================================

class DeliveryChannel(models.TextChoices):
    """Notification delivery channels."""
    IN_APP = 'in_app', 'In-App'
    EMAIL = 'email', 'Email'
    SMS = 'sms', 'SMS'
    PUSH = 'push', 'Push Notification'


class UserNotificationPreferences(models.Model):
    """
    User's notification preferences.
    
    Controls which notification types the user wants to receive
    and through which channels (in-app, email, SMS, push).
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='notification_preferences',
        help_text="User for these preferences"
    )
    
    # Global settings
    notifications_enabled = models.BooleanField(
        default=True,
        help_text="Master switch to enable/disable all notifications"
    )
    email_enabled = models.BooleanField(
        default=True,
        help_text="Whether to send email notifications"
    )
    sms_enabled = models.BooleanField(
        default=False,
        help_text="Whether to send SMS notifications"
    )
    push_enabled = models.BooleanField(
        default=True,
        help_text="Whether to send push notifications"
    )
    
    # Per-type preferences (JSON maps NotificationType → list of DeliveryChannel)
    # Example: {"task_assigned": ["in_app", "email"], "mention": ["in_app"]}
    type_preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text="Per-type delivery preferences"
    )
    
    # Quiet hours (don't send notifications during these times)
    quiet_hours_enabled = models.BooleanField(
        default=False,
        help_text="Enable quiet hours (no notifications during specified times)"
    )
    quiet_hours_start = models.TimeField(
        null=True,
        blank=True,
        help_text="Start of quiet hours (e.g., 22:00)"
    )
    quiet_hours_end = models.TimeField(
        null=True,
        blank=True,
        help_text="End of quiet hours (e.g., 08:00)"
    )
    
    # Digest preferences
    daily_digest_enabled = models.BooleanField(
        default=False,
        help_text="Receive a daily digest email instead of individual notifications"
    )
    weekly_digest_enabled = models.BooleanField(
        default=False,
        help_text="Receive a weekly digest email"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Notification Preferences"
        verbose_name_plural = "User Notification Preferences"
    
    def __str__(self):
        return f"Notification Preferences for {self.user.username}"
    
    def should_notify(self, notification_type: str, channel: str) -> bool:
        """Check if this user should receive a notification via a specific channel."""
        if not self.notifications_enabled:
            return False
        
        # Check channel-level toggle
        if channel == DeliveryChannel.EMAIL and not self.email_enabled:
            return False
        if channel == DeliveryChannel.SMS and not self.sms_enabled:
            return False
        if channel == DeliveryChannel.PUSH and not self.push_enabled:
            return False
        
        # Check type-specific preferences
        type_prefs = self.type_preferences.get(notification_type, [])
        if type_prefs:
            return channel in type_prefs
        
        # Default: in-app only for unspecified types
        return channel == DeliveryChannel.IN_APP
    
    @classmethod
    def get_defaults(cls):
        """Return default notification preferences."""
        return {
            NotificationType.TASK_ASSIGNED: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
            NotificationType.TASK_DUE_SOON: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
            NotificationType.TASK_OVERDUE: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
            NotificationType.TASK_COMPLETED: [DeliveryChannel.IN_APP],
            NotificationType.FORM_SUBMITTED: [DeliveryChannel.IN_APP],
            NotificationType.FORM_APPROVED: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
            NotificationType.FORM_REJECTED: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
            NotificationType.MENTION: [DeliveryChannel.IN_APP],
            NotificationType.COMMENT: [DeliveryChannel.IN_APP],
            NotificationType.STATUS_CHANGE: [DeliveryChannel.IN_APP],
            NotificationType.WORKFLOW_TRIGGER: [DeliveryChannel.IN_APP],
            NotificationType.SYSTEM: [DeliveryChannel.IN_APP],
        }
