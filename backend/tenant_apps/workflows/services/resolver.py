"""
Variable Resolver Service

Parses and resolves template strings with variable placeholders like {{ field_name }}.
Supports nested lookups, safe defaults, and date formatting for workflow execution.

Phase 7.4 Readiness - The "Variable Injector"
Authority: .github/copilot-instructions.md (Phase 7 - Intelligent Workform Editor)
"""
import re
from typing import Any, Dict, Optional
from datetime import datetime, date
from django.utils import timezone


class VariableResolver:
    """
    Resolves template variables in strings like 'Hello {{ customer_name }}'.
    
    Features:
    - Nested object access: {{ customer.email }}
    - Array indexing: {{ items[0].name }}
    - Safe defaults: Returns empty string or placeholder if variable missing
    - Date formatting: {{ created_at|format:'Y-m-d' }}
    - Null-safe: Won't crash on missing data
    
    Example:
        resolver = VariableResolver({'customer': {'name': 'John', 'email': 'john@example.com'}})
        result = resolver.resolve('Hello {{ customer.name }}, your email is {{ customer.email }}')
        # Output: "Hello John, your email is john@example.com"
    """
    
    # Regex pattern to match {{ variable_name }} or {{ variable|filter:'args' }}
    VARIABLE_PATTERN = re.compile(
        r'\{\{\s*'  # Opening braces and optional whitespace
        r'([a-zA-Z0-9_.[\]]+)'  # Variable name (with dot notation, brackets)
        r'(?:\|([a-zA-Z0-9_]+)'  # Optional pipe and filter name
        r'(?::\'([^\']+)\')?)?'  # Optional filter arguments
        r'\s*\}\}',  # Closing braces
        re.MULTILINE
    )
    
    def __init__(self, context: Dict[str, Any], missing_value: str = ''):
        """
        Initialize resolver with data context.
        
        Args:
            context: Dictionary of available variables
            missing_value: Value to return for missing variables (default: empty string)
        """
        self.context = context or {}
        self.missing_value = missing_value
    
    def resolve(self, template: str) -> str:
        """
        Resolve all variables in a template string.
        
        Args:
            template: String with {{ variable }} placeholders
            
        Returns:
            String with variables replaced by their values
        """
        if not template or not isinstance(template, str):
            return str(template) if template is not None else ''
        
        def replace_match(match):
            """Replace a single variable match."""
            variable_path = match.group(1)
            filter_name = match.group(2)
            filter_arg = match.group(3)
            
            # Resolve the variable value
            value = self._resolve_variable(variable_path)
            
            # Apply filter if specified
            if filter_name:
                value = self._apply_filter(value, filter_name, filter_arg)
            
            return str(value) if value is not None else self.missing_value
        
        return self.VARIABLE_PATTERN.sub(replace_match, template)
    
    def _resolve_variable(self, path: str) -> Any:
        """
        Resolve a variable path like 'customer.email' or 'items[0].name'.
        
        Args:
            path: Dot-notation or bracket-notation path
            
        Returns:
            Resolved value or None if not found
        """
        # Split path by dots and brackets
        parts = self._parse_path(path)
        
        # Traverse the context
        current = self.context
        for part in parts:
            if current is None:
                return None
            
            # Handle dictionary access
            if isinstance(current, dict):
                current = current.get(part, None)
            # Handle list/array access
            elif isinstance(current, (list, tuple)):
                try:
                    index = int(part)
                    current = current[index] if 0 <= index < len(current) else None
                except (ValueError, IndexError):
                    return None
            # Handle object attribute access
            elif hasattr(current, part):
                current = getattr(current, part, None)
            else:
                return None
        
        return current
    
    def _parse_path(self, path: str) -> list:
        """
        Parse a path string into parts.
        
        Examples:
            'customer.name' -> ['customer', 'name']
            'items[0].name' -> ['items', '0', 'name']
            'data.users[5].email' -> ['data', 'users', '5', 'email']
        
        Args:
            path: Path string
            
        Returns:
            List of path parts
        """
        # Replace [index] with .index for uniform splitting
        normalized = re.sub(r'\[(\d+)\]', r'.\1', path)
        return [p for p in normalized.split('.') if p]
    
    def _apply_filter(self, value: Any, filter_name: str, filter_arg: Optional[str] = None) -> Any:
        """
        Apply a filter to a value.
        
        Supported filters:
        - format: Date/datetime formatting (requires strftime format string)
        - upper: Uppercase string
        - lower: Lowercase string
        - title: Title case
        - default: Use default value if None
        
        Args:
            value: Value to filter
            filter_name: Name of filter
            filter_arg: Optional filter argument
            
        Returns:
            Filtered value
        """
        if filter_name == 'format':
            return self._filter_format(value, filter_arg)
        elif filter_name == 'upper':
            return str(value).upper() if value is not None else ''
        elif filter_name == 'lower':
            return str(value).lower() if value is not None else ''
        elif filter_name == 'title':
            return str(value).title() if value is not None else ''
        elif filter_name == 'default':
            return value if value is not None else (filter_arg or '')
        else:
            # Unknown filter, return value as-is
            return value
    
    def _filter_format(self, value: Any, format_string: Optional[str]) -> str:
        """
        Format a date/datetime value using strftime.
        
        Args:
            value: Date or datetime object
            format_string: strftime format string (e.g., 'Y-m-d', 'Y-m-d H:M:S')
            
        Returns:
            Formatted date string
        """
        if value is None:
            return ''
        
        if not format_string:
            format_string = '%Y-%m-%d'
        
        # Handle datetime objects
        if isinstance(value, (datetime, date)):
            # Convert Django format shortcuts to strftime
            format_string = self._convert_django_format(format_string)
            return value.strftime(format_string)
        
        # Try to parse string as datetime
        if isinstance(value, str):
            try:
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                format_string = self._convert_django_format(format_string)
                return dt.strftime(format_string)
            except ValueError:
                return value
        
        return str(value)
    
    def _convert_django_format(self, fmt: str) -> str:
        """
        Convert Django template format shortcuts to strftime format.
        
        Django shortcuts:
        - Y: 4-digit year
        - m: Month (01-12)
        - d: Day (01-31)
        - H: Hour (00-23)
        - M: Minute (00-59)
        - S: Second (00-59)
        
        Args:
            fmt: Django format string
            
        Returns:
            strftime format string
        """
        replacements = {
            'Y': '%Y',
            'm': '%m',
            'd': '%d',
            'H': '%H',
            'M': '%M',
            'S': '%S',
        }
        
        result = fmt
        for django_code, strftime_code in replacements.items():
            result = result.replace(django_code, strftime_code)
        
        return result
    
    def resolve_multiple(self, templates: Dict[str, str]) -> Dict[str, str]:
        """
        Resolve multiple templates at once.
        
        Useful for resolving all fields in an email template or action configuration.
        
        Args:
            templates: Dictionary of {key: template_string}
            
        Returns:
            Dictionary of {key: resolved_string}
        """
        return {
            key: self.resolve(template)
            for key, template in templates.items()
        }


def resolve_variables(template: str, context: Dict[str, Any], missing_value: str = '') -> str:
    """
    Convenience function to resolve variables in a template string.
    
    Args:
        template: String with {{ variable }} placeholders
        context: Dictionary of available variables
        missing_value: Value to return for missing variables
        
    Returns:
        String with variables replaced by their values
    
    Example:
        result = resolve_variables(
            'Hello {{ name }}, today is {{ date|format:\'Y-m-d\' }}',
            {'name': 'John', 'date': datetime.now()}
        )
    """
    resolver = VariableResolver(context, missing_value)
    return resolver.resolve(template)


def resolve_action_config(
    config: Dict[str, Any],
    context: Dict[str, Any],
    fields_to_resolve: Optional[list] = None
) -> Dict[str, Any]:
    """
    Resolve variables in action configuration dictionary.
    
    Useful for resolving workflow action parameters before execution.
    Only resolves string values, leaves other types unchanged.
    
    Args:
        config: Action configuration dictionary
        context: Variable context
        fields_to_resolve: Optional list of field names to resolve (resolves all strings if None)
        
    Returns:
        Configuration with resolved values
    
    Example:
        action_config = {
            'to': '{{ customer.email }}',
            'subject': 'Order {{ order.id }} Confirmation',
            'body': 'Hello {{ customer.name }}, your order is ready!',
            'send_at': datetime.now(),  # Non-string, won't be touched
            'priority': 5  # Non-string, won't be touched
        }
        
        resolved = resolve_action_config(action_config, {'customer': {...}, 'order': {...}})
    """
    resolver = VariableResolver(context)
    resolved = {}
    
    for key, value in config.items():
        # Only resolve if it's a string and either no filter list or key is in filter list
        if isinstance(value, str) and (fields_to_resolve is None or key in fields_to_resolve):
            resolved[key] = resolver.resolve(value)
        else:
            resolved[key] = value
    
    return resolved


# Convenience exports
__all__ = [
    'VariableResolver',
    'resolve_variables',
    'resolve_action_config',
]
