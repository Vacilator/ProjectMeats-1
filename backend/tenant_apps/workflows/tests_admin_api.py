"""
Tests for Field Registry Service and Admin API endpoints.
"""
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.tenants.models import Tenant
from tenant_apps.workflows.models import TenantForm, TenantFormEntity, TenantFormField
from tenant_apps.workflows.services import FieldRegistry, get_entity_fields, get_available_entities


User = get_user_model()


class FieldRegistryTests(TestCase):
    """Tests for the Field Registry service."""
    
    def test_get_available_entities(self):
        """Test getting list of available entity types."""
        entities = get_available_entities()
        
        self.assertIsInstance(entities, list)
        self.assertGreater(len(entities), 0)
        
        # Check structure
        for entity in entities:
            self.assertIn('key', entity)
            self.assertIn('label', entity)
            self.assertIn('app', entity)
            self.assertIn('model', entity)
    
    def test_get_entity_fields_supplier(self):
        """Test getting fields for supplier entity."""
        fields = get_entity_fields('supplier')
        
        self.assertIsInstance(fields, list)
        self.assertGreater(len(fields), 0)
        
        # Check field structure
        for field in fields:
            self.assertIn('key', field)
            self.assertIn('label', field)
            self.assertIn('type', field)
            self.assertIn('required', field)
        
        # Should have common supplier fields
        field_keys = [f['key'] for f in fields]
        self.assertIn('name', field_keys)
        self.assertIn('email', field_keys)
    
    def test_get_entity_fields_unknown_entity(self):
        """Test getting fields for unknown entity returns empty list."""
        fields = get_entity_fields('unknown_entity_type')
        self.assertEqual(fields, [])
    
    def test_find_matching_fields(self):
        """Test smart field matching algorithm."""
        source_field = {'key': 'email', 'type': 'email'}
        matches = FieldRegistry.find_matching_fields(source_field, 'contact')
        
        self.assertIsInstance(matches, list)
        
        if matches:
            # First match should be the exact match
            first_match = matches[0]
            self.assertIn('field', first_match)
            self.assertIn('score', first_match)
            self.assertIn('reasons', first_match)
            
            # Exact name match should have high score
            if first_match['field']['key'] == 'email':
                self.assertGreaterEqual(first_match['score'], 100)


class AdminAPITests(APITestCase):
    """Tests for the Admin Form Builder API endpoints."""
    
    @classmethod
    def setUpTestData(cls):
        # Create admin user
        cls.admin_user = User.objects.create_superuser(
            username='testadmin',
            email='admin@test.com',
            password='testpass123'
        )
        
        # Create tenant
        cls.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant'
        )
        
        # Create test form
        cls.form = TenantForm.objects.create(
            tenant=cls.tenant,
            name='Test Form',
            description='A test form',
            status='draft'
        )
        
        # Create test entity/step
        cls.step = TenantFormEntity.objects.create(
            form=cls.form,
            entity_type='supplier',
            step_name='Supplier Info',
            order=0
        )
    
    def setUp(self):
        self.client.force_authenticate(user=self.admin_user)
    
    def test_get_available_entities_api(self):
        """Test the available entities API endpoint."""
        response = self.client.get('/api/v1/workflows/admin/entities/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('entities', response.data)
        self.assertIn('count', response.data)
        self.assertGreater(response.data['count'], 0)
    
    def test_get_entity_fields_api(self):
        """Test the entity fields API endpoint."""
        response = self.client.get('/api/v1/workflows/admin/entities/supplier/fields/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('entity_type', response.data)
        self.assertIn('fields', response.data)
        self.assertEqual(response.data['entity_type'], 'supplier')
        self.assertGreater(len(response.data['fields']), 0)
    
    def test_get_entity_fields_api_unknown_entity(self):
        """Test the entity fields API with unknown entity type."""
        response = self.client.get('/api/v1/workflows/admin/entities/unknown_type/fields/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_get_step_fields_api(self):
        """Test getting fields for a form step."""
        response = self.client.get(f'/api/v1/workflows/admin/steps/{self.step.id}/fields/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('step_id', response.data)
        self.assertIn('step_name', response.data)
        self.assertIn('entity_type', response.data)
        self.assertIn('selected_fields', response.data)
        self.assertIn('available_fields', response.data)
    
    def test_save_step_fields_api(self):
        """Test saving field selection for a form step."""
        fields_data = {
            'fields': [
                {'key': 'name', 'visible': True, 'required': True},
                {'key': 'email', 'visible': True, 'required': False},
            ]
        }
        
        response = self.client.post(
            f'/api/v1/workflows/admin/steps/{self.step.id}/fields/',
            fields_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify fields were created
        self.assertEqual(self.step.fields.count(), 2)
        
        # Verify field data
        name_field = self.step.fields.get(field_key='name')
        self.assertTrue(name_field.is_required)
        
        email_field = self.step.fields.get(field_key='email')
        self.assertFalse(email_field.is_required)
    
    def test_reorder_steps_api(self):
        """Test reordering form steps."""
        # Create second step
        step2 = TenantFormEntity.objects.create(
            form=self.form,
            entity_type='contact',
            step_name='Contact Info',
            order=1
        )
        
        # Reorder: step2 first, then step1
        response = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/reorder/',
            {'step_order': [str(step2.id), str(self.step.id)]},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify order changed
        step2.refresh_from_db()
        self.step.refresh_from_db()
        
        self.assertEqual(step2.order, 0)
        self.assertEqual(self.step.order, 1)
    
    def test_smart_match_api(self):
        """Test the smart field matching API."""
        response = self.client.post(
            '/api/v1/workflows/admin/smart-match/',
            {
                'source_field': {'key': 'email', 'type': 'email'},
                'target_entity_type': 'contact'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('source_field', response.data)
        self.assertIn('target_entity_type', response.data)
        self.assertIn('matches', response.data)
    
    def test_unauthenticated_access(self):
        """Test that unauthenticated users cannot access admin APIs."""
        self.client.logout()
        
        response = self.client.get('/api/v1/workflows/admin/entities/')
        # Should be 401 or 403
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
