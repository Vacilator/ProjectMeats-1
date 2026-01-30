"""
API ViewSets for Schema Builder.

Bundle One: Custom System Data
Provides REST API endpoints for DataSchema, Fields, and Versions.
"""
from django.db import models
from django.db.models import Count, Max
from django.core.cache import cache
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView

from .models import DataSchema, DataSchemaField, DataSchemaVersion, FieldOptionList, SchemaStatus, TenantFieldChoiceOverride
from .serializers import (
    DataSchemaSerializer, DataSchemaListSerializer, DataSchemaFieldSerializer,
    DataSchemaVersionSerializer, FieldOptionListSerializer, SchemaDefinitionSerializer,
    TenantFieldChoiceOverrideSerializer, EffectiveChoicesSerializer
)
from .permissions import can_submit_schema, can_publish_schema


# =============================================================================
# ADMIN SCHEMA EDITOR API VIEWS
# =============================================================================

class SchemaFieldsAPIView(APIView):
    """
    API endpoint for managing schema fields (list/create).
    Used by the schema editor admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, schema_id):
        """Get all fields for a schema."""
        try:
            schema = DataSchema.objects.get(pk=schema_id)
        except DataSchema.DoesNotExist:
            return Response(
                {'error': 'Schema not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        fields = schema.fields.all().order_by('order')
        fields_data = [{
            'id': str(field.id),
            'key': field.key,
            'label': field.label,
            'field_type': field.field_type,
            'is_required': field.is_required,
            'is_visible': field.is_visible,
            'is_searchable': field.is_searchable,
            'order': field.order,
            'help_text': field.help_text,
            'placeholder': field.placeholder,
            'options': field.options,
            'default_value': field.default_value,
            'validation_rules': field.validation_rules,
            'decimal_places': field.decimal_places
        } for field in fields]
        
        return Response({
            'schema_id': str(schema_id),
            'schema_name': schema.name,
            'fields': fields_data,
            'count': len(fields_data)
        })
    
    def post(self, request, schema_id):
        """Create a new field for a schema."""
        try:
            schema = DataSchema.objects.get(pk=schema_id)
        except DataSchema.DoesNotExist:
            return Response(
                {'error': 'Schema not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        label = request.data.get('label')
        key = request.data.get('key')
        field_type = request.data.get('field_type', 'text')
        
        if not label:
            return Response(
                {'error': 'label is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Auto-generate key if not provided
        if not key:
            from django.utils.text import slugify
            key = slugify(label).replace('-', '_')
        
        # Check for duplicate key
        if schema.fields.filter(key=key).exists():
            return Response(
                {'error': f'Field with key "{key}" already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get next order number
        max_order = schema.fields.aggregate(Max('order'))['order__max']
        next_order = 0 if max_order is None else max_order + 1
        
        # Create the field
        field = DataSchemaField.objects.create(
            schema=schema,
            key=key,
            label=label,
            field_type=field_type,
            is_required=request.data.get('is_required', False),
            is_visible=request.data.get('is_visible', True),
            is_searchable=request.data.get('is_searchable', True),
            order=next_order,
            help_text=request.data.get('help_text', ''),
            placeholder=request.data.get('placeholder', ''),
            options=request.data.get('options', []),
            default_value=request.data.get('default_value'),
            validation_rules=request.data.get('validation_rules', {}),
            decimal_places=request.data.get('decimal_places', 2)
        )
        
        return Response({
            'status': 'success',
            'message': 'Field created',
            'field': {
                'id': str(field.id),
                'key': field.key,
                'label': field.label,
                'field_type': field.field_type,
                'is_required': field.is_required,
                'is_visible': field.is_visible,
                'is_searchable': field.is_searchable,
                'order': field.order,
                'help_text': field.help_text,
                'placeholder': field.placeholder,
                'options': field.options,
                'default_value': field.default_value,
                'validation_rules': field.validation_rules,
                'decimal_places': field.decimal_places
            }
        }, status=status.HTTP_201_CREATED)


class SchemaFieldDetailAPIView(APIView):
    """
    API endpoint for managing individual schema fields (get/update/delete).
    Used by the schema editor admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, field_id):
        """Get a single field."""
        try:
            field = DataSchemaField.objects.get(pk=field_id)
        except DataSchemaField.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'id': str(field.id),
            'schema_id': str(field.schema_id),
            'key': field.key,
            'label': field.label,
            'field_type': field.field_type,
            'is_required': field.is_required,
            'is_visible': field.is_visible,
            'is_searchable': field.is_searchable,
            'order': field.order,
            'help_text': field.help_text,
            'placeholder': field.placeholder,
            'options': field.options,
            'default_value': field.default_value,
            'validation_rules': field.validation_rules,
            'decimal_places': field.decimal_places
        })
    
    def put(self, request, field_id):
        """Update a field."""
        try:
            field = DataSchemaField.objects.get(pk=field_id)
        except DataSchemaField.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update allowed fields (key cannot be changed)
        if 'label' in request.data:
            field.label = request.data['label']
        if 'field_type' in request.data:
            field.field_type = request.data['field_type']
        if 'is_required' in request.data:
            field.is_required = request.data['is_required']
        if 'is_visible' in request.data:
            field.is_visible = request.data['is_visible']
        if 'is_searchable' in request.data:
            field.is_searchable = request.data['is_searchable']
        if 'help_text' in request.data:
            field.help_text = request.data['help_text']
        if 'placeholder' in request.data:
            field.placeholder = request.data['placeholder']
        if 'options' in request.data:
            field.options = request.data['options']
        if 'default_value' in request.data:
            field.default_value = request.data['default_value']
        if 'validation_rules' in request.data:
            field.validation_rules = request.data['validation_rules']
        if 'decimal_places' in request.data:
            field.decimal_places = request.data['decimal_places']
        
        field.save()
        
        return Response({
            'status': 'success',
            'message': 'Field updated',
            'field': {
                'id': str(field.id),
                'key': field.key,
                'label': field.label,
                'field_type': field.field_type,
                'is_required': field.is_required,
                'is_visible': field.is_visible,
                'is_searchable': field.is_searchable,
                'order': field.order,
                'help_text': field.help_text,
                'placeholder': field.placeholder,
                'options': field.options,
                'default_value': field.default_value,
                'validation_rules': field.validation_rules,
                'decimal_places': field.decimal_places
            }
        })
    
    def delete(self, request, field_id):
        """Delete a field."""
        try:
            field = DataSchemaField.objects.get(pk=field_id)
        except DataSchemaField.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        field_label = field.label
        field.delete()
        
        return Response({
            'status': 'success',
            'message': f'Field "{field_label}" deleted'
        })


class SchemaReorderAPIView(APIView):
    """
    API endpoint for reordering schema fields.
    Used by the schema editor admin interface (drag-drop).
    """
    permission_classes = [IsAdminUser]
    
    def post(self, request, schema_id):
        """Reorder fields within a schema."""
        try:
            schema = DataSchema.objects.get(pk=schema_id)
        except DataSchema.DoesNotExist:
            return Response(
                {'error': 'Schema not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        field_order = request.data.get('field_order', [])
        
        if not field_order:
            return Response(
                {'error': 'field_order is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update order for each field
        for item in field_order:
            field_id = item.get('id')
            order = item.get('order', 0)
            if field_id:
                DataSchemaField.objects.filter(
                    id=field_id,
                    schema=schema
                ).update(order=order)
        
        return Response({
            'status': 'success',
            'message': 'Field order updated'
        })


# =============================================================================
# STANDARD VIEWSETS
# =============================================================================



class DataSchemaViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Data Schemas.
    
    Provides CRUD operations and workflow actions (submit, publish).
    Schema definitions can be fetched for frontend form generation.
    """
    
    queryset = DataSchema.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DataSchemaListSerializer
        if self.action == 'definition':
            return SchemaDefinitionSerializer
        return DataSchemaSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Annotate with field count for efficiency
        qs = qs.annotate(_field_count=Count('fields'))
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        # Filter by active only
        if self.request.query_params.get('active_only'):
            qs = qs.filter(is_active=True)
        
        # Filter published only (for frontend consumption)
        if self.request.query_params.get('published_only'):
            qs = qs.filter(status=SchemaStatus.PUBLISHED)
        
        return qs.select_related('created_by', 'submitted_by', 'published_by')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def definition(self, request, pk=None):
        """
        Get schema definition for frontend form generation.
        
        Returns a cached, frontend-optimized format of the schema.
        """
        schema = self.get_object()
        
        # Only published schemas can be used for form generation
        if schema.status != SchemaStatus.PUBLISHED:
            return Response(
                {'error': 'Only published schemas are available for form generation'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Try cache first
        cache_key = f'schema_definition_{schema.id}_{schema.version}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        # Generate definition
        serializer = SchemaDefinitionSerializer(schema)
        data = serializer.data
        
        # Cache for 1 hour
        cache.set(cache_key, data, 3600)
        
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit schema for review."""
        schema = self.get_object()
        
        if not can_submit_schema(request, schema):
            return Response(
                {'error': 'Cannot submit this schema'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            schema.submit(request.user)
            return Response({
                'status': 'submitted',
                'message': f'Schema "{schema.name}" has been submitted for review'
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish schema (superuser only)."""
        schema = self.get_object()
        
        if not can_publish_schema(request, schema):
            return Response(
                {'error': 'Only superusers can publish schemas'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            schema.publish(request.user)
            
            # Invalidate any cached definitions
            cache.delete_pattern(f'schema_definition_{schema.id}_*')
            
            return Response({
                'status': 'published',
                'version': schema.version,
                'message': f'Schema "{schema.name}" v{schema.version} is now published'
            })
        except (ValueError, PermissionError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def revert_to_draft(self, request, pk=None):
        """Revert schema to draft status."""
        schema = self.get_object()
        
        if not request.user.is_superuser:
            return Response(
                {'error': 'Only superusers can revert schemas'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            schema.revert_to_draft(request.user)
            return Response({
                'status': 'draft',
                'message': f'Schema "{schema.name}" has been reverted to draft'
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get version history for a schema."""
        schema = self.get_object()
        versions = schema.versions.all().select_related('created_by')
        serializer = DataSchemaVersionSerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def published(self, request):
        """
        Get all published schemas for frontend consumption.
        
        This endpoint is optimized for frontend form generation.
        """
        schemas = self.get_queryset().filter(
            status=SchemaStatus.PUBLISHED,
            is_active=True
        )
        
        # Return definitions, not full schemas
        definitions = []
        for schema in schemas:
            cache_key = f'schema_definition_{schema.id}_{schema.version}'
            cached = cache.get(cache_key)
            if cached:
                definitions.append(cached)
            else:
                serializer = SchemaDefinitionSerializer(schema)
                data = serializer.data
                cache.set(cache_key, data, 3600)
                definitions.append(data)
        
        return Response(definitions)


class DataSchemaFieldViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Schema Fields.
    
    Usually edited inline with schemas, but also available standalone.
    """
    
    queryset = DataSchemaField.objects.all()
    serializer_class = DataSchemaFieldSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by schema
        schema_id = self.request.query_params.get('schema')
        if schema_id:
            qs = qs.filter(schema_id=schema_id)
        
        return qs.select_related('schema').order_by('order')
    
    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder fields within a schema."""
        schema_id = request.data.get('schema_id')
        field_order = request.data.get('field_order', [])  # List of field IDs in order
        
        if not schema_id:
            return Response(
                {'error': 'schema_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        for index, field_id in enumerate(field_order):
            DataSchemaField.objects.filter(
                id=field_id,
                schema_id=schema_id
            ).update(order=index)
        
        return Response({'status': 'reordered'})


class DataSchemaVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for Schema Versions.
    
    Read-only - versions are created automatically by the system.
    """
    
    queryset = DataSchemaVersion.objects.all()
    serializer_class = DataSchemaVersionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by schema
        schema_id = self.request.query_params.get('schema')
        if schema_id:
            qs = qs.filter(schema_id=schema_id)
        
        return qs.select_related('schema', 'created_by').order_by('-created_at')


class FieldOptionListViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Field Option Lists.
    
    System-level reusable option lists for dropdown/multiselect fields.
    """
    
    queryset = FieldOptionList.objects.all()
    serializer_class = FieldOptionListSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter system lists only
        if self.request.query_params.get('system_only'):
            qs = qs.filter(is_system=True)
        
        return qs.order_by('name')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def destroy(self, request, *args, **kwargs):
        """Prevent deletion of system lists."""
        instance = self.get_object()
        if instance.is_system:
            return Response(
                {'error': 'System lists cannot be deleted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class TenantFieldChoiceOverrideViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Tenant Field Choice Overrides.
    
    Allows admins to override entity field choices at tenant level.
    Root-level overrides (tenant=None) serve as system defaults.
    """
    
    queryset = TenantFieldChoiceOverride.objects.all()
    serializer_class = TenantFieldChoiceOverrideSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by tenant
        tenant_id = self.request.query_params.get('tenant')
        if tenant_id == 'root':
            qs = qs.filter(tenant__isnull=True)
        elif tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        
        # Filter by entity type
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        
        # Filter by field name
        field_name = self.request.query_params.get('field_name')
        if field_name:
            qs = qs.filter(field_name=field_name)
        
        # Filter active only
        if self.request.query_params.get('active_only'):
            qs = qs.filter(is_active=True)
        
        return qs.select_related('tenant', 'option_list', 'created_by')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EffectiveChoicesAPIView(APIView):
    """
    API endpoint for getting effective choices for an entity field.
    
    Combines default choices with root-level and tenant-level overrides.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, entity_type, field_name):
        """Get effective choices for an entity field."""
        from tenant_apps.workflows.services import FieldRegistry
        
        # Get tenant from request
        tenant = getattr(request, 'tenant', None)
        
        # Get default choices from field registry
        default_choices = None
        fields = FieldRegistry.get_fields_for_entity(entity_type)
        for field in fields:
            if field.get('name') == field_name and field.get('choices'):
                default_choices = [(c['value'], c['label']) for c in field['choices']]
                break
        
        # Get effective choices with overrides applied
        choices = TenantFieldChoiceOverride.get_effective_choices(
            entity_type=entity_type,
            field_name=field_name,
            tenant=tenant,
            default_choices=default_choices
        )
        
        # Check if there's an override
        override = TenantFieldChoiceOverride.objects.filter(
            entity_type=entity_type,
            field_name=field_name,
            is_active=True
        ).filter(
            models.Q(tenant__isnull=True) | models.Q(tenant=tenant)
        ).order_by('-tenant').first()  # Prefer tenant over root
        
        return Response({
            'entity_type': entity_type,
            'field_name': field_name,
            'choices': choices,
            'has_override': override is not None,
            'override_mode': override.mode if override else None,
            'override_source': ('tenant' if override and override.tenant else 'root') if override else None
        })


class EntityChoiceFieldsAPIView(APIView):
    """
    API endpoint for listing all entity fields that have choices.
    
    Used by admin UI to show which fields can have choice overrides.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get all entity fields that have choices (select/multiselect)."""
        from tenant_apps.workflows.services import FieldRegistry
        
        result = []
        entity_types = FieldRegistry.get_entity_types()
        
        for entity_type in entity_types:
            fields = FieldRegistry.get_fields_for_entity(entity_type)
            choice_fields = []
            
            for field in fields:
                if field.get('choices') or field.get('type') in ['select', 'multiselect']:
                    choice_fields.append({
                        'name': field.get('name'),
                        'label': field.get('label', field.get('name')),
                        'type': field.get('type'),
                        'default_choice_count': len(field.get('choices', [])),
                    })
            
            if choice_fields:
                result.append({
                    'entity_type': entity_type,
                    'choice_fields': choice_fields,
                })
        
        return Response({
            'entities': result,
            'total_fields': sum(len(e['choice_fields']) for e in result)
        })
