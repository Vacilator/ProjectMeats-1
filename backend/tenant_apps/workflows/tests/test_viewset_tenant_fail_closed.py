from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import (
    FormStatusHistory,
    FormSubmission,
    FormSubmissionStatus,
    NotificationType,
    StepAssignment,
    TenantForm,
    TenantFormEntity,
    UserNotification,
)
from tenant_apps.workflows.views import (
    FormStatusHistoryViewSet,
    StepAssignmentViewSet,
    TenantFormEntityViewSet,
    UserNotificationViewSet,
)


class WorkflowViewSetTenantFailClosedTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')

        self.tenant_a = Tenant.objects.create(
            name=f'Tenant A {unique}',
            slug=f'tenant-a-{unique}',
            contact_email=f'a-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f'Tenant B {unique}',
            slug=f'tenant-b-{unique}',
            contact_email=f'b-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role='admin', is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user, role='admin', is_active=True)

        # Forms + entities in both tenants
        self.form_a = TenantForm.objects.create(tenant=self.tenant_a, name='Form A', created_by=self.user)
        self.form_b = TenantForm.objects.create(tenant=self.tenant_b, name='Form B', created_by=self.user)

        self.entity_a = TenantFormEntity.objects.create(form=self.form_a, entity_type='customer', order=0)
        self.entity_b = TenantFormEntity.objects.create(form=self.form_b, entity_type='customer', order=0)

        # Step assignments in both tenants
        StepAssignment.objects.create(
            tenant=self.tenant_a,
            form=self.form_a,
            step=self.entity_a,
            assigned_user=self.user,
            created_by=self.user,
        )
        StepAssignment.objects.create(
            tenant=self.tenant_b,
            form=self.form_b,
            step=self.entity_b,
            assigned_user=self.user,
            created_by=self.user,
        )

        # Form submission + status history in tenant A
        self.submission_a = FormSubmission.objects.create(
            tenant=self.tenant_a,
            form=self.form_a,
            created_by=self.user,
            status=FormSubmissionStatus.DRAFT,
        )
        FormStatusHistory.objects.create(
            submission=self.submission_a,
            from_status='',
            to_status=FormSubmissionStatus.DRAFT,
            changed_by=self.user,
        )

        # Notifications in both tenants
        UserNotification.objects.create(
            tenant=self.tenant_a,
            user=self.user,
            notification_type=NotificationType.SYSTEM,
            title='A only',
            message='Tenant A notification',
        )
        UserNotification.objects.create(
            tenant=self.tenant_b,
            user=self.user,
            notification_type=NotificationType.SYSTEM,
            title='B only',
            message='Tenant B notification',
        )

    def _get(self, path: str, tenant):
        request = self.factory.get(path)
        force_authenticate(request, user=self.user)
        request.tenant = tenant
        return request

    def _items(self, response):
        data = response.data
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    def test_tenant_form_entity_list_is_scoped_and_fails_closed(self):
        # Scoped to tenant
        resp = TenantFormEntityViewSet.as_view({'get': 'list'})(
            self._get('/api/v1/workflows/form-entities/', self.tenant_a)
        )
        self.assertEqual(resp.status_code, 200)
        items = self._items(resp)
        ids = {row.get('id') for row in items}
        self.assertIn(str(self.entity_a.id), ids)
        self.assertNotIn(str(self.entity_b.id), ids)

        # Fail closed when tenant missing
        resp2 = TenantFormEntityViewSet.as_view({'get': 'list'})(self._get('/api/v1/workflows/form-entities/', None))
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(self._items(resp2)), 0)

    def test_step_assignments_list_is_scoped_and_fails_closed(self):
        resp = StepAssignmentViewSet.as_view({'get': 'list'})(
            self._get('/api/v1/workflows/step-assignments/', self.tenant_a)
        )
        self.assertEqual(resp.status_code, 200)
        joined = str(self._items(resp))
        self.assertIn(str(self.tenant_a.id), joined)
        self.assertNotIn(str(self.tenant_b.id), joined)

        resp2 = StepAssignmentViewSet.as_view({'get': 'list'})(self._get('/api/v1/workflows/step-assignments/', None))
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(self._items(resp2)), 0)

    def test_notifications_list_is_scoped_and_fails_closed(self):
        resp = UserNotificationViewSet.as_view({'get': 'list'})(
            self._get('/api/v1/workflows/notifications/', self.tenant_a)
        )
        self.assertEqual(resp.status_code, 200)
        joined = str(self._items(resp))
        self.assertIn('A only', joined)
        self.assertNotIn('B only', joined)

        resp2 = UserNotificationViewSet.as_view({'get': 'list'})(self._get('/api/v1/workflows/notifications/', None))
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(self._items(resp2)), 0)

    def test_status_history_is_scoped_and_fails_closed(self):
        # Scoped to tenant
        req = self._get(
            f'/api/v1/workflows/form-submissions/{self.submission_a.id}/history/',
            self.tenant_a,
        )
        resp = FormStatusHistoryViewSet.as_view({'get': 'list'})(req, submission_id=str(self.submission_a.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(self._items(resp)), 1)

        # Wrong tenant gets nothing
        req2 = self._get(
            f'/api/v1/workflows/form-submissions/{self.submission_a.id}/history/',
            self.tenant_b,
        )
        resp2 = FormStatusHistoryViewSet.as_view({'get': 'list'})(req2, submission_id=str(self.submission_a.id))
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(self._items(resp2)), 0)

        # Missing tenant fails closed
        req3 = self._get(
            f'/api/v1/workflows/form-submissions/{self.submission_a.id}/history/',
            None,
        )
        resp3 = FormStatusHistoryViewSet.as_view({'get': 'list'})(req3, submission_id=str(self.submission_a.id))
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(len(self._items(resp3)), 0)
