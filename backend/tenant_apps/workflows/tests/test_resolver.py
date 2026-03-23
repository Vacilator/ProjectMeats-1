"""
Unit tests for Variable Resolver Service

Tests template string parsing with {{ variable }} syntax.
"""
import unittest
from datetime import datetime, date
from tenant_apps.workflows.services.resolver import (
    VariableResolver,
    resolve_variables,
    resolve_action_config
)


class TestVariableResolver(unittest.TestCase):
    """Test suite for VariableResolver."""
    
    def test_simple_variable(self):
        """Resolve simple variable: {{ name }}."""
        resolver = VariableResolver({'name': 'John'})
        result = resolver.resolve('Hello {{ name }}!')
        
        self.assertEqual(result, 'Hello John!')
    
    def test_multiple_variables(self):
        """Resolve multiple variables in one string."""
        resolver = VariableResolver({'first': 'John', 'last': 'Doe'})
        result = resolver.resolve('{{ first }} {{ last }}')
        
        self.assertEqual(result, 'John Doe')
    
    def test_nested_object_access(self):
        """Resolve nested object: {{ customer.email }}."""
        context = {
            'customer': {
                'name': 'John',
                'email': 'john@example.com',
                'address': {
                    'city': 'New York'
                }
            }
        }
        resolver = VariableResolver(context)
        
        result1 = resolver.resolve('{{ customer.name }}')
        result2 = resolver.resolve('{{ customer.email }}')
        result3 = resolver.resolve('{{ customer.address.city }}')
        
        self.assertEqual(result1, 'John')
        self.assertEqual(result2, 'john@example.com')
        self.assertEqual(result3, 'New York')
    
    def test_array_indexing(self):
        """Resolve array elements: {{ items[0] }}."""
        context = {
            'items': ['apple', 'banana', 'cherry'],
            'users': [
                {'name': 'Alice'},
                {'name': 'Bob'}
            ]
        }
        resolver = VariableResolver(context)
        
        result1 = resolver.resolve('{{ items[0] }}')
        result2 = resolver.resolve('{{ items[2] }}')
        result3 = resolver.resolve('{{ users[1].name }}')
        
        self.assertEqual(result1, 'apple')
        self.assertEqual(result2, 'cherry')
        self.assertEqual(result3, 'Bob')
    
    def test_missing_variable_default(self):
        """Missing variables return empty string by default."""
        resolver = VariableResolver({'name': 'John'})
        result = resolver.resolve('Hello {{ name }}, your age is {{ age }}')
        
        self.assertEqual(result, 'Hello John, your age is ')
    
    def test_missing_variable_custom_default(self):
        """Missing variables can use custom default."""
        resolver = VariableResolver({'name': 'John'}, missing_value='[MISSING]')
        result = resolver.resolve('Hello {{ name }}, your age is {{ age }}')
        
        self.assertEqual(result, 'Hello John, your age is [MISSING]')
    
    def test_filter_upper(self):
        """Test uppercase filter: {{ name|upper }}."""
        resolver = VariableResolver({'name': 'john'})
        result = resolver.resolve('{{ name|upper }}')
        
        self.assertEqual(result, 'JOHN')
    
    def test_filter_lower(self):
        """Test lowercase filter: {{ name|lower }}."""
        resolver = VariableResolver({'name': 'JOHN'})
        result = resolver.resolve('{{ name|lower }}')
        
        self.assertEqual(result, 'john')
    
    def test_filter_title(self):
        """Test title case filter: {{ name|title }}."""
        resolver = VariableResolver({'name': 'john doe'})
        result = resolver.resolve('{{ name|title }}')
        
        self.assertEqual(result, 'John Doe')
    
    def test_filter_format_date(self):
        """Test date formatting filter: {{ date|format:'Y-m-d' }}."""
        test_date = date(2024, 12, 25)
        resolver = VariableResolver({'date': test_date})
        result = resolver.resolve('{{ date|format:\'Y-m-d\' }}')
        
        self.assertEqual(result, '2024-12-25')
    
    def test_filter_format_datetime(self):
        """Test datetime formatting: {{ timestamp|format:'Y-m-d H:M:S' }}."""
        test_dt = datetime(2024, 12, 25, 14, 30, 45)
        resolver = VariableResolver({'timestamp': test_dt})
        result = resolver.resolve('{{ timestamp|format:\'Y-m-d H:M:S\' }}')
        
        self.assertEqual(result, '2024-12-25 14:30:45')
    
    def test_filter_default(self):
        """Test default filter: {{ value|default:'N/A' }}."""
        resolver = VariableResolver({'name': 'John', 'age': None})
        
        result1 = resolver.resolve('{{ name|default:\'Anonymous\' }}')
        result2 = resolver.resolve('{{ age|default:\'Unknown\' }}')
        
        self.assertEqual(result1, 'John')
        self.assertEqual(result2, 'Unknown')
    
    def test_no_variables(self):
        """String with no variables returns unchanged."""
        resolver = VariableResolver({})
        result = resolver.resolve('This is a plain string.')
        
        self.assertEqual(result, 'This is a plain string.')
    
    def test_empty_template(self):
        """Empty or None template returns safely."""
        resolver = VariableResolver({'name': 'John'})
        
        result1 = resolver.resolve('')
        result2 = resolver.resolve(None)
        
        self.assertEqual(result1, '')
        self.assertEqual(result2, '')
    
    def test_whitespace_handling(self):
        """Variables work with various whitespace."""
        resolver = VariableResolver({'name': 'John'})
        
        result1 = resolver.resolve('{{name}}')
        result2 = resolver.resolve('{{ name }}')
        result3 = resolver.resolve('{{  name  }}')
        
        self.assertEqual(result1, 'John')
        self.assertEqual(result2, 'John')
        self.assertEqual(result3, 'John')
    
    def test_resolve_multiple(self):
        """Resolve multiple templates at once."""
        resolver = VariableResolver({'name': 'John', 'age': 30})
        templates = {
            'greeting': 'Hello {{ name }}!',
            'info': 'You are {{ age }} years old.',
            'plain': 'No variables here.'
        }
        
        result = resolver.resolve_multiple(templates)
        
        self.assertEqual(result['greeting'], 'Hello John!')
        self.assertEqual(result['info'], 'You are 30 years old.')
        self.assertEqual(result['plain'], 'No variables here.')


class TestConvenienceFunctions(unittest.TestCase):
    """Test convenience functions."""
    
    def test_resolve_variables_function(self):
        """Test resolve_variables convenience function."""
        result = resolve_variables(
            'Hello {{ name }}, welcome to {{ city }}!',
            {'name': 'Alice', 'city': 'NYC'}
        )
        
        self.assertEqual(result, 'Hello Alice, welcome to NYC!')
    
    def test_resolve_action_config(self):
        """Test resolve_action_config for workflow actions."""
        config = {
            'to': '{{ customer.email }}',
            'subject': 'Order {{ order.id }} Confirmation',
            'body': 'Hello {{ customer.name }}!',
            'priority': 5,  # Non-string, should not change
            'send_at': datetime.now()  # Non-string, should not change
        }
        
        context = {
            'customer': {'name': 'John', 'email': 'john@example.com'},
            'order': {'id': '12345'}
        }
        
        result = resolve_action_config(config, context)
        
        self.assertEqual(result['to'], 'john@example.com')
        self.assertEqual(result['subject'], 'Order 12345 Confirmation')
        self.assertEqual(result['body'], 'Hello John!')
        self.assertEqual(result['priority'], 5)
        self.assertIsInstance(result['send_at'], datetime)
    
    def test_resolve_action_config_selective(self):
        """Test resolve_action_config with field filter."""
        config = {
            'template_id': '{{ template.id }}',
            'description': '{{ template.description }}',
            'note': 'This should not be resolved: {{ value }}'
        }
        
        context = {
            'template': {'id': 'tmpl-001', 'description': 'Default Template'}
        }
        
        # Only resolve specific fields
        result = resolve_action_config(
            config,
            context,
            fields_to_resolve=['template_id', 'description']
        )
        
        self.assertEqual(result['template_id'], 'tmpl-001')
        self.assertEqual(result['description'], 'Default Template')
        self.assertEqual(result['note'], 'This should not be resolved: {{ value }}')


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and error handling."""
    
    def test_deeply_nested_access(self):
        """Handle deeply nested object access."""
        context = {
            'a': {
                'b': {
                    'c': {
                        'd': {
                            'e': 'deep value'
                        }
                    }
                }
            }
        }
        resolver = VariableResolver(context)
        result = resolver.resolve('{{ a.b.c.d.e }}')
        
        self.assertEqual(result, 'deep value')
    
    def test_out_of_bounds_array_access(self):
        """Out of bounds array access returns empty."""
        resolver = VariableResolver({'items': ['a', 'b', 'c']})
        result = resolver.resolve('{{ items[10] }}')
        
        self.assertEqual(result, '')
    
    def test_non_dict_dot_access(self):
        """Dot access on non-dict returns empty."""
        resolver = VariableResolver({'value': 'string'})
        result = resolver.resolve('{{ value.property }}')
        
        self.assertEqual(result, '')
    
    def test_numeric_values(self):
        """Numeric values are converted to strings."""
        resolver = VariableResolver({'count': 42, 'price': 19.99})
        result = resolver.resolve('Count: {{ count }}, Price: ${{ price }}')
        
        self.assertEqual(result, 'Count: 42, Price: $19.99')
    
    def test_boolean_values(self):
        """Boolean values are converted to strings."""
        resolver = VariableResolver({'active': True, 'verified': False})
        result = resolver.resolve('Active: {{ active }}, Verified: {{ verified }}')
        
        self.assertEqual(result, 'Active: True, Verified: False')


if __name__ == '__main__':
    unittest.main()
