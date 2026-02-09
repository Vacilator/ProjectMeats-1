import logging
import traceback
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.core.cache import cache
from .models import Tenant, TenantUser, TenantConfiguration
from .activity_models import ActivityLog
from .serializers import (
    TenantSerializer,
    TenantCreateSerializer,
    TenantUserSerializer,
    UserTenantSerializer,
    TenantConfigurationSerializer,
)
from .activity_serializers import ActivityLogSerializer
from .permissions import IsTenantAdminOrOwner

logger = logging.getLogger(__name__)


class TenantViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tenants.
    Provides CRUD operations for tenant management.
    
    Permissions:
    - Authenticated users can list and view tenants they belong to
    - Only owners and admins can update/delete tenants
    """

    queryset = Tenant.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrOwner]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "is_trial"]
    search_fields = ["name", "slug", "contact_email", "domain"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "create":
            return TenantCreateSerializer
        return TenantSerializer

    def get_queryset(self):
        """Filter tenants based on user permissions."""
        user = self.request.user
        if user.is_superuser:
            return Tenant.objects.all()

        # Regular users can only see tenants they belong to
        tenant_ids = TenantUser.objects.filter(user=user, is_active=True).values_list(
            "tenant_id", flat=True
        )
        return Tenant.objects.filter(id__in=tenant_ids)
    
    def perform_update(self, serializer):
        """
        Override perform_update to add detailed logging and error handling.
        
        Logs all PATCH/PUT requests and captures exceptions with full traceback.
        This helps diagnose 500 errors related to logo uploads or color updates.
        """
        logger.info("=" * 60)
        logger.info(f"🔄 Tenant Update Request - Method: {self.request.method}")
        logger.info(f"User: {self.request.user.username} (ID: {self.request.user.id})")
        logger.info(f"Tenant ID: {serializer.instance.id}")
        logger.info(f"Request Data: {self.request.data}")
        logger.info(f"Content Type: {self.request.content_type}")
        
        # Log file uploads separately
        if self.request.FILES:
            logger.info(f"Files Uploaded: {list(self.request.FILES.keys())}")
            for key, file in self.request.FILES.items():
                logger.info(f"  - {key}: {file.name} ({file.size} bytes, {file.content_type})")
        
        try:
            # Perform the update
            instance = serializer.save()
            
            # Clear tenant branding cache after successful update
            cache_key = f'tenant_branding_{instance.id}'
            cache.delete(cache_key)
            logger.info(f"✅ Tenant update successful - Cache cleared: {cache_key}")
            logger.info("=" * 60)
            
            return instance
            
        except Exception as e:
            # Log full traceback for debugging
            logger.error("=" * 60)
            logger.error(f"❌ Tenant update failed for tenant {serializer.instance.id}")
            logger.error(f"Error Type: {type(e).__name__}")
            logger.error(f"Error Message: {str(e)}")
            logger.error("Full Traceback:")
            logger.error(traceback.format_exc())
            logger.error("=" * 60)
            
            # Re-raise to let DRF handle the error response
            raise

    @action(detail=True, methods=["get"])
    def users(self, request, pk=None):
        """Get all users for a specific tenant."""
        tenant = self.get_object()
        tenant_users = TenantUser.objects.filter(
            tenant=tenant, is_active=True
        ).select_related("user")

        serializer = TenantUserSerializer(tenant_users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def add_user(self, request, pk=None):
        """Add a user to a tenant."""
        tenant = self.get_object()

        # Check if user has permission to manage this tenant
        if (
            not TenantUser.objects.filter(
                tenant=tenant,
                user=request.user,
                role__in=["owner", "admin"],
                is_active=True,
            ).exists()
            and not request.user.is_superuser
        ):
            return Response(
                {"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = TenantUserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def my_tenants(self, request):
        """Get all tenants for the current user.
        
        For superusers/global admins, returns ALL tenants.
        For regular users, returns only tenants they belong to.
        """
        user = request.user
        
        # Superusers can access all tenants
        if user.is_superuser or getattr(user, 'is_global_admin', False):
            tenants = Tenant.objects.filter(is_active=True).order_by('name')
            # Return in same format as UserTenantSerializer
            data = [
                {
                    'id': str(t.id),
                    'name': t.name,
                    'slug': t.slug,
                    'role': 'owner',  # Superuser has full access
                    'is_primary': False,
                }
                for t in tenants
            ]
            return Response(data)
        
        # Regular users - only tenants they belong to
        tenant_users = TenantUser.objects.filter(
            user=request.user, is_active=True
        ).select_related("tenant")

        serializer = UserTenantSerializer(tenant_users, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"])
    def current_theme(self, request):
        """
        Get theme settings for the current user's active tenant.
        
        Returns tenant logo, name, and theme colors.
        Used by frontend to apply tenant-specific branding.
        """
        # Get user's current/active tenant (you might have this in session or request header)
        # For now, get the first tenant the user belongs to
        tenant_user = TenantUser.objects.filter(
            user=request.user, is_active=True
        ).select_related("tenant").first()
        
        if not tenant_user:
            return Response(
                {"error": "User not associated with any tenant"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        theme_settings = tenant_user.tenant.get_theme_settings()
        return Response(theme_settings)
    
    @action(detail=False, methods=["get"])
    def admin_permissions(self, request):
        """
        Get admin permissions for the current user in their active tenant.
        
        Returns a dictionary of permission flags based on the user's role:
        - owner: Full access to everything
        - admin: Can manage users, configs, customizations, view audit logs
        - manager: Limited admin access
        - user/readonly: No admin access
        
        Used by frontend to show/hide admin workspace features.
        """
        # Get user's role in their current tenant
        # TODO: Use request.tenant from TenantMiddleware when available
        tenant_user = TenantUser.objects.filter(
            user=request.user, is_active=True
        ).select_related("tenant").first()
        
        if not tenant_user:
            return Response(
                {"error": "User not associated with any tenant"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        role = tenant_user.role
        
        # Define permissions based on role
        permissions_map = {
            'owner': {
                'can_manage_users': True,
                'can_invite_users': True,
                'can_change_roles': True,
                'can_manage_profile': True,
                'can_manage_billing': True,
                'can_manage_configurations': True,
                'can_manage_customizations': True,
                'can_view_audit_logs': True,
                'can_manage_option_lists': True,
            },
            'admin': {
                'can_manage_users': True,
                'can_invite_users': True,
                'can_change_roles': True,
                'can_manage_profile': True,
                'can_manage_billing': False,  # Only owners can manage billing
                'can_manage_configurations': True,
                'can_manage_customizations': True,
                'can_view_audit_logs': True,
                'can_manage_option_lists': True,
            },
            'manager': {
                'can_manage_users': False,
                'can_invite_users': True,
                'can_change_roles': False,
                'can_manage_profile': False,
                'can_manage_billing': False,
                'can_manage_configurations': False,
                'can_manage_customizations': False,
                'can_view_audit_logs': False,
                'can_manage_option_lists': False,
            },
            'user': {
                'can_manage_users': False,
                'can_invite_users': False,
                'can_change_roles': False,
                'can_manage_profile': False,
                'can_manage_billing': False,
                'can_manage_configurations': False,
                'can_manage_customizations': False,
                'can_view_audit_logs': False,
                'can_manage_option_lists': False,
            },
            'readonly': {
                'can_manage_users': False,
                'can_invite_users': False,
                'can_change_roles': False,
                'can_manage_profile': False,
                'can_manage_billing': False,
                'can_manage_configurations': False,
                'can_manage_customizations': False,
                'can_view_audit_logs': False,
                'can_manage_option_lists': False,
            },
        }
        
        # Get permissions for user's role, default to empty permissions
        permissions = permissions_map.get(role, permissions_map['readonly'])
        permissions['role'] = role
        
        return Response(permissions)
    
    @action(detail=True, methods=["post", "patch"])
    def update_theme(self, request, pk=None):
        """
        Update theme settings for a tenant.
        
        Only owners and admins can update theme settings.
        Accepts: primary_color_light, primary_color_dark
        """
        tenant = self.get_object()
        
        # Check if user has permission (owner or admin)
        if (
            not TenantUser.objects.filter(
                tenant=tenant,
                user=request.user,
                role__in=["owner", "admin"],
                is_active=True,
            ).exists()
            and not request.user.is_superuser
        ):
            return Response(
                {"error": "Only owners and admins can update theme settings"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update theme colors
        light_color = request.data.get('primary_color_light')
        dark_color = request.data.get('primary_color_dark')
        
        if light_color or dark_color:
            try:
                tenant.set_theme_colors(light_color, dark_color)
                return Response(tenant.get_theme_settings())
            except ValueError:
                return Response(
                    {"error": "Invalid hex color format. Use format: #RRGGBB (e.g., #3498db)"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response(
            {"error": "No theme colors provided"},
            status=status.HTTP_400_BAD_REQUEST
        )


class TenantUserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tenant-user associations.
    
    Enhanced with admin workspace features:
    - Search by user name or email
    - Bulk operations (bulk_update_roles, bulk_deactivate)
    - Pagination support
    """

    queryset = TenantUser.objects.all()
    serializer_class = TenantUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["tenant", "user", "role", "is_active"]
    search_fields = ["user__username", "user__email", "user__first_name", "user__last_name"]
    ordering_fields = ["created_at", "updated_at", "user__username", "role"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """Filter based on user permissions."""
        user = self.request.user
        if user.is_superuser:
            return TenantUser.objects.select_related("user", "tenant")

        # Users can only see associations for tenants they have admin access to
        admin_tenant_ids = TenantUser.objects.filter(
            user=user, role__in=["owner", "admin"], is_active=True
        ).values_list("tenant_id", flat=True)

        return TenantUser.objects.filter(tenant_id__in=admin_tenant_ids).select_related(
            "user", "tenant"
        )

    def perform_create(self, serializer):
        """Ensure user has permission to create associations."""
        tenant = serializer.validated_data["tenant"]

        # Check if user has admin access to the tenant
        if (
            not TenantUser.objects.filter(
                tenant=tenant,
                user=self.request.user,
                role__in=["owner", "admin"],
                is_active=True,
            ).exists()
            and not self.request.user.is_superuser
        ):
            raise permissions.PermissionDenied(
                "You don't have permission to manage users for this tenant."
            )

        serializer.save()

    def perform_update(self, serializer):
        """Ensure user has permission to update associations."""
        instance = self.get_object()

        # Check if user has admin access to the tenant
        if (
            not TenantUser.objects.filter(
                tenant=instance.tenant,
                user=self.request.user,
                role__in=["owner", "admin"],
                is_active=True,
            ).exists()
            and not self.request.user.is_superuser
        ):
            raise permissions.PermissionDenied(
                "You don't have permission to manage users for this tenant."
            )

        serializer.save()

    def perform_destroy(self, instance):
        """Soft delete by setting is_active to False."""
        instance.is_active = False
        instance.save()
    
    @action(detail=False, methods=["post"])
    def bulk_update_roles(self, request):
        """
        Bulk update roles for multiple users.
        
        Expected payload:
        {
            "user_ids": [1, 2, 3],
            "role": "admin"
        }
        """
        user_ids = request.data.get('user_ids', [])
        new_role = request.data.get('role')
        
        if not user_ids or not new_role:
            return Response(
                {"error": "user_ids and role are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_role not in dict(TenantUser.ROLE_CHOICES):
            return Response(
                {"error": f"Invalid role. Must be one of: {', '.join(dict(TenantUser.ROLE_CHOICES).keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get tenant users to update
        tenant_users = TenantUser.objects.filter(
            id__in=user_ids,
            is_active=True
        ).select_related('tenant')
        
        # Check permissions for each tenant
        updated_count = 0
        for tenant_user in tenant_users:
            # Check if requester has admin access to this tenant
            has_permission = (
                TenantUser.objects.filter(
                    tenant=tenant_user.tenant,
                    user=request.user,
                    role__in=["owner", "admin"],
                    is_active=True,
                ).exists()
                or request.user.is_superuser
            )
            
            if has_permission:
                tenant_user.role = new_role
                tenant_user.save()
                updated_count += 1
        
        return Response({
            "message": f"Successfully updated {updated_count} user(s)",
            "updated_count": updated_count
        })
    
    @action(detail=False, methods=["post"])
    def bulk_deactivate(self, request):
        """
        Bulk deactivate multiple users.
        
        Expected payload:
        {
            "user_ids": [1, 2, 3]
        }
        """
        user_ids = request.data.get('user_ids', [])
        
        if not user_ids:
            return Response(
                {"error": "user_ids is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get tenant users to deactivate
        tenant_users = TenantUser.objects.filter(
            id__in=user_ids,
            is_active=True
        ).select_related('tenant')
        
        # Check permissions for each tenant
        deactivated_count = 0
        for tenant_user in tenant_users:
            # Check if requester has admin access to this tenant
            has_permission = (
                TenantUser.objects.filter(
                    tenant=tenant_user.tenant,
                    user=request.user,
                    role__in=["owner", "admin"],
                    is_active=True,
                ).exists()
                or request.user.is_superuser
            )
            
            # Prevent self-deactivation
            if tenant_user.user == request.user:
                continue
            
            if has_permission:
                tenant_user.is_active = False
                tenant_user.save()
                deactivated_count += 1
        
        return Response({
            "message": f"Successfully deactivated {deactivated_count} user(s)",
            "deactivated_count": deactivated_count
        })


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing activity logs (audit trail).
    
    Read-only - logs are created automatically by the system.
    Only admins and owners can view activity logs.
    """
    
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["tenant", "user", "action", "entity_type"]
    search_fields = ["description", "entity_type", "entity_id"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
    
    def get_queryset(self):
        """Filter activity logs based on user permissions."""
        user = self.request.user
        
        if user.is_superuser:
            return ActivityLog.objects.select_related("user", "tenant")
        
        # Get tenants where user is admin or owner
        admin_tenant_ids = TenantUser.objects.filter(
            user=user,
            role__in=["owner", "admin"],
            is_active=True
        ).values_list("tenant_id", flat=True)
        
        return ActivityLog.objects.filter(
            tenant_id__in=admin_tenant_ids
        ).select_related("user", "tenant")


class TenantConfigurationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tenant configurations.
    
    Provides CRUD operations + bulk update and reset actions.
    Configurations are organized by category and support different data types.
    
    Permissions:
    - Only owners and admins can view/manage configurations
    - System configs can be modified but not deleted
    """
    
    queryset = TenantConfiguration.objects.all()
    serializer_class = TenantConfigurationSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrOwner]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["tenant", "category", "data_type", "is_system"]
    search_fields = ["key", "display_name", "description"]
    ordering_fields = ["category", "key", "created_at"]
    ordering = ["category", "key"]
    
    def get_queryset(self):
        """Filter configurations for user's tenant."""
        user = self.request.user
        
        if user.is_superuser:
            return TenantConfiguration.objects.select_related("tenant", "updated_by")
        
        # Get tenants where user is admin or owner
        admin_tenant_ids = TenantUser.objects.filter(
            user=user,
            role__in=["owner", "admin"],
            is_active=True
        ).values_list("tenant_id", flat=True)
        
        return TenantConfiguration.objects.filter(
            tenant_id__in=admin_tenant_ids
        ).select_related("tenant", "updated_by")
    
    def perform_create(self, serializer):
        """Set tenant and updated_by on creation."""
        # Use tenant from request (set by TenantMiddleware)
        tenant_id = self.request.headers.get('X-Tenant-ID')
        if tenant_id:
            tenant = Tenant.objects.get(id=tenant_id)
            serializer.save(tenant=tenant, updated_by=self.request.user)
        else:
            # Fallback: Use first tenant where user is admin
            tenant_user = TenantUser.objects.filter(
                user=self.request.user,
                role__in=["owner", "admin"],
                is_active=True
            ).first()
            
            if not tenant_user:
                raise permissions.PermissionDenied("User is not an admin of any tenant")
            
            serializer.save(tenant=tenant_user.tenant, updated_by=self.request.user)
    
    def perform_destroy(self, instance):
        """Prevent deletion of system configurations."""
        if instance.is_system:
            raise permissions.PermissionDenied("Cannot delete system configurations")
        super().perform_destroy(instance)
    
    @action(detail=False, methods=["post"])
    def bulk_update(self, request):
        """
        Bulk update multiple configurations.
        
        Expected payload:
        {
            "configurations": [
                {"id": "uuid1", "value": "new_value1"},
                {"id": "uuid2", "value": "new_value2"}
            ]
        }
        """
        configurations_data = request.data.get('configurations', [])
        
        if not configurations_data:
            return Response(
                {"error": "configurations array is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updated_count = 0
        errors = []
        
        for config_data in configurations_data:
            config_id = config_data.get('id')
            new_value = config_data.get('value')
            
            if not config_id:
                errors.append({"error": "Missing id for configuration"})
                continue
            
            try:
                config = TenantConfiguration.objects.get(id=config_id)
                
                # Check permission
                if not self.get_queryset().filter(id=config_id).exists():
                    errors.append({
                        "id": config_id,
                        "error": "Permission denied or configuration not found"
                    })
                    continue
                
                config.value = new_value
                config.updated_by = request.user
                config.save()
                updated_count += 1
                
            except TenantConfiguration.DoesNotExist:
                errors.append({"id": config_id, "error": "Configuration not found"})
            except Exception as e:
                errors.append({"id": config_id, "error": str(e)})
        
        response_data = {
            "message": f"Successfully updated {updated_count} configuration(s)",
            "updated_count": updated_count
        }
        
        if errors:
            response_data["errors"] = errors
        
        return Response(response_data)
    
    @action(detail=True, methods=["post"])
    def reset(self, request, pk=None):
        """Reset a configuration to its default value."""
        config = self.get_object()
        
        if not config.default_value:
            return Response(
                {"error": "No default value defined for this configuration"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        config.reset_to_default()
        config.updated_by = request.user
        config.save()
        
        serializer = self.get_serializer(config)
        return Response(serializer.data)
    
    @action(detail=False, methods=["post"])
    def reset_category(self, request):
        """
        Reset all configurations in a category to default values.
        
        Expected payload:
        {
            "category": "security"
        }
        """
        category = request.data.get('category')
        
        if not category:
            return Response(
                {"error": "category is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        configs = self.get_queryset().filter(category=category)
        
        reset_count = 0
        for config in configs:
            if config.default_value:
                config.reset_to_default()
                config.updated_by = request.user
                config.save()
                reset_count += 1
        
        return Response({
            "message": f"Reset {reset_count} configuration(s) in category '{category}'",
            "reset_count": reset_count
        })
