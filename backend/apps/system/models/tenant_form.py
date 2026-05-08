"""
TenantForm model for WorkForms Enhancement Project.

Stores form definitions (entity + fields) that can be used in workflows.
Forms can be single-step or multi-step, and are tenant-isolated.

Phase 1.4 of WF-ENH-2026-Q1
Created: 2026-02-06
"""
import uuid

from django.conf import settings
from django.db import models


class FormTypeChoices(models.TextChoices):
    """Form type classification."""

    SINGLE_STEP = "single_step", "Single Step"
    MULTI_STEP = "multi_step", "Multi-Step"


class TenantForm(models.Model):
    """
    Tenant-specific form definition.

    Forms define entity-based data collection structures that can be used
    in WorkForm workflows. Each form is associated with an entity type
    (Supplier, Customer, Product, etc.) and contains field definitions.

    Forms can be:
    - Single-step: One form step with fields
    - Multi-step: Multiple form steps in sequence

    Usage:
    - Created when Form Step nodes are saved in WorkForms editor
    - Referenced by TenantWorkForm via formReferences field
    - Can be merged (multiple single-steps → one multi-step)
    - Can be split (multi-step → multiple single-steps)
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Tenant isolation
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="forms",
        db_index=True,
        help_text="Tenant that owns this form",
    )

    # Form metadata
    name = models.CharField(max_length=255, help_text="Form name/title")
    description = models.TextField(blank=True, help_text="Optional form description")
    type = models.CharField(
        max_length=20,
        choices=FormTypeChoices.choices,
        default=FormTypeChoices.SINGLE_STEP,
        db_index=True,
        help_text="Form type: single-step or multi-step",
    )

    # Form definition (JSON)
    # Structure for single-step:
    # {
    #   "entity_type": "supplier",
    #   "fields": [
    #     {
    #       "name": "name",
    #       "label": "Supplier Name",
    #       "type": "text",
    #       "required": true,
    #       "validation": {...}
    #     }
    #   ]
    # }
    #
    # Structure for multi-step:
    # {
    #   "steps": [
    #     {
    #       "name": "Step 1: Basic Info",
    #       "entity_type": "supplier",
    #       "fields": [...]
    #     },
    #     {
    #       "name": "Step 2: Contact Details",
    #       "entity_type": "supplier",
    #       "fields": [...]
    #     }
    #   ],
    #   "navigation": {
    #     "show_progress": true,
    #     "allow_back": true
    #   }
    # }
    form_definition = models.JSONField(default=dict, help_text="Form structure: entity type, fields, validation")

    # Versioning
    version = models.IntegerField(default=1, help_text="Form version number (auto-incremented on update)")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_forms",
        help_text="User who created this form",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="updated_forms",
        help_text="User who last updated this form",
    )

    # Usage tracking
    usage_count = models.IntegerField(default=0, help_text="Number of times this form is referenced by workflows")

    # Phase 1: Container versioning fields
    source_node_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text="Original container node ID from React Flow (for versioning)",
    )
    definition_hash = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        db_index=True,
        help_text="SHA256 hash of form_definition for deduplication",
    )
    is_template = models.BooleanField(
        default=False, db_index=True, help_text="Whether this form is a reusable template"
    )

    # WorkForm extraction metadata (Phase 7: Dual references)
    is_workform = models.BooleanField(
        default=False, db_index=True, help_text="If true, this TenantForm was generated from a TenantWorkForm save"
    )
    parent_workform = models.ForeignKey(
        "system.TenantWorkForm",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="extracted_forms",
        help_text="The TenantWorkForm that generated this form (optional)",
    )

    class Meta:
        db_table = "tenant_forms"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["tenant", "type"]),
            models.Index(fields=["tenant", "name"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["tenant", "source_node_id", "version"]),
            models.Index(fields=["definition_hash"]),
            models.Index(fields=["is_template"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "name", "version"], name="unique_tenant_form_name_version")
        ]

    def __str__(self):
        return f"{self.name} (v{self.version}) - {self.tenant.name}"

    def increment_usage(self):
        """Increment usage count when referenced by a workflow."""
        self.usage_count += 1
        self.save(update_fields=["usage_count"])

    def decrement_usage(self):
        """Decrement usage count when a workflow reference is removed."""
        if self.usage_count > 0:
            self.usage_count -= 1
            self.save(update_fields=["usage_count"])

    def get_entity_type(self):
        """Extract entity type from form definition."""
        if self.type == FormTypeChoices.SINGLE_STEP:
            return self.form_definition.get("entity_type")
        elif self.type == FormTypeChoices.MULTI_STEP:
            steps = self.form_definition.get("steps", [])
            if steps:
                return steps[0].get("entity_type")
        return None

    def get_field_count(self):
        """Calculate total number of fields in the form."""
        if self.type == FormTypeChoices.SINGLE_STEP:
            return len(self.form_definition.get("fields", []))
        elif self.type == FormTypeChoices.MULTI_STEP:
            total = 0
            for step in self.form_definition.get("steps", []):
                total += len(step.get("fields", []))
            return total
        return 0

    def get_step_count(self):
        """Get number of steps (1 for single-step, N for multi-step)."""
        if self.type == FormTypeChoices.SINGLE_STEP:
            return 1
        elif self.type == FormTypeChoices.MULTI_STEP:
            return len(self.form_definition.get("steps", []))
        return 0
