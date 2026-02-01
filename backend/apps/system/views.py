"""
Views for System app API.

Provides DRF ViewSets for:
- SystemChoiceList (read-only for most users, admin can edit)
- SystemChoiceItem (tenant admins can add custom items)
- SystemFieldSchema (admin only)
- TenantConfig (tenant admins can manage their configs)
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from apps.system.models import (
    SystemChoiceList,
    SystemChoiceItem,
    SystemFieldSchema,
    TenantConfig,
)
from apps.system.serializers import (
    SystemChoiceListSerializer,
    SystemChoiceListMinimalSerializer,
    SystemChoiceItemSerializer,
    SystemFieldSchemaSerializer,
    TenantConfigSerializer,
    ChoiceItemCreateSerializer,
    BulkChoiceUpdateSerializer,
)
from apps.system.services.config_resolver import ConfigResolver


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated users, write for admins."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_staff


class IsTenantAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated users, write for tenant admins."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        # Check if user is a tenant admin
        return (
            request.user.is_authenticated and 
            (request.user.is_staff or getattr(request.user, 'is_tenant_admin', False))
        )


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
    permission_classes = [permissions.IsAuthenticated]
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
        instance.delete()
    
    def perform_update(self, serializer):
        """Only allow updating tenant-owned items (or if admin)."""
        instance = serializer.instance
        if instance.tenant_id is None and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot modify system-defined items.")
        serializer.save()


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
        serializer.save(tenant=tenant, updated_by=self.request.user)
    
    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
    
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
