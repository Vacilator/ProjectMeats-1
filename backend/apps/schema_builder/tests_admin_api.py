"""
Tests for Schema Builder Admin API.

Tests for the schema editor admin interface API endpoints.
"""
import json
import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import DataSchema, DataSchemaField, FieldType


class SchemaFieldsAPITest(TestCase):
    """Test SchemaFieldsAPIView endpoints."""
    
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema',
            created_by=self.admin
        )
        # Create a test field
        self.field1 = DataSchemaField.objects.create(
            schema=self.schema,
            key='name',
            label='Name',
            field_type=FieldType.TEXT,
            is_required=True,
            order=0
        )
        self.field2 = DataSchemaField.objects.create(
            schema=self.schema,
            key='email',
            label='Email',
            field_type=FieldType.EMAIL,
            is_required=False,
            order=1
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
    
    def test_list_schema_fields(self):
        """Test listing fields for a schema."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['schema_name'], 'Test Schema')
        
        fields = response.data['fields']
        self.assertEqual(len(fields), 2)
        self.assertEqual(fields[0]['key'], 'name')
        self.assertEqual(fields[1]['key'], 'email')
    
    def test_list_schema_fields_not_found(self):
        """Test listing fields for non-existent schema returns 404."""
        fake_id = uuid.uuid4()
        url = f'/api/v1/schema-builder/admin/schemas/{fake_id}/fields/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 404)
    
    def test_create_field(self):
        """Test creating a new field."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        data = {
            'label': 'Phone Number',
            'field_type': FieldType.PHONE,
            'is_required': False,
            'help_text': 'Enter phone with country code'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'success')
        
        field = response.data['field']
        self.assertEqual(field['key'], 'phone_number')
        self.assertEqual(field['label'], 'Phone Number')
        self.assertEqual(field['field_type'], FieldType.PHONE)
        self.assertEqual(field['order'], 2)  # Auto-ordered after existing fields
    
    def test_create_field_auto_key(self):
        """Test that key is auto-generated from label."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        data = {'label': 'My Custom Field'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['field']['key'], 'my_custom_field')
    
    def test_create_field_duplicate_key(self):
        """Test creating field with duplicate key fails."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        data = {'label': 'Name'}  # Would generate 'name' key which exists
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('already exists', response.data['error'])
    
    def test_create_field_missing_label(self):
        """Test creating field without label fails."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        data = {'field_type': FieldType.TEXT}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('required', response.data['error'])


class SchemaFieldDetailAPITest(TestCase):
    """Test SchemaFieldDetailAPIView endpoints."""
    
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema',
            created_by=self.admin
        )
        self.field = DataSchemaField.objects.create(
            schema=self.schema,
            key='test_field',
            label='Test Field',
            field_type=FieldType.TEXT,
            is_required=True,
            help_text='Original help text',
            order=0
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
    
    def test_get_field(self):
        """Test getting a single field."""
        url = f'/api/v1/schema-builder/admin/fields/{self.field.id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['key'], 'test_field')
        self.assertEqual(response.data['label'], 'Test Field')
    
    def test_get_field_not_found(self):
        """Test getting non-existent field returns 404."""
        fake_id = uuid.uuid4()
        url = f'/api/v1/schema-builder/admin/fields/{fake_id}/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 404)
    
    def test_update_field(self):
        """Test updating a field."""
        url = f'/api/v1/schema-builder/admin/fields/{self.field.id}/'
        data = {
            'label': 'Updated Label',
            'help_text': 'Updated help text',
            'is_required': False
        }
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
        field = response.data['field']
        self.assertEqual(field['label'], 'Updated Label')
        self.assertEqual(field['help_text'], 'Updated help text')
        self.assertFalse(field['is_required'])
        # Key should not change
        self.assertEqual(field['key'], 'test_field')
    
    def test_delete_field(self):
        """Test deleting a field."""
        url = f'/api/v1/schema-builder/admin/fields/{self.field.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify field is deleted
        self.assertFalse(DataSchemaField.objects.filter(id=self.field.id).exists())
    
    def test_delete_field_not_found(self):
        """Test deleting non-existent field returns 404."""
        fake_id = uuid.uuid4()
        url = f'/api/v1/schema-builder/admin/fields/{fake_id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, 404)


class SchemaReorderAPITest(TestCase):
    """Test SchemaReorderAPIView endpoint."""
    
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema',
            created_by=self.admin
        )
        # Create fields in order
        self.field1 = DataSchemaField.objects.create(
            schema=self.schema,
            key='field_a',
            label='Field A',
            field_type=FieldType.TEXT,
            order=0
        )
        self.field2 = DataSchemaField.objects.create(
            schema=self.schema,
            key='field_b',
            label='Field B',
            field_type=FieldType.TEXT,
            order=1
        )
        self.field3 = DataSchemaField.objects.create(
            schema=self.schema,
            key='field_c',
            label='Field C',
            field_type=FieldType.TEXT,
            order=2
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
    
    def test_reorder_fields(self):
        """Test reordering fields."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/reorder/'
        # Reverse the order
        data = {
            'field_order': [
                {'id': str(self.field3.id), 'order': 0},
                {'id': str(self.field2.id), 'order': 1},
                {'id': str(self.field1.id), 'order': 2},
            ]
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
        # Refresh from DB and verify order
        self.field1.refresh_from_db()
        self.field2.refresh_from_db()
        self.field3.refresh_from_db()
        
        self.assertEqual(self.field1.order, 2)
        self.assertEqual(self.field2.order, 1)
        self.assertEqual(self.field3.order, 0)
    
    def test_reorder_fields_not_found(self):
        """Test reordering fields for non-existent schema returns 404."""
        fake_id = uuid.uuid4()
        url = f'/api/v1/schema-builder/admin/schemas/{fake_id}/reorder/'
        data = {'field_order': []}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 404)
    
    def test_reorder_fields_empty_order(self):
        """Test reordering with empty order fails."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/reorder/'
        data = {'field_order': []}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 400)


class SchemaFieldsAPIAuthTest(TestCase):
    """Test authentication requirements for schema admin API."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='normaluser',
            email='user@example.com',
            password='userpass123'
        )
        self.admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.schema = DataSchema.objects.create(
            name='Test Schema',
            slug='test-schema',
            created_by=self.admin
        )
        
        self.client = APIClient()
    
    def test_unauthenticated_user_cannot_access(self):
        """Test unauthenticated users cannot access admin API."""
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        response = self.client.get(url)
        
        # Should return 401 or 403
        self.assertIn(response.status_code, [401, 403])
    
    def test_non_admin_user_cannot_access(self):
        """Test non-admin users cannot access admin API."""
        self.client.force_authenticate(user=self.user)
        
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 403)
    
    def test_admin_user_can_access(self):
        """Test admin users can access admin API."""
        self.client.force_authenticate(user=self.admin)
        
        url = f'/api/v1/schema-builder/admin/schemas/{self.schema.id}/fields/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
