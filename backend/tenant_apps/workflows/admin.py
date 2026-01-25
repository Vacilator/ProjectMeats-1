"""
Django Admin for Tenant Workflows.

Bundle Two: System → Tenant Workflows & New Data Entities
Provides admin interface for managing Tenant Forms, Workflows, and Lists.
"""
from django.contrib import admin, messages
from django.db.models import Count
from django.utils.html import format_html

from apps.core.admin import TenantFilteredAdmin
from .models import (
    TenantList, TenantForm, TenantFormEntity, TenantFormField, TenantFormRule,
    TenantWorkflow, TenantWorkflowCondition, TenantWorkflowAction,
    WorkflowExecutionLog, FormStatus, WorkflowStatus, TriggerType, ActionType
)


# =============================================================================
# TENANT LIST ADMIN
# =============================================================================

@admin.register(TenantList)
class TenantListAdmin(TenantFilteredAdmin):
    """Admin for tenant-specific option lists."""
    
    list_display = ['name', 'tenant', 'option_count', 'is_active', 'created_at']
    list_filter = ['tenant', 'is_active', 'created_at']
    search_fields = ['name', 'description', 'tenant__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['tenant', 'name']
    
    fieldsets = [
        ('List Information', {
            'fields': ('tenant', 'name', 'description', 'is_active')
        }),
        ('Options', {
            'fields': ('options',),
            'description': 'Enter options as JSON: [{"value": "v1", "label": "Label 1"}, ...]'
        }),
        ('Metadata', {
            'fields': ('id', 'created_by', 'created_at', 'updated_at'),
            'classes': ['collapse']
        }),
    ]
    
    def option_count(self, obj):
        count = len(obj.options) if obj.options else 0
        return format_html(
            '<span style="background: #e0e0e0; padding: 2px 8px; border-radius: 10px;">{}</span>',
            count
        )
    option_count.short_description = 'Options'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


# =============================================================================
# TENANT FORM ADMIN
# =============================================================================

class TenantFormEntityInline(admin.TabularInline):
    """Inline for form entities (steps)."""
    model = TenantFormEntity
    extra = 1
    ordering = ['order']
    fields = ['order', 'entity_type', 'step_name']


class TenantFormFieldInline(admin.TabularInline):
    """Inline for form fields."""
    model = TenantFormField
    extra = 0
    ordering = ['order']
    fields = ['order', 'field_key', 'is_visible', 'is_required', 'custom_label']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('form_entity')


class TenantFormRuleInline(admin.TabularInline):
    """Inline for form rules."""
    model = TenantFormRule
    extra = 0
    ordering = ['order']
    fields = ['order', 'name', 'is_active', 'condition_logic']
    readonly_fields = ['conditions', 'actions']
    
    classes = ['collapse']


@admin.register(TenantForm)
class TenantFormAdmin(TenantFilteredAdmin):
    """Admin for tenant custom forms."""
    
    list_display = [
        'name', 'tenant', 'status_badge', 'entity_count', 
        'is_default', 'created_at'
    ]
    list_filter = ['tenant', 'status', 'is_default', 'created_at']
    search_fields = ['name', 'description', 'tenant__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['tenant', 'name']
    inlines = [TenantFormEntityInline, TenantFormRuleInline]
    
    actions = ['activate_forms', 'deactivate_forms']
    
    fieldsets = [
        ('Form Information', {
            'fields': ('tenant', 'name', 'description', 'icon')
        }),
        ('Status & Settings', {
            'fields': ('status', 'is_default')
        }),
        ('Metadata', {
            'fields': ('id', 'created_by', 'created_at', 'updated_at'),
            'classes': ['collapse']
        }),
    ]
    
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _entity_count=Count('entities')
        ).select_related('tenant', 'created_by')
    
    def entity_count(self, obj):
        count = getattr(obj, '_entity_count', obj.entities.count())
        label = "Multi-step" if count > 1 else "Single"
        color = "#17a2b8" if count > 1 else "#28a745"
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; '
            'border-radius: 10px; font-size: 11px;">{} ({})</span>',
            color, label, count
        )
    entity_count.short_description = 'Type'
    entity_count.admin_order_field = '_entity_count'
    
    def status_badge(self, obj):
        colors = {
            'draft': '#ffc107',
            'active': '#28a745',
            'inactive': '#6c757d',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 10px; '
            'border-radius: 10px; font-size: 11px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'status'
    
    @admin.action(description="✅ Activate selected forms")
    def activate_forms(self, request, queryset):
        updated = queryset.filter(status=FormStatus.DRAFT).update(status=FormStatus.ACTIVE)
        self.message_user(request, f"Activated {updated} form(s).", messages.SUCCESS)
    
    @admin.action(description="⏸️ Deactivate selected forms")
    def deactivate_forms(self, request, queryset):
        updated = queryset.exclude(status=FormStatus.INACTIVE).update(status=FormStatus.INACTIVE)
        self.message_user(request, f"Deactivated {updated} form(s).", messages.SUCCESS)
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(TenantFormEntity)
class TenantFormEntityAdmin(admin.ModelAdmin):
    """Admin for form entities (usually edited inline)."""
    
    list_display = ['form', 'entity_type', 'step_name', 'order', 'field_count']
    list_filter = ['form__tenant', 'entity_type']
    search_fields = ['form__name', 'entity_type', 'step_name']
    ordering = ['form', 'order']
    inlines = [TenantFormFieldInline]
    
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _field_count=Count('fields')
        ).select_related('form', 'form__tenant')
    
    def field_count(self, obj):
        count = getattr(obj, '_field_count', obj.fields.count())
        return format_html(
            '<span style="background: #e0e0e0; padding: 2px 8px; border-radius: 10px;">{}</span>',
            count
        )
    field_count.short_description = 'Fields'


# =============================================================================
# TENANT WORKFLOW ADMIN
# =============================================================================

class TenantWorkflowConditionInline(admin.TabularInline):
    """Inline for workflow conditions."""
    model = TenantWorkflowCondition
    extra = 0
    ordering = ['order']
    fields = ['order', 'field_path', 'operator', 'compare_value']


class TenantWorkflowActionInline(admin.TabularInline):
    """Inline for workflow actions."""
    model = TenantWorkflowAction
    extra = 0
    ordering = ['order']
    fields = ['order', 'action_type', 'continue_on_error']
    readonly_fields = ['config']


@admin.register(TenantWorkflow)
class TenantWorkflowAdmin(TenantFilteredAdmin):
    """Admin for tenant workflows."""
    
    list_display = [
        'name', 'tenant', 'status_badge', 'trigger_badge', 
        'entity_type', 'run_count', 'last_run_at'
    ]
    list_filter = ['tenant', 'status', 'trigger_type', 'entity_type', 'created_at']
    search_fields = ['name', 'description', 'tenant__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_run_at', 'run_count']
    ordering = ['tenant', 'name']
    inlines = [TenantWorkflowConditionInline, TenantWorkflowActionInline]
    
    actions = ['activate_workflows', 'pause_workflows', 'run_workflow_manually']
    
    fieldsets = [
        ('Workflow Information', {
            'fields': ('tenant', 'name', 'description', 'icon')
        }),
        ('Trigger Configuration', {
            'fields': ('trigger_type', 'entity_type', 'trigger_config')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Execution Stats', {
            'fields': ('run_count', 'last_run_at'),
            'classes': ['collapse']
        }),
        ('Metadata', {
            'fields': ('id', 'created_by', 'created_at', 'updated_at'),
            'classes': ['collapse']
        }),
    ]
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'created_by')
    
    def status_badge(self, obj):
        colors = {
            'draft': '#ffc107',
            'active': '#28a745',
            'paused': '#17a2b8',
            'inactive': '#6c757d',
        }
        icons = {
            'draft': '📝',
            'active': '▶️',
            'paused': '⏸️',
            'inactive': '⏹️',
        }
        color = colors.get(obj.status, '#6c757d')
        icon = icons.get(obj.status, '❓')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 10px; '
            'border-radius: 10px; font-size: 11px;">{} {}</span>',
            color, icon, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'status'
    
    def trigger_badge(self, obj):
        colors = {
            'scheduled': '#6f42c1',
            'record_created': '#28a745',
            'record_updated': '#17a2b8',
            'manual': '#fd7e14',
        }
        icons = {
            'scheduled': '⏰',
            'record_created': '➕',
            'record_updated': '✏️',
            'manual': '👆',
        }
        color = colors.get(obj.trigger_type, '#6c757d')
        icon = icons.get(obj.trigger_type, '❓')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 10px; '
            'border-radius: 10px; font-size: 11px;">{} {}</span>',
            color, icon, obj.get_trigger_type_display()
        )
    trigger_badge.short_description = 'Trigger'
    trigger_badge.admin_order_field = 'trigger_type'
    
    @admin.action(description="▶️ Activate selected workflows")
    def activate_workflows(self, request, queryset):
        updated = queryset.exclude(status=WorkflowStatus.ACTIVE).update(status=WorkflowStatus.ACTIVE)
        self.message_user(request, f"Activated {updated} workflow(s).", messages.SUCCESS)
    
    @admin.action(description="⏸️ Pause selected workflows")
    def pause_workflows(self, request, queryset):
        updated = queryset.filter(status=WorkflowStatus.ACTIVE).update(status=WorkflowStatus.PAUSED)
        self.message_user(request, f"Paused {updated} workflow(s).", messages.SUCCESS)
    
    @admin.action(description="🚀 Run selected workflows manually")
    def run_workflow_manually(self, request, queryset):
        # This will be implemented in the workflow engine
        count = queryset.filter(status=WorkflowStatus.ACTIVE).count()
        self.message_user(
            request, 
            f"Manual execution queued for {count} workflow(s). "
            "Note: Workflow engine integration pending.",
            messages.INFO
        )
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(WorkflowExecutionLog)
class WorkflowExecutionLogAdmin(admin.ModelAdmin):
    """Admin for viewing workflow execution logs."""
    
    list_display = [
        'workflow', 'status_badge', 'trigger_type', 
        'actions_executed', 'actions_failed', 'started_at', 'duration'
    ]
    list_filter = ['status', 'trigger_type', 'workflow__tenant', 'started_at']
    search_fields = ['workflow__name', 'error_message']
    readonly_fields = [
        'id', 'workflow', 'trigger_type', 'trigger_data', 'status',
        'started_at', 'completed_at', 'actions_executed', 'actions_failed',
        'error_message', 'execution_log', 'triggered_by'
    ]
    ordering = ['-started_at']
    
    def has_add_permission(self, request):
        """Logs are created automatically, not manually."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Logs are read-only."""
        return False
    
    def status_badge(self, obj):
        colors = {
            'started': '#ffc107',
            'success': '#28a745',
            'failed': '#dc3545',
            'partial': '#fd7e14',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 10px; '
            'border-radius: 10px; font-size: 11px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def duration(self, obj):
        if obj.completed_at and obj.started_at:
            delta = obj.completed_at - obj.started_at
            seconds = delta.total_seconds()
            if seconds < 1:
                return f"{int(seconds * 1000)}ms"
            elif seconds < 60:
                return f"{seconds:.1f}s"
            else:
                return f"{int(seconds // 60)}m {int(seconds % 60)}s"
        return "Running..."
    duration.short_description = 'Duration'
