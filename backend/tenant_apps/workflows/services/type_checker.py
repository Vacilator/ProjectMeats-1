"""
Type Checking Service for Workflow Forms

Provides runtime type validation for form fields to prevent data corruption
and ensure type safety throughout the workflow execution lifecycle.

Features:
- Field-level type validation
- Custom type definitions (email, phone, url, etc.)
- Type coercion with safety checks
- Detailed validation error reporting
"""
from typing import Any, Dict, List
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
import re


class ValidationError(Exception):
    """Raised when type validation fails"""
    def __init__(self, field_name: str, expected_type: str, actual_value: Any, message: str = None):
        self.field_name = field_name
        self.expected_type = expected_type
        self.actual_value = actual_value
        self.custom_message = message
        super().__init__(self._format_message())
    
    def _format_message(self) -> str:
        if self.custom_message:
            return self.custom_message
        return (
            f"Field '{self.field_name}' expected type '{self.expected_type}', "
            f"got {type(self.actual_value).__name__}: {self.actual_value}"
        )


class TypeChecker:
    """
    Type checking and validation service for workflow form fields.
    
    Supports standard Python types plus custom validators for:
    - Email addresses
    - Phone numbers
    - URLs
    - Dates and datetimes
    - Decimal values
    - Enums (choice fields)
    """
    
    # Regex patterns for custom types
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    PHONE_PATTERN = re.compile(r'^\+?1?\d{9,15}$')  # E.164 format
    URL_PATTERN = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE
    )
    
    # Type mapping for common field types
    TYPE_VALIDATORS = {
        'string': str,
        'text': str,
        'integer': int,
        'number': (int, float, Decimal),
        'boolean': bool,
        'date': date,
        'datetime': datetime,
        'email': 'email',
        'phone': 'phone',
        'url': 'url',
        'choice': 'choice',
        'decimal': Decimal,
    }
    
    def __init__(self, field_definitions: List[Dict[str, Any]]):
        """
        Initialize type checker with field definitions.
        
        Args:
            field_definitions: List of field definition dicts containing:
                - name: Field name
                - type: Field type (string, integer, email, etc.)
                - required: Whether field is required (default: False)
                - choices: Valid choices for choice fields (optional)
                - min: Minimum value for numeric fields (optional)
                - max: Maximum value for numeric fields (optional)
        """
        self.field_definitions = {field['name']: field for field in field_definitions}
    
    def validate_field(self, field_name: str, value: Any) -> Any:
        """
        Validate a single field value against its type definition.
        
        Args:
            field_name: Name of the field
            value: Value to validate
            
        Returns:
            Validated (and possibly coerced) value
            
        Raises:
            ValidationError: If validation fails
        """
        if field_name not in self.field_definitions:
            raise ValidationError(
                field_name, 'unknown', value,
                f"Field '{field_name}' not found in schema"
            )
        
        field_def = self.field_definitions[field_name]
        field_type = field_def.get('type', 'string')
        required = field_def.get('required', False)
        
        # Check required fields
        if required and (value is None or value == ''):
            raise ValidationError(
                field_name, field_type, value,
                f"Field '{field_name}' is required but was empty"
            )
        
        # Allow None for optional fields
        if value is None or value == '':
            return None
        
        # Get type validator
        expected_type = self.TYPE_VALIDATORS.get(field_type, str)
        
        # Handle custom validators
        if expected_type == 'email':
            return self._validate_email(field_name, value)
        elif expected_type == 'phone':
            return self._validate_phone(field_name, value)
        elif expected_type == 'url':
            return self._validate_url(field_name, value)
        elif expected_type == 'choice':
            return self._validate_choice(field_name, value, field_def.get('choices', []))
        
        # Handle standard type validation
        if isinstance(expected_type, tuple):
            # Multiple acceptable types
            if not isinstance(value, expected_type):
                try:
                    # Try to coerce to first acceptable type
                    value = expected_type[0](value)
                except (ValueError, TypeError):
                    raise ValidationError(field_name, field_type, value)
        else:
            if not isinstance(value, expected_type):
                try:
                    # Try type coercion
                    if expected_type == Decimal:
                        value = Decimal(str(value))
                    elif expected_type == datetime:
                        value = self._parse_datetime(value)
                    elif expected_type == date:
                        value = self._parse_date(value)
                    else:
                        value = expected_type(value)
                except (ValueError, TypeError, InvalidOperation):
                    raise ValidationError(field_name, field_type, value)
        
        # Validate numeric ranges
        if field_type in ('integer', 'number', 'decimal'):
            min_val = field_def.get('min')
            max_val = field_def.get('max')
            if min_val is not None and value < min_val:
                raise ValidationError(
                    field_name, field_type, value,
                    f"Value {value} is less than minimum {min_val}"
                )
            if max_val is not None and value > max_val:
                raise ValidationError(
                    field_name, field_type, value,
                    f"Value {value} is greater than maximum {max_val}"
                )
        
        return value
    
    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate an entire data dictionary against all field definitions.
        
        Args:
            data: Dictionary of field names to values
            
        Returns:
            Dictionary of validated (and possibly coerced) values
            
        Raises:
            ValidationError: If any field validation fails
        """
        validated_data = {}
        errors = []
        
        # Validate provided fields
        for field_name, value in data.items():
            try:
                validated_data[field_name] = self.validate_field(field_name, value)
            except ValidationError as e:
                errors.append({
                    'field': field_name,
                    'error': str(e),
                    'expected_type': e.expected_type,
                    'actual_value': e.actual_value
                })
        
        # Check for missing required fields
        for field_name, field_def in self.field_definitions.items():
            if field_def.get('required', False) and field_name not in data:
                errors.append({
                    'field': field_name,
                    'error': f"Required field '{field_name}' is missing",
                    'expected_type': field_def.get('type', 'string'),
                    'actual_value': None
                })
        
        if errors:
            error_msg = "Validation failed:\n" + "\n".join(
                f"  - {e['field']}: {e['error']}" for e in errors
            )
            raise ValidationError('multiple', 'various', data, error_msg)
        
        return validated_data
    
    def _validate_email(self, field_name: str, value: Any) -> str:
        """Validate email address format"""
        if not isinstance(value, str):
            raise ValidationError(field_name, 'email', value, "Email must be a string")
        
        if not self.EMAIL_PATTERN.match(value):
            raise ValidationError(
                field_name, 'email', value,
                f"Invalid email format: {value}"
            )
        
        return value.lower()  # Normalize to lowercase
    
    def _validate_phone(self, field_name: str, value: Any) -> str:
        """Validate phone number format (E.164)"""
        if not isinstance(value, str):
            value = str(value)
        
        # Remove common formatting characters
        cleaned = re.sub(r'[\s\-\(\)\.]+', '', value)
        
        if not self.PHONE_PATTERN.match(cleaned):
            raise ValidationError(
                field_name, 'phone', value,
                f"Invalid phone number format: {value} (expected E.164 format)"
            )
        
        return cleaned
    
    def _validate_url(self, field_name: str, value: Any) -> str:
        """Validate URL format"""
        if not isinstance(value, str):
            raise ValidationError(field_name, 'url', value, "URL must be a string")
        
        if not self.URL_PATTERN.match(value):
            raise ValidationError(
                field_name, 'url', value,
                f"Invalid URL format: {value}"
            )
        
        return value
    
    def _validate_choice(self, field_name: str, value: Any, choices: List[Any]) -> Any:
        """Validate that value is one of the allowed choices"""
        if not choices:
            raise ValidationError(
                field_name, 'choice', value,
                f"No choices defined for field '{field_name}'"
            )
        
        if value not in choices:
            raise ValidationError(
                field_name, 'choice', value,
                f"Value '{value}' is not a valid choice. Must be one of: {choices}"
            )
        
        return value
    
    def _parse_datetime(self, value: Any) -> datetime:
        """Parse datetime from string"""
        if isinstance(value, datetime):
            return value
        
        if isinstance(value, str):
            # Try ISO 8601 format first
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                pass
            
            # Try common formats
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d %H:%M',
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%dT%H:%M',
                '%d/%m/%Y %H:%M:%S',
                '%d/%m/%Y %H:%M',
                '%m/%d/%Y %H:%M:%S',
                '%m/%d/%Y %H:%M',
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
        
        raise ValueError(f"Could not parse datetime: {value}")
    
    def _parse_date(self, value: Any) -> date:
        """Parse date from string"""
        if isinstance(value, date):
            return value
        
        if isinstance(value, datetime):
            return value.date()
        
        if isinstance(value, str):
            # Try ISO 8601 format first
            try:
                return date.fromisoformat(value)
            except ValueError:
                pass
            
            # Try common formats
            formats = [
                '%Y-%m-%d',
                '%d/%m/%Y',
                '%m/%d/%Y',
                '%d-%m-%Y',
                '%m-%d-%Y',
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt).date()
                except ValueError:
                    continue
        
        raise ValueError(f"Could not parse date: {value}")


def validate_workflow_data(field_definitions: List[Dict[str, Any]], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to validate workflow data.
    
    Args:
        field_definitions: List of field definitions
        data: Data dictionary to validate
        
    Returns:
        Validated data dictionary
        
    Raises:
        ValidationError: If validation fails
    """
    checker = TypeChecker(field_definitions)
    return checker.validate_data(data)
