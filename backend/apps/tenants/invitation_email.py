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


def _build_invitation_email(invitation: TenantInvitation) -> tuple[str, str, str]:
    base_url = getattr(settings, "FRONTEND_URL", "https://meatscentral.com")
    invite_url = f"{base_url}/signup?token={invitation.token}"

    subject = f"You've been invited to join {invitation.tenant.name} on Meats Central"

    body = (
        "Hello,\n\n\n"
        f"You have been invited to join '{invitation.tenant.name}' as a {invitation.role}. "
        "Join us on Meats Central!\n\n\n"
        "Click the link below to accept the invitation and set up your account:\n"
        f"{invite_url}\n\n"
        f"This link expires on {invitation.expires_at.strftime('%Y-%m-%d')}.\n\n\n"
        "Welcome to easy,\n\n"
        "The Meats Central Team"
    )

    return subject, body, invite_url


def send_invitation_email_now(invitation: TenantInvitation) -> None:
    """Send invitation email immediately.

    Use this when the caller needs immediate feedback (e.g., resend endpoint).
    """

    if invitation.status != "pending" or not invitation.email:
        return

    # Common operational misconfig: SendGrid backend enabled but no API key.
    if (
        str(getattr(settings, 'EMAIL_BACKEND', '')).endswith('SendgridBackend')
        and not getattr(settings, 'SENDGRID_API_KEY', '')
    ):
        raise RuntimeError('SENDGRID_API_KEY is not set for SendGrid email backend')

    subject, body, invite_url = _build_invitation_email(invitation)

    logger.info(
        "📤 Sending invitation email to %s (tenant=%s, role=%s, invite_url=%s)",
        invitation.email,
        invitation.tenant_id,
        invitation.role,
        invite_url,
    )

    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=False,
    )


def schedule_invitation_email(invitation: TenantInvitation) -> None:
    """Best-effort: send the invitation email after commit.

    Safe to call multiple times. No-op if the invitation is not a pending 1:1 email invite.
    Email failures must never break invitation creation/resend.
    """

    if invitation.status != "pending" or not invitation.email:
        return

    def _send() -> None:
        try:
            send_invitation_email_now(invitation)
        except Exception:
            logger.exception("❌ Failed to send invitation email to %s", invitation.email)

    transaction.on_commit(_send)
