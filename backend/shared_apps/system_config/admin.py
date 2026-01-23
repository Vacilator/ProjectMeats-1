from django.contrib import admin
from .models import EntityBlueprint, BlueprintVersion, WorkflowRun


@admin.register(EntityBlueprint)
class EntityBlueprintAdmin(admin.ModelAdmin):
    """Admin interface for Entity Blueprints."""
    list_display = ('name', 'slug', 'published_version', 'created_at')
    search_fields = ('name', 'slug')
    list_filter = ('created_at',)
    readonly_fields = ('id', 'created_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'slug', 'description')
        }),
        ('Configuration', {
            'fields': ('logic_config', 'metadata', 'published_version')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(BlueprintVersion)
class BlueprintVersionAdmin(admin.ModelAdmin):
    """Admin interface for Blueprint Versions."""
    list_display = ('blueprint', 'version', 'status', 'created_at')
    search_fields = ('blueprint__name', 'version')
    list_filter = ('status', 'created_at')
    readonly_fields = ('id', 'created_at')
    
    fieldsets = (
        ('Version Information', {
            'fields': ('id', 'blueprint', 'version', 'status')
        }),
        ('Configuration', {
            'fields': ('logic_config', 'change_summary')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(WorkflowRun)
class WorkflowRunAdmin(admin.ModelAdmin):
    """Admin interface for Workflow Runs."""
    list_display = ('id', 'tenant', 'workflow_slug', 'status', 'created_on')
    search_fields = ('workflow_slug', 'tenant__name')
    list_filter = ('status', 'created_on')
    readonly_fields = ('id', 'tenant', 'created_on', 'modified_on')
    
    fieldsets = (
        ('Workflow Information', {
            'fields': ('id', 'tenant', 'workflow_slug', 'status')
        }),
        ('Execution State', {
            'fields': ('current_step_index', 'data_context')
        }),
        ('Timestamps', {
            'fields': ('created_on', 'modified_on'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        """Prevent manual creation - workflows should be started via API."""
        return False
