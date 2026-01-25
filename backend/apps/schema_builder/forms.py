"""
Django Admin forms for Schema Builder.

Provides forms for creating and editing schemas and fields
through the Django Admin interface.
"""
from django import forms
from django.contrib.auth.models import User

from .models import DataSchema, DataSchemaField, FieldOptionList, FieldType


class DataSchemaForm(forms.ModelForm):
    """Form for creating/editing Data Schemas."""
    
    class Meta:
        model = DataSchema
        fields = [
            'name', 'slug', 'description', 'icon', 'color', 'is_active', 'is_system'
        ]
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
        }


class DataSchemaFieldForm(forms.ModelForm):
    """Form for creating/editing Schema Fields."""
    
    # For dropdown/multiselect, allow selecting from existing option lists
    option_list = forms.ModelChoiceField(
        queryset=FieldOptionList.objects.all(),
        required=False,
        help_text="Select an existing option list or define custom options below"
    )
    
    class Meta:
        model = DataSchemaField
        fields = [
            'key', 'label', 'field_type', 'is_visible', 'is_required',
            'is_searchable', 'order', 'options', 'default_value',
            'help_text', 'placeholder', 'validation_rules', 'decimal_places'
        ]
        widgets = {
            'help_text': forms.TextInput(attrs={'class': 'vTextField'}),
            'placeholder': forms.TextInput(attrs={'class': 'vTextField'}),
            'options': forms.Textarea(attrs={'rows': 4}),
            'validation_rules': forms.Textarea(attrs={'rows': 3}),
        }
    
    def clean(self):
        cleaned_data = super().clean()
        field_type = cleaned_data.get('field_type')
        options = cleaned_data.get('options')
        option_list = cleaned_data.get('option_list')
        
        # If dropdown/multiselect, require options
        if field_type in [FieldType.DROPDOWN, FieldType.MULTISELECT]:
            if option_list:
                # Copy options from the selected list
                cleaned_data['options'] = option_list.options
            elif not options:
                raise forms.ValidationError(
                    "Dropdown and Multi-select fields require options. "
                    "Select an option list or define custom options."
                )
        
        return cleaned_data


class AddFieldForm(forms.Form):
    """Quick add field form for modal actions."""
    
    label = forms.CharField(
        max_length=255,
        help_text="Human-readable field label"
    )
    field_type = forms.ChoiceField(
        choices=FieldType.choices,
        initial=FieldType.TEXT,
        help_text="Type of field"
    )
    is_required = forms.BooleanField(
        required=False,
        initial=False,
        help_text="Whether this field is required"
    )
    is_visible = forms.BooleanField(
        required=False,
        initial=True,
        help_text="Whether this field is visible in forms"
    )
    help_text = forms.CharField(
        max_length=500,
        required=False,
        help_text="Help text shown below the field"
    )
    
    # Options for dropdown/multiselect (JSON format)
    options_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 3, 'placeholder': 'Option 1\nOption 2\nOption 3'}),
        required=False,
        help_text="Enter options (one per line) for dropdown/multiselect fields"
    )
    
    def clean_options_text(self):
        """Convert text options to JSON format."""
        options_text = self.cleaned_data.get('options_text', '')
        if not options_text:
            return []
        
        options = []
        for line in options_text.strip().split('\n'):
            line = line.strip()
            if line:
                # Create {value, label} format
                value = line.lower().replace(' ', '_')
                options.append({'value': value, 'label': line})
        return options


class SubmitSchemaForm(forms.Form):
    """Form for submitting a schema for review."""
    
    notes = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 3}),
        required=False,
        help_text="Optional notes for the reviewer"
    )
    confirm = forms.BooleanField(
        required=True,
        label="I confirm this schema is ready for review"
    )


class PublishSchemaForm(forms.Form):
    """Form for publishing a schema (superuser only)."""
    
    notes = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 3}),
        required=False,
        help_text="Optional notes about this publication"
    )
    confirm = forms.BooleanField(
        required=True,
        label="I confirm this schema should be published and made globally accessible"
    )


class FieldOptionListForm(forms.ModelForm):
    """Form for creating/editing Field Option Lists."""
    
    # Helper field for easy option entry
    options_text = forms.CharField(
        widget=forms.Textarea(attrs={
            'rows': 10,
            'placeholder': 'Option 1\nOption 2\nOption 3'
        }),
        required=False,
        label="Options (one per line)",
        help_text="Enter options one per line. They will be converted to value/label pairs."
    )
    
    class Meta:
        model = FieldOptionList
        fields = ['name', 'description', 'is_system']
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
