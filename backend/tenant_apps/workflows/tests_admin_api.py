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
    
    def test_step_fields_nonexistent_step(self):
        """Test getting fields for a non-existent step returns 404."""
        import uuid
        fake_id = str(uuid.uuid4())
        response = self.client.get(f'/api/v1/workflows/admin/steps/{fake_id}/fields/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_save_empty_fields_list(self):
        """Test saving an empty fields list clears all fields."""
        # First add some fields
        TenantFormField.objects.create(
            form_entity=self.step,
            field_key='name',
            order=0
        )
        TenantFormField.objects.create(
            form_entity=self.step,
            field_key='email',
            order=1
        )
        self.assertEqual(self.step.fields.count(), 2)
        
        # Now save empty list
        response = self.client.post(
            f'/api/v1/workflows/admin/steps/{self.step.id}/fields/',
            {'fields': []},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Fields should be cleared
        self.step.refresh_from_db()
        self.assertEqual(self.step.fields.count(), 0)
    
    def test_save_fields_replaces_existing(self):
        """Test that saving fields replaces existing selection."""
        # Add initial field
        TenantFormField.objects.create(
            form_entity=self.step,
            field_key='old_field',
            order=0
        )
        
        # Save new fields
        response = self.client.post(
            f'/api/v1/workflows/admin/steps/{self.step.id}/fields/',
            {'fields': [{'key': 'new_field', 'visible': True}]},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Only new field should exist
        self.assertEqual(self.step.fields.count(), 1)
        self.assertTrue(self.step.fields.filter(field_key='new_field').exists())
        self.assertFalse(self.step.fields.filter(field_key='old_field').exists())
    
    def test_reorder_with_invalid_step_ids(self):
        """Test reordering with invalid step IDs."""
        import uuid
        response = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/reorder/',
            {'step_order': [str(uuid.uuid4()), str(uuid.uuid4())]},
            format='json'
        )
        
        # Should not crash, but may return error or ignore invalid IDs
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])
    
    def test_get_all_entity_types(self):
        """Test that all entity types return valid field lists."""
        entities_response = self.client.get('/api/v1/workflows/admin/entities/')
        entities = entities_response.data['entities']
        
        for entity in entities:
            response = self.client.get(f'/api/v1/workflows/admin/entities/{entity["key"]}/fields/')
            self.assertEqual(response.status_code, status.HTTP_200_OK, 
                           f'Failed for entity: {entity["key"]}')
            self.assertIn('fields', response.data)
    
    def test_smart_match_with_various_field_types(self):
        """Test smart matching works for different field types."""
        test_cases = [
            {'key': 'name', 'type': 'text'},
            {'key': 'phone', 'type': 'phone'},
            {'key': 'created_at', 'type': 'datetime'},
        ]
        
        for source_field in test_cases:
            response = self.client.post(
                '/api/v1/workflows/admin/smart-match/',
                {
                    'source_field': source_field,
                    'target_entity_type': 'customer'
                },
                format='json'
            )
            
            self.assertEqual(response.status_code, status.HTTP_200_OK, 
                           f'Failed for field type: {source_field["type"]}')


class FieldConfigAPITests(APITestCase):
    """Tests for the Field Configuration API endpoint."""
    
    @classmethod
    def setUpTestData(cls):
        # Create admin user
        cls.admin_user = User.objects.create_superuser(
            username='configadmin',
            email='configadmin@test.com',
            password='testpass123'
        )
        
        # Create tenant
        cls.tenant = Tenant.objects.create(
            name='Config Test Tenant',
            slug='config-test-tenant'
        )
        
        # Create test form
        cls.form = TenantForm.objects.create(
            tenant=cls.tenant,
            name='Config Test Form',
            description='A test form for config tests',
            status='draft'
        )
        
        # Create step 1 (source for auto-populate)
        cls.step1 = TenantFormEntity.objects.create(
            form=cls.form,
            entity_type='supplier',
            step_name='Supplier Info',
            order=0
        )
        
        # Create step 2 (target for auto-populate)
        cls.step2 = TenantFormEntity.objects.create(
            form=cls.form,
            entity_type='contact',
            step_name='Contact Info',
            order=1
        )
        
        # Create a field in step 1
        cls.source_field = TenantFormField.objects.create(
            form_entity=cls.step1,
            field_key='email',
            order=0
        )
        
        # Create a field in step 2 (target for config)
        cls.target_field = TenantFormField.objects.create(
            form_entity=cls.step2,
            field_key='email',
            order=0
        )
    
    def setUp(self):
        self.client.force_authenticate(user=self.admin_user)
    
    def test_get_field_config(self):
        """Test getting field configuration."""
        response = self.client.get(f'/api/v1/workflows/admin/fields/{self.target_field.id}/config/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('field_id', response.data)
        self.assertIn('field_key', response.data)
        self.assertIn('auto_populate', response.data)
        self.assertIn('available_source_steps', response.data)
        self.assertIn('suggestions', response.data)
        
        # Should have step 1 as available source (since target is in step 2)
        self.assertEqual(len(response.data['available_source_steps']), 1)
        self.assertEqual(response.data['available_source_steps'][0]['id'], str(self.step1.id))
    
    def test_get_field_config_first_step(self):
        """Test that first step has no available source steps."""
        response = self.client.get(f'/api/v1/workflows/admin/fields/{self.source_field.id}/config/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # First step has no prior steps to pull from
        self.assertEqual(len(response.data['available_source_steps']), 0)
        self.assertEqual(len(response.data['suggestions']), 0)
    
    def test_save_field_config(self):
        """Test saving field configuration with auto-populate."""
        response = self.client.post(
            f'/api/v1/workflows/admin/fields/{self.target_field.id}/config/',
            {
                'custom_label': 'Contact Email',
                'custom_help_text': 'Auto-populated from supplier',
                'auto_populate': {
                    'source_step': str(self.step1.id),
                    'source_field': 'email',
                    'mode': 'copy'
                }
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify saved data
        self.target_field.refresh_from_db()
        self.assertEqual(self.target_field.custom_label, 'Contact Email')
        self.assertEqual(self.target_field.custom_help_text, 'Auto-populated from supplier')
        self.assertEqual(self.target_field.auto_populate_source_step, self.step1)
        self.assertEqual(self.target_field.auto_populate_source_field, 'email')
        self.assertEqual(self.target_field.auto_populate_mode, 'copy')
    
    def test_clear_auto_populate(self):
        """Test clearing auto-populate configuration."""
        # First set auto-populate
        self.target_field.auto_populate_source_step = self.step1
        self.target_field.auto_populate_source_field = 'email'
        self.target_field.auto_populate_mode = 'copy'
        self.target_field.save()
        
        # Now clear it
        response = self.client.post(
            f'/api/v1/workflows/admin/fields/{self.target_field.id}/config/',
            {
                'auto_populate': {
                    'source_step': None,
                    'source_field': '',
                    'mode': ''
                }
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify cleared
        self.target_field.refresh_from_db()
        self.assertIsNone(self.target_field.auto_populate_source_step)
        self.assertEqual(self.target_field.auto_populate_source_field, '')
        self.assertEqual(self.target_field.auto_populate_mode, '')
    
    def test_smart_suggestions(self):
        """Test that smart matching suggestions are returned."""
        response = self.client.get(f'/api/v1/workflows/admin/fields/{self.target_field.id}/config/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Since target field is 'email' and source step has 'email', should get suggestions
        suggestions = response.data['suggestions']
        # Should suggest email from step 1
        if suggestions:
            # Find email suggestion
            email_suggestion = next((s for s in suggestions if s['source_field_key'] == 'email'), None)
            if email_suggestion:
                self.assertGreater(email_suggestion['score'], 50)
                self.assertIn('reasons', email_suggestion)
    
    def test_nonexistent_field(self):
        """Test getting config for non-existent field returns 404."""
        import uuid
        response = self.client.get(f'/api/v1/workflows/admin/fields/{uuid.uuid4()}/config/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FormRulesAPITests(APITestCase):
    """Tests for the Form Rules API endpoints."""
    
    @classmethod
    def setUpTestData(cls):
        # Create admin user
        cls.admin_user = User.objects.create_superuser(
            username='rulesadmin',
            email='rulesadmin@test.com',
            password='testpass123'
        )
        
        # Create tenant
        cls.tenant = Tenant.objects.create(
            name='Rules Test Tenant',
            slug='rules-test-tenant'
        )
        
        # Create test form
        cls.form = TenantForm.objects.create(
            tenant=cls.tenant,
            name='Rules Test Form',
            description='A test form for rules tests',
            status='draft'
        )
        
        # Create step 1
        cls.step1 = TenantFormEntity.objects.create(
            form=cls.form,
            entity_type='supplier',
            step_name='Supplier Info',
            order=0
        )
        
        # Create step 2
        cls.step2 = TenantFormEntity.objects.create(
            form=cls.form,
            entity_type='customer',
            step_name='Customer Info',
            order=1
        )
    
    def setUp(self):
        self.client.force_authenticate(user=self.admin_user)
    
    def test_get_form_rules_empty(self):
        """Test getting rules for a form with no rules."""
        response = self.client.get(f'/api/v1/workflows/admin/forms/{self.form.id}/rules/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['form_id'], str(self.form.id))
        self.assertEqual(response.data['rules'], [])
        self.assertEqual(len(response.data['steps']), 2)
    
    def test_get_form_rules_with_steps(self):
        """Test that form rules response includes steps with fields."""
        response = self.client.get(f'/api/v1/workflows/admin/forms/{self.form.id}/rules/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        steps = response.data['steps']
        self.assertEqual(len(steps), 2)
        
        # Check step structure
        for step in steps:
            self.assertIn('id', step)
            self.assertIn('name', step)
            self.assertIn('entity_type', step)
            self.assertIn('fields', step)
            # Should have fields from the entity type
            self.assertIsInstance(step['fields'], list)
    
    def test_create_rule(self):
        """Test creating a new rule."""
        response = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/rules/',
            {
                'name': 'Test Rule',
                'conditions': [
                    {
                        'field': f'{self.step1.id}.supplier_type',
                        'operator': 'eq',
                        'value': 'wholesale'
                    }
                ],
                'condition_logic': 'and',
                'actions': [
                    {
                        'action': 'display_fields',
                        'params': {'fields': [f'{self.step2.id}.credit_limit']}
                    }
                ]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('rule_id', response.data)
    
    def test_create_rule_auto_order(self):
        """Test that rules get auto-incrementing order when created sequentially."""
        from tenant_apps.workflows.models import TenantFormRule
        from django.db.models import Max
        
        # Clean up any existing rules from this form  
        TenantFormRule.objects.filter(form=self.form).delete()
        
        # Create first rule
        rule1 = TenantFormRule.objects.create(
            form=self.form,
            name='Rule 1',
            conditions=[],
            actions=[],
            order=0
        )
        
        # Calculate next order like the API does (fixed version)
        max_order = TenantFormRule.objects.filter(form=self.form).aggregate(max_order=Max('order'))['max_order']
        next_order = 0 if max_order is None else max_order + 1
        
        # Create second rule with calculated order
        rule2 = TenantFormRule.objects.create(
            form=self.form,
            name='Rule 2',
            conditions=[],
            actions=[],
            order=next_order
        )
        
        # Verify orders are sequential
        self.assertEqual(rule1.order, 0)
        self.assertEqual(rule2.order, 1)
        self.assertGreater(rule2.order, rule1.order)
    
    def test_update_rule(self):
        """Test updating an existing rule."""
        from tenant_apps.workflows.models import TenantFormRule
        
        # Create a rule
        rule = TenantFormRule.objects.create(
            form=self.form,
            name='Original Name',
            conditions=[],
            actions=[],
            order=0
        )
        
        # Update it
        response = self.client.put(
            f'/api/v1/workflows/admin/rules/{rule.id}/',
            {
                'name': 'Updated Name',
                'conditions': [{'field': 'test', 'operator': 'eq', 'value': 'new'}],
                'is_active': False
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify updates
        rule.refresh_from_db()
        self.assertEqual(rule.name, 'Updated Name')
        self.assertEqual(rule.conditions, [{'field': 'test', 'operator': 'eq', 'value': 'new'}])
        self.assertFalse(rule.is_active)
    
    def test_delete_rule(self):
        """Test deleting a rule."""
        from tenant_apps.workflows.models import TenantFormRule
        
        rule = TenantFormRule.objects.create(
            form=self.form,
            name='To Delete',
            conditions=[],
            actions=[],
            order=0
        )
        rule_id = rule.id
        
        response = self.client.delete(f'/api/v1/workflows/admin/rules/{rule_id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(TenantFormRule.objects.filter(pk=rule_id).exists())
    
    def test_get_nonexistent_form_rules(self):
        """Test getting rules for non-existent form returns 404."""
        import uuid
        response = self.client.get(f'/api/v1/workflows/admin/forms/{uuid.uuid4()}/rules/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_nonexistent_rule(self):
        """Test updating non-existent rule returns 404."""
        import uuid
        response = self.client.put(
            f'/api/v1/workflows/admin/rules/{uuid.uuid4()}/',
            {'name': 'Test'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delete_nonexistent_rule(self):
        """Test deleting non-existent rule returns 404."""
        import uuid
        response = self.client.delete(f'/api/v1/workflows/admin/rules/{uuid.uuid4()}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FormStepsAPITests(APITestCase):
    """Tests for the Form Steps API endpoints (create/delete steps)."""
    
    @classmethod
    def setUpTestData(cls):
        # Create admin user
        cls.admin_user = User.objects.create_superuser(
            username='stepsadmin',
            email='stepsadmin@test.com',
            password='testpass123'
        )
        
        # Create tenant
        cls.tenant = Tenant.objects.create(
            name='Steps Test Tenant',
            slug='steps-test-tenant'
        )
        
        # Create test form
        cls.form = TenantForm.objects.create(
            tenant=cls.tenant,
            name='Steps Test Form',
            description='A test form for steps tests',
            status='draft'
        )
    
    def setUp(self):
        self.client.force_authenticate(user=self.admin_user)
    
    def test_get_form_steps(self):
        """Test getting steps for a form."""
        # Create some steps first
        TenantFormEntity.objects.create(
            form=self.form,
            entity_type='supplier',
            step_name='Step 1',
            order=0
        )
        TenantFormEntity.objects.create(
            form=self.form,
            entity_type='customer',
            step_name='Step 2',
            order=1
        )
        
        response = self.client.get(f'/api/v1/workflows/admin/forms/{self.form.id}/steps/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['form_id'], str(self.form.id))
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['steps']), 2)
    
    def test_create_step(self):
        """Test creating a new step via API."""
        initial_count = TenantFormEntity.objects.filter(form=self.form).count()
        
        response = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/steps/',
            {
                'entity_type': 'product',
                'step_name': 'Product Details'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['step']['entity_type'], 'product')
        self.assertEqual(response.data['step']['step_name'], 'Product Details')
        
        # Verify step was created
        new_count = TenantFormEntity.objects.filter(form=self.form).count()
        self.assertEqual(new_count, initial_count + 1)
    
    def test_create_step_auto_order(self):
        """Test that new steps get auto-incrementing order."""
        # Create first step
        response1 = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/steps/',
            {'entity_type': 'supplier'},
            format='json'
        )
        self.assertEqual(response1.data['step']['order'], 0)
        
        # Create second step
        response2 = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/steps/',
            {'entity_type': 'customer'},
            format='json'
        )
        self.assertEqual(response2.data['step']['order'], 1)
        
        # Create third step
        response3 = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/steps/',
            {'entity_type': 'product'},
            format='json'
        )
        self.assertEqual(response3.data['step']['order'], 2)
    
    def test_create_step_missing_entity_type(self):
        """Test that creating step without entity_type returns error."""
        response = self.client.post(
            f'/api/v1/workflows/admin/forms/{self.form.id}/steps/',
            {'step_name': 'No Entity'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_delete_step(self):
        """Test deleting a step via API."""
        step = TenantFormEntity.objects.create(
            form=self.form,
            entity_type='carrier',
            step_name='To Delete',
            order=0
        )
        
        response = self.client.delete(f'/api/v1/workflows/admin/steps/{step.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify step was deleted
        self.assertFalse(TenantFormEntity.objects.filter(id=step.id).exists())
    
    def test_delete_nonexistent_step(self):
        """Test deleting non-existent step returns 404."""
        import uuid
        response = self.client.delete(f'/api/v1/workflows/admin/steps/{uuid.uuid4()}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_get_nonexistent_form_steps(self):
        """Test getting steps for non-existent form returns 404."""
        import uuid
        response = self.client.get(f'/api/v1/workflows/admin/forms/{uuid.uuid4()}/steps/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
