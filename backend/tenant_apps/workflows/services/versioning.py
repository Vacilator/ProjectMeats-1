"""
Form Versioning Service (Phase 2.4)

Provides version control for TenantForm with snapshot, rollback, and diff capabilities.
"""
from typing import Dict, List, Any, Optional
from django.db import transaction
from django.contrib.auth.models import User
from tenant_apps.workflows.models import TenantForm, TenantFormVersion
from tenant_apps.workflows.serializers import TenantFormSerializer


class FormVersionService:
    """
    Service for managing form versions.
    
    Provides:
    1. Snapshot creation: Save current form state as new version
    2. Rollback: Restore form to previous version
    3. Diff: Compare versions to see what changed
    4. History: List all versions with metadata
    """
    
    @staticmethod
    def create_version(
        form: TenantForm,
        change_summary: str,
        user: Optional[User] = None
    ) -> TenantFormVersion:
        """
        Create a new version snapshot of the form.
        
        Args:
            form: TenantForm to snapshot
            change_summary: Description of changes made
            user: User creating the version
            
        Returns:
            Created TenantFormVersion instance
            
        Side Effects:
            - Marks previous version as not current
            - Sets new version as current
            - Updates form.current_version
        """
        if not form.version_enabled:
            raise ValueError(f"Version control not enabled for form {form.name}")
        
        # Get next version number
        latest_version = form.versions.order_by('-version_number').first()
        version_number = 1 if not latest_version else latest_version.version_number + 1
        
        # Serialize current form state
        serializer = TenantFormSerializer(form)
        snapshot_data = serializer.data
        
        # Mark previous versions as not current
        form.versions.update(is_current=False)
        
        # Create new version
        version = TenantFormVersion.objects.create(
            tenant=form.tenant,
            form=form,
            version_number=version_number,
            snapshot_data=snapshot_data,
            change_summary=change_summary,
            created_by=user,
            is_current=True
        )
        
        # Update form's current_version pointer
        form.current_version = version
        form.save(update_fields=['current_version'])
        
        return version
    
    @staticmethod
    def rollback_to_version(
        form: TenantForm,
        version_number: int,
        user: Optional[User] = None
    ) -> TenantFormVersion:
        """
        Rollback form to a previous version.
        
        Args:
            form: TenantForm to rollback
            version_number: Version number to restore
            user: User performing the rollback
            
        Returns:
            New version (rollback creates a new version, doesn't delete history)
            
        Raises:
            ValueError: If version not found or version control not enabled
        """
        if not form.version_enabled:
            raise ValueError(f"Version control not enabled for form {form.name}")
        
        # Get target version
        try:
            target_version = form.versions.get(version_number=version_number)
        except TenantFormVersion.DoesNotExist:
            raise ValueError(f"Version {version_number} not found for form {form.name}")
        
        # Restore snapshot data to form
        snapshot = target_version.snapshot_data
        
        with transaction.atomic():
            # Update form fields from snapshot
            form.name = snapshot.get('name', form.name)
            form.description = snapshot.get('description', form.description)
            form.status = snapshot.get('status', form.status)
            form.icon = snapshot.get('icon', form.icon)
            form.is_quick_action_enabled = snapshot.get('is_quick_action_enabled', form.is_quick_action_enabled)
            form.flow_data = snapshot.get('flow_data', {})
            form.save()
            
            # Create new version documenting the rollback
            rollback_version = FormVersionService.create_version(
                form=form,
                change_summary=f"Rollback to version {version_number}",
                user=user
            )
        
        return rollback_version
    
    @staticmethod
    def get_version_history(form: TenantForm) -> List[Dict[str, Any]]:
        """
        Get version history for a form.
        
        Args:
            form: TenantForm to get history for
            
        Returns:
            List of version dicts with metadata:
            [
                {
                    "version_number": 3,
                    "change_summary": "Added email notification",
                    "created_at": "2026-03-03T12:00:00Z",
                    "created_by": "john@example.com",
                    "is_current": True
                },
                ...
            ]
        """
        versions = form.versions.select_related('created_by').order_by('-version_number')
        
        history = []
        for version in versions:
            history.append({
                'version_number': version.version_number,
                'change_summary': version.change_summary,
                'created_at': version.created_on.isoformat(),
                'created_by': version.created_by.email if version.created_by else 'System',
                'is_current': version.is_current
            })
        
        return history
    
    @staticmethod
    def compare_versions(
        form: TenantForm,
        version_a: int,
        version_b: int
    ) -> Dict[str, Any]:
        """
        Compare two versions and return diff.
        
        Args:
            form: TenantForm
            version_a: First version number
            version_b: Second version number
            
        Returns:
            Dict with changed fields:
            {
                "name": {"old": "...", "new": "..."},
                "description": {"old": "...", "new": "..."},
                "flow_data": {"added_nodes": [...], "removed_nodes": [...]}
            }
        """
        try:
            ver_a = form.versions.get(version_number=version_a)
            ver_b = form.versions.get(version_number=version_b)
        except TenantFormVersion.DoesNotExist:
            raise ValueError("One or both versions not found")
        
        snapshot_a = ver_a.snapshot_data
        snapshot_b = ver_b.snapshot_data
        
        # Compare simple fields
        diff = {}
        simple_fields = ['name', 'description', 'status', 'icon']
        
        for field in simple_fields:
            val_a = snapshot_a.get(field)
            val_b = snapshot_b.get(field)
            if val_a != val_b:
                diff[field] = {'old': val_a, 'new': val_b}
        
        # Compare flow_data (nodes/edges)
        flow_a = snapshot_a.get('flow_data', {})
        flow_b = snapshot_b.get('flow_data', {})
        
        if flow_a != flow_b:
            nodes_a = {n['id']: n for n in flow_a.get('nodes', [])}
            nodes_b = {n['id']: n for n in flow_b.get('nodes', [])}
            
            added_nodes = [n for nid, n in nodes_b.items() if nid not in nodes_a]
            removed_nodes = [n for nid, n in nodes_a.items() if nid not in nodes_b]
            
            diff['flow_data'] = {
                'added_nodes': added_nodes,
                'removed_nodes': removed_nodes
            }
        
        return diff
    
    @staticmethod
    def enable_versioning(form: TenantForm, user: Optional[User] = None) -> TenantFormVersion:
        """
        Enable version control for a form and create initial version.
        
        Args:
            form: TenantForm to enable versioning for
            user: User enabling versioning
            
        Returns:
            Initial version (v1)
        """
        if form.version_enabled:
            raise ValueError(f"Version control already enabled for form {form.name}")
        
        form.version_enabled = True
        form.save(update_fields=['version_enabled'])
        
        # Create initial version
        return FormVersionService.create_version(
            form=form,
            change_summary="Initial version (versioning enabled)",
            user=user
        )
