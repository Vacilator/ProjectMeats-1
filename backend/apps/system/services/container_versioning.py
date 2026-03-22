"""
Container versioning service for Unified WorkForm Overhaul.

Phase 1: Recursive Persistence
Automatically snapshots formMultiStepContainer nodes into reusable,
versioned TenantForm records.

Created: 2026-02-12
"""
import hashlib
import json
from django.db import transaction
from apps.system.models import TenantForm, FormTypeChoices


def hash_definition(definition: dict) -> str:
    """
    Create a stable hash of a form definition for deduplication.
    
    Args:
        definition: Form definition dictionary
        
    Returns:
        SHA256 hash of the normalized definition
    """
    # Normalize the definition (sort keys, remove volatile fields)
    normalized = json.dumps(definition, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(normalized.encode()).hexdigest()


def serialize_step(step_node: dict) -> dict:
    """Serialize a step into form definition format.

    Supports two shapes:
    1) React Flow node dict: {id, type, data:{...}}
    2) Nested step dict (from container.data.steps): {id?, name?, entity_type?, fields, order, mappings, ...}

    This keeps URL/payload stability while allowing the frontend to save a single
    nested structure through TenantWorkForm PUT.
    """

    # Shape 1: React Flow node
    if isinstance(step_node, dict) and 'data' in step_node:
        data = step_node.get('data', {}) or {}
        return {
            'id': step_node.get('id'),
            'order': data.get('order'),
            'name': data.get('stepTitle') or data.get('label', 'Untitled Step'),
            'description': data.get('stepDescription', ''),
            'entity_type': data.get('entityType') or data.get('entity_type'),
            'entity_action': data.get('entityAction') or data.get('entity_action'),
            'fields': data.get('fields', []),
            'field_mappings': data.get('fieldMappings') or data.get('field_mappings') or [],
            'cascade_mappings': data.get('cascadeMappings') or data.get('cascade_mappings') or [],
            'visibility': data.get('visibility', {}),
            'navigation': data.get('navigation', {}),
            'validation': data.get('validation', {}),
        }

    # Shape 2: already-nested step object
    data = step_node or {}
    return {
        'id': data.get('id'),
        'order': data.get('order'),
        'name': data.get('name') or data.get('stepTitle') or data.get('label', 'Untitled Step'),
        'description': data.get('description', ''),
        'entity_type': data.get('entity_type') or data.get('entityType'),
        'entity_action': data.get('entity_action') or data.get('entityAction'),
        'fields': data.get('fields', []),
        'field_mappings': data.get('field_mappings') or data.get('fieldMappings') or [],
        'cascade_mappings': data.get('cascade_mappings') or data.get('cascadeMappings') or [],
        'visibility': data.get('visibility', {}),
        'navigation': data.get('navigation', {}),
        'validation': data.get('validation', {}),
    }


def get_next_version(tenant, source_node_id: str) -> int:
    """
    Get the next version number for a container's TenantForm.
    
    Args:
        tenant: Tenant instance
        source_node_id: Container node ID
        
    Returns:
        Next version number
    """
    latest = TenantForm.objects.filter(
        tenant=tenant,
        source_node_id=source_node_id
    ).order_by('-version').first()
    
    return (latest.version + 1) if latest else 1


def has_container_changed(container_node: dict, existing_form: TenantForm) -> tuple[bool, dict]:
    """
    Check if container definition has changed compared to existing form.
    
    Args:
        container_node: Current container node from React Flow
        existing_form: Existing TenantForm record
        
    Returns:
        Tuple of (has_changed, diff_summary)
    """
    # Build current definition hash
    current_def = existing_form.form_definition
    container_data = container_node.get('data', {})
    
    label_candidate = (
        container_data.get('containerName')
        or container_data.get('label')
        or container_data.get('name')
    )

    diff = {
        'label_changed': label_candidate != current_def.get('container_label'),
        'step_count_changed': False,
        'fields_changed': False
    }
    
    current_steps = current_def.get('steps', [])
    
    # Step count comparison will be done by caller (needs child nodes)
    
    has_changed = any(diff.values())
    
    return has_changed, diff


@transaction.atomic
def snapshot_container(
    container_node: dict, 
    child_steps: list[dict], 
    tenant,
    user=None
) -> TenantForm:
    """
    Create or reuse a TenantForm snapshot for a container node.
    
    This is the main entry point for container persistence. It:
    1. Builds a form_definition from the container and its child steps
    2. Checks if an identical definition already exists (via hash)
    3. Returns existing form (incrementing usage_count) or creates new version
    
    Args:
        container_node: formMultiStepContainer node from React Flow
        child_steps: List of child formStep nodes
        tenant: Tenant instance
        user: User creating the snapshot (optional)
        
    Returns:
        TenantForm instance (existing or newly created)
    """
    container_data = container_node.get('data', {})
    
    # 1. Build form definition
    container_label = (
        container_data.get('containerName')
        or container_data.get('label')
        or container_data.get('name')
        or 'Multi-Step Container'
    )
    container_description = (
        container_data.get('containerDescription')
        or container_data.get('description')
        or ''
    )

    definition = {
        'container_id': container_node['id'],
        'container_label': container_label,
        'steps': [serialize_step(step) for step in child_steps],
        'layout': container_data.get('layout', {}),
        'description': container_description,
    }
    
    definition_hash = hash_definition(definition)
    
    # 2. Check if identical snapshot exists
    existing = TenantForm.objects.filter(
        tenant=tenant,
        definition_hash=definition_hash
    ).first()
    
    if existing:
        # Reuse existing form, increment usage
        existing.usage_count += 1
        existing.save(update_fields=['usage_count'])
        return existing
    
    # 3. Create new version
    version = get_next_version(tenant, container_node['id'])
    
    new_form = TenantForm.objects.create(
        tenant=tenant,
        name=f"Container: {container_label}",
        description=definition.get('description', ''),
        type=FormTypeChoices.MULTI_STEP,
        form_definition=definition,
        version=version,
        source_node_id=container_node['id'],
        definition_hash=definition_hash,
        is_template=True,
        usage_count=1,
        created_by=user,
        updated_by=user
    )
    
    return new_form


def extract_container_definitions(nodes: list[dict]) -> list[dict]:
    """Extract form containers and their steps.

    Container types (canonical + legacy):
    - formBook (canonical)
    - formProcessGroup, formProcess, formMultiStepContainer (legacy aliases)

    Step sources:
    - Child nodes via parentId/parentNode (sub-flows)
    - OR nested steps via container.data.steps (preferred for stable saves)
    """

    containers: list[dict] = []

    container_types = {
        'formBook',
        'formProcessGroup',
        'formProcess',
        'formMultiStepContainer',
        'smartWorkForm',
    }

    step_types = {
        'form',
        'formStepSingle',
        'formStep',
        'formReference',
    }

    # Build parent-child map
    children_by_parent: dict[str, list[dict]] = {}
    container_nodes: dict[str, dict] = {}

    for node in nodes:
        node_id = node.get('id')
        if not node_id:
            continue

        if node.get('type') in container_types:
            container_nodes[node_id] = node
            children_by_parent.setdefault(node_id, [])

        parent_id = node.get('parentId') or node.get('parentNode')
        if parent_id:
            children_by_parent.setdefault(parent_id, []).append(node)

    for container_id, container_node in container_nodes.items():
        container_data = (container_node.get('data') or {}) if isinstance(container_node, dict) else {}

        nested_steps = container_data.get('steps') if isinstance(container_data, dict) else None
        if isinstance(nested_steps, list) and nested_steps:
            containers.append({'container': container_node, 'children': nested_steps})
            continue

        children = children_by_parent.get(container_id, [])
        form_steps = [child for child in children if child.get('type') in step_types]

        containers.append({'container': container_node, 'children': form_steps})

    return containers
