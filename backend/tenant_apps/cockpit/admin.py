"""
Admin configuration for Cockpit app.
"""
from django.contrib import admin
from apps.core.admin_site import admin_site
from .models import ActivityLog, ScheduledCall


class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('entity_type', 'entity_id', 'title', 'created_by', 'created_on', 'is_pinned')
    list_filter = ('entity_type', 'is_pinned', 'created_on')
    search_fields = ('title', 'content', 'tags')
    readonly_fields = ('created_on', 'modified_on')


class ScheduledCallAdmin(admin.ModelAdmin):
    list_display = ('title', 'entity_type', 'entity_id', 'scheduled_for', 'is_completed', 'assigned_to')
    list_filter = ('entity_type', 'is_completed', 'scheduled_for')
    search_fields = ('title', 'description')
    readonly_fields = ('created_on', 'modified_on', 'completed_at')



# Register models with custom admin site
admin_site.register(ActivityLog, ActivityLogAdmin)
admin_site.register(ScheduledCall, ScheduledCallAdmin)
