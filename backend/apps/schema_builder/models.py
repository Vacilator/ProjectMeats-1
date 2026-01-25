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
