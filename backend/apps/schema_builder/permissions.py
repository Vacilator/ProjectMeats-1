"""
Permissions for Schema Builder.

Defines permission checks for GSA vs Superuser/Superadmin roles.
- GSA: Can Draft and Submit
- Superuser/Superadmin: Can Draft, Submit, AND Publish
"""
from functools import wraps


def can_edit_schema(request, obj=None):
    """
    Check if user can edit a schema.
    
    Draft schemas can be edited by anyone with change permission.
    Submitted schemas can only be edited by superusers.
    Published schemas cannot be edited directly.
    """
    if obj is None:
        return True  # Can create new schemas
    
    if obj.status == 'published':
        return False  # Published schemas require creating a new version
    
    if obj.status == 'submitted':
        return request.user.is_superuser
    
    return True  # Draft can be edited by anyone


def can_submit_schema(request, obj=None):
    """
    Check if user can submit a schema for review.
    
    Both GSA and Superusers can submit draft schemas.
    """
    if obj is None:
        return False
    
    if obj.status != 'draft':
        return False
    
    # Check if user is GSA or superuser
    return request.user.is_staff or request.user.is_superuser


def can_publish_schema(request, obj=None):
    """
    Check if user can publish a schema.
    
    ONLY Superusers/Superadmins can publish schemas.
    """
    if obj is None:
        return False
    
    if obj.status != 'submitted':
        return False
    
    return request.user.is_superuser


def can_revert_schema(request, obj=None):
    """
    Check if user can revert a schema to draft.
    
    Submitted schemas can be reverted by superusers.
    Published schemas cannot be reverted.
    """
    if obj is None:
        return False
    
    if obj.status == 'published':
        return False
    
    if obj.status == 'submitted':
        return request.user.is_superuser
    
    return False  # Draft doesn't need reverting


def can_view_versions(request, obj=None):
    """
    Check if user can view schema version history.
    
    All staff users can view version history.
    """
    return request.user.is_staff


def superuser_required(func):
    """Decorator to require superuser for an action."""
    @wraps(func)
    def wrapper(modeladmin, request, *args, **kwargs):
        if not request.user.is_superuser:
            from django.contrib import messages
            messages.error(
                request,
                "⛔ Permission Denied: Only superusers can perform this action."
            )
            return None
        return func(modeladmin, request, *args, **kwargs)
    return wrapper


def staff_required(func):
    """Decorator to require staff status for an action."""
    @wraps(func)
    def wrapper(modeladmin, request, *args, **kwargs):
        if not request.user.is_staff:
            from django.contrib import messages
            messages.error(
                request,
                "⛔ Permission Denied: Only staff members can perform this action."
            )
            return None
        return func(modeladmin, request, *args, **kwargs)
    return wrapper
