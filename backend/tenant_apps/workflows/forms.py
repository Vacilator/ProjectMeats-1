"""
Django Admin forms for Tenant Workflows.

Provides user-friendly forms for creating and editing
Forms, Workflows, and Lists through the Django Admin interface.
"""
from django import forms
from django.contrib.postgres.forms import SimpleArrayField

from .models import (
    TenantList, TenantForm, TenantFormEntity, TenantFormField, TenantFormRule,
    TenantWorkflow, TenantWorkflowCondition, TenantWorkflowAction,
    OperatorType, ActionType, TriggerType, FormStatus, WorkflowStatus
)


# =============================================================================
# CUSTOM WIDGETS
# =============================================================================

class IconSelectorWidget(forms.TextInput):
    """Widget for selecting icons with visual preview and picker."""
    
    AVAILABLE_ICONS = [
        # Documents
        ('file-text', 'Document', 'documents'),
        ('file', 'File', 'documents'),
        ('file-plus', 'New File', 'documents'),
        ('file-check', 'Approved', 'documents'),
        ('clipboard', 'Clipboard', 'documents'),
        ('clipboard-list', 'Checklist', 'documents'),
        ('clipboard-check', 'Completed', 'documents'),
        ('folder', 'Folder', 'documents'),
        ('folder-open', 'Open Folder', 'documents'),
        
        # People
        ('user', 'Person', 'people'),
        ('users', 'Team', 'people'),
        ('building', 'Company', 'people'),
        
        # Business
        ('briefcase', 'Business', 'business'),
        ('shopping-cart', 'Order', 'business'),
        ('shopping-bag', 'Purchase', 'business'),
        ('dollar-sign', 'Money', 'business'),
        ('credit-card', 'Payment', 'business'),
        ('receipt', 'Invoice', 'business'),
        ('percent', 'Discount', 'business'),
        ('tag', 'Price Tag', 'business'),
        
        # Logistics
        ('truck', 'Shipping', 'logistics'),
        ('box', 'Box', 'logistics'),
        ('package', 'Package', 'logistics'),
        ('map-pin', 'Location', 'logistics'),
        ('globe', 'Global', 'logistics'),
        
        # Communication
        ('mail', 'Email', 'communication'),
        ('phone', 'Phone', 'communication'),
        ('message-square', 'Message', 'communication'),
        ('send', 'Send', 'communication'),
        ('bell', 'Notification', 'communication'),
        
        # Time
        ('calendar', 'Calendar', 'time'),
        ('clock', 'Time', 'time'),
        
        # Status
        ('check-circle', 'Success', 'status'),
        ('x-circle', 'Error', 'status'),
        ('alert-circle', 'Warning', 'status'),
        ('info', 'Info', 'status'),
        ('star', 'Favorite', 'status'),
        ('activity', 'Activity', 'status'),
        
        # Actions
        ('edit', 'Edit', 'actions'),
        ('trash', 'Delete', 'actions'),
        ('plus', 'Add', 'actions'),
        ('search', 'Search', 'actions'),
        ('filter', 'Filter', 'actions'),
        ('download', 'Download', 'actions'),
        ('upload', 'Upload', 'actions'),
        ('refresh-cw', 'Refresh', 'actions'),
        ('copy', 'Copy', 'actions'),
        ('link', 'Link', 'actions'),
        ('external-link', 'External', 'actions'),
        
        # Security
        ('lock', 'Locked', 'security'),
        ('unlock', 'Unlocked', 'security'),
        ('key', 'Key', 'security'),
        ('eye', 'View', 'security'),
        ('eye-off', 'Hidden', 'security'),
        
        # Charts
        ('bar-chart', 'Bar Chart', 'charts'),
        ('pie-chart', 'Pie Chart', 'charts'),
        ('trending-up', 'Growth', 'charts'),
        ('trending-down', 'Decline', 'charts'),
        
        # Tech
        ('settings', 'Settings', 'tech'),
        ('database', 'Database', 'tech'),
        ('server', 'Server', 'tech'),
        ('code', 'Code', 'tech'),
        ('terminal', 'Terminal', 'tech'),
        ('layers', 'Layers', 'tech'),
        ('zap', 'Power', 'tech'),
    ]
    
    ICON_CATEGORIES = [
        ('documents', '📄 Documents'),
        ('people', '👥 People'),
        ('business', '💼 Business'),
        ('logistics', '📦 Logistics'),
        ('communication', '💬 Communication'),
        ('time', '⏰ Time'),
        ('status', '✅ Status'),
        ('actions', '⚡ Actions'),
        ('security', '🔒 Security'),
        ('charts', '📊 Charts'),
        ('tech', '💻 Tech'),
    ]
    
    template_name = 'admin/workflows/widgets/icon_selector.html'
    
    class Media:
        css = {
            'all': ('admin/workflows/css/icon_selector.css',)
        }
        js = ('admin/workflows/js/icon_selector.js',)
    
    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        context['icons'] = self.AVAILABLE_ICONS
        context['categories'] = self.ICON_CATEGORIES
        context['current_value'] = value or 'file-text'
        return context


# =============================================================================
# SYSTEM FIELDS (available in all entities)
# =============================================================================

SYSTEM_FIELDS = [
    ('__created_at', 'Date Created'),
    ('__created_by', 'Created By'),
    ('__updated_at', 'Modified On'),
    ('__updated_by', 'Modified By'),
    ('__id', 'Record ID'),
]

ENTITY_TYPES = [
    ('supplier', 'Supplier'),
    ('customer', 'Customer'),
    ('purchase_order', 'Purchase Order'),
    ('sales_order', 'Sales Order'),
    ('invoice', 'Invoice'),
    ('plant', 'Plant'),
    ('location', 'Location'),
    ('contact', 'Contact'),
    ('carrier', 'Carrier'),
    ('product', 'Product'),
]


# =============================================================================
# TENANT LIST FORMS
# =============================================================================

class TenantListForm(forms.ModelForm):
    """Form for creating/editing Tenant Lists with user-friendly option entry."""
    
    options_text = forms.CharField(
        widget=forms.Textarea(attrs={
            'rows': 10,
            'placeholder': 'Option 1\nOption 2\nOption 3',
            'class': 'vLargeTextField',
        }),
        required=False,
        label="Options (one per line)",
        help_text="Enter each option on a new line. They will be converted to selectable values."
    )
    
    class Meta:
        model = TenantList
        fields = ['name', 'description', 'is_active']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 2}),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Pre-populate options_text from existing options
        if self.instance and self.instance.pk and self.instance.options:
            lines = [opt.get('label', opt.get('value', '')) for opt in self.instance.options]
            self.fields['options_text'].initial = '\n'.join(lines)
    
    def clean_options_text(self):
        """Convert text options to JSON format."""
        options_text = self.cleaned_data.get('options_text', '')
        if not options_text:
            return []
        
        options = []
        for line in options_text.strip().split('\n'):
            line = line.strip()
            if line:
                value = line.lower().replace(' ', '_').replace('-', '_')
                options.append({'value': value, 'label': line})
        return options
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.options = self.cleaned_data.get('options_text', [])
        if commit:
            instance.save()
        return instance


# =============================================================================
# TENANT FORM FORMS
# =============================================================================

class TenantFormAdminForm(forms.ModelForm):
    """Form for creating/editing Tenant Forms."""
    
    class Meta:
        model = TenantForm
        fields = ['name', 'description', 'status', 'is_default', 'icon']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 2}),
            'icon': IconSelectorWidget(attrs={'class': 'vTextField'}),
        }
        help_texts = {
            'is_default': 'If checked, this form will be used by default when creating new records. Only works for single-entity forms.',
        }


class TenantFormEntityForm(forms.ModelForm):
    """Form for form entity configuration."""
    
    entity_type = forms.ChoiceField(
        choices=[('', '---------')] + ENTITY_TYPES,
        help_text="Select the entity type for this form step"
    )
    
    class Meta:
        model = TenantFormEntity
        fields = ['entity_type', 'step_name', 'order']
        widgets = {
            'step_name': forms.TextInput(attrs={
                'placeholder': 'e.g., Customer Information, Order Details'
            }),
        }
        help_texts = {
            'step_name': 'Custom name for this step (leave blank to use entity name)',
            'order': 'Order in the form (0 = first step)',
        }


class TenantFormFieldForm(forms.ModelForm):
    """Form for field configuration."""
    
    class Meta:
        model = TenantFormField
        fields = [
            'field_key', 'is_visible', 'is_required', 'order',
            'custom_label', 'custom_help_text', 'default_value'
        ]
        widgets = {
            'custom_label': forms.TextInput(attrs={
                'placeholder': 'Custom label (optional)'
            }),
            'custom_help_text': forms.TextInput(attrs={
                'placeholder': 'Help text shown below field'
            }),
        }


class TenantFormRuleForm(forms.ModelForm):
    """Form for conditional rule configuration with user-friendly editors."""
    
    # Human-readable condition builder
    condition_field = forms.ChoiceField(
        choices=[('', '-- Select Field --')] + SYSTEM_FIELDS,
        required=False,
        label="When this field",
        help_text="Select a field to watch for changes"
    )
    
    condition_operator = forms.ChoiceField(
        choices=OperatorType.choices,
        required=False,
        initial=OperatorType.EQUALS,
        label="Has this condition"
    )
    
    condition_value = forms.CharField(
        max_length=255,
        required=False,
        label="Equals this value",
        widget=forms.TextInput(attrs={'placeholder': 'Enter value to compare'})
    )
    
    # Action builder
    action_type = forms.ChoiceField(
        choices=[('', '-- Select Action --')] + list(ActionType.choices),
        required=False,
        label="Then perform action"
    )
    
    action_target_fields = forms.CharField(
        max_length=500,
        required=False,
        label="Target fields",
        widget=forms.TextInput(attrs={'placeholder': 'field1, field2 (comma-separated)'}),
        help_text="Fields to show/hide or modify"
    )
    
    class Meta:
        model = TenantFormRule
        fields = ['name', 'is_active', 'order', 'condition_logic']
        widgets = {
            'name': forms.TextInput(attrs={
                'placeholder': 'e.g., Show shipping fields when delivery selected'
            }),
        }
        help_texts = {
            'condition_logic': 'How to combine multiple conditions',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Pre-populate from existing conditions/actions
        if self.instance and self.instance.pk:
            conditions = self.instance.conditions or []
            actions = self.instance.actions or []
            
            if conditions:
                first_cond = conditions[0]
                self.fields['condition_field'].initial = first_cond.get('field', '')
                self.fields['condition_operator'].initial = first_cond.get('operator', 'eq')
                self.fields['condition_value'].initial = first_cond.get('value', '')
            
            if actions:
                first_action = actions[0]
                self.fields['action_type'].initial = first_action.get('action', '')
                params = first_action.get('params', {})
                if 'fields' in params:
                    self.fields['action_target_fields'].initial = ', '.join(params['fields'])
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # Build conditions from form fields
        cond_field = self.cleaned_data.get('condition_field')
        cond_op = self.cleaned_data.get('condition_operator')
        cond_val = self.cleaned_data.get('condition_value')
        
        if cond_field:
            instance.conditions = [{
                'field': cond_field,
                'operator': cond_op,
                'value': cond_val,
            }]
        
        # Build actions from form fields
        action_type = self.cleaned_data.get('action_type')
        target_fields = self.cleaned_data.get('action_target_fields', '')
        
        if action_type:
            fields_list = [f.strip() for f in target_fields.split(',') if f.strip()]
            instance.actions = [{
                'action': action_type,
                'params': {'fields': fields_list} if fields_list else {},
            }]
        
        if commit:
            instance.save()
        return instance


# =============================================================================
# TENANT WORKFLOW FORMS
# =============================================================================

class TenantWorkflowAdminForm(forms.ModelForm):
    """Form for creating/editing Tenant Workflows with user-friendly configuration."""
    
    entity_type = forms.ChoiceField(
        choices=[('', '-- Any Entity --')] + ENTITY_TYPES,
        required=False,
        help_text="Entity type this workflow applies to (leave blank for all)"
    )
    
    # Schedule configuration (for scheduled triggers)
    schedule_description = forms.CharField(
        max_length=255,
        required=False,
        label="Schedule",
        widget=forms.TextInput(attrs={
            'placeholder': 'e.g., Every Monday at 9am, Daily at midnight'
        }),
        help_text="Describe when this should run (we'll help you set up the schedule)"
    )
    
    # Record trigger configuration
    watch_fields = forms.CharField(
        max_length=500,
        required=False,
        label="Watch fields",
        widget=forms.TextInput(attrs={'placeholder': 'status, total_amount (comma-separated)'}),
        help_text="For record_updated trigger: which fields to watch"
    )
    
    class Meta:
        model = TenantWorkflow
        fields = ['name', 'description', 'status', 'trigger_type', 'entity_type', 'icon']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 2}),
        }
        help_texts = {
            'trigger_type': 'What event triggers this workflow',
            'status': 'Only "Active" workflows will run automatically',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Pre-populate from existing trigger_config
        if self.instance and self.instance.pk:
            config = self.instance.trigger_config or {}
            if 'fields' in config:
                self.fields['watch_fields'].initial = ', '.join(config['fields'])
            if 'schedule_description' in config:
                self.fields['schedule_description'].initial = config['schedule_description']
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # Build trigger_config from form fields
        config = instance.trigger_config or {}
        
        if instance.trigger_type == TriggerType.SCHEDULED:
            schedule = self.cleaned_data.get('schedule_description', '')
            if schedule:
                config['schedule_description'] = schedule
        
        elif instance.trigger_type == TriggerType.RECORD_UPDATED:
            watch_fields = self.cleaned_data.get('watch_fields', '')
            if watch_fields:
                config['fields'] = [f.strip() for f in watch_fields.split(',') if f.strip()]
        
        instance.trigger_config = config
        
        if commit:
            instance.save()
        return instance


class TenantWorkflowConditionForm(forms.ModelForm):
    """Form for workflow condition with better UX."""
    
    field_path = forms.ChoiceField(
        choices=[('', '-- Select Field --')] + SYSTEM_FIELDS + [
            ('custom', '↳ Custom field path...')
        ],
        label="Field to check"
    )
    
    custom_field_path = forms.CharField(
        max_length=255,
        required=False,
        label="Custom field path",
        widget=forms.TextInput(attrs={'placeholder': 'e.g., customer.name, items.0.quantity'}),
        help_text="Use dot notation for nested fields"
    )
    
    class Meta:
        model = TenantWorkflowCondition
        fields = ['field_path', 'operator', 'compare_value', 'order']
    
    def clean(self):
        cleaned_data = super().clean()
        field_path = cleaned_data.get('field_path')
        custom_field_path = cleaned_data.get('custom_field_path')
        
        if field_path == 'custom' and custom_field_path:
            cleaned_data['field_path'] = custom_field_path
        
        return cleaned_data


class TenantWorkflowActionForm(forms.ModelForm):
    """Form for workflow action with user-friendly configuration."""
    
    # Email action fields
    email_to = forms.CharField(
        max_length=500,
        required=False,
        label="To (email)",
        widget=forms.TextInput(attrs={'placeholder': '{{record.customer.email}} or email@example.com'}),
        help_text="Use {{field}} for dynamic values"
    )
    
    email_subject = forms.CharField(
        max_length=255,
        required=False,
        label="Subject",
        widget=forms.TextInput(attrs={'placeholder': 'Order {{record.order_number}} - Status Update'})
    )
    
    email_body = forms.CharField(
        required=False,
        label="Body",
        widget=forms.Textarea(attrs={'rows': 4, 'placeholder': 'Hello {{record.customer.name}},\n\nYour order has been updated.'})
    )
    
    # Notification fields
    notification_title = forms.CharField(
        max_length=255,
        required=False,
        label="Title",
        widget=forms.TextInput(attrs={'placeholder': 'New Order Received'})
    )
    
    notification_message = forms.CharField(
        max_length=500,
        required=False,
        label="Message"
    )
    
    # Set value fields
    set_field = forms.CharField(
        max_length=100,
        required=False,
        label="Field to set",
        widget=forms.TextInput(attrs={'placeholder': 'status'})
    )
    
    set_value = forms.CharField(
        max_length=255,
        required=False,
        label="Value to set",
        widget=forms.TextInput(attrs={'placeholder': 'approved'})
    )
    
    class Meta:
        model = TenantWorkflowAction
        fields = ['action_type', 'order', 'continue_on_error']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Pre-populate from existing config
        if self.instance and self.instance.pk:
            config = self.instance.config or {}
            
            # Email
            self.fields['email_to'].initial = config.get('to', '')
            self.fields['email_subject'].initial = config.get('subject', '')
            self.fields['email_body'].initial = config.get('body', '')
            
            # Notification
            self.fields['notification_title'].initial = config.get('title', '')
            self.fields['notification_message'].initial = config.get('message', '')
            
            # Set value
            self.fields['set_field'].initial = config.get('field', '')
            self.fields['set_value'].initial = config.get('value', '')
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        action_type = instance.action_type
        
        config = {}
        
        if action_type == ActionType.SEND_EMAIL:
            config = {
                'to': self.cleaned_data.get('email_to', ''),
                'subject': self.cleaned_data.get('email_subject', ''),
                'body': self.cleaned_data.get('email_body', ''),
            }
        elif action_type in [ActionType.SEND_NOTIFICATION, ActionType.SEND_TEAMS_SLACK]:
            config = {
                'title': self.cleaned_data.get('notification_title', ''),
                'message': self.cleaned_data.get('notification_message', ''),
            }
        elif action_type == ActionType.SET_FIELD_VALUE:
            config = {
                'field': self.cleaned_data.get('set_field', ''),
                'value': self.cleaned_data.get('set_value', ''),
            }
        
        if config:
            instance.config = config
        
        if commit:
            instance.save()
        return instance


# =============================================================================
# QUICK ADD FORMS (for modals)
# =============================================================================

class QuickAddFormRuleForm(forms.Form):
    """Quick form for adding a rule via modal."""
    
    name = forms.CharField(
        max_length=255,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'Rule name (optional)'})
    )
    
    when_field = forms.ChoiceField(
        choices=[('', '-- Select --')] + SYSTEM_FIELDS,
        label="When"
    )
    
    operator = forms.ChoiceField(
        choices=OperatorType.choices,
        initial=OperatorType.EQUALS
    )
    
    value = forms.CharField(
        max_length=255,
        widget=forms.TextInput(attrs={'placeholder': 'Value'})
    )
    
    then_action = forms.ChoiceField(
        choices=ActionType.choices,
        label="Then"
    )
    
    target_fields = forms.CharField(
        max_length=500,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'field1, field2'}),
        help_text="Comma-separated field names"
    )


class QuickAddWorkflowActionForm(forms.Form):
    """Quick form for adding a workflow action via modal."""
    
    action_type = forms.ChoiceField(
        choices=ActionType.choices,
        label="Action"
    )
    
    description = forms.CharField(
        max_length=255,
        required=False,
        widget=forms.TextInput(attrs={'placeholder': 'Brief description of this action'})
    )
    
    continue_on_error = forms.BooleanField(
        required=False,
        label="Continue if this action fails"
    )
