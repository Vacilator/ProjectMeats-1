"""Invitation email helpers.

Centralizes invitation email sending so the same logic can be reused from:
- post_save signals (send on create)
- API resend action

Email failures must never break invitation creation/resend.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from .models import TenantInvitation

logger = logging.getLogger(__name__)


def schedule_invitation_email(invitation: TenantInvitation) -> None:
    """Best-effort: send the invitation email after commit.

    Safe to call multiple times. No-op if the invitation is not a pending 1:1 email invite.
    """

    if invitation.status != "pending" or not invitation.email:
        return

    base_url = getattr(settings, "FRONTEND_URL", "https://meatscentral.com")
    invite_url = f"{base_url}/signup?token={invitation.token}"

    subject = f"You've been invited to join {invitation.tenant.name} on Meats Central"

    message = (
        "Hello,\n\n\n"
        f"You have been invited to join '{invitation.tenant.name}' as a {invitation.role}. "
        "Join us on Meats Central!\n\n\n"
        "Click the link below to accept the invitation and set up your account:\n"
        f"{invite_url}\n\n"
        f"This link expires on {invitation.expires_at.strftime('%Y-%m-%d')}.\n\n\n"
        "Welcome to easy,\n\n"
        "The Meats Central Team"
    )

    def _send() -> None:
        try:
            logger.info(
                "📤 Sending invitation email to %s (tenant=%s, role=%s)",
                invitation.email,
                invitation.tenant_id,
                invitation.role,
            )
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[invitation.email],
                fail_silently=False,
            )
        except Exception:
            logger.exception("❌ Failed to send invitation email to %s", invitation.email)

    transaction.on_commit(_send)
