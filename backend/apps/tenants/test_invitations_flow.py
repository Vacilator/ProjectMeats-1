"""Invitation flow regression tests.

These tests protect the invite-only signup flow and the public validate endpoint.

Endpoints:
- GET  /api/v1/invitations/validate/?token=...
- POST /api/v1/auth/signup-with-invitation/

Goals:
- Invalid/expired/revoked tokens fail with stable 4xx (no 500)
- Successful signup creates User + TenantUser, marks invitation accepted
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantInvitation, TenantUser


class InvitationFlowTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.inviter = User.objects.create_user(username=f"inviter-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"t-{unique}@example.com",
            is_active=True,
            created_by=self.inviter,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.inviter, role="admin", is_active=True)

    def test_validate_invitation_missing_token_returns_400(self):
        resp = self.client.get("/api/v1/invitations/validate/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", resp.data)

    def test_validate_invitation_invalid_token_returns_404(self):
        resp = self.client.get("/api/v1/invitations/validate/?token=does-not-exist")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", resp.data)

    def test_validate_invitation_expired_marks_expired_and_returns_400(self):
        invitation = TenantInvitation.objects.create(
            tenant=self.tenant,
            invited_by=self.inviter,
            email="expired@example.com",
            role="user",
            status="pending",
            expires_at=timezone.now() - timedelta(days=1),
        )

        resp = self.client.get(f"/api/v1/invitations/validate/?token={invitation.token}")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "expired")

    def test_validate_invitation_valid_returns_details(self):
        invitation = TenantInvitation.objects.create(
            tenant=self.tenant,
            invited_by=self.inviter,
            email="new-user@example.com",
            role="manager",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )

        resp = self.client.get(f"/api/v1/invitations/validate/?token={invitation.token}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get("valid"))
        self.assertEqual(resp.data.get("email"), "new-user@example.com")
        self.assertEqual(resp.data.get("role"), "manager")
        self.assertEqual(resp.data.get("tenant", {}).get("slug"), self.tenant.slug)

    def test_signup_with_invitation_requires_matching_email_for_single_use(self):
        invitation = TenantInvitation.objects.create(
            tenant=self.tenant,
            invited_by=self.inviter,
            email="invitee@example.com",
            role="user",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )

        resp = self.client.post(
            "/api/v1/auth/signup-with-invitation/",
            {
                "invitation_token": invitation.token,
                "username": "newuser",
                "password": "SecurePass123!",
                "first_name": "New",
                "last_name": "User",
                "email": "wrong@example.com",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", resp.data)

    def test_signup_with_invitation_creates_user_and_membership(self):
        unique = uuid.uuid4().hex[:6]
        invitee_email = f"invitee-{unique}@example.com"
        invitation = TenantInvitation.objects.create(
            tenant=self.tenant,
            invited_by=self.inviter,
            email=invitee_email,
            role="manager",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )

        resp = self.client.post(
            "/api/v1/auth/signup-with-invitation/",
            {
                "invitation_token": invitation.token,
                "username": f"newuser-{unique}",
                "password": "SecurePass123!",
                "first_name": "New",
                "last_name": "User",
                "email": invitee_email,
            },
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data.get("tenant", {}).get("slug"), self.tenant.slug)
        self.assertEqual(resp.data.get("role"), "manager")

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "accepted")
        self.assertEqual(invitation.usage_count, 1)

        created_user = User.objects.get(username=f"newuser-{unique}")
        membership = TenantUser.objects.get(tenant=self.tenant, user=created_user)
        self.assertEqual(membership.role, "manager")
        self.assertTrue(membership.is_active)
