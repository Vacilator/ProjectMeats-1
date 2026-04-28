from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


User = get_user_model()


class WorkFormsMetadataEndpointTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_metadata_endpoint_returns_registry(self):
        resp = self.client.get('/api/v1/system/workforms/metadata/')
        self.assertEqual(resp.status_code, 200)

        data = resp.json()
        self.assertEqual(data.get('version'), 'v1')
        self.assertIn('nodes', data)
        self.assertIn('aliases', data)

        nodes = data.get('nodes') or {}
        self.assertIn('parallelPath', nodes)
        self.assertIn('actionHTTP', nodes)
