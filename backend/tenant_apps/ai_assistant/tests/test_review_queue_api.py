import unittest
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
    raise unittest.SkipTest('tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings')

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.plants.models import Plant
from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.ai_assistant.views import ContextualSuggestionsAPIView, PendingReviewView


class PendingReviewViewTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username=f'ai-review-{unique}',
            email=f'ai-review-{unique}@example.com',
            password='pw',
            is_staff=True,
        )
        self.tenant = Tenant.objects.create(
            name=f'AI Review Tenant {unique}',
            slug=f'ai-review-tenant-{unique}',
            contact_email=f'ops-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

    def test_pending_review_payload_includes_operational_hub_metadata(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type='bill_of_lading',
            confidence_score=0.42,
            original_extracted_data={
                'from_email': 'dispatch@example.com',
                'subject': 'BOL 9917 ready for review',
                'bol_number': '9917',
                'notes': 'Carrier confirmed pickup window.',
                'items': [
                    {
                        'description': 'Beef trim combo',
                        'quantity': 12,
                        'total_net_weight': 18000,
                        'weight_unit': 'LBS',
                    }
                ],
            },
        )

        request = self.factory.get('/api/v1/ai-assistant/review/pending/')
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = PendingReviewView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data['results'][0]
        self.assertEqual(str(payload['id']), str(feedback.id))
        self.assertEqual(payload['sender'], 'dispatch@example.com')
        self.assertEqual(payload['intent_label'], 'Bill Of Lading')
        self.assertEqual(payload['review_entity_type'], 'carrier-pos')
        self.assertEqual(payload['review_target_url'], f'/my-tasks?tab=ai-review&draft={feedback.id}')

    def test_pending_review_uses_explicit_review_target_url_from_payload(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type='inquiry',
            confidence_score=1.0,
            original_extracted_data={
                'inquiry_id': 17,
                'review_target_url': '/inquiries?review=inquiry&inquiry=17',
                'route_decision': 'BROKER',
            },
        )

        request = self.factory.get('/api/v1/ai-assistant/review/pending/')
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = PendingReviewView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        payload = next(item for item in response.data['results'] if str(item['id']) == str(feedback.id))
        self.assertEqual(payload['review_entity_type'], 'inquiry')
        self.assertEqual(payload['review_target_url'], '/inquiries?review=inquiry&inquiry=17')

    def test_pending_review_purchase_order_payload_uses_purchase_order_intent(self):
        feedback = AIFeedbackLog.objects.create(
            tenant=self.tenant,
            document_id=uuid.uuid4(),
            document_type='purchase_order',
            confidence_score=0.95,
            original_extracted_data={
                'order_number': '226001',
                'supplier_name': 'Quoted Supplier',
                'review_target_url': '/purchase-orders/44/review',
                'status': 'draft',
            },
        )

        request = self.factory.get('/api/v1/ai-assistant/review/pending/')
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = PendingReviewView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        payload = next(item for item in response.data['results'] if str(item['id']) == str(feedback.id))
        self.assertEqual(payload['intent_label'], 'Purchase Order')
        self.assertEqual(payload['review_entity_type'], 'purchase_order')
        self.assertEqual(payload['review_target_url'], '/purchase-orders/44/review')

    def test_contextual_suggestions_returns_plant_continuity_actions(self):
        plant = Plant.objects.create(
            tenant=self.tenant,
            name='Continuity Plant',
            plant_type='processing',
            city='Chicago',
            state='IL',
            country='USA',
        )

        request = self.factory.post(
            '/api/v1/ai-assistant/suggestions/contextual/',
            {
                'entity_type': 'plant',
                'entity_id': str(plant.id),
                'current_state': {},
            },
            format='json',
        )
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = ContextualSuggestionsAPIView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['suggestions'][0]['action'], 'update_booking_contact')
