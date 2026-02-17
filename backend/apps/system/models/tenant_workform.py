"""
TenantWorkForm model for WorkForms Enhancement Project.

Stores complete workflow definitions including nodes, edges, and form references.
WorkForms represent the entire workflow canvas state and can reference multiple TenantForms.

Phase 1.6 of WF-ENH-2026-Q1
Created: 2026-02-06
"""
import uuid
from django.db import models
from django.conf import settings
from django.contrib.postgres.fields import ArrayField


class WorkFormStatusChoices(models.TextChoices):
    """WorkForm status classification."""
    DRAFT = 'draft', 'Draft'
    ACTIVE = 'active', 'Active'
    ARCHIVED = 'archived', 'Archived'


class TenantWorkForm(models.Model):
    """
    Tenant-specific workflow definition.
    
    WorkForms represent complete workflow canvas states including:
    - All 42 node types (triggers, forms, actions, conditions, etc.)
    - Node connections (edges)
    - References to TenantForms (for Form Step nodes)
    - Container configurations (Form Multi-Step Container)
    
    WorkForms are saved when users click "Save Flow" in the WorkForms editor.
    They can be cloned, versioned, and validated for broken references.
    
    Usage:
    - Created when user saves a workflow in UnifiedFlowEditor
    - Can reference multiple TenantForms via formReferences
    - Supports versioning for workflow history
    - Can be cloned for template creation
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Tenant isolation
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='workforms',
        db_index=True,
        help_text="Tenant that owns this workflow"
    )
    
    # WorkForm metadata
    name = models.CharField(
        max_length=255,
        help_text="Workflow name/title"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional workflow description"
    )
    status = models.CharField(
        max_length=20,
        choices=WorkFormStatusChoices.choices,
        default=WorkFormStatusChoices.DRAFT,
        db_index=True,
        help_text="Workflow status: draft, active, or archived"
    )
    
    # Workflow definition (JSON - React Flow format)
    # Structure:
    # {
    #   "nodes": [
    #     {
    #       "id": "node-1",
    #       "type": "formStep",
    #       "position": {"x": 100, "y": 100},
    #       "data": {
    #         "label": "Supplier Form",
    #         "tenantFormId": "uuid-123",  // Reference to TenantForm
    #         "config": {...}
    #       }
    #     },
    #     {
    #       "id": "node-2",
    #       "type": "actionEmail",
    #       "position": {"x": 300, "y": 100},
    #       "data": {...}
    #     }
    #   ],
    #   "edges": [
    #     {
    #       "id": "edge-1",
    #       "source": "node-1",
    #       "target": "node-2"
    #     }
    #   ],
    #   "viewport": {
    #     "x": 0,
    #     "y": 0,
    #     "zoom": 1
    #   }
    # }
    workflow_definition = models.JSONField(
        default=dict,
        help_text="Complete React Flow canvas state (nodes + edges)"
    )
    
    # Form references (extracted from nodes for quick lookups)
    # Array of TenantForm UUIDs that are referenced in this workflow
    # Updated automatically when workflow is saved
    form_references = ArrayField(
        models.UUIDField(),
        default=list,
        blank=True,
        help_text="List of TenantForm IDs referenced in this workflow"
    )
    
    # Versioning
    version = models.IntegerField(
        default=1,
        help_text="Workflow version number (auto-incremented on update)"
    )
    parent_version = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_versions',
        help_text="Previous version of this workflow (for version history)"
    )
    
    # Execution tracking
    execution_count = models.IntegerField(
        default=0,
        help_text="Number of times this workflow has been executed"
    )
    last_executed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this workflow was last executed"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_workforms',
        help_text="User who created this workflow"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_workforms',
        help_text="User who last updated this workflow"
    )
    
    # Cloning tracking
    cloned_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clones',
        help_text="Original workflow if this is a clone"
    )
    clone_count = models.IntegerField(
        default=0,
        help_text="Number of times this workflow has been cloned"
    )
    
    class Meta:
        db_table = 'tenant_workforms'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', 'name']),
            models.Index(fields=['created_at']),
            models.Index(fields=['last_executed_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'name', 'version'],
                name='unique_tenant_workform_name_version'
            )
        ]
    
    def __str__(self):
        return f"{self.name} (v{self.version}) - {self.tenant.name}"
    
    def extract_form_references(self):
        """
        Extract TenantForm IDs from workflow nodes.
        
        Scans all nodes in workflow_definition and collects tenantFormId
        references from Form Step nodes and Form Multi-Step Containers.
        
        Returns:
            list: List of UUID strings
        """
        form_ids = set()
        nodes = self.workflow_definition.get('nodes', [])
        
        for node in nodes:
            node_data = node.get('data', {})
            
            # Form Step node
            if node.get('type') == 'formStep' and node_data.get('tenantFormId'):
                form_ids.add(node_data['tenantFormId'])
            
            # Form Multi-Step Container (if implemented)
            if node.get('type') == 'formMultiStepContainer' and node_data.get('tenantFormId'):
                form_ids.add(node_data['tenantFormId'])
            
            # Form Reference node
            if node.get('type') == 'formReference' and node_data.get('tenantFormId'):
                form_ids.add(node_data['tenantFormId'])
        
        return list(form_ids)
    
    def update_form_references(self):
        """Update form_references field from workflow_definition."""
        self.form_references = self.extract_form_references()
        self.save(update_fields=['form_references'])
    
    def validate_form_references(self):
        """
        Validate that all form references exist.
        
        Returns:
            dict: {
                "valid": bool,
                "missing_forms": list of UUID strings,
                "total_references": int
            }
        """
        from apps.system.models import TenantForm
        
        form_ids = self.extract_form_references()
        existing_forms = TenantForm.objects.filter(
            tenant=self.tenant,
            id__in=form_ids
        ).values_list('id', flat=True)
        
        missing_forms = [fid for fid in form_ids if fid not in existing_forms]
        
        return {
            "valid": len(missing_forms) == 0,
            "missing_forms": missing_forms,
            "total_references": len(form_ids)
        }
    
    def get_node_count(self):
        """Get total number of nodes in this workflow."""
        return len(self.workflow_definition.get('nodes', []))
    
    def get_edge_count(self):
        """Get total number of edges in this workflow."""
        return len(self.workflow_definition.get('edges', []))
    
    def get_node_types_summary(self):
        """
        Get summary of node types used in this workflow.
        
        Returns:
            dict: {"formStep": 3, "actionEmail": 1, "conditionIf": 2, ...}
        """
        summary = {}
        for node in self.workflow_definition.get('nodes', []):
            node_type = node.get('type', 'unknown')
            summary[node_type] = summary.get(node_type, 0) + 1
        return summary
    
    def increment_execution_count(self):
        """Increment execution count and update last_executed_at."""
        from django.utils import timezone
        self.execution_count += 1
        self.last_executed_at = timezone.now()
        self.save(update_fields=['execution_count', 'last_executed_at'])
    
    def increment_clone_count(self):
        """Increment clone count when this workflow is cloned."""
        self.clone_count += 1
        self.save(update_fields=['clone_count'])
    
    def get_container_nodes(self):
        """
        Get all container nodes in this workflow.
        
        Returns:
            list: List of container node objects
        """
        nodes = self.workflow_definition.get('nodes', [])
        return [node for node in nodes if node.get('type') == 'formMultiStepContainer']
    
    def get_nodes_in_container(self, container_id):
        """
        Get all nodes that belong to a specific container.
        
        Args:
            container_id (str): ID of the container node
            
        Returns:
            list: List of node objects that have containerNodeId == container_id
        """
        nodes = self.workflow_definition.get('nodes', [])
        return [
            node for node in nodes 
            if node.get('data', {}).get('containerNodeId') == container_id
        ]
    
    def get_container_summary(self, container_id):
        """
        Get summary of nodes within a container.
        
        Args:
            container_id (str): ID of the container node
            
        Returns:
            dict: {
                "container_name": str,
                "total_nodes": int,
                "node_types": {"formStep": 2, "actionEmail": 1, ...},
                "form_references": [uuid1, uuid2, ...]
            }
        """
        container_nodes = self.get_nodes_in_container(container_id)
        container_node = next(
            (n for n in self.workflow_definition.get('nodes', []) if n.get('id') == container_id),
            None
        )
        
        # Count node types
        node_types = {}
        form_refs = set()
        for node in container_nodes:
            node_type = node.get('type', 'unknown')
            node_types[node_type] = node_types.get(node_type, 0) + 1
            
            # Extract form references
            node_data = node.get('data', {})
            if node_type in ['formStep', 'formReference'] and node_data.get('tenantFormId'):
                form_refs.add(node_data['tenantFormId'])
        
        return {
            "container_name": container_node.get('data', {}).get('label', 'Unnamed Container') if container_node else 'Unknown',
            "total_nodes": len(container_nodes),
            "node_types": node_types,
            "form_references": list(form_refs)
        }
    
    def update_node_container(self, node_id, container_id=None):
        """
        Update a node's containerNodeId field.
        
        Args:
            node_id (str): ID of the node to update
            container_id (str|None): ID of container to assign (None to remove from container)
            
        Returns:
            bool: True if node was found and updated, False otherwise
        """
        nodes = self.workflow_definition.get('nodes', [])
        
        for node in nodes:
            if node.get('id') == node_id:
                if container_id:
                    node.setdefault('data', {})['containerNodeId'] = container_id
                else:
                    # Remove containerNodeId
                    node.get('data', {}).pop('containerNodeId', None)
                return True
        
        return False
