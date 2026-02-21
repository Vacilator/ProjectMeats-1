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
    FieldTemplatesAPIView,
    # Form Submission API Views
    FormSubmissionViewSet, AvailableFormsViewSet, QuickActionsAPIView,
    # Entity Options API Views
    EntityOptionsAPIView, QuickCreateEntityAPIView,
    # Form Import/Export API Views
    FormExportAPIView, FormImportAPIView, FormDuplicateAPIView,
    # Form Analytics API Views
    FormAnalyticsAPIView, FormEventAPIView,
    # Form Test Data API Views
    FormTestDataAPIView,
    # Wave 3: Forms & Flows Enhancement Views
    FormStatusHistoryViewSet, StepAssignmentViewSet,
    UserNotificationViewSet, UserNotificationPreferencesView,
    ActionItemsAPIView, ActionItemCountsAPIView,
    # Phase 4.2: Permission System
    WorkFormPermissionsAPIView
)

# Phase 5: Workflow Trigger API Views
from .views_triggers import (
    WorkflowWebhookAPIView,
    WebhookReceiverAPIView,
    ManualTriggerAPIView,
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

# Wave 3: Step Assignments and Notifications
router.register(r'step-assignments', StepAssignmentViewSet, basename='step-assignment')
router.register(r'notifications', UserNotificationViewSet, basename='notification')

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
    
    # Field Templates API endpoints
    path('field-templates/', FieldTemplatesAPIView.as_view(), name='field-templates'),
    path('field-templates/<str:template_id>/', FieldTemplatesAPIView.as_view(), name='field-template-detail'),
    
    # Quick Actions API endpoints
    path('quick-actions/', QuickActionsAPIView.as_view(), name='quick-actions'),
    
    # Entity Options API endpoints (for select fields in forms)
    path('entity-options/<str:entity_type>/', EntityOptionsAPIView.as_view(), name='entity-options'),
    path('quick-create/<str:entity_type>/', QuickCreateEntityAPIView.as_view(), name='quick-create'),
    
    # Form Import/Export API endpoints
    path('forms/<uuid:form_id>/export/', FormExportAPIView.as_view(), name='form-export'),
    path('forms/import/', FormImportAPIView.as_view(), name='form-import'),
    path('forms/<uuid:form_id>/duplicate/', FormDuplicateAPIView.as_view(), name='form-duplicate'),
    
    # Form Analytics API endpoints
    path('forms/<uuid:form_id>/analytics/', FormAnalyticsAPIView.as_view(), name='form-analytics'),
    path('analytics/summary/', FormAnalyticsAPIView.as_view(), name='analytics-summary'),
    path('form-submissions/<uuid:submission_id>/events/', FormEventAPIView.as_view(), name='form-events'),
    
    # Form Status History endpoint (nested under submissions)
    path('form-submissions/<uuid:submission_id>/history/', 
         FormStatusHistoryViewSet.as_view({'get': 'list', 'post': 'create'}), 
         name='form-submission-history'),
    
    # Form Test Data API endpoints
    path('forms/<uuid:form_id>/test-data/', FormTestDataAPIView.as_view(), name='form-test-data'),
    
    # Wave 3: Action Items API endpoints
    path('action-items/', ActionItemsAPIView.as_view(), name='action-items'),
    path('action-items/counts/', ActionItemCountsAPIView.as_view(), name='action-item-counts'),
    
    # Wave 3: Notification Preferences endpoint
    path('notification-preferences/', UserNotificationPreferencesView.as_view(), name='notification-preferences'),
    
    # Phase 4.2: WorkForms Permissions endpoint
    path('permissions/', WorkFormPermissionsAPIView.as_view(), name='workforms-permissions'),
    
    # Phase 5: Workflow Trigger API endpoints
    path('workflows/<uuid:workflow_id>/webhooks/', WorkflowWebhookAPIView.as_view(), name='workflow-webhooks'),
    path('workflows/<uuid:workflow_id>/trigger/', ManualTriggerAPIView.as_view(), name='workflow-manual-trigger'),
]

# Public webhook receiver endpoint (no auth required)
webhook_urlpatterns = [
    path('webhooks/<uuid:workflow_id>/<str:webhook_token>/', WebhookReceiverAPIView.as_view(), name='webhook-receiver'),
]

urlpatterns += webhook_urlpatterns
