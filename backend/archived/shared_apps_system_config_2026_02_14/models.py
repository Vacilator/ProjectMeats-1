"""
System Configuration models for ProjectMeats.

Defines the Meta-Models for the System Blueprint Engine.

Architecture:
- EntityBlueprint & BlueprintVersion: Global (standard models.Model)
- WorkflowRun: Tenant-specific (inherits TenantAwareModel)
"""
import uuid
from django.db import models
from apps.core.models import TenantAwareModel


class EntityBlueprint(models.Model):
    """
    Global Blueprint definition (not tenant-specific).
    
    Represents a reusable entity template (e.g., "Customer", "Sales Order")
    that can be versioned and customized per tenant via custom_data.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the blueprint"
    )
    slug = models.SlugField(
        unique=True,
        max_length=100,
        help_text="URL-safe identifier (e.g., 'customer', 'sales-order')"
    )
    name = models.CharField(
        max_length=255,
        help_text="Human-readable name (e.g., 'Customer Blueprint')"
    )
    published_version = models.OneToOneField(
        'BlueprintVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_for_blueprint',
        help_text="Currently active version for this blueprint"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['slug']
        verbose_name = "Entity Blueprint"
        verbose_name_plural = "Entity Blueprints"
    
    def __str__(self):
        return f"{self.name} ({self.slug})"


class BlueprintVersion(models.Model):
    """
    Versioned configuration for a Blueprint (global, not tenant-specific).
    
    Stores the schema, workflow UI, and execution logic for a specific
    version of an EntityBlueprint.
    """
    
    class StatusChoices(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PUBLISHED = 'PUBLISHED', 'Published'
        ARCHIVED = 'ARCHIVED', 'Archived'
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the version"
    )
    blueprint = models.ForeignKey(
        EntityBlueprint,
        on_delete=models.CASCADE,
        related_name='versions',
        help_text="The blueprint this version belongs to"
    )
    version = models.PositiveIntegerField(
        help_text="Version number (1, 2, 3, etc.)"
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.DRAFT,
        help_text="Version status"
    )
    schema_config = models.JSONField(
        default=list,
        blank=True,
        help_text="List of field definitions for dynamic schema"
    )
    workflow_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="React Flow UI state (nodes, edges, positions)"
    )
    logic_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Execution logic and mappings for workflow steps"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-version']
        unique_together = [['blueprint', 'version']]
        verbose_name = "Blueprint Version"
        verbose_name_plural = "Blueprint Versions"
    
    def __str__(self):
        return f"{self.blueprint.slug} v{self.version} ({self.status})"


class WorkflowRun(TenantAwareModel):
    """
    Tenant-specific workflow execution state.
    
    Inherits from TenantAwareModel to get:
    - tenant (ForeignKey)
    - custom_data (JSONField)
    - created_on, modified_on (timestamps)
    - TenantManager
    """
    
    class StatusChoices(models.TextChoices):
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'
    
    workflow_slug = models.CharField(
        max_length=100,
        help_text="Reference to EntityBlueprint.slug"
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.IN_PROGRESS,
        help_text="Current workflow execution status"
    )
    current_step_index = models.IntegerField(
        default=0,
        help_text="Index of current step in workflow"
    )
    data_context = models.JSONField(
        default=dict,
        blank=True,
        help_text="Secure clipboard for workflow data (step inputs/outputs)"
    )
    
    class Meta:
        ordering = ['-created_on']
        indexes = [
            models.Index(fields=['tenant', 'workflow_slug']),
            models.Index(fields=['tenant', 'status']),
        ]
        verbose_name = "Workflow Run"
        verbose_name_plural = "Workflow Runs"
    
    def __str__(self):
        return f"{self.workflow_slug} - {self.status} (Tenant: {self.tenant_id})"

