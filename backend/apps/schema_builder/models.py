"""
Schema Builder Models for Custom System Data.

Bundle One: Custom System Data - Django Admin Enhancements
Provides Data Schemas, Fields, and Versioning for Global System Admins.

Target Roles:
- Global System Admin (GSA): Can Draft and Submit
- Superuser/Superadmin: Can Draft, Submit, AND Publish

Target Tenant: System (Root) Tenant only
"""
import uuid
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone


class SchemaStatus(models.TextChoices):
    """Status workflow for Data Schemas."""
    DRAFT = 'draft', 'Draft'
    SUBMITTED = 'submitted', 'Submitted'
    PUBLISHED = 'published', 'Published'


class FieldType(models.TextChoices):
    """Supported field types for schema fields."""
    TEXT = 'text', 'Text'
    TEXTAREA = 'textarea', 'Text Area'
    NUMBER_INTEGER = 'integer', 'Number (Integer)'
    NUMBER_DECIMAL = 'decimal', 'Number (Decimal)'
    DROPDOWN = 'dropdown', 'Dropdown (Single Select)'
    MULTISELECT = 'multiselect', 'Multi-select'
    CURRENCY = 'currency', 'Currency'
    PHONE = 'phone', 'Phone Number'
    EMAIL = 'email', 'Email'
    DATE = 'date', 'Date'
    DATETIME = 'datetime', 'Date & Time'
    BOOLEAN = 'boolean', 'Yes/No (Boolean)'
    URL = 'url', 'URL'


class DataSchema(models.Model):
    """
    Data Schema model for defining custom data structures.
    
    Represents a collection of fields that define a data entity.
    Supports Draft → Submitted → Published workflow with versioning.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Basic information
    name = models.CharField(
        max_length=255,
        help_text="Human-readable name for the schema"
    )
    slug = models.SlugField(
        max_length=100,
        unique=True,
        help_text="URL-friendly identifier (auto-generated)"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Description of the schema's purpose"
    )
    
    # Status workflow
    status = models.CharField(
        max_length=20,
        choices=SchemaStatus.choices,
        default=SchemaStatus.DRAFT,
        help_text="Current status of the schema"
    )
    
    # Versioning
    version = models.PositiveIntegerField(
        default=1,
        help_text="Current version number"
    )
    
    # Visibility
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this schema is active and usable"
    )
    is_system = models.BooleanField(
        default=False,
        help_text="Whether this is a core system schema (cannot be deleted)"
    )
    
    # Icon/Display
    icon = models.CharField(
        max_length=50,
        blank=True,
        default='database',
        help_text="Icon identifier for UI display"
    )
    color = models.CharField(
        max_length=20,
        blank=True,
        default='blue',
        help_text="Color theme for UI display"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schemas_created',
        help_text="User who created this schema"
    )
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schemas_submitted',
        help_text="User who submitted this schema for review"
    )
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the schema was submitted"
    )
    published_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schemas_published',
        help_text="User who published this schema (superuser only)"
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the schema was published"
    )
    
    class Meta:
        verbose_name = "Data Schema"
        verbose_name_plural = "Data Schemas"
        ordering = ['name']
        permissions = [
            ("submit_dataschema", "Can submit schema for review"),
            ("publish_dataschema", "Can publish schema (superuser only)"),
            ("view_versions", "Can view schema version history"),
        ]
    
    def __str__(self):
        return f"{self.name} (v{self.version}) [{self.status}]"
    
    def save(self, *args, **kwargs):
        # Auto-generate slug from name if not provided
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    
    def submit(self, user):
        """Submit schema for review."""
        if self.status != SchemaStatus.DRAFT:
            raise ValueError("Only draft schemas can be submitted")
        self.status = SchemaStatus.SUBMITTED
        self.submitted_by = user
        self.submitted_at = timezone.now()
        self.save()
        # Create version snapshot
        self.create_version_snapshot(user, 'submitted')
    
    def publish(self, user):
        """
        Publish schema (superuser only).
        Once published, fields become globally accessible.
        """
        if not user.is_superuser:
            raise PermissionError("Only superusers can publish schemas")
        if self.status != SchemaStatus.SUBMITTED:
            raise ValueError("Only submitted schemas can be published")
        self.status = SchemaStatus.PUBLISHED
        self.published_by = user
        self.published_at = timezone.now()
        self.version += 1
        self.save()
        # Create version snapshot
        self.create_version_snapshot(user, 'published')
    
    def revert_to_draft(self, user):
        """Revert schema back to draft status."""
        if self.status == SchemaStatus.PUBLISHED:
            raise ValueError("Published schemas cannot be reverted to draft")
        self.status = SchemaStatus.DRAFT
        self.submitted_by = None
        self.submitted_at = None
        self.save()
        self.create_version_snapshot(user, 'reverted_to_draft')
    
    def create_version_snapshot(self, user, action):
        """Create a versioned snapshot of the current schema state."""
        fields_data = []
        for field in self.fields.all():
            fields_data.append({
                'key': field.key,
                'label': field.label,
                'field_type': field.field_type,
                'is_required': field.is_required,
                'is_visible': field.is_visible,
                'order': field.order,
                'options': field.options,
                'default_value': field.default_value,
                'help_text': field.help_text,
                'validation_rules': field.validation_rules,
            })
        
        DataSchemaVersion.objects.create(
            schema=self,
            version_number=self.version,
            action=action,
            snapshot_data={
                'name': self.name,
                'slug': self.slug,
                'description': self.description,
                'status': self.status,
                'fields': fields_data,
            },
            created_by=user
        )


class DataSchemaField(models.Model):
    """
    Field definition for a Data Schema.
    
    Represents a single field within a schema with type, validation, and display options.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Relationship
    schema = models.ForeignKey(
        DataSchema,
        on_delete=models.CASCADE,
        related_name='fields',
        help_text="Schema this field belongs to"
    )
    
    # Field identification
    key = models.CharField(
        max_length=100,
        help_text="Machine-readable field identifier (snake_case)"
    )
    label = models.CharField(
        max_length=255,
        help_text="Human-readable field label"
    )
    
    # Field type
    field_type = models.CharField(
        max_length=20,
        choices=FieldType.choices,
        default=FieldType.TEXT,
        help_text="Type of field"
    )
    
    # Display settings
    is_visible = models.BooleanField(
        default=True,
        help_text="Whether this field is visible in forms and lists"
    )
    is_required = models.BooleanField(
        default=False,
        help_text="Whether this field is required"
    )
    is_searchable = models.BooleanField(
        default=True,
        help_text="Whether this field is searchable"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order of the field"
    )
    
    # Options for dropdown/multiselect
    options = models.JSONField(
        default=list,
        blank=True,
        help_text="Options for dropdown/multiselect fields (list of {value, label})"
    )
    
    # Default value
    default_value = models.JSONField(
        null=True,
        blank=True,
        help_text="Default value for the field"
    )
    
    # Help text and placeholder
    help_text = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Help text shown below the field"
    )
    placeholder = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Placeholder text shown in empty fields"
    )
    
    # Validation rules (JSON format)
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Validation rules (min, max, pattern, etc.)"
    )
    
    # Number-specific settings
    decimal_places = models.PositiveSmallIntegerField(
        default=2,
        help_text="Decimal places for decimal/currency fields"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Schema Field"
        verbose_name_plural = "Schema Fields"
        ordering = ['schema', 'order', 'label']
        unique_together = [['schema', 'key']]
    
    def __str__(self):
        visibility = "👁" if self.is_visible else "🚫"
        return f"{visibility} {self.label} ({self.field_type})"
    
    def save(self, *args, **kwargs):
        # Auto-generate key from label if not provided
        if not self.key:
            from django.utils.text import slugify
            self.key = slugify(self.label).replace('-', '_')
        super().save(*args, **kwargs)


class DataSchemaVersion(models.Model):
    """
    Version history for Data Schemas.
    
    Stores snapshots of schema state at each significant change.
    Provides full revision history for auditing and rollback.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Relationship
    schema = models.ForeignKey(
        DataSchema,
        on_delete=models.CASCADE,
        related_name='versions',
        help_text="Schema this version belongs to"
    )
    
    # Version info
    version_number = models.PositiveIntegerField(
        help_text="Version number at time of snapshot"
    )
    
    # Action that triggered this version
    action = models.CharField(
        max_length=50,
        help_text="Action that created this version (created, updated, submitted, published, etc.)"
    )
    
    # Snapshot of schema state
    snapshot_data = models.JSONField(
        help_text="Complete snapshot of schema and fields at this version"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who created this version"
    )
    
    # Change notes
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Optional notes about this version"
    )
    
    class Meta:
        verbose_name = "Schema Version"
        verbose_name_plural = "Schema Versions"
        ordering = ['-created_at']
        unique_together = [['schema', 'version_number', 'action']]
    
    def __str__(self):
        return f"{self.schema.name} v{self.version_number} ({self.action})"


class FieldOptionList(models.Model):
    """
    Reusable option list for dropdown/multiselect fields.
    
    System-level field definitions that can be shared across schemas.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(
        max_length=255,
        unique=True,
        help_text="Name of the option list"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Description of the option list"
    )
    
    # Options stored as JSON array of {value, label} objects
    options = models.JSONField(
        default=list,
        help_text="List of options [{value: 'v1', label: 'Label 1'}, ...]"
    )
    
    # Whether this is a system list (cannot be deleted)
    is_system = models.BooleanField(
        default=False,
        help_text="Whether this is a core system list"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who created this list"
    )
    
    class Meta:
        verbose_name = "Field Option List"
        verbose_name_plural = "Field Option Lists"
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({len(self.options)} options)"


class TenantFieldChoiceOverride(models.Model):
    """
    Tenant-level override for entity field choices.
    
    Allows tenants to customize the options available for select/multi-select
    fields on standard entities (Customer, Product, etc.).
    
    Hierarchy:
    - Root level (tenant=None): System defaults, apply to all tenants
    - Tenant level (tenant=X): Override for specific tenant
    
    When fetching choices, system merges:
    1. Django model's original choices
    2. Root-level overrides (if any)
    3. Tenant-level overrides (if any, based on mode)
    """
    
    class OverrideMode(models.TextChoices):
        REPLACE = 'replace', 'Replace All'  # Completely replace default options
        APPEND = 'append', 'Append to Defaults'  # Add to existing options
        PREPEND = 'prepend', 'Prepend to Defaults'  # Add before existing options
        FILTER = 'filter', 'Filter Defaults'  # Show only specified subset
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Scoping - null tenant means root/system level
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='field_choice_overrides',
        help_text="Tenant this override belongs to (null for root/system level)"
    )
    
    # Target entity and field
    entity_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Entity type (e.g., 'customer', 'product')"
    )
    field_name = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Field name (e.g., 'protein_type', 'edible_inedible')"
    )
    
    # Override configuration
    mode = models.CharField(
        max_length=20,
        choices=OverrideMode.choices,
        default=OverrideMode.REPLACE,
        help_text="How to apply this override"
    )
    
    # Options stored as JSON array of {value, label} objects
    options = models.JSONField(
        default=list,
        help_text="List of options [{value: 'v1', label: 'Label 1'}, ...]"
    )
    
    # Optional: link to a reusable FieldOptionList
    option_list = models.ForeignKey(
        FieldOptionList,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='field_overrides',
        help_text="Use options from a reusable list instead of inline options"
    )
    
    # Settings
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this override is active"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='field_choice_overrides_created',
        help_text="User who created this override"
    )
    
    class Meta:
        verbose_name = "Field Choice Override"
        verbose_name_plural = "Field Choice Overrides"
        ordering = ['entity_type', 'field_name', 'tenant']
        # Unique per tenant+entity+field combination
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'entity_type', 'field_name'],
                name='unique_tenant_entity_field_override'
            )
        ]
        indexes = [
            models.Index(fields=['entity_type', 'field_name']),
            models.Index(fields=['tenant', 'is_active']),
        ]
    
    def __str__(self):
        scope = self.tenant.name if self.tenant else "Root/System"
        return f"{self.entity_type}.{self.field_name} ({scope})"
    
    def get_effective_options(self):
        """Get options, preferring option_list if linked."""
        if self.option_list:
            return self.option_list.options
        return self.options
    
    @classmethod
    def get_effective_choices(cls, entity_type, field_name, tenant=None, default_choices=None):
        """
        Get the effective choices for an entity field, applying overrides.
        
        Resolution order:
        1. Start with default_choices (from Django model)
        2. Apply root-level override (tenant=None) if exists
        3. Apply tenant-level override if exists
        
        Returns list of {value, label} dicts.
        """
        # Start with defaults
        if default_choices:
            choices = [{'value': c[0], 'label': c[1]} for c in default_choices]
        else:
            choices = []
        
        # Find applicable overrides
        overrides = cls.objects.filter(
            entity_type=entity_type,
            field_name=field_name,
            is_active=True
        ).filter(
            models.Q(tenant__isnull=True) | models.Q(tenant=tenant)
        ).order_by('tenant')  # root first, then tenant
        
        for override in overrides:
            override_options = override.get_effective_options()
            
            if override.mode == cls.OverrideMode.REPLACE:
                choices = override_options
            elif override.mode == cls.OverrideMode.APPEND:
                # Add options that don't already exist
                existing_values = {c['value'] for c in choices}
                for opt in override_options:
                    if opt['value'] not in existing_values:
                        choices.append(opt)
            elif override.mode == cls.OverrideMode.PREPEND:
                # Add options before existing
                existing_values = {c['value'] for c in choices}
                new_choices = []
                for opt in override_options:
                    if opt['value'] not in existing_values:
                        new_choices.append(opt)
                choices = new_choices + choices
            elif override.mode == cls.OverrideMode.FILTER:
                # Keep only specified options
                allowed_values = {opt['value'] for opt in override_options}
                choices = [c for c in choices if c['value'] in allowed_values]
        
        return choices


class ChoiceOverrideAuditLog(models.Model):
    """
    Audit log for tracking changes to TenantFieldChoiceOverride.
    
    Records all create, update, and delete operations on choice overrides
    for compliance and debugging purposes.
    """
    
    class ActionType(models.TextChoices):
        CREATE = 'create', 'Created'
        UPDATE = 'update', 'Updated'
        DELETE = 'delete', 'Deleted'
        ACTIVATE = 'activate', 'Activated'
        DEACTIVATE = 'deactivate', 'Deactivated'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Reference to the override (nullable for deletes)
    override = models.ForeignKey(
        TenantFieldChoiceOverride,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text="The override that was modified"
    )
    
    # Denormalized fields for when override is deleted
    tenant_id = models.UUIDField(null=True, blank=True)
    tenant_name = models.CharField(max_length=255, blank=True, default='')
    entity_type = models.CharField(max_length=100)
    field_name = models.CharField(max_length=100)
    
    # Action details
    action = models.CharField(
        max_length=20,
        choices=ActionType.choices,
        help_text="Type of action performed"
    )
    
    # Snapshot of data before and after change
    previous_state = models.JSONField(
        default=dict,
        help_text="State before the change (empty for creates)"
    )
    new_state = models.JSONField(
        default=dict,
        help_text="State after the change (empty for deletes)"
    )
    
    # What specifically changed
    changes = models.JSONField(
        default=list,
        help_text="List of specific field changes: [{field, old, new}]"
    )
    
    # Audit metadata
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='choice_override_audit_logs',
        help_text="User who performed the action"
    )
    performed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    
    class Meta:
        verbose_name = "Choice Override Audit Log"
        verbose_name_plural = "Choice Override Audit Logs"
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['override']),
            models.Index(fields=['entity_type', 'field_name']),
            models.Index(fields=['performed_at']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.action} {self.entity_type}.{self.field_name} by {self.performed_by} at {self.performed_at}"
    
    @classmethod
    def log_create(cls, override, user, request=None):
        """Log creation of a new override."""
        return cls.objects.create(
            override=override,
            tenant_id=override.tenant_id if override.tenant else None,
            tenant_name=override.tenant.name if override.tenant else '',
            entity_type=override.entity_type,
            field_name=override.field_name,
            action=cls.ActionType.CREATE,
            previous_state={},
            new_state=cls._serialize_override(override),
            changes=[],
            performed_by=user,
            ip_address=cls._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )
    
    @classmethod
    def log_update(cls, override, old_data, user, request=None):
        """Log update to an existing override."""
        new_data = cls._serialize_override(override)
        changes = cls._compute_changes(old_data, new_data)
        
        return cls.objects.create(
            override=override,
            tenant_id=override.tenant_id if override.tenant else None,
            tenant_name=override.tenant.name if override.tenant else '',
            entity_type=override.entity_type,
            field_name=override.field_name,
            action=cls.ActionType.UPDATE,
            previous_state=old_data,
            new_state=new_data,
            changes=changes,
            performed_by=user,
            ip_address=cls._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )
    
    @classmethod
    def log_delete(cls, override, user, request=None):
        """Log deletion of an override."""
        return cls.objects.create(
            override=None,  # Will be deleted
            tenant_id=override.tenant_id if override.tenant else None,
            tenant_name=override.tenant.name if override.tenant else '',
            entity_type=override.entity_type,
            field_name=override.field_name,
            action=cls.ActionType.DELETE,
            previous_state=cls._serialize_override(override),
            new_state={},
            changes=[],
            performed_by=user,
            ip_address=cls._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )
    
    @classmethod
    def log_status_change(cls, override, activated, user, request=None):
        """Log activation/deactivation of an override."""
        action = cls.ActionType.ACTIVATE if activated else cls.ActionType.DEACTIVATE
        return cls.objects.create(
            override=override,
            tenant_id=override.tenant_id if override.tenant else None,
            tenant_name=override.tenant.name if override.tenant else '',
            entity_type=override.entity_type,
            field_name=override.field_name,
            action=action,
            previous_state={'is_active': not activated},
            new_state={'is_active': activated},
            changes=[{'field': 'is_active', 'old': not activated, 'new': activated}],
            performed_by=user,
            ip_address=cls._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )
    
    @staticmethod
    def _serialize_override(override):
        """Serialize override to dict for storage."""
        return {
            'id': str(override.id),
            'tenant_id': str(override.tenant_id) if override.tenant else None,
            'entity_type': override.entity_type,
            'field_name': override.field_name,
            'mode': override.mode,
            'options': override.options,
            'option_list_id': str(override.option_list_id) if override.option_list else None,
            'is_active': override.is_active,
        }
    
    @staticmethod
    def _compute_changes(old_data, new_data):
        """Compute list of field changes between old and new state."""
        changes = []
        all_keys = set(old_data.keys()) | set(new_data.keys())
        
        for key in all_keys:
            old_val = old_data.get(key)
            new_val = new_data.get(key)
            if old_val != new_val:
                changes.append({
                    'field': key,
                    'old': old_val,
                    'new': new_val
                })
        
        return changes
    
    @staticmethod
    def _get_client_ip(request):
        """Extract client IP from request."""
        if not request:
            return None
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class DynamicEntity(models.Model):
    """
    Dynamic Entity model for storing custom data.
    
    Uses a single table with a JSONB field to store custom data,
    driven by the Schema Metadata. This is the metadata-driven architecture
    that avoids generating hard database migrations for every user change.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to the schema that defines this entity's structure
    schema = models.ForeignKey(
        DataSchema,
        on_delete=models.PROTECT,
        related_name='entities',
        help_text="Schema that defines this entity's structure"
    )
    
    # The actual custom data stored as JSONB
    data = models.JSONField(
        default=dict,
        help_text="Custom field data stored as JSON, validated against schema"
    )
    
    # Tenant isolation (for tenant-specific entities)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='dynamic_entities',
        help_text="Tenant this entity belongs to (null for system entities)"
    )
    
    # Searchable fields cache (denormalized for performance)
    search_text = models.TextField(
        blank=True,
        default='',
        help_text="Concatenated searchable field values for full-text search"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dynamic_entities_created'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dynamic_entities_updated'
    )
    
    class Meta:
        verbose_name = "Dynamic Entity"
        verbose_name_plural = "Dynamic Entities"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['schema', 'tenant']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        # Try to get a display name from data
        name = self.data.get('name') or self.data.get('title') or str(self.id)[:8]
        return f"{self.schema.name}: {name}"
    
    def save(self, *args, **kwargs):
        # Build search text from searchable fields
        self._build_search_text()
        super().save(*args, **kwargs)
    
    def _build_search_text(self):
        """Build search text from searchable fields in the schema."""
        search_parts = []
        
        for field in self.schema.fields.filter(is_searchable=True):
            value = self.data.get(field.key)
            if value:
                if isinstance(value, list):
                    search_parts.extend(str(v) for v in value)
                else:
                    search_parts.append(str(value))
        
        self.search_text = ' '.join(search_parts)
    
    def validate_data(self):
        """
        Validate data against schema field definitions.
        
        Returns a dict of {field_key: [errors]} for any validation failures.
        """
        errors = {}
        
        for field in self.schema.fields.all():
            value = self.data.get(field.key)
            field_errors = []
            
            # Required check
            if field.is_required and (value is None or value == ''):
                field_errors.append(f"{field.label} is required")
            
            # Type validation
            if value is not None and value != '':
                if field.field_type == 'integer':
                    try:
                        int(value)
                    except (ValueError, TypeError):
                        field_errors.append(f"{field.label} must be an integer")
                
                elif field.field_type == 'decimal':
                    try:
                        float(value)
                    except (ValueError, TypeError):
                        field_errors.append(f"{field.label} must be a number")
                
                elif field.field_type in ['dropdown', 'multiselect']:
                    valid_values = [opt.get('value') for opt in field.options]
                    if field.field_type == 'multiselect':
                        if isinstance(value, list):
                            for v in value:
                                if v not in valid_values:
                                    field_errors.append(f"Invalid option: {v}")
                        else:
                            field_errors.append(f"{field.label} must be a list")
                    else:
                        if value not in valid_values:
                            field_errors.append(f"Invalid option: {value}")
            
            if field_errors:
                errors[field.key] = field_errors
        
        return errors
    
    def get_field_value(self, key):
        """Get a field value with type coercion based on schema."""
        return self.data.get(key)
    
    def set_field_value(self, key, value):
        """Set a field value."""
        self.data[key] = value
