"""
Tests for Schema Builder (Bundle One).

Tests for Data Schemas, Fields, and Versioning functionality.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User

from .models import DataSchema, DataSchemaField, DataSchemaVersion, FieldOptionList, SchemaStatus, FieldType


class DataSchemaModelTest(TestCase):
    """Test DataSchema model functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.superuser = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
    
    def test_create_schema(self):
        """Test creating a basic schema."""
        schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema',
            description='A test schema',
            created_by=self.user
        )
        
        self.assertEqual(schema.name, 'Test Schema')
        self.assertEqual(schema.status, SchemaStatus.DRAFT)
        self.assertEqual(schema.version, 1)
        self.assertTrue(schema.is_active)
    
    def test_auto_slug_generation(self):
        """Test that slug is auto-generated from name."""
        schema = DataSchema.objects.create(
            name='My Custom Schema',
            created_by=self.user
        )
        
        self.assertEqual(schema.slug, 'my-custom-schema')
    
    def test_submit_schema(self):
        """Test submitting a draft schema."""
        schema = DataSchema.objects.create(
            name='Draft Schema',
            slug='draft-schema',
            created_by=self.user
        )
        
        schema.submit(self.user)
        
        self.assertEqual(schema.status, SchemaStatus.SUBMITTED)
        self.assertEqual(schema.submitted_by, self.user)
        self.assertIsNotNone(schema.submitted_at)
    
    def test_cannot_submit_non_draft(self):
        """Test that only draft schemas can be submitted."""
        schema = DataSchema.objects.create(
            name='Submitted Schema',
            slug='submitted-schema',
            status=SchemaStatus.SUBMITTED,
            created_by=self.user
        )
        
        with self.assertRaises(ValueError):
            schema.submit(self.user)
    
    def test_publish_schema_superuser(self):
        """Test that superuser can publish submitted schema."""
        schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema-publish',
            status=SchemaStatus.SUBMITTED,
            created_by=self.user
        )
        
        schema.publish(self.superuser)
        
        self.assertEqual(schema.status, SchemaStatus.PUBLISHED)
        self.assertEqual(schema.published_by, self.superuser)
        self.assertEqual(schema.version, 2)
    
    def test_non_superuser_cannot_publish(self):
        """Test that non-superuser cannot publish."""
        schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema-no-publish',
            status=SchemaStatus.SUBMITTED,
            created_by=self.user
        )
        
        with self.assertRaises(PermissionError):
            schema.publish(self.user)
    
    def test_version_snapshot_created(self):
        """Test that version snapshots are created on status changes."""
        schema = DataSchema.objects.create(
            name='Versioned Schema',
            slug='versioned-schema',
            created_by=self.user
        )
        
        # Add a field
        DataSchemaField.objects.create(
            schema=schema,
            key='test_field',
            label='Test Field',
            field_type=FieldType.TEXT
        )
        
        # Submit creates version
        schema.submit(self.user)
        
        versions = DataSchemaVersion.objects.filter(schema=schema)
        self.assertEqual(versions.count(), 1)
        self.assertEqual(versions.first().action, 'submitted')


class DataSchemaFieldModelTest(TestCase):
    """Test DataSchemaField model functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema',
            created_by=self.user
        )
    
    def test_create_field(self):
        """Test creating a schema field."""
        field = DataSchemaField.objects.create(
            schema=self.schema,
            key='customer_name',
            label='Customer Name',
            field_type=FieldType.TEXT,
            is_required=True
        )
        
        self.assertEqual(field.label, 'Customer Name')
        self.assertEqual(field.field_type, FieldType.TEXT)
        self.assertTrue(field.is_required)
        self.assertTrue(field.is_visible)
    
    def test_auto_key_generation(self):
        """Test that key is auto-generated from label."""
        field = DataSchemaField.objects.create(
            schema=self.schema,
            label='My Custom Field',
            field_type=FieldType.TEXT
        )
        
        self.assertEqual(field.key, 'my_custom_field')
    
    def test_dropdown_field_with_options(self):
        """Test creating a dropdown field with options."""
        field = DataSchemaField.objects.create(
            schema=self.schema,
            key='status',
            label='Status',
            field_type=FieldType.DROPDOWN,
            options=[
                {'value': 'active', 'label': 'Active'},
                {'value': 'inactive', 'label': 'Inactive'},
            ]
        )
        
        self.assertEqual(len(field.options), 2)
        self.assertEqual(field.options[0]['value'], 'active')
    
    def test_field_str_representation(self):
        """Test field string representation includes visibility."""
        visible_field = DataSchemaField.objects.create(
            schema=self.schema,
            label='Visible Field',
            field_type=FieldType.TEXT,
            is_visible=True
        )
        
        hidden_field = DataSchemaField.objects.create(
            schema=self.schema,
            label='Hidden Field',
            field_type=FieldType.TEXT,
            is_visible=False
        )
        
        self.assertIn('👁', str(visible_field))
        self.assertIn('🚫', str(hidden_field))


class FieldOptionListModelTest(TestCase):
    """Test FieldOptionList model functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_create_option_list(self):
        """Test creating a field option list."""
        option_list = FieldOptionList.objects.create(
            name='Countries',
            description='List of countries',
            options=[
                {'value': 'us', 'label': 'United States'},
                {'value': 'ca', 'label': 'Canada'},
                {'value': 'mx', 'label': 'Mexico'},
            ],
            created_by=self.user
        )
        
        self.assertEqual(option_list.name, 'Countries')
        self.assertEqual(len(option_list.options), 3)
        self.assertFalse(option_list.is_system)
    
    def test_option_list_str_representation(self):
        """Test option list string representation."""
        option_list = FieldOptionList.objects.create(
            name='Statuses',
            options=[
                {'value': 'a', 'label': 'A'},
                {'value': 'b', 'label': 'B'},
            ],
            created_by=self.user
        )
        
        self.assertIn('2 options', str(option_list))
