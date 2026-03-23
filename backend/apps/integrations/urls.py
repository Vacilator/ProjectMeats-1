"""
URL configuration for integrations app.
"""
from django.urls import path, include
from . import views

app_name = 'integrations'

urlpatterns = [
    # OAuth URLs
    path('oauth/authorize/', views.get_auth_url, name='oauth-authorize'),
    path('oauth/callback/<str:provider_type>/', views.oauth_callback, name='oauth-callback'),
    path('oauth/status/', views.get_connection_status, name='oauth-status'),
    path('oauth/disconnect/', views.disconnect_provider, name='oauth-disconnect'),
    
    # Email sync endpoints (Phase 5.5)
    path('email/sync/', views.sync_emails, name='email-sync'),
    path('email/logs/', views.get_email_logs, name='email-logs'),
    
    # Microsoft OAuth (Phase 5)
    path('microsoft/', include('apps.integrations.microsoft.urls', namespace='microsoft')),
]
