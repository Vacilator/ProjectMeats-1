import unittest
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
    raise unittest.SkipTest('tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings')

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.ai_assistant.views import PendingReviewView


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
