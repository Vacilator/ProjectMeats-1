"""
Django Admin for Schema Builder.

Bundle One: Custom System Data - Django Admin Enhancements
Provides CRUD functionality for Data Schemas and Fields with versioning.

Features:
- Modal actions for field creation (using django-modal-actions)
- Status workflow (Draft → Submitted → Published)
- Full version history
- Role-based permissions (GSA can draft/submit, Superuser can publish)
"""
from django.contrib import admin, messages
from django.contrib.admin import SimpleListFilter
from django.db.models import Count
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .forms import (
    DataSchemaForm, DataSchemaFieldForm, AddFieldForm,
    SubmitSchemaForm, PublishSchemaForm, FieldOptionListForm
)
from .models import (
    DataSchema, DataSchemaField, DataSchemaVersion, 
    FieldOptionList, SchemaStatus, FieldType
)
from .permissions import (
    can_edit_schema, can_submit_schema, can_publish_schema,
    can_revert_schema, superuser_required, staff_required
)


# Try to import django-modal-actions if available
try:
    from django_modal_actions import ModalActionMixin, modal_action
    HAS_MODAL_ACTIONS = True
except ImportError:
    HAS_MODAL_ACTIONS = False
    ModalActionMixin = object
    def modal_action(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


# Base classes that conditionally inherit from ModalActionMixin
if HAS_MODAL_ACTIONS:
    SchemaFieldAdminBase = type('SchemaFieldAdminBase', (ModalActionMixin, admin.ModelAdmin), {})
    DataSchemaAdminBase = type('DataSchemaAdminBase', (ModalActionMixin, admin.ModelAdmin), {})
else:
    SchemaFieldAdminBase = admin.ModelAdmin
    DataSchemaAdminBase = admin.ModelAdmin


class StatusFilter(SimpleListFilter):
    """Filter schemas by status."""
    title = 'status'
    parameter_name = 'status'
    
    def lookups(self, request, model_admin):
        return SchemaStatus.choices
    
    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(status=self.value())
        return queryset


class DataSchemaFieldInline(admin.TabularInline):
    """Inline editor for schema fields."""
    model = DataSchemaField
    form = DataSchemaFieldForm
    extra = 0
    ordering = ['order', 'label']
    
    fields = [
        'order', 'label', 'key', 'field_type', 'is_visible', 
        'is_required', 'is_searchable', 'help_text'
    ]
    readonly_fields = ['key']
    
    classes = ['collapse']
    
    def get_queryset(self, request):
        return super().get_queryset(request).order_by('order', 'label')


class SchemaFieldAdmin(SchemaFieldAdminBase):
    """
    Admin interface for Schema Fields.
    Typically edited inline, but also available as standalone.
    """
    list_display = [
        'label', 'schema', 'field_type', 'is_visible', 
        'is_required', 'order', 'created_at'
    ]
    list_filter = ['schema', 'field_type', 'is_visible', 'is_required']
    search_fields = ['label', 'key', 'schema__name']
    ordering = ['schema', 'order', 'label']
    
    fieldsets = [
        ('Field Information', {
            'fields': ('schema', 'label', 'key', 'field_type')
        }),
        ('Display Settings', {
            'fields': ('is_visible', 'is_required', 'is_searchable', 'order')
        }),
        ('Options (for Dropdown/Multi-select)', {
            'fields': ('options',),
            'classes': ['collapse']
        }),
        ('Default & Help Text', {
            'fields': ('default_value', 'help_text', 'placeholder')
        }),
        ('Validation', {
            'fields': ('validation_rules', 'decimal_places'),
            'classes': ['collapse']
        }),
    ]
    
    def get_readonly_fields(self, request, obj=None):
        """Key is auto-generated from label."""
        if obj:
            return ['key']
        return []


@admin.register(DataSchema)
class DataSchemaAdmin(DataSchemaAdminBase):
    """
    Admin interface for Data Schemas with modal actions.
    
    Features:
    - CRUD for schemas and fields
    - Status workflow (Draft → Submitted → Published)
    - Version history
    - Role-based permissions
    - Visual field editor (Phase 1)
    """
    
    form = DataSchemaForm
    inlines = [DataSchemaFieldInline]
    
    # Custom template with visual field editor
    change_form_template = 'admin/schema_builder/dataschema/change_form.html'
    
    list_display = [
        'name', 'status_badge', 'version', 'field_count',
        'is_active', 'created_by', 'created_at', 'updated_at'
    ]
    list_filter = [StatusFilter, 'is_active', 'is_system', 'created_at']
    search_fields = ['name', 'slug', 'description']
    ordering = ['-updated_at']
    readonly_fields = [
        'id', 'version', 'created_at', 'updated_at',
        'submitted_by', 'submitted_at', 'published_by', 'published_at'
    ]
    
    # Custom actions
    actions = ['submit_schemas', 'publish_schemas', 'revert_to_draft']
    
    # Modal actions (if django-modal-actions is installed)
    if HAS_MODAL_ACTIONS:
        modal_actions = ['add_field_modal', 'submit_modal', 'publish_modal']
        list_modal_actions = ['bulk_submit_modal']
    
    fieldsets = [
        ('Schema Information', {
            'fields': ('name', 'slug', 'description')
        }),
        ('Display', {
            'fields': ('icon', 'color'),
            'classes': ['collapse']
        }),
        ('Status & Settings', {
            'fields': ('status', 'is_active', 'is_system')
        }),
        ('Version Info', {
            'fields': ('version',),
            'classes': ['collapse']
        }),
        ('Audit Trail', {
            'fields': (
                'id', 'created_by', 'created_at', 'updated_at',
                'submitted_by', 'submitted_at', 'published_by', 'published_at'
            ),
            'classes': ['collapse']
        }),
    ]
    
    class Media:
        """Load CSS and JS for schema editor."""
        css = {
            'all': ('admin/schema_builder/css/schema_editor.css',)
        }
        js = ('admin/schema_builder/js/schema_editor.js',)
    
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _field_count=Count('fields')
        ).select_related('created_by', 'submitted_by', 'published_by')
    
    def field_count(self, obj):
        """Display number of fields in schema."""
        count = getattr(obj, '_field_count', obj.fields.count())
        return format_html(
            '<span style="background: #e0e0e0; padding: 2px 8px; border-radius: 10px;">{}</span>',
            count
        )
    field_count.short_description = 'Fields'
    field_count.admin_order_field = '_field_count'
    
    def status_badge(self, obj):
        """Display status with colored badge."""
        colors = {
            'draft': '#ffc107',      # Yellow
            'submitted': '#17a2b8',  # Blue
            'published': '#28a745',  # Green
        }
        icons = {
            'draft': '📝',
            'submitted': '📤',
            'published': '✅',
        }
        color = colors.get(obj.status, '#6c757d')
        icon = icons.get(obj.status, '❓')
        return format_html(
            '<span style="background: {}; color: white; padding: 3px 10px; '
            'border-radius: 12px; font-size: 12px;">{} {}</span>',
            color, icon, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'status'
    
    def get_readonly_fields(self, request, obj=None):
        """Make status read-only for non-superusers on submitted/published schemas."""
        readonly = list(self.readonly_fields)
        
        if obj:
            # Slug is read-only after creation
            readonly.append('slug')
            
            # Status changes should be done via actions, not direct edit
            if obj.status != 'draft' and not request.user.is_superuser:
                readonly.append('status')
        
        return readonly
    
    def has_change_permission(self, request, obj=None):
        """Check if user can edit this schema."""
        if not super().has_change_permission(request, obj):
            return False
        return can_edit_schema(request, obj)
    
    def save_model(self, request, obj, form, change):
        """Set created_by on first save."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
        
        # Create initial version snapshot
        if not change:
            obj.create_version_snapshot(request.user, 'created')
    
    # ==================== STANDARD ADMIN ACTIONS ====================
    
    @admin.action(description="📤 Submit selected schemas for review")
    def submit_schemas(self, request, queryset):
        """Submit selected draft schemas for review."""
        submitted = 0
        errors = []
        
        for schema in queryset.filter(status='draft'):
            try:
                schema.submit(request.user)
                submitted += 1
            except Exception as e:
                errors.append(f"{schema.name}: {str(e)}")
        
        if submitted:
            self.message_user(
                request,
                f"✅ Successfully submitted {submitted} schema(s) for review.",
                messages.SUCCESS
            )
        if errors:
            self.message_user(
                request,
                f"⚠️ Errors: {'; '.join(errors)}",
                messages.WARNING
            )
    
    @admin.action(description="✅ Publish selected schemas (Superuser Only)")
    @superuser_required
    def publish_schemas(self, request, queryset):
        """Publish selected submitted schemas."""
        published = 0
        errors = []
        
        for schema in queryset.filter(status='submitted'):
            try:
                schema.publish(request.user)
                published += 1
            except Exception as e:
                errors.append(f"{schema.name}: {str(e)}")
        
        if published:
            self.message_user(
                request,
                f"✅ Successfully published {published} schema(s)!",
                messages.SUCCESS
            )
        if errors:
            self.message_user(
                request,
                f"⚠️ Errors: {'; '.join(errors)}",
                messages.WARNING
            )
    
    @admin.action(description="↩️ Revert selected schemas to draft")
    def revert_to_draft(self, request, queryset):
        """Revert selected submitted schemas to draft."""
        reverted = 0
        errors = []
        
        for schema in queryset.filter(status='submitted'):
            if request.user.is_superuser:
                try:
                    schema.revert_to_draft(request.user)
                    reverted += 1
                except Exception as e:
                    errors.append(f"{schema.name}: {str(e)}")
            else:
                errors.append(f"{schema.name}: Only superusers can revert")
        
        if reverted:
            self.message_user(
                request,
                f"✅ Reverted {reverted} schema(s) to draft.",
                messages.SUCCESS
            )
        if errors:
            self.message_user(
                request,
                f"⚠️ Errors: {'; '.join(errors)}",
                messages.WARNING
            )
    
    # ==================== MODAL ACTIONS (if available) ====================
    
    if HAS_MODAL_ACTIONS:
        @modal_action(
            modal_header="Add New Field",
            modal_description="Add a new field to this schema",
            form_class=AddFieldForm
        )
        def add_field_modal(self, request, obj, form_data=None):
            """Add a new field via modal dialog."""
            if form_data:
                # Create the field
                from django.utils.text import slugify
                label = form_data['label']
                key = slugify(label).replace('-', '_')
                
                # Get next order number
                max_order = obj.fields.aggregate(models.Max('order'))['order__max'] or 0
                
                field = DataSchemaField.objects.create(
                    schema=obj,
                    key=key,
                    label=label,
                    field_type=form_data['field_type'],
                    is_required=form_data.get('is_required', False),
                    is_visible=form_data.get('is_visible', True),
                    help_text=form_data.get('help_text', ''),
                    options=form_data.get('options_text', []),
                    order=max_order + 1
                )
                return f"✅ Added field '{label}' to {obj.name}"
            return "Field creation cancelled"
        
        @modal_action(
            modal_header="Submit for Review",
            modal_description="Submit this schema for review. Once submitted, only superusers can edit.",
            form_class=SubmitSchemaForm,
            permissions=can_submit_schema
        )
        def submit_modal(self, request, obj, form_data=None):
            """Submit schema via modal dialog."""
            if form_data and form_data.get('confirm'):
                obj.submit(request.user)
                return f"✅ '{obj.name}' has been submitted for review!"
            return "Submission cancelled"
        
        @modal_action(
            modal_header="Publish Schema",
            modal_description="⚠️ SUPERUSER ONLY: Publish this schema to make it globally accessible.",
            form_class=PublishSchemaForm,
            permissions=can_publish_schema
        )
        def publish_modal(self, request, obj, form_data=None):
            """Publish schema via modal dialog (superuser only)."""
            if form_data and form_data.get('confirm'):
                obj.publish(request.user)
                return f"✅ '{obj.name}' has been PUBLISHED! It is now globally accessible."
            return "Publication cancelled"
        
        @modal_action(
            modal_header="Bulk Submit for Review",
            modal_description="Submit selected schemas for review."
        )
        def bulk_submit_modal(self, request, queryset, form_data=None):
            """Bulk submit schemas via modal."""
            draft_schemas = queryset.filter(status='draft')
            count = draft_schemas.count()
            
            for schema in draft_schemas:
                schema.submit(request.user)
            
            return f"✅ Submitted {count} schema(s) for review"
    
    # ==================== CUSTOM URLS ====================
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<uuid:object_id>/versions/',
                self.admin_site.admin_view(self.version_history_view),
                name='schema_builder_dataschema_versions'
            ),
            path(
                '<uuid:object_id>/add-field/',
                self.admin_site.admin_view(self.add_field_view),
                name='schema_builder_dataschema_add_field'
            ),
        ]
        return custom_urls + urls
    
    def version_history_view(self, request, object_id):
        """Display version history for a schema."""
        schema = DataSchema.objects.get(pk=object_id)
        versions = schema.versions.all().select_related('created_by')
        
        context = {
            **self.admin_site.each_context(request),
            'title': f'Version History: {schema.name}',
            'schema': schema,
            'versions': versions,
            'opts': self.model._meta,
        }
        return render(request, 'admin/schema_builder/version_history.html', context)
    
    def add_field_view(self, request, object_id):
        """Add field view (fallback if modal actions not available)."""
        schema = DataSchema.objects.get(pk=object_id)
        
        if request.method == 'POST':
            form = AddFieldForm(request.POST)
            if form.is_valid():
                from django.utils.text import slugify
                label = form.cleaned_data['label']
                key = slugify(label).replace('-', '_')
                max_order = schema.fields.aggregate(models.Max('order'))['order__max'] or 0
                
                DataSchemaField.objects.create(
                    schema=schema,
                    key=key,
                    label=label,
                    field_type=form.cleaned_data['field_type'],
                    is_required=form.cleaned_data.get('is_required', False),
                    is_visible=form.cleaned_data.get('is_visible', True),
                    help_text=form.cleaned_data.get('help_text', ''),
                    options=form.cleaned_data.get('options_text', []),
                    order=max_order + 1
                )
                messages.success(request, f"✅ Added field '{label}' to {schema.name}")
                return redirect('admin:schema_builder_dataschema_change', object_id)
        else:
            form = AddFieldForm()
        
        context = {
            **self.admin_site.each_context(request),
            'title': f'Add Field to: {schema.name}',
            'schema': schema,
            'form': form,
            'opts': self.model._meta,
        }
        return render(request, 'admin/schema_builder/add_field.html', context)
    
    def change_view(self, request, object_id, form_url='', extra_context=None):
        """Add extra context for change view."""
        extra_context = extra_context or {}
        
        try:
            schema = DataSchema.objects.get(pk=object_id)
            extra_context['version_url'] = reverse(
                'admin:schema_builder_dataschema_versions',
                args=[object_id]
            )
            extra_context['add_field_url'] = reverse(
                'admin:schema_builder_dataschema_add_field',
                args=[object_id]
            )
            extra_context['can_submit'] = can_submit_schema(request, schema)
            extra_context['can_publish'] = can_publish_schema(request, schema)
        except DataSchema.DoesNotExist:
            pass
        
        return super().change_view(request, object_id, form_url, extra_context)


@admin.register(DataSchemaField)
class DataSchemaFieldAdmin(SchemaFieldAdmin):
    """Register the standalone field admin."""
    pass


@admin.register(DataSchemaVersion)
class DataSchemaVersionAdmin(admin.ModelAdmin):
    """Admin for viewing schema version history."""
    
    list_display = [
        'schema', 'version_number', 'action', 'created_by', 'created_at'
    ]
    list_filter = ['action', 'created_at', 'schema']
    search_fields = ['schema__name', 'notes']
    readonly_fields = ['schema', 'version_number', 'action', 'snapshot_data', 'created_at', 'created_by']
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        """Versions are created automatically, not manually."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Versions are immutable."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete versions."""
        return request.user.is_superuser


@admin.register(FieldOptionList)
class FieldOptionListAdmin(admin.ModelAdmin):
    """Admin for managing reusable field option lists."""
    
    form = FieldOptionListForm
    
    list_display = ['name', 'option_count', 'is_system', 'created_by', 'created_at']
    list_filter = ['is_system', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['name']
    
    fieldsets = [
        ('List Information', {
            'fields': ('name', 'description', 'is_system')
        }),
        ('Options', {
            'fields': ('options_text',),
            'description': 'Enter options one per line. They will be converted to value/label pairs.'
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ['collapse']
        }),
    ]
    
    def option_count(self, obj):
        """Display number of options."""
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
    
    def has_delete_permission(self, request, obj=None):
        """System lists cannot be deleted."""
        if obj and obj.is_system:
            return False
        return super().has_delete_permission(request, obj)
