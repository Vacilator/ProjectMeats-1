"""
URL configuration for integrations app.
"""
from django.urls import path, include
from . import views

app_name = 'integrations'

urlpatterns = [
    # OAuth authorize/callback routes are defined canonically in backend/integrations/urls.py.
    # This app URLConf keeps only the non-OAuth integrations endpoints behind that shim.
    path('oauth/status/', views.get_connection_status, name='oauth-status'),
    path('oauth/disconnect/', views.disconnect_provider, name='oauth-disconnect'),
    
    # Email sync endpoints (Phase 5.5)
    path('email/sync/', views.sync_emails, name='email-sync'),
    path('email/logs/', views.get_email_logs, name='email-logs'),
    
    # Microsoft OAuth (Phase 5)
    path('microsoft/', include('apps.integrations.microsoft.urls', namespace='microsoft')),
]
