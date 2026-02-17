"""
Data migration to rename node types in TenantWorkForm workflow_definition JSON.

Phase 2 of WorkForms Enhancement - Node Renaming:
- 'formMultiStepContainer' → 'formProcess'
- 'formStep' → 'formStepSingle'

This migration updates the workflow_definition JSON field in all TenantWorkForm records.
It preserves all other node data and is idempotent (safe to run multiple times).

Created: 2026-02-14
"""
from django.db import migrations
import json


def rename_node_types_forward(apps, schema_editor):
    """
    Rename node types in workflow_definition JSON.
    
    Changes:
    - formMultiStepContainer → formProcess
    - formStep → formStepSingle
    """
    TenantWorkForm = apps.get_model('system', 'TenantWorkForm')
    
    updated_count = 0
    for workform in TenantWorkForm.objects.all():
        workflow_def = workform.workflow_definition
        if not workflow_def or 'nodes' not in workflow_def:
            continue
        
        modified = False
        nodes = workflow_def.get('nodes', [])
        
        for node in nodes:
            node_type = node.get('type')
            
            # Rename formMultiStepContainer → formProcess
            if node_type == 'formMultiStepContainer':
                node['type'] = 'formProcess'
                modified = True
            
            # Rename formStep → formStepSingle
            elif node_type == 'formStep':
                node['type'] = 'formStepSingle'
                modified = True
        
        if modified:
            workform.workflow_definition = workflow_def
            workform.save(update_fields=['workflow_definition'])
            updated_count += 1
    
    if updated_count > 0:
        print(f"✅ Updated {updated_count} TenantWorkForm records with renamed node types")
    else:
        print("ℹ️  No TenantWorkForm records required node type updates")


def rename_node_types_reverse(apps, schema_editor):
    """
    Reverse migration: Restore original node type names.
    
    Changes:
    - formProcess → formMultiStepContainer
    - formStepSingle → formStep
    """
    TenantWorkForm = apps.get_model('system', 'TenantWorkForm')
    
    updated_count = 0
    for workform in TenantWorkForm.objects.all():
        workflow_def = workform.workflow_definition
        if not workflow_def or 'nodes' not in workflow_def:
            continue
        
        modified = False
        nodes = workflow_def.get('nodes', [])
        
        for node in nodes:
            node_type = node.get('type')
            
            # Reverse: formProcess → formMultiStepContainer
            if node_type == 'formProcess':
                node['type'] = 'formMultiStepContainer'
                modified = True
            
            # Reverse: formStepSingle → formStep
            elif node_type == 'formStepSingle':
                node['type'] = 'formStep'
                modified = True
        
        if modified:
            workform.workflow_definition = workflow_def
            workform.save(update_fields=['workflow_definition'])
            updated_count += 1
    
    if updated_count > 0:
        print(f"✅ Reversed {updated_count} TenantWorkForm records to original node types")
    else:
        print("ℹ️  No TenantWorkForm records required reversal")


class Migration(migrations.Migration):
    """
    Data migration for Phase 2: Node type renaming.
    
    This migration is:
    - Idempotent: Safe to run multiple times
    - Reversible: Can rollback if needed
    - Non-destructive: Only modifies node 'type' field, preserves all other data
    """

    dependencies = [
        ('system', '0007_add_container_versioning_fields'),
    ]

    operations = [
        migrations.RunPython(
            rename_node_types_forward,
            rename_node_types_reverse,
        ),
    ]
