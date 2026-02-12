"""
Tests for container versioning service.

Phase 1: Recursive Persistence
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.tenants.models import Tenant
from apps.system.models import TenantForm, FormTypeChoices
from apps.system.services.container_versioning import (
    hash_definition,
    serialize_step,
    extract_container_definitions,
    snapshot_container,
)

User = get_user_model()


class ContainerVersioningTests(TestCase):
    """Test container versioning functionality."""
    
    def setUp(self):
        """Set up test data."""
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant"
        )
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
    
    def test_hash_definition_stability(self):
        """Test that hash_definition produces stable hashes."""
        definition1 = {
            'steps': [{'name': 'Step 1'}],
            'container_id': 'node-1'
        }
        definition2 = {
            'container_id': 'node-1',
            'steps': [{'name': 'Step 1'}]
        }
        
        hash1 = hash_definition(definition1)
        hash2 = hash_definition(definition2)
        
        # Should be identical despite different key order
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)  # SHA256 = 64 hex chars
    
    def test_snapshot_container_creates_new(self):
        """Test that snapshot_container creates a new TenantForm."""
        container_node = {
            'id': 'container-1',
            'type': 'formMultiStepContainer',
            'data': {
                'label': 'Customer Onboarding',
                'description': 'Onboard new customers'
            }
        }
        
        child_steps = [
            {
                'id': 'step-1',
                'type': 'formStep',
                'data': {
                    'stepTitle': 'Basic Info',
                    'entityType': 'customer',
                    'fields': [{'name': 'name', 'type': 'text'}]
                }
            }
        ]
        
        form = snapshot_container(
            container_node=container_node,
            child_steps=child_steps,
            tenant=self.tenant,
            user=self.user
        )
        
        self.assertIsNotNone(form.id)
        self.assertEqual(form.tenant, self.tenant)
        self.assertEqual(form.type, FormTypeChoices.MULTI_STEP)
        self.assertEqual(form.version, 1)
        self.assertEqual(form.usage_count, 1)
        self.assertEqual(form.source_node_id, 'container-1')
        self.assertTrue(form.is_template)
        self.assertIsNotNone(form.definition_hash)
    
    def test_snapshot_container_reuses_existing(self):
        """Test that identical containers reuse existing TenantForm."""
        container_node = {
            'id': 'container-1',
            'type': 'formMultiStepContainer',
            'data': {'label': 'Customer Form'}
        }
        
        child_steps = [
            {
                'id': 'step-1',
                'type': 'formStep',
                'data': {
                    'stepTitle': 'Info',
                    'fields': [{'name': 'name'}]
                }
            }
        ]
        
        # Create first snapshot
        form1 = snapshot_container(
            container_node, child_steps, self.tenant, self.user
        )
        
        # Create second identical snapshot
        form2 = snapshot_container(
            container_node, child_steps, self.tenant, self.user
        )
        
        # Should reuse the same form
        self.assertEqual(form1.id, form2.id)
        self.assertEqual(form2.usage_count, 2)  # Incremented
        
        # Should only have 1 TenantForm record
        count = TenantForm.objects.filter(tenant=self.tenant).count()
        self.assertEqual(count, 1)
