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
    TenantWorkflowActionViewSet, WorkflowExecutionLogViewSet,
    # Admin Form Builder API Views
    EntityFieldsAPIView, AvailableEntitiesAPIView,
    FormStepFieldsAPIView, FormStepReorderAPIView, SmartFieldMatchAPIView,
    FieldConfigAPIView, FormRulesAPIView, FormRuleDetailAPIView,
    FormStepsAPIView, FormStepDetailAPIView,
    FormMappingsAPIView, FormAutoMapAPIView, FieldMappingAPIView,
    # Form Submission API Views
    FormSubmissionViewSet, AvailableFormsViewSet, QuickActionsAPIView
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

# Form Submissions
router.register(r'form-submissions', FormSubmissionViewSet, basename='form-submission')
router.register(r'available-forms', AvailableFormsViewSet, basename='available-form')

urlpatterns = [
    path('', include(router.urls)),
    
    # Admin Form Builder API endpoints
    path('admin/entities/', AvailableEntitiesAPIView.as_view(), name='admin-available-entities'),
    path('admin/entities/<str:entity_type>/fields/', EntityFieldsAPIView.as_view(), name='admin-entity-fields'),
    path('admin/steps/<uuid:step_id>/fields/', FormStepFieldsAPIView.as_view(), name='admin-step-fields'),
    path('admin/forms/<uuid:form_id>/reorder/', FormStepReorderAPIView.as_view(), name='admin-form-reorder'),
    path('admin/forms/<uuid:form_id>/steps/', FormStepsAPIView.as_view(), name='admin-form-steps'),
    path('admin/steps/<uuid:step_id>/', FormStepDetailAPIView.as_view(), name='admin-step-detail'),
    path('admin/smart-match/', SmartFieldMatchAPIView.as_view(), name='admin-smart-match'),
    path('admin/fields/<uuid:field_id>/config/', FieldConfigAPIView.as_view(), name='admin-field-config'),
    path('admin/forms/<uuid:form_id>/rules/', FormRulesAPIView.as_view(), name='admin-form-rules'),
    path('admin/rules/<uuid:rule_id>/', FormRuleDetailAPIView.as_view(), name='admin-rule-detail'),
    
    # Field Mappings API endpoints
    path('admin/forms/<uuid:form_id>/mappings/', FormMappingsAPIView.as_view(), name='admin-form-mappings'),
    path('admin/forms/<uuid:form_id>/auto-map/', FormAutoMapAPIView.as_view(), name='admin-form-auto-map'),
    path('admin/fields/<uuid:field_id>/mapping/', FieldMappingAPIView.as_view(), name='admin-field-mapping'),
    
    # Quick Actions API endpoints
    path('quick-actions/', QuickActionsAPIView.as_view(), name='quick-actions'),
]
