"""
URL configuration for Schema Builder API.

Bundle One: Custom System Data
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DataSchemaViewSet, DataSchemaFieldViewSet,
    DataSchemaVersionViewSet, FieldOptionListViewSet,
    TenantFieldChoiceOverrideViewSet,
    # Admin Schema Editor APIs
    SchemaFieldsAPIView, SchemaFieldDetailAPIView, SchemaReorderAPIView,
    # Choice Override APIs
    EffectiveChoicesAPIView, EntityChoiceFieldsAPIView
)

app_name = 'schema_builder'

router = DefaultRouter()
router.register(r'schemas', DataSchemaViewSet, basename='data-schema')
router.register(r'fields', DataSchemaFieldViewSet, basename='schema-field')
router.register(r'versions', DataSchemaVersionViewSet, basename='schema-version')
router.register(r'option-lists', FieldOptionListViewSet, basename='option-list')
router.register(r'choice-overrides', TenantFieldChoiceOverrideViewSet, basename='choice-override')

urlpatterns = [
    path('', include(router.urls)),
    
    # Admin Schema Editor API endpoints
    path('admin/schemas/<uuid:schema_id>/fields/', SchemaFieldsAPIView.as_view(), name='admin-schema-fields'),
    path('admin/fields/<uuid:field_id>/', SchemaFieldDetailAPIView.as_view(), name='admin-field-detail'),
    path('admin/schemas/<uuid:schema_id>/reorder/', SchemaReorderAPIView.as_view(), name='admin-schema-reorder'),
    
    # Choice Override API endpoints
    path('choices/<str:entity_type>/<str:field_name>/effective/', EffectiveChoicesAPIView.as_view(), name='effective-choices'),
    path('entity-choice-fields/', EntityChoiceFieldsAPIView.as_view(), name='entity-choice-fields'),
]
