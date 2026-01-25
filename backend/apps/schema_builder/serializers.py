"""
Serializers for Schema Builder API.

Bundle One: Custom System Data
Provides REST API serialization for DataSchema, Fields, and Versions.
"""
from rest_framework import serializers

from .models import DataSchema, DataSchemaField, DataSchemaVersion, FieldOptionList


class DataSchemaFieldSerializer(serializers.ModelSerializer):
    """Serializer for DataSchemaField model."""
    
    field_type_display = serializers.CharField(source='get_field_type_display', read_only=True)
    
    class Meta:
        model = DataSchemaField
        fields = [
            'id', 'key', 'label', 'field_type', 'field_type_display',
            'is_visible', 'is_required', 'is_searchable', 'order',
            'options', 'default_value', 'help_text', 'placeholder',
            'validation_rules', 'decimal_places',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DataSchemaSerializer(serializers.ModelSerializer):
    """Serializer for DataSchema model."""
    
    fields = DataSchemaFieldSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    field_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = DataSchema
        fields = [
            'id', 'name', 'slug', 'description',
            'status', 'status_display', 'version',
            'is_active', 'is_system', 'icon', 'color',
            'fields', 'field_count',
            'created_at', 'updated_at', 'created_by', 'created_by_name',
            'submitted_at', 'submitted_by', 'published_at', 'published_by'
        ]
        read_only_fields = [
            'id', 'slug', 'version', 'created_at', 'updated_at',
            'submitted_at', 'submitted_by', 'published_at', 'published_by'
        ]
    
    def get_field_count(self, obj):
        return obj.fields.count()


class DataSchemaListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing schemas."""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    field_count = serializers.SerializerMethodField()
    
    class Meta:
        model = DataSchema
        fields = [
            'id', 'name', 'slug', 'description',
            'status', 'status_display', 'version',
            'is_active', 'icon', 'color', 'field_count',
            'created_at', 'updated_at'
        ]
    
    def get_field_count(self, obj):
        if hasattr(obj, '_field_count'):
            return obj._field_count
        return obj.fields.count()


class DataSchemaVersionSerializer(serializers.ModelSerializer):
    """Serializer for DataSchemaVersion model."""
    
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = DataSchemaVersion
        fields = [
            'id', 'version_number', 'action', 'snapshot_data',
            'notes', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = '__all__'


class FieldOptionListSerializer(serializers.ModelSerializer):
    """Serializer for FieldOptionList model."""
    
    option_count = serializers.SerializerMethodField()
    
    class Meta:
        model = FieldOptionList
        fields = [
            'id', 'name', 'description', 'options', 'option_count',
            'is_system', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_option_count(self, obj):
        return len(obj.options) if obj.options else 0


# =============================================================================
# FRONTEND SCHEMA DEFINITION SERIALIZER
# =============================================================================

class SchemaDefinitionSerializer(serializers.Serializer):
    """
    Serializer for frontend form generation.
    
    Returns a schema definition in a format optimized for 
    dynamic form rendering on the frontend.
    """
    
    def to_representation(self, instance):
        """Convert schema to frontend-friendly format."""
        fields_config = []
        
        for field in instance.fields.filter(is_visible=True).order_by('order'):
            field_config = {
                'key': field.key,
                'label': field.label,
                'type': field.field_type,
                'required': field.is_required,
                'searchable': field.is_searchable,
                'order': field.order,
            }
            
            # Add optional properties
            if field.help_text:
                field_config['helpText'] = field.help_text
            if field.placeholder:
                field_config['placeholder'] = field.placeholder
            if field.default_value is not None:
                field_config['defaultValue'] = field.default_value
            if field.options:
                field_config['options'] = field.options
            if field.validation_rules:
                field_config['validation'] = field.validation_rules
            if field.field_type in ['decimal', 'currency']:
                field_config['decimalPlaces'] = field.decimal_places
            
            fields_config.append(field_config)
        
        return {
            'id': str(instance.id),
            'name': instance.name,
            'slug': instance.slug,
            'description': instance.description,
            'version': instance.version,
            'icon': instance.icon,
            'color': instance.color,
            'fields': fields_config,
        }
