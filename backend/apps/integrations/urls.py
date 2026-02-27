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
    
    # Microsoft OAuth (Phase 5)
    path('microsoft/', include('apps.integrations.microsoft.urls', namespace='microsoft')),
]
