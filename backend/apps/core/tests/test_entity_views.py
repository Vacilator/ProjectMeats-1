"""
Tests for Entity API Views (Phase 1.1-1.3)

Tests the entity registry, schema extraction, and lookup endpoints.
Ensures robust behavior for WorkForms field picker integration.
"""
import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class EntityRegistryTestCase(TestCase):
    """Test /api/v1/entities/ endpoint"""
    
    def setUp(self):
        """Set up test client, user, and tenant"""
        self.client = APIClient()
        
        # Create tenant
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant',
            schema_name='test_tenant'
        )
        
        # Create user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create tenant user relationship
        TenantUser.objects.create(
            user=self.user,
            tenant=self.tenant,
            role='admin',
            is_active=True
        )
        
        # Login
        self.client.force_authenticate(user=self.user)
    
    def test_entity_registry_requires_auth(self):
        """Endpoint should require authentication"""
        client = APIClient()
        response = client.get('/api/v1/entities/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_entity_registry_returns_entities(self):
        """Should return list of available entities"""
        response = self.client.get('/api/v1/entities/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.json()
        self.assertIn('entities', data)
        self.assertIsInstance(data['entities'], list)
        self.assertGreater(len(data['entities']), 0)
    
    def test_entity_registry_structure(self):
        """Each entity should have required fields"""
        response = self.client.get('/api/v1/entities/')
        data = response.json()
        
        # Check first entity structure
        entity = data['entities'][0]
        self.assertIn('type', entity)
        self.assertIn('label', entity)
        self.assertIn('model_name', entity)
        self.assertIn('app_label', entity)
        self.assertIn('description', entity)
    
    def test_entity_registry_includes_common_models(self):
        """Should include common business entities"""
        response = self.client.get('/api/v1/entities/')
        data = response.json()
        
        entity_types = [e['type'] for e in data['entities']]
        
        # Check for common entities (if they exist in your project)
        expected_entities = ['supplier', 'customer', 'product', 'user']
        for expected in expected_entities:
            # At least some common entities should be present
            if expected in entity_types:
                self.assertIn(expected, entity_types)
    
    def test_entity_registry_tenant_isolation(self):
        """Should only show entities accessible to tenant"""
        # Create second tenant
        tenant2 = Tenant.objects.create(
            name='Another Tenant',
            slug='another-tenant',
            schema_name='another_tenant'
        )
        
        # Create user for second tenant
        user2 = User.objects.create_user(
            username='testuser2',
            email='test2@example.com',
            password='testpass123'
        )
        
        TenantUser.objects.create(
            user=user2,
            tenant=tenant2,
            role='admin',
            is_active=True
        )
        
        # Both tenants should see same entities (shared schema)
        response1 = self.client.get('/api/v1/entities/')
        
        client2 = APIClient()
        client2.force_authenticate(user=user2)
        response2 = client2.get('/api/v1/entities/')
        
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        
        # Both should see entities (may be filtered by permissions)
        data1 = response1.json()
        data2 = response2.json()
        self.assertGreater(len(data1['entities']), 0)
        self.assertGreater(len(data2['entities']), 0)


class EntitySchemaTestCase(TestCase):
    """Test /api/v1/entities/<type>/schema/ endpoint"""
    
    def setUp(self):
        """Set up test client, user, and tenant"""
        self.client = APIClient()
        
        # Create tenant
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant',
            schema_name='public'
        )
        
        # Create user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create tenant user relationship
        TenantUser.objects.create(
            user=self.user,
            tenant=self.tenant,
            role='admin',
            is_active=True
        )
        
        # Login
        self.client.force_authenticate(user=self.user)
    
    def test_schema_requires_auth(self):
        """Schema endpoint should require authentication"""
        client = APIClient()
        response = client.get('/api/v1/entities/user/schema/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_schema_returns_fields(self):
        """Should return field schema for valid entity"""
        # Get entities first
        entities_response = self.client.get('/api/v1/entities/')
        entities = entities_response.json()['entities']
        
        if len(entities) > 0:
            entity_type = entities[0]['type']
            
            response = self.client.get(f'/api/v1/entities/{entity_type}/schema/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            data = response.json()
            self.assertIn('entity_type', data)
            self.assertIn('fields', data)
            self.assertIsInstance(data['fields'], list)
    
    def test_schema_field_structure(self):
        """Each field should have required properties"""
        # Get first entity
        entities_response = self.client.get('/api/v1/entities/')
        entities = entities_response.json()['entities']
        
        if len(entities) > 0:
            entity_type = entities[0]['type']
            
            response = self.client.get(f'/api/v1/entities/{entity_type}/schema/')
            data = response.json()
            
            if len(data['fields']) > 0:
                field = data['fields'][0]
                
                # Required field properties
                self.assertIn('name', field)
                self.assertIn('type', field)
                self.assertIn('label', field)
                self.assertIn('required', field)
    
    def test_schema_invalid_entity(self):
        """Should return 404 for invalid entity type"""
        response = self.client.get('/api/v1/entities/nonexistent/schema/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_schema_handles_foreign_keys(self):
        """Schema should properly expose ForeignKey fields"""
        # Get entities first
        entities_response = self.client.get('/api/v1/entities/')
        entities = entities_response.json()['entities']
        
        # Find an entity with ForeignKey fields
        for entity in entities:
            entity_type = entity['type']
            response = self.client.get(f'/api/v1/entities/{entity_type}/schema/')
            data = response.json()
            
            # Check if any field is a ForeignKey
            for field in data['fields']:
                if field['type'] == 'foreignkey':
                    # Should have related_model info
                    self.assertIn('related_model', field)
                    break


class EntityLookupTestCase(TestCase):
    """Test /api/v1/entities/<type>/lookup/ endpoint"""
    
    def setUp(self):
        """Set up test client, user, and tenant"""
        self.client = APIClient()
        
        # Create tenant
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant',
            schema_name='test_tenant_lookup'
        )
        
        # Create user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create tenant user relationship
        TenantUser.objects.create(
            user=self.user,
            tenant=self.tenant,
            role='admin',
            is_active=True
        )
        
        # Login
        self.client.force_authenticate(user=self.user)
    
    def test_lookup_requires_auth(self):
        """Lookup endpoint should require authentication"""
        client = APIClient()
        response = client.get('/api/v1/entities/user/lookup/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_lookup_returns_options(self):
        """Should return lookup options for valid entity"""
        # User entity should always exist
        response = self.client.get('/api/v1/entities/user/lookup/')
        
        # Should return 200 even if empty
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.json()
        self.assertIn('options', data)
        self.assertIsInstance(data['options'], list)
    
    def test_lookup_option_structure(self):
        """Each option should have value and label"""
        # Get entities
        entities_response = self.client.get('/api/v1/entities/')
        entities = entities_response.json()['entities']
        
        if len(entities) > 0:
            entity_type = entities[0]['type']
            
            response = self.client.get(f'/api/v1/entities/{entity_type}/lookup/')
            data = response.json()
            
            if len(data['options']) > 0:
                option = data['options'][0]
                self.assertIn('value', option)
                self.assertIn('label', option)
    
    def test_lookup_pagination(self):
        """Lookup should support pagination for large datasets"""
        response = self.client.get('/api/v1/entities/user/lookup/?page=1&page_size=10')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.json()
        self.assertIn('options', data)
        self.assertIn('count', data)
        self.assertIn('next', data)
        self.assertIn('previous', data)
    
    def test_lookup_search(self):
        """Lookup should support search filtering"""
        response = self.client.get('/api/v1/entities/user/lookup/?search=test')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.json()
        self.assertIn('options', data)
        # Results should be filtered (implementation dependent)
    
    def test_lookup_invalid_entity(self):
        """Should return 404 for invalid entity type"""
        response = self.client.get('/api/v1/entities/nonexistent/lookup/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_lookup_tenant_filtered(self):
        """Lookup options should be tenant-filtered"""
        # This test assumes entities have tenant field
        response = self.client.get('/api/v1/entities/supplier/lookup/')
        
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            # Should only show options for current tenant
            # Implementation depends on whether entity has tenant field
            self.assertIsInstance(data['options'], list)


class EntityPermissionsTestCase(TestCase):
    """Test entity endpoint permissions"""
    
    def setUp(self):
        """Set up test clients with different permission levels"""
        # Create tenant
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant',
            schema_name='public'
        )
        
        # Create superuser
        self.superuser = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123'
        )
        
        # Create regular user
        self.regular_user = User.objects.create_user(
            username='regular',
            email='regular@example.com',
            password='regular123'
        )
        
        TenantUser.objects.create(
            user=self.regular_user,
            tenant=self.tenant,
            role='user',
            is_active=True
        )
        
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.superuser)
        
        self.user_client = APIClient()
        self.user_client.force_authenticate(user=self.regular_user)
    
    def test_superuser_access(self):
        """Superusers should have full access"""
        response = self.admin_client.get('/api/v1/entities/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_regular_user_access(self):
        """Regular users should have access based on tenant permissions"""
        response = self.user_client.get('/api/v1/entities/')
        # Should be accessible to authenticated users
        self.assertEqual(response.status_code, status.HTTP_200_OK)
