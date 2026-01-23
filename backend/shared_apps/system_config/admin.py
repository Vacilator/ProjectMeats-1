from django.contrib import admin
from django.utils.html import mark_safe
from .models import EntityBlueprint, BlueprintVersion, WorkflowRun


@admin.register(EntityBlueprint)
class EntityBlueprintAdmin(admin.ModelAdmin):
    """Admin interface for Entity Blueprints."""
    list_display = ('name', 'slug', 'published_version', 'created_at', 'open_studio_button')
    search_fields = ('name', 'slug')
    list_filter = ('created_at',)
    readonly_fields = ('id', 'created_at', 'open_studio_button')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'slug')
        }),
        ('Publication', {
            'fields': ('published_version',)
        }),
        ('Visual Studio', {
            'fields': ('open_studio_button',),
            'description': 'Use the Visual Studio to design workflows without writing JSON.'
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def open_studio_button(self, obj):
        """Render a button to launch the Visual Studio for this blueprint."""
        if obj.pk:
            # Try to find latest version (published or draft)
            version = obj.published_version or obj.versions.order_by('-created_at').first()
            if version:
                url = f'/admin/system-config/studio/{version.id}/'
                label = '🛠 Launch Visual Studio'
                if obj.published_version:
                    label += ' (Published)'
                else:
                    label += ' (Draft)'
                return mark_safe(
                    f'<a class="button" href="{url}" target="_blank" '
                    f'style="background:#417690; padding:10px 15px; color:white; '
                    f'text-decoration:none; border-radius:4px; display:inline-block; '
                    f'font-weight:500;">{label}</a>'
                )
            return mark_safe('<em style="color:#666;">Create a version first to use the studio</em>')
        return mark_safe('<em style="color:#666;">Save the blueprint first</em>')
    
    open_studio_button.short_description = 'Visual Editor'


@admin.register(BlueprintVersion)
class BlueprintVersionAdmin(admin.ModelAdmin):
    """Admin interface for Blueprint Versions."""
    list_display = ('blueprint', 'version', 'status', 'created_at', 'open_studio_button')
    search_fields = ('blueprint__name', 'version')
    list_filter = ('status', 'created_at')
    readonly_fields = ('id', 'created_at', 'open_studio_button')
    
    fieldsets = (
        ('Version Information', {
            'fields': ('id', 'blueprint', 'version', 'status')
        }),
        ('Visual Studio', {
            'fields': ('open_studio_button',),
            'description': 'Use the Visual Studio to design workflows visually.'
        }),
        ('Configuration (JSON)', {
            'fields': ('schema_config', 'workflow_config', 'logic_config'),
            'classes': ('collapse',),
            'description': 'Advanced: Direct JSON editing. Use Visual Studio instead for easier editing.'
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def open_studio_button(self, obj):
        """Render a button to launch the Visual Studio for this version."""
        if obj.pk:
            url = f'/admin/system-config/studio/{obj.id}/'
            return mark_safe(
                f'<a class="button" href="{url}" target="_blank" '
                f'style="background:#417690; padding:10px 15px; color:white; '
                f'text-decoration:none; border-radius:4px; display:inline-block; '
                f'font-weight:500;">🛠 Launch Visual Studio</a>'
            )
        return mark_safe('<em style="color:#666;">Save the version first</em>')
    
    open_studio_button.short_description = 'Visual Editor'


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
