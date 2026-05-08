"""
FormProcessGroup Persistence Service.

Maps FormProcessGroup nodes from the visual workflow editor to TenantForm
database records. Handles the synchronization of the React Flow graph with
the persistent form structure.

Architecture:
- FormProcessGroup nodes → TenantForm records
- Child FormStep nodes → TenantFormEntity records
- FormStep fields → TenantFormField records
- Increments version when form structure changes
- Preserves existing submissions while allowing structure evolution

Created: 2026-02-25 (Agent B: FormProcessGroup Persistence)
"""

import logging
from typing import Any, Dict, List, Optional

from django.contrib.auth.models import User
from django.db import transaction

from tenant_apps.workflows.models import TenantForm, TenantFormEntity, TenantFormField

from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


class FormProcessPersistenceService:
    """
    Service for syncing FormProcessGroup nodes to TenantForm records.

    Usage:
        service = FormProcessPersistenceService(tenant, user)
        result = service.sync_from_workflow(workflow_data)
    """

    def __init__(self, tenant: Tenant, user: Optional[User] = None):
        """
        Initialize the service.

        Args:
            tenant: The tenant context
            user: Optional user for created_by tracking
        """
        self.tenant = tenant
        self.user = user
        self.errors: List[str] = []

    def extract_form_process_groups(self, flow_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract all FormProcessGroup nodes from React Flow data.

        Args:
            flow_data: React Flow graph with nodes and edges

        Returns:
            List of FormProcessGroup node data dicts
        """
        nodes = flow_data.get("nodes", [])
        form_groups = []

        for node in nodes:
            node_type = node.get("data", {}).get("nodeType") or node.get("type")
            if node_type in ["formProcessGroup", "formMultiStepContainer"]:
                form_groups.append(node)

        return form_groups

    def get_child_steps(self, group_node: Dict[str, Any], all_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Get all child FormStep nodes for a FormProcessGroup.

        Uses React Flow's parent-child relationship (node.parentNode).

        Args:
            group_node: The FormProcessGroup node
            all_nodes: All nodes in the graph

        Returns:
            List of child step nodes, sorted by order
        """
        group_id = group_node["id"]
        children = []

        for node in all_nodes:
            parent_id = node.get("parentNode") or node.get("parentId")
            node_type = node.get("data", {}).get("nodeType") or node.get("type")

            if parent_id == group_id and node_type in ["formStep", "form"]:
                children.append(node)

        # Sort by position.y (vertical ordering in container)
        children.sort(key=lambda n: n.get("position", {}).get("y", 0))

        return children

    def extract_step_fields(self, step_node: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract field definitions from a FormStep node.

        Args:
            step_node: The FormStep node with field data

        Returns:
            List of field definition dicts
        """
        node_data = step_node.get("data", {})

        # Check various possible field storage locations
        fields = []

        # From entityConfig.fields (new pattern)
        entity_config = node_data.get("entityConfig", {})
        if "fields" in entity_config:
            fields = entity_config["fields"]

        # From fields array (older pattern)
        elif "fields" in node_data:
            fields = node_data["fields"]

        # From formFields (alternative pattern)
        elif "formFields" in node_data:
            fields = node_data["formFields"]

        # Ensure it's a list
        if not isinstance(fields, list):
            fields = []

        return fields

    def calculate_form_hash(self, form_data: Dict[str, Any]) -> str:
        """
        Calculate a hash of the form structure for change detection.

        Includes: container name, step count, entity types, field keys.
        Excludes: positions, styling, metadata that doesn't affect data model.

        Args:
            form_data: Dict with container and steps data

        Returns:
            String hash for comparison
        """
        import hashlib
        import json

        structure = {
            "name": form_data.get("name", ""),
            "steps": [
                {
                    "entity_type": step.get("entity_type"),
                    "fields": sorted([f.get("field_key") for f in step.get("fields", [])]),
                }
                for step in form_data.get("steps", [])
            ],
        }

        structure_str = json.dumps(structure, sort_keys=True)
        return hashlib.sha256(structure_str.encode()).hexdigest()[:16]

    @transaction.atomic
    def sync_form_process_group(self, group_node: Dict[str, Any], all_nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Sync a single FormProcessGroup node to a TenantForm record.

        Creates or updates the TenantForm and all child entities/fields.
        Increments version if structure changes.

        Args:
            group_node: The FormProcessGroup node
            all_nodes: All nodes in the graph (for finding children)

        Returns:
            Dict with:
                - success: bool
                - form_id: UUID of created/updated form
                - version: int
                - created: bool (True if new, False if updated)
                - changes: str describing what changed
        """
        result = {"success": False, "form_id": None, "version": 1, "created": False, "changes": ""}

        try:
            # Extract container data
            group_id = group_node["id"]
            group_data = group_node.get("data", {})

            container_name = (
                group_data.get("containerName")
                or group_data.get("label")
                or group_data.get("name")
                or "Unnamed Form Process"
            )

            container_description = group_data.get("containerDescription", "")

            # Get child steps
            child_steps = self.get_child_steps(group_node, all_nodes)

            if not child_steps:
                logger.warning(f"FormProcessGroup {group_id} has no child steps, skipping")
                self.errors.append(f"Group '{container_name}' has no steps")
                return result

            # Build form structure for comparison
            form_structure = {"name": container_name, "steps": []}

            for step in child_steps:
                step_data = step.get("data", {})
                entity_type = step_data.get("entityType") or step_data.get("entity_type") or "unknown"

                fields = self.extract_step_fields(step)

                form_structure["steps"].append(
                    {"entity_type": entity_type, "step_name": step_data.get("label", entity_type), "fields": fields}
                )

            # Calculate structure hash
            new_hash = self.calculate_form_hash(form_structure)

            # Try to find existing form by flow node ID (stored in metadata)
            existing_form = None
            try:
                # Check if group_data has a form_id reference
                form_id = group_data.get("form_id")
                if form_id:
                    existing_form = TenantForm.objects.get(id=form_id, tenant=self.tenant)
            except TenantForm.DoesNotExist:
                pass

            # If no direct reference, try to find by name (less reliable)
            if not existing_form:
                existing_forms = TenantForm.objects.filter(tenant=self.tenant, name=container_name)
                if existing_forms.count() == 1:
                    existing_form = existing_forms.first()

            # Determine if we need to create or update
            if existing_form:
                # Check if structure changed
                old_metadata = existing_form.metadata or {}
                old_hash = old_metadata.get("structure_hash", "")

                if old_hash == new_hash:
                    # No changes needed
                    result["success"] = True
                    result["form_id"] = str(existing_form.id)
                    result["version"] = existing_form.version
                    result["created"] = False
                    result["changes"] = "No changes"
                    logger.info(f"Form '{container_name}' unchanged, skipping")
                    return result

                # Structure changed - increment version
                existing_form.version += 1
                existing_form.name = container_name
                existing_form.description = container_description
                existing_form.metadata = existing_form.metadata or {}
                existing_form.metadata["structure_hash"] = new_hash
                existing_form.metadata["flow_node_id"] = group_id
                existing_form.save()

                # Delete old entities and fields (will recreate)
                existing_form.entities.all().delete()

                form = existing_form
                result["changes"] = f"Structure updated (v{form.version})"
                logger.info(f"Updated form '{container_name}' to v{form.version}")
            else:
                # Create new form
                form = TenantForm.objects.create(
                    tenant=self.tenant,
                    name=container_name,
                    description=container_description,
                    form_type="multi_entity",
                    version=1,
                    metadata={"structure_hash": new_hash, "flow_node_id": group_id},
                    created_by=self.user,
                )
                result["created"] = True
                result["changes"] = "New form created"
                logger.info(f"Created new form '{container_name}' (ID: {form.id})")

            # Create entities and fields
            for order, step in enumerate(form_structure["steps"]):
                entity = TenantFormEntity.objects.create(
                    form=form, entity_type=step["entity_type"], step_name=step["step_name"], order=order
                )

                # Create fields
                for field_order, field_def in enumerate(step["fields"]):
                    TenantFormField.objects.create(
                        form_entity=entity,
                        field_key=field_def.get("field_key", field_def.get("name", "unknown")),
                        field_type=field_def.get("field_type", "text"),
                        label=field_def.get("label", ""),
                        is_required=field_def.get("required", False),
                        is_visible=field_def.get("visible", True),
                        order=field_order,
                        default_value=field_def.get("default_value", ""),
                        placeholder=field_def.get("placeholder", ""),
                        help_text=field_def.get("help_text", ""),
                    )

            result["success"] = True
            result["form_id"] = str(form.id)
            result["version"] = form.version

            return result

        except Exception as e:
            error_msg = f"Failed to sync FormProcessGroup: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.errors.append(error_msg)
            result["changes"] = f"Error: {str(e)}"
            return result

    @transaction.atomic
    def sync_from_workflow(self, flow_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync all FormProcessGroup nodes from a workflow's flow_data.

        This is called when a workflow is saved in the visual editor.

        Args:
            flow_data: React Flow graph data with nodes and edges

        Returns:
            Dict with:
                - success: bool (True if all groups synced successfully)
                - synced_forms: List of results from each group
                - errors: List of error messages
        """
        result = {"success": True, "synced_forms": [], "errors": []}

        try:
            # Extract all FormProcessGroup nodes
            form_groups = self.extract_form_process_groups(flow_data)
            all_nodes = flow_data.get("nodes", [])

            if not form_groups:
                logger.info("No FormProcessGroup nodes found in workflow")
                return result

            logger.info(f"Found {len(form_groups)} FormProcessGroup nodes to sync")

            # Sync each group
            for group in form_groups:
                group_result = self.sync_form_process_group(group, all_nodes)
                result["synced_forms"].append(group_result)

                if not group_result["success"]:
                    result["success"] = False

            result["errors"] = self.errors

            if result["success"]:
                logger.info(f"Successfully synced {len(form_groups)} form(s)")
            else:
                logger.warning(f"Synced forms with errors: {self.errors}")

            return result

        except Exception as e:
            error_msg = f"Failed to sync workflow forms: {str(e)}"
            logger.error(error_msg, exc_info=True)
            result["success"] = False
            result["errors"].append(error_msg)
            return result
