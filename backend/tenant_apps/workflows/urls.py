"""
URL configuration for Tenant Workflows API.

Bundle Two: System → Tenant Workflows & New Data Entities
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TenantListViewSet,
    TenantFormViewSet, TenantFormEntityViewSet, 
    TenantFormFieldViewSet, TenantFormRuleViewSet,
    TenantWorkflowViewSet, TenantWorkflowConditionViewSet,
    TenantWorkflowActionViewSet, WorkflowExecutionLogViewSet
)

app_name = 'workflows'

router = DefaultRouter()

# Lists
router.register(r'lists', TenantListViewSet, basename='tenant-list')

# Forms
router.register(r'forms', TenantFormViewSet, basename='tenant-form')
router.register(r'form-entities', TenantFormEntityViewSet, basename='tenant-form-entity')
router.register(r'form-fields', TenantFormFieldViewSet, basename='tenant-form-field')
router.register(r'form-rules', TenantFormRuleViewSet, basename='tenant-form-rule')

# Workflows
router.register(r'workflows', TenantWorkflowViewSet, basename='tenant-workflow')
router.register(r'workflow-conditions', TenantWorkflowConditionViewSet, basename='tenant-workflow-condition')
router.register(r'workflow-actions', TenantWorkflowActionViewSet, basename='tenant-workflow-action')
router.register(r'execution-logs', WorkflowExecutionLogViewSet, basename='workflow-execution-log')

urlpatterns = [
    path('', include(router.urls)),
]
