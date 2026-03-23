"""
Views for System app API.

Provides DRF ViewSets for:
- SystemChoiceList (read-only for most users, admin can edit)
- SystemChoiceItem (tenant admins can add custom items)
- SystemFieldSchema (admin only)
- TenantConfig (tenant admins can manage their configs)
- ConfigAuditLog (read-only audit trail)
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.system.models import (
    SystemChoiceList,
    SystemChoiceItem,
    SystemFieldSchema,
    TenantConfig,
    ConfigAuditLog,
    TenantChoiceOverride,
)

from apps.tenants.models import TenantUser
from apps.tenants.activity_models import ActivityLog
from apps.system.serializers import (
    SystemChoiceListSerializer,
    SystemChoiceListMinimalSerializer,
    SystemChoiceItemSerializer,
    SystemFieldSchemaSerializer,
    TenantConfigSerializer,
    ChoiceItemCreateSerializer,
    BulkChoiceUpdateSerializer,
    TenantChoiceOverrideSerializer,
    ConfigAuditLogSerializer,
    ConfigAuditLogSummarySerializer,
)
from apps.system.services.config_resolver import ConfigResolver
from apps.system.services.entity_introspection import (
    get_entity_models,
    get_entity_fields,
    get_entity_display_fields,
)


def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated users, write for admins."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_staff


class IsTenantAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated users, write for tenant admins/owners."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated

        if not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.is_staff:
            return True

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return False

        return TenantUser.objects.filter(
            tenant=tenant,
            user=request.user,
            role__in=['owner', 'admin'],
            is_active=True,
        ).exists()


class SystemChoiceListViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for SystemChoiceList.
    
    GET /api/v1/system/choice-lists/ - List all choice lists
    GET /api/v1/system/choice-lists/{slug}/ - Get choice list with items
    GET /api/v1/system/choice-lists/{slug}/items/ - Get just the items (with tenant custom)
    POST /api/v1/system/choice-lists/{slug}/items/ - Add tenant custom item
    """
    queryset = SystemChoiceList.objects.all()
    serializer_class = SystemChoiceListSerializer
    permission_classes = [IsTenantAdminOrReadOnly]
    lookup_field = 'slug'
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SystemChoiceListMinimalSerializer
        return SystemChoiceListSerializer
    
    def get_serializer(self, *args, **kwargs):
        serializer_class = self.get_serializer_class()
        return serializer_class(*args, **kwargs)
    
    @action(detail=True, methods=['get', 'post'])
    def items(self, request, slug=None):
        """
        GET: Get choice items for this list (including tenant custom items).
        POST: Add a custom item for the current tenant.
        """
        choice_list = self.get_object()
        tenant = getattr(request, 'tenant', None)
        
        if request.method == 'GET':
            # Get items with tenant filtering
            items = SystemChoiceItem.objects.filter(
                choice_list=choice_list,
                is_active=True
            )
            
            if tenant:
                # System items + tenant's custom items
                items = items.filter(
                    Q(tenant__isnull=True) | Q(tenant=tenant)
                )
            else:
                # System items only
                items = items.filter(tenant__isnull=True)
            
            items = items.order_by('order', 'label')
            serializer = SystemChoiceItemSerializer(items, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Create custom item for tenant
            if not choice_list.is_extensible:
                return Response(
                    {'error': 'This choice list does not allow custom items.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not tenant:
                return Response(
                    {'error': 'Tenant context required to add custom items.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = ChoiceItemCreateSerializer(
                data=request.data,
                context={'choice_list': choice_list, 'tenant': tenant}
            )
            serializer.is_valid(raise_exception=True)
            
            item = SystemChoiceItem.objects.create(
                choice_list=choice_list,
                tenant=tenant,
                **serializer.validated_data
            )

            try:
                ConfigAuditLog.log_change(
                    entity=item,
                    change_type=ConfigAuditLog.ChangeType.CREATE,
                    user=request.user,
                    tenant=tenant,
                    request=request,
                    snapshot_after={
                        'id': str(item.id),
                        'choice_list': choice_list.slug,
                        'value': item.value,
                        'label': item.label,
                        'order': item.order,
                    },
                )
            except Exception:
                pass

            try:
                ActivityLog.log_activity(
                    tenant=tenant,
                    user=request.user,
                    action='optionlist.update',
                    description=f"Added custom option '{item.label}' to list {choice_list.slug}.",
                    entity_type='SystemChoiceItem',
                    entity_id=item.id,
                    metadata={'choice_list': choice_list.slug},
                    ip_address=_get_client_ip(request),
                )
            except Exception:
                pass

            return Response(
                SystemChoiceItemSerializer(item).data,
                status=status.HTTP_201_CREATED
            )
    
    @action(detail=True, methods=['post'])
    def reorder(self, request, slug=None):
        """Reorder items within this choice list."""
        choice_list = self.get_object()
        
        if not choice_list.is_reorderable:
            return Response(
                {'error': 'This choice list does not allow reordering.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = BulkChoiceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        tenant = getattr(request, 'tenant', None)
        
        for item_data in serializer.validated_data['items']:
            item_id = item_data['id']
            new_order = int(item_data['order'])

            # Only allow updating tenant's own items or system items (if admin)
            item_filter = {'id': item_id, 'choice_list': choice_list}
            if not request.user.is_staff:
                item_filter['tenant'] = tenant

            SystemChoiceItem.objects.filter(**item_filter).update(order=new_order)

        try:
            ConfigAuditLog.log_change(
                entity=choice_list,
                change_type=ConfigAuditLog.ChangeType.UPDATE,
                user=request.user,
                tenant=tenant,
                request=request,
                notes='Reordered choice list items.',
                new_value={'count': len(serializer.validated_data['items'])},
            )
        except Exception:
            pass

        try:
            if tenant:
                ActivityLog.log_activity(
                    tenant=tenant,
                    user=request.user,
                    action='optionlist.update',
                    description=f"Reordered items for list {choice_list.slug}.",
                    entity_type='SystemChoiceList',
                    entity_id=choice_list.id,
                    metadata={'choice_list': choice_list.slug},
                    ip_address=_get_client_ip(request),
                )
        except Exception:
            pass

        return Response({'status': 'ok'})


class SystemChoiceItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tenant-specific choice items.
    
    Only allows modification of tenant-owned items.
    System items (tenant=None) are read-only.
    """
    serializer_class = SystemChoiceItemSerializer
    permission_classes = [IsTenantAdminOrReadOnly]
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        
        if self.request.user.is_staff:
            return SystemChoiceItem.objects.all()
        
        if tenant:
            return SystemChoiceItem.objects.filter(
                Q(tenant__isnull=True) | Q(tenant=tenant)
            )
        
        return SystemChoiceItem.objects.filter(tenant__isnull=True)
    
    def perform_destroy(self, instance):
        """Only allow deleting tenant-owned items."""
        if instance.tenant_id is None:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cannot delete system-defined items.")

        tenant = getattr(self.request, 'tenant', None)
        snapshot_before = {
            'id': str(instance.id),
            'choice_list': getattr(instance.choice_list, 'slug', None),
            'value': instance.value,
            'label': instance.label,
            'order': instance.order,
        }

        instance.delete()

        try:
            ConfigAuditLog.log_change(
                entity=instance,
                change_type=ConfigAuditLog.ChangeType.DELETE,
                user=self.request.user,
                tenant=tenant,
                request=self.request,
                snapshot_before=snapshot_before,
            )
        except Exception:
            pass

        try:
            if tenant:
                ActivityLog.log_activity(
                    tenant=tenant,
                    user=self.request.user,
                    action='optionlist.delete',
                    description=f"Deleted tenant option '{snapshot_before['label']}'.",
                    entity_type='SystemChoiceItem',
                    entity_id=snapshot_before['id'],
                    metadata={'choice_list': snapshot_before['choice_list']},
                    ip_address=_get_client_ip(self.request),
                )
        except Exception:
            pass

    def perform_update(self, serializer):
        """Only allow updating tenant-owned items (or if admin)."""
        instance = serializer.instance
        if instance.tenant_id is None and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cannot modify system-defined items.")

        tenant = getattr(self.request, 'tenant', None)
        snapshot_before = {
            'id': str(instance.id),
            'choice_list': getattr(instance.choice_list, 'slug', None),
            'value': instance.value,
            'label': instance.label,
            'order': instance.order,
            'is_active': instance.is_active,
        }

        updated = serializer.save()

        try:
            ConfigAuditLog.log_change(
                entity=updated,
                change_type=ConfigAuditLog.ChangeType.UPDATE,
                user=self.request.user,
                tenant=tenant,
                request=self.request,
                snapshot_before=snapshot_before,
                snapshot_after={
                    'id': str(updated.id),
                    'choice_list': getattr(updated.choice_list, 'slug', None),
                    'value': updated.value,
                    'label': updated.label,
                    'order': updated.order,
                    'is_active': updated.is_active,
                },
            )
        except Exception:
            pass

        try:
            if tenant:
                ActivityLog.log_activity(
                    tenant=tenant,
                    user=self.request.user,
                    action='optionlist.update',
                    description=f"Updated option '{updated.label}'.",
                    entity_type='SystemChoiceItem',
                    entity_id=updated.id,
                    metadata={'choice_list': getattr(updated.choice_list, 'slug', None)},
                    ip_address=_get_client_ip(self.request),
                )
        except Exception:
            pass


class SystemFieldSchemaViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SystemFieldSchema.
    
    Admin-only for modifications.
    """
    queryset = SystemFieldSchema.objects.all()
    serializer_class = SystemFieldSchemaSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = 'field_path'
    
    def get_object(self):
        """Allow lookup by field_path with dots."""
        field_path = self.kwargs.get('field_path', '')
        return SystemFieldSchema.objects.get(field_path=field_path)


class TenantChoiceOverrideViewSet(viewsets.ModelViewSet):
    """CRUD for TenantChoiceOverride (tenant-specific choice visibility and ordering)."""

    serializer_class = TenantChoiceOverrideSerializer
    permission_classes = [IsTenantAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['choice_list']
    ordering_fields = ['updated_at', 'created_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        qs = TenantChoiceOverride.objects.all().select_related('tenant', 'choice_list', 'updated_by')

        if self.request.user.is_staff or self.request.user.is_superuser:
            return qs

        if not tenant:
            return TenantChoiceOverride.objects.none()

        return qs.filter(tenant=tenant)

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            from rest_framework.exceptions import ValidationError

            raise ValidationError('Tenant context required.')

        instance = serializer.save(tenant=tenant, updated_by=self.request.user)

        try:
            ConfigAuditLog.log_change(
                entity=instance,
                change_type=ConfigAuditLog.ChangeType.CREATE,
                user=self.request.user,
                tenant=tenant,
                request=self.request,
                snapshot_after={
                    'id': str(instance.id),
                    'choice_list': str(instance.choice_list_id),
                    'disabled_system_items': list(instance.disabled_system_items or []),
                    'display_config': instance.display_config or {},
                },
            )
        except Exception:
            pass

        try:
            ActivityLog.log_activity(
                tenant=tenant,
                user=self.request.user,
                action='optionlist.update',
                description='Updated tenant choice list customizations.',
                entity_type='TenantChoiceOverride',
                entity_id=instance.id,
                metadata={'choice_list': str(instance.choice_list_id)},
                ip_address=_get_client_ip(self.request),
            )
        except Exception:
            pass

    def perform_update(self, serializer):
        instance = serializer.instance
        tenant = getattr(self.request, 'tenant', None)
        snapshot_before = {
            'id': str(instance.id),
            'choice_list': str(instance.choice_list_id),
            'disabled_system_items': list(instance.disabled_system_items or []),
            'display_config': instance.display_config or {},
        }

        updated = serializer.save(updated_by=self.request.user)

        try:
            ConfigAuditLog.log_change(
                entity=updated,
                change_type=ConfigAuditLog.ChangeType.UPDATE,
                user=self.request.user,
                tenant=tenant,
                request=self.request,
                snapshot_before=snapshot_before,
                snapshot_after={
                    'id': str(updated.id),
                    'choice_list': str(updated.choice_list_id),
                    'disabled_system_items': list(updated.disabled_system_items or []),
                    'display_config': updated.display_config or {},
                },
            )
        except Exception:
            pass

        try:
            if tenant:
                ActivityLog.log_activity(
                    tenant=tenant,
                    user=self.request.user,
                    action='optionlist.update',
                    description='Updated tenant choice list customizations.',
                    entity_type='TenantChoiceOverride',
                    entity_id=updated.id,
                    metadata={'choice_list': str(updated.choice_list_id)},
                    ip_address=_get_client_ip(self.request),
                )
        except Exception:
            pass


class TenantConfigViewSet(viewsets.ModelViewSet):
    """
    ViewSet for TenantConfig.
    
    Tenant admins can manage their own configurations.
    """
    serializer_class = TenantConfigSerializer
    permission_classes = [IsTenantAdminOrReadOnly]
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        
        if self.request.user.is_staff:
            return TenantConfig.objects.all()
        
        if tenant:
            return TenantConfig.objects.filter(tenant=tenant)
        
        return TenantConfig.objects.none()
    
    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("Tenant context required.")

        instance = serializer.save(tenant=tenant, updated_by=self.request.user)

        try:
            ConfigAuditLog.log_change(
                entity=instance,
                change_type=ConfigAuditLog.ChangeType.CREATE,
                user=self.request.user,
                tenant=tenant,
                request=self.request,
                snapshot_after={'id': str(instance.id), 'key': instance.key, 'value': instance.value},
            )
        except Exception:
            pass

        try:
            ActivityLog.log_activity(
                tenant=tenant,
                user=self.request.user,
                action='config.update',
                description=f"Created config {instance.key}.",
                entity_type='TenantConfig',
                entity_id=instance.id,
                metadata={'key': instance.key},
                ip_address=_get_client_ip(self.request),
            )
        except Exception:
            pass

    def perform_update(self, serializer):
        instance = serializer.instance
        tenant = getattr(self.request, 'tenant', None)
        snapshot_before = {'id': str(instance.id), 'key': instance.key, 'value': instance.value}

        updated = serializer.save(updated_by=self.request.user)

        try:
            ConfigAuditLog.log_change(
                entity=updated,
                change_type=ConfigAuditLog.ChangeType.UPDATE,
                user=self.request.user,
                tenant=tenant,
                request=self.request,
                snapshot_before=snapshot_before,
                snapshot_after={'id': str(updated.id), 'key': updated.key, 'value': updated.value},
            )
        except Exception:
            pass

        try:
            if tenant:
                ActivityLog.log_activity(
                    tenant=tenant,
                    user=self.request.user,
                    action='config.update',
                    description=f"Updated config {updated.key}.",
                    entity_type='TenantConfig',
                    entity_id=updated.id,
                    metadata={'key': updated.key},
                    ip_address=_get_client_ip(self.request),
                )
        except Exception:
            pass
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get configs grouped by category."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({})
        
        resolver = ConfigResolver(tenant=tenant)
        configs = resolver.get_all_tenant_configs()
        
        # Group by first part of key
        grouped = {}
        for key, value in configs.items():
            category = key.split('.')[0] if '.' in key else 'other'
            if category not in grouped:
                grouped[category] = {}
            grouped[category][key] = value
        
        return Response(grouped)


class ConfigResolverView(viewsets.ViewSet):
    """
    ViewSet for resolving configuration values.
    
    GET /api/v1/system/config/resolve/?key=ui.theme.primary_color
    GET /api/v1/system/config/choices/{slug}/
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def resolve(self, request):
        """Resolve a configuration value with cascading."""
        key = request.query_params.get('key')
        default = request.query_params.get('default')
        
        if not key:
            return Response(
                {'error': 'key parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tenant = getattr(request, 'tenant', None)
        resolver = ConfigResolver(tenant=tenant)
        value = resolver.get(key, default=default)
        
        return Response({'key': key, 'value': value})
    
    @action(detail=False, methods=['get'], url_path='choices/(?P<slug>[^/.]+)')
    def choices(self, request, slug=None):
        """Get choice items for a dropdown field."""
        tenant = getattr(request, 'tenant', None)
        resolver = ConfigResolver(tenant=tenant)
        
        try:
            choices = resolver.get_choices(slug)
            return Response(choices)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'], url_path='field-schema/(?P<field_path>.+)')
    def field_schema(self, request, field_path=None):
        """Get field schema configuration."""
        tenant = getattr(request, 'tenant', None)
        resolver = ConfigResolver(tenant=tenant)
        
        schema = resolver.get_field_schema(field_path)
        if schema:
            return Response(schema)
        return Response(
            {'error': f'No schema found for {field_path}'},
            status=status.HTTP_404_NOT_FOUND
        )


class ConfigAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for ConfigAuditLog.
    
    Provides audit trail viewing with filtering capabilities.
    Only accessible to staff users or tenant admins.
    
    GET /api/v1/system/audit-logs/ - List audit logs
    GET /api/v1/system/audit-logs/{id}/ - Get single log entry
    GET /api/v1/system/audit-logs/summary/ - Get summary statistics
    """
    permission_classes = [IsTenantAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['entity_type', 'change_type', 'user']
    search_fields = ['entity_name', 'user_email', 'notes']
    ordering_fields = ['created_at', 'entity_type', 'change_type']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter audit logs by tenant context."""
        tenant = getattr(self.request, 'tenant', None)
        
        if self.request.user.is_staff:
            # Staff can see all logs
            qs = ConfigAuditLog.objects.all()
        elif tenant:
            # Tenant admins see their tenant's logs + system-level logs
            qs = ConfigAuditLog.objects.filter(
                Q(tenant=tenant) | Q(tenant__isnull=True)
            )
        else:
            # No tenant context - only system-level logs
            qs = ConfigAuditLog.objects.filter(tenant__isnull=True)
        
        # Apply date filters from query params
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__lte=date_to)
        
        return qs.select_related('user', 'tenant')
    
    def get_serializer_class(self):
        """Use summary serializer for list, full serializer for detail."""
        if self.action == 'list':
            return ConfigAuditLogSummarySerializer
        return ConfigAuditLogSerializer
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for audit logs."""
        qs = self.get_queryset()
        
        # Count by entity type
        from django.db.models import Count
        by_entity = qs.values('entity_type').annotate(count=Count('id')).order_by('-count')
        
        # Count by change type
        by_change = qs.values('change_type').annotate(count=Count('id')).order_by('-count')
        
        # Count by user
        by_user = qs.values('user_email').annotate(count=Count('id')).order_by('-count')[:10]
        
        # Recent activity
        recent = qs[:5]
        
        return Response({
            'total_count': qs.count(),
            'by_entity_type': list(by_entity),
            'by_change_type': list(by_change),
            'by_user': list(by_user),
            'recent': ConfigAuditLogSummarySerializer(recent, many=True).data,
        })
    
    @action(detail=False, methods=['get'])
    def entity_history(self, request):
        """Get history for a specific entity."""
        entity_type = request.query_params.get('entity_type')
        entity_name = request.query_params.get('entity_name')
        object_id = request.query_params.get('object_id')
        
        if not (entity_type or object_id):
            return Response(
                {'error': 'entity_type or object_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        qs = self.get_queryset()
        
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if entity_name:
            qs = qs.filter(entity_name__icontains=entity_name)
        if object_id:
            qs = qs.filter(object_id=object_id)
        
        serializer = ConfigAuditLogSerializer(qs[:50], many=True)
        return Response(serializer.data)


class EntityIntrospectionViewSet(viewsets.ViewSet):
    """ViewSet for entity introspection and field metadata.

    Phase 3: Schema Bridge.
    Provides entity types and field definitions from Django models.

    Note: entity IDs are dotted strings (e.g., `tenant_apps.locations.location`). DRF routers
    default to `lookup_value_regex = [^/.]+`, which would truncate at dots and break
    `/api/v1/system/entities/<entity_id>/fields/`.
    """

    # Allow dots in the entity id URL segment (DRF DefaultRouter uses this regex)
    lookup_value_regex = r'[^/]+'

    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request):
        """
        List all business entities from tenant_apps.
        
        Returns entity metadata including field counts and descriptions.
        """
        entities = get_entity_models()
        return Response({
            'count': len(entities),
            'results': entities
        })
    
    @action(detail=True, methods=['get'], url_path='fields')
    def fields(self, request, pk=None):
        """
        Get field definitions for a specific entity.
        
        Args:
            pk: Entity ID (e.g., 'suppliers.supplier')
            
        Returns:
            List of field definitions with types, validation rules, etc.
        """
        fields = get_entity_fields(pk)
        
        if not fields:
            return Response(
                {'error': f'Entity not found: {pk}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'entity_id': pk,
            'field_count': len(fields),
            'fields': fields
        })
    
    @action(detail=True, methods=['get'], url_path='display-fields')
    def display_fields(self, request, pk=None):
        """
        Get recommended display fields for entity lookups.
        
        Args:
            pk: Entity ID (e.g., 'suppliers.supplier')
            
        Returns:
            List of field names suitable for display in lookups
        """
        display_fields = get_entity_display_fields(pk)
        
        return Response({
            'entity_id': pk,
            'display_fields': display_fields
        })
