"""
URL configuration for integrations app.
"""
from django.urls import path, include
from . import views
from integrations.views.oauth import OAuthAuthorizeView, OAuthCallbackView

app_name = 'integrations'

urlpatterns = [
    # Keep legacy app URL aliases pointed at the hardened canonical views so include-order changes
    # cannot re-expose the older function-based OAuth implementation.
    path('oauth/authorize/', OAuthAuthorizeView.as_view(), name='oauth-authorize'),
    path('oauth/callback/<str:provider_type>/', OAuthCallbackView.as_view(), name='oauth-callback'),
    path('oauth/status/', views.get_connection_status, name='oauth-status'),
    path('oauth/disconnect/', views.disconnect_provider, name='oauth-disconnect'),
    
    # Email sync endpoints (Phase 5.5)
    path('email/sync/', views.sync_emails, name='email-sync'),
    path('email/logs/', views.get_email_logs, name='email-logs'),
    
    # Microsoft OAuth (Phase 5)
    path('microsoft/', include('apps.integrations.microsoft.urls', namespace='microsoft')),
]
