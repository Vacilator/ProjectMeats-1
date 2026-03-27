"""
Permission classes for WorkForms/Workflows.

Phase 4.2: Enterprise-grade permission system for WorkForms editor.

Role-based access control:
- owner/admin: Full access (create, edit, publish, expert mode, system templates)
- manager: Create/edit own forms, visual mode only, use system templates  
- user: View/use forms only, cannot edit
- readonly: View only
"""
from rest_framework import permissions
from .models import TenantForm, TenantWorkflow


class IsTenantAdminOrOwner(permissions.BasePermission):
    """Allow access for users with 'owner' or 'admin' role."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        if not hasattr(request, 'tenant') or not request.tenant:
            return False

        from apps.tenants.models import TenantUser

        try:
            tenant_user = TenantUser.objects.get(user=request.user, tenant=request.tenant, is_active=True)
            return tenant_user.role in ['owner', 'admin']
        except TenantUser.DoesNotExist:
            return False


class IsTenantAdminOrOwnerOrReadOnly(permissions.BasePermission):
    """Read-only for authenticated users; write for tenant admins/owners."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)

        return IsTenantAdminOrOwner().has_permission(request, view)


class CanEditWorkForm(permissions.BasePermission):
    """
    Permission class for editing forms/workflows.
    - owner/admin: Can edit any form
    - manager: Can edit own forms only
    - user/readonly: Cannot edit
    """
    
    def has_permission(self, request, view):
        """Check if user can access editing features."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Superusers always have access
        if request.user.is_superuser:
            return True
        
        # Check tenant role
        if not hasattr(request, 'tenant') or not request.tenant:
            return False
        
        from apps.tenants.models import TenantUser
        try:
            tenant_user = TenantUser.objects.get(
                user=request.user,
                tenant=request.tenant,
                is_active=True
            )
            # owner, admin, manager can access editing
            return tenant_user.role in ['owner', 'admin', 'manager']
        except TenantUser.DoesNotExist:
            return False
    
    def has_object_permission(self, request, view, obj):
        """Check if user can edit this specific form/workflow."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Superusers always have access
        if request.user.is_superuser:
            return True
        
        # Check tenant role
        if not hasattr(request, 'tenant') or not request.tenant:
            return False
        
        from apps.tenants.models import TenantUser
        try:
            tenant_user = TenantUser.objects.get(
                user=request.user,
                tenant=request.tenant,
                is_active=True
            )
            
            # owner/admin can edit any form
            if tenant_user.role in ['owner', 'admin']:
                return True
            
            # manager can only edit own forms
            if tenant_user.role == 'manager':
                # Check if user created this form/workflow
                if hasattr(obj, 'created_by'):
                    return obj.created_by == request.user
                return False
            
            # user/readonly cannot edit
            return False
            
        except TenantUser.DoesNotExist:
            return False


class CanPublishWorkForm(permissions.BasePermission):
    """
    Permission class for publishing forms/workflows.
    Only owner/admin can publish forms.
    """
    
    def has_permission(self, request, view):
        """Check if user can publish forms."""
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Superusers always have access
        if request.user.is_superuser:
            return True
        
        # Check tenant role
        if not hasattr(request, 'tenant') or not request.tenant:
            return False
        
        from apps.tenants.models import TenantUser
        try:
            tenant_user = TenantUser.objects.get(
                user=request.user,
                tenant=request.tenant,
                is_active=True
            )
            # Only owner/admin can publish
            return tenant_user.role in ['owner', 'admin']
        except TenantUser.DoesNotExist:
            return False
    
    def has_object_permission(self, request, view, obj):
        """Check if user can publish this specific form/workflow."""
        return self.has_permission(request, view)


class WorkFormPermissionHelper:
    """
    Helper class to generate permission metadata for frontend.
    """
    
    @staticmethod
    def get_permissions_for_user(user, tenant) -> dict:
        """
        Get comprehensive permission metadata for a user in a tenant.
        
        Returns:
            dict: Permission configuration for frontend
        """
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[WorkFormPermissions] Checking permissions for user: {user}, is_authenticated: {user.is_authenticated if user else False}, is_superuser: {user.is_superuser if user else False}, tenant: {tenant}")
        
        if not user or not user.is_authenticated:
            logger.info("[WorkFormPermissions] User not authenticated - returning anonymous permissions")
            return WorkFormPermissionHelper._get_anonymous_permissions()
        
        # Superusers get full access
        if user.is_superuser:
            logger.info("[WorkFormPermissions] User is superuser - returning full permissions")
            return WorkFormPermissionHelper._get_superuser_permissions()
        
        # Get tenant role
        from apps.tenants.models import TenantUser
        try:
            tenant_user = TenantUser.objects.get(
                user=user,
                tenant=tenant,
                is_active=True
            )
            role = tenant_user.role
            logger.info(f"[WorkFormPermissions] Found tenant role: {role}")
        except TenantUser.DoesNotExist:
            logger.warning(f"[WorkFormPermissions] TenantUser not found for user {user.id} in tenant {tenant.id if tenant else None}")
            return WorkFormPermissionHelper._get_anonymous_permissions()
        
        # Generate permissions based on role
        return WorkFormPermissionHelper._get_role_permissions(role)
    
    @staticmethod
    def _get_anonymous_permissions() -> dict:
        """Permissions for anonymous/unauthenticated users."""
        return {
            'can_create': False,
            'can_edit': False,
            'can_publish': False,
            'can_archive': False,
            'can_delete': False,
            'allowed_modes': [],
            'allowed_node_categories': [],
            'can_access_system_templates': False,
            'can_create_global_templates': False,
            'max_active_flows': 0,
            'role': 'anonymous',
        }
    
    @staticmethod
    def _get_superuser_permissions() -> dict:
        """Permissions for superusers."""
        return {
            'can_create': True,
            'can_edit': True,
            'can_publish': True,
            'can_archive': True,
            'can_delete': True,
            'allowed_modes': ['wizard', 'visual', 'expert'],
            'allowed_node_categories': [
                'trigger', 'form', 'logic', 'action', 
                'wait', 'document', 'utility', 'terminal'
            ],
            'can_access_system_templates': True,
            'can_create_global_templates': True,
            'max_active_flows': None,  # Unlimited
            'role': 'superuser',
        }
    
    @staticmethod
    def _get_role_permissions(role: str) -> dict:
        """Get permissions for a specific tenant role."""
        
        # owner/admin: Full access
        if role in ['owner', 'admin']:
            return {
                'can_create': True,
                'can_edit': True,
                'can_publish': True,
                'can_archive': True,
                'can_delete': True,
                'allowed_modes': ['wizard', 'visual', 'expert'],
                'allowed_node_categories': [
                    'trigger', 'form', 'logic', 'action',
                    'wait', 'document', 'utility', 'terminal'
                ],
                'can_access_system_templates': True,
                'can_create_global_templates': True,
                'max_active_flows': None,  # Unlimited
                'role': role,
            }
        
        # manager: Create/edit own, visual mode only
        elif role == 'manager':
            return {
                'can_create': True,
                'can_edit': True,  # Own forms only (enforced in has_object_permission)
                'can_publish': False,
                'can_archive': True,  # Own forms only
                'can_delete': True,   # Own forms only
                'allowed_modes': ['wizard', 'visual'],
                'allowed_node_categories': [
                    'trigger', 'form', 'logic', 'action',
                    'wait', 'document', 'utility', 'terminal'
                ],
                'can_access_system_templates': True,
                'can_create_global_templates': False,
                'max_active_flows': 50,
                'role': role,
            }
        
        # user: View/use forms only
        elif role == 'user':
            return {
                'can_create': False,
                'can_edit': False,
                'can_publish': False,
                'can_archive': False,
                'can_delete': False,
                'allowed_modes': [],  # Can't access editor
                'allowed_node_categories': [],
                'can_access_system_templates': True,  # Can use (not edit)
                'can_create_global_templates': False,
                'max_active_flows': 0,
                'role': role,
            }
        
        # readonly: View only
        else:  # readonly or any other role
            return {
                'can_create': False,
                'can_edit': False,
                'can_publish': False,
                'can_archive': False,
                'can_delete': False,
                'allowed_modes': [],
                'allowed_node_categories': [],
                'can_access_system_templates': False,
                'can_create_global_templates': False,
                'max_active_flows': 0,
                'role': role if role in ['readonly', 'user', 'manager', 'admin', 'owner'] else 'readonly',
            }
