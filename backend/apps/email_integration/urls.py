"""
Email Integration URLs

Routes for email OAuth flows and webhook notifications.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.email_integration.views import oauth_views, webhook_views

app_name = "email_integration"

router = DefaultRouter()
router.register("email-accounts", oauth_views.EmailAccountViewSet, basename="email-account")

urlpatterns = [
    # Outlook OAuth
    path("email/outlook/auth/init/", oauth_views.outlook_auth_init, name="outlook-auth-init"),
    path("email/outlook/auth/callback/", oauth_views.outlook_auth_callback, name="outlook-auth-callback"),
    # Gmail OAuth
    path("email/gmail/auth/init/", oauth_views.gmail_auth_init, name="gmail-auth-init"),
    path("email/gmail/auth/callback/", oauth_views.gmail_auth_callback, name="gmail-auth-callback"),
    # Outlook Webhooks
    path(
        "email/outlook/webhook/subscribe/<int:account_id>/",
        webhook_views.outlook_webhook_subscribe,
        name="outlook-webhook-subscribe",
    ),
    path(
        "email/outlook/webhook/renew/<int:account_id>/",
        webhook_views.outlook_webhook_renew,
        name="outlook-webhook-renew",
    ),
    path(
        "email/outlook/webhook/unsubscribe/<int:account_id>/",
        webhook_views.outlook_webhook_unsubscribe,
        name="outlook-webhook-unsubscribe",
    ),
    path(
        "email/outlook/webhook/notifications/",
        webhook_views.outlook_webhook_notifications,
        name="outlook-webhook-notifications",
    ),
    # Gmail Webhooks
    path(
        "email/gmail/webhook/subscribe/<int:account_id>/",
        webhook_views.gmail_webhook_subscribe,
        name="gmail-webhook-subscribe",
    ),
    path("email/gmail/webhook/renew/<int:account_id>/", webhook_views.gmail_webhook_renew, name="gmail-webhook-renew"),
    path(
        "email/gmail/webhook/unsubscribe/<int:account_id>/",
        webhook_views.gmail_webhook_unsubscribe,
        name="gmail-webhook-unsubscribe",
    ),
    path(
        "email/gmail/webhook/notifications/",
        webhook_views.gmail_webhook_notifications,
        name="gmail-webhook-notifications",
    ),
    # Email account management
    *router.urls,
]
