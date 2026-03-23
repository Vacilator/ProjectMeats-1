"""
Unit Tests for Type Checking Service
"""
from django.test import TestCase
from datetime import datetime, date
from decimal import Decimal

from tenant_apps.workflows.services.type_checker import (
    TypeChecker,
    ValidationError,
    validate_workflow_data
)


class TypeCheckerTestCase(TestCase):
    """Test cases for TypeChecker service"""
    
    def setUp(self):
        """Set up test field definitions"""
        self.field_definitions = [
            {'name': 'customer_name', 'type': 'string', 'required': True},
            {'name': 'age', 'type': 'integer', 'required': False, 'min': 0, 'max': 150},
            {'name': 'email', 'type': 'email', 'required': True},
            {'name': 'phone', 'type': 'phone', 'required': False},
            {'name': 'website', 'type': 'url', 'required': False},
            {'name': 'order_date', 'type': 'date', 'required': False},
            {'name': 'price', 'type': 'decimal', 'required': False, 'min': 0},
            {'name': 'status', 'type': 'choice', 'required': True, 'choices': ['pending', 'approved', 'rejected']},
            {'name': 'is_active', 'type': 'boolean', 'required': False},
        ]
        self.checker = TypeChecker(self.field_definitions)
    
    def test_validate_string_field(self):
        """Test string field validation"""
        result = self.checker.validate_field('customer_name', 'John Doe')
        self.assertEqual(result, 'John Doe')
        
        # Test type coercion
        result = self.checker.validate_field('customer_name', 123)
        self.assertEqual(result, '123')
    
    def test_validate_integer_field(self):
        """Test integer field validation"""
        result = self.checker.validate_field('age', 30)
        self.assertEqual(result, 30)
        
        # Test string to int coercion
        result = self.checker.validate_field('age', '25')
        self.assertEqual(result, 25)
    
    def test_validate_integer_range(self):
        """Test integer range validation"""
        # Valid range
        result = self.checker.validate_field('age', 50)
        self.assertEqual(result, 50)
        
        # Below minimum
        with self.assertRaises(ValidationError) as cm:
            self.checker.validate_field('age', -1)
        self.assertIn('less than minimum', str(cm.exception))
        
        # Above maximum
        with self.assertRaises(ValidationError) as cm:
            self.checker.validate_field('age', 200)
        self.assertIn('greater than maximum', str(cm.exception))
    
    def test_validate_email_field(self):
        """Test email field validation"""
        # Valid emails
        result = self.checker.validate_field('email', 'test@example.com')
        self.assertEqual(result, 'test@example.com')
        
        result = self.checker.validate_field('email', 'USER@EXAMPLE.COM')
        self.assertEqual(result, 'user@example.com')  # Normalized to lowercase
        
        # Invalid emails
        invalid_emails = ['invalid', 'test@', '@example.com', 'test @example.com']
        for invalid in invalid_emails:
            with self.assertRaises(ValidationError):
                self.checker.validate_field('email', invalid)
    
    def test_validate_phone_field(self):
        """Test phone number validation"""
        # Valid phone numbers
        result = self.checker.validate_field('phone', '+1234567890')
        self.assertEqual(result, '+1234567890')
        
        # With formatting characters
        result = self.checker.validate_field('phone', '(123) 456-7890')
        self.assertEqual(result, '1234567890')
        
        # Invalid phone numbers
        with self.assertRaises(ValidationError):
            self.checker.validate_field('phone', '123')  # Too short
    
    def test_validate_url_field(self):
        """Test URL validation"""
        # Valid URLs
        valid_urls = [
            'https://example.com',
            'http://example.com/path',
            'https://sub.example.com:8080/path?query=value',
        ]
        for url in valid_urls:
            result = self.checker.validate_field('website', url)
            self.assertEqual(result, url)
        
        # Invalid URLs
        invalid_urls = ['not a url', 'ftp://example.com', 'example.com']
        for invalid in invalid_urls:
            with self.assertRaises(ValidationError):
                self.checker.validate_field('website', invalid)
    
    def test_validate_date_field(self):
        """Test date field validation"""
        # Date object
        test_date = date(2024, 1, 15)
        result = self.checker.validate_field('order_date', test_date)
        self.assertEqual(result, test_date)
        
        # ISO string
        result = self.checker.validate_field('order_date', '2024-01-15')
        self.assertEqual(result, date(2024, 1, 15))
        
        # Common formats
        result = self.checker.validate_field('order_date', '15/01/2024')
        self.assertEqual(result, date(2024, 1, 15))
    
    def test_validate_decimal_field(self):
        """Test decimal field validation"""
        # Decimal object
        result = self.checker.validate_field('price', Decimal('19.99'))
        self.assertEqual(result, Decimal('19.99'))
        
        # Float coercion
        result = self.checker.validate_field('price', 19.99)
        self.assertEqual(result, Decimal('19.99'))
        
        # String coercion
        result = self.checker.validate_field('price', '19.99')
        self.assertEqual(result, Decimal('19.99'))
        
        # Negative price should fail
        with self.assertRaises(ValidationError):
            self.checker.validate_field('price', -10)
    
    def test_validate_choice_field(self):
        """Test choice field validation"""
        # Valid choice
        result = self.checker.validate_field('status', 'pending')
        self.assertEqual(result, 'pending')
        
        # Invalid choice
        with self.assertRaises(ValidationError) as cm:
            self.checker.validate_field('status', 'invalid')
        self.assertIn('not a valid choice', str(cm.exception))
    
    def test_validate_boolean_field(self):
        """Test boolean field validation"""
        result = self.checker.validate_field('is_active', True)
        self.assertTrue(result)
        
        result = self.checker.validate_field('is_active', False)
        self.assertFalse(result)
        
        # String coercion
        result = self.checker.validate_field('is_active', 'True')
        self.assertTrue(result)
    
    def test_required_field_validation(self):
        """Test required field validation"""
        # Missing required field
        with self.assertRaises(ValidationError) as cm:
            self.checker.validate_field('customer_name', None)
        self.assertIn('required', str(cm.exception))
        
        with self.assertRaises(ValidationError):
            self.checker.validate_field('customer_name', '')
        
        # Optional field can be None
        result = self.checker.validate_field('age', None)
        self.assertIsNone(result)
    
    def test_validate_data_success(self):
        """Test validating entire data dictionary - success case"""
        data = {
            'customer_name': 'John Doe',
            'age': 30,
            'email': 'john@example.com',
            'phone': '+1234567890',
            'status': 'pending',
            'price': '19.99',
            'is_active': True,
        }
        
        result = self.checker.validate_data(data)
        
        self.assertEqual(result['customer_name'], 'John Doe')
        self.assertEqual(result['age'], 30)
        self.assertEqual(result['email'], 'john@example.com')
        self.assertEqual(result['status'], 'pending')
        self.assertEqual(result['price'], Decimal('19.99'))
        self.assertTrue(result['is_active'])
    
    def test_validate_data_missing_required(self):
        """Test validating data with missing required fields"""
        data = {
            'age': 30,
            # Missing customer_name, email, status
        }
        
        with self.assertRaises(ValidationError) as cm:
            self.checker.validate_data(data)
        
        error_msg = str(cm.exception)
        self.assertIn('customer_name', error_msg)
        self.assertIn('email', error_msg)
        self.assertIn('status', error_msg)
    
    def test_validate_data_type_errors(self):
        """Test validating data with type errors"""
        data = {
            'customer_name': 'John Doe',
            'email': 'invalid_email',  # Invalid email
            'age': 200,  # Above maximum
            'status': 'pending',
        }
        
        with self.assertRaises(ValidationError) as cm:
            self.checker.validate_data(data)
        
        error_msg = str(cm.exception)
        self.assertIn('email', error_msg)
        self.assertIn('age', error_msg)
    
    def test_validate_unknown_field(self):
        """Test validation of field not in schema"""
        with self.assertRaises(ValidationError) as cm:
            self.checker.validate_field('unknown_field', 'value')
        self.assertIn('not found in schema', str(cm.exception))
    
    def test_convenience_function(self):
        """Test convenience function"""
        data = {
            'customer_name': 'Jane Doe',
            'email': 'jane@example.com',
            'status': 'approved',
        }
        
        result = validate_workflow_data(self.field_definitions, data)
        self.assertEqual(result['customer_name'], 'Jane Doe')
        self.assertEqual(result['status'], 'approved')
    
    def test_datetime_parsing(self):
        """Test datetime parsing from various formats"""
        checker = TypeChecker([
            {'name': 'created_at', 'type': 'datetime', 'required': False}
        ])
        
        # ISO format
        result = checker.validate_field('created_at', '2024-01-15T10:30:00')
        self.assertIsInstance(result, datetime)
        
        # Common format
        result = checker.validate_field('created_at', '2024-01-15 10:30:00')
        self.assertIsInstance(result, datetime)
        
        # Datetime object
        now = datetime.now()
        result = checker.validate_field('created_at', now)
        self.assertEqual(result, now)
    
    def test_number_type_multiple_acceptable(self):
        """Test number type accepts int, float, or Decimal"""
        checker = TypeChecker([
            {'name': 'amount', 'type': 'number', 'required': False}
        ])
        
        # Integer
        result = checker.validate_field('amount', 100)
        self.assertEqual(result, 100)
        
        # Float
        result = checker.validate_field('amount', 99.99)
        self.assertEqual(result, 99.99)
        
        # Decimal
        result = checker.validate_field('amount', Decimal('99.99'))
        self.assertEqual(result, Decimal('99.99'))
        
        # String coercion to int
        result = checker.validate_field('amount', '100')
        self.assertEqual(result, 100)


class ValidationErrorTestCase(TestCase):
    """Test cases for ValidationError exception"""
    
    def test_validation_error_default_message(self):
        """Test default error message format"""
        error = ValidationError('age', 'integer', 'not_a_number')
        error_msg = str(error)
        
        self.assertIn('age', error_msg)
        self.assertIn('integer', error_msg)
        self.assertIn('not_a_number', error_msg)
    
    def test_validation_error_custom_message(self):
        """Test custom error message"""
        custom_msg = "Custom validation error"
        error = ValidationError('field', 'type', 'value', message=custom_msg)
        
        self.assertEqual(str(error), custom_msg)
    
    def test_validation_error_attributes(self):
        """Test error attributes are accessible"""
        error = ValidationError('test_field', 'string', 123, "Test error")
        
        self.assertEqual(error.field_name, 'test_field')
        self.assertEqual(error.expected_type, 'string')
        self.assertEqual(error.actual_value, 123)
        self.assertEqual(error.custom_message, "Test error")
