"""
URL configuration for Schema Builder API.

Bundle One: Custom System Data
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DataSchemaViewSet, DataSchemaFieldViewSet,
    DataSchemaVersionViewSet, FieldOptionListViewSet
)

app_name = 'schema_builder'

router = DefaultRouter()
router.register(r'schemas', DataSchemaViewSet, basename='data-schema')
router.register(r'fields', DataSchemaFieldViewSet, basename='schema-field')
router.register(r'versions', DataSchemaVersionViewSet, basename='schema-version')
router.register(r'option-lists', FieldOptionListViewSet, basename='option-list')

urlpatterns = [
    path('', include(router.urls)),
]
