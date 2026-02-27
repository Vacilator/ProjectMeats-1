"""
Microsoft integration URL configuration.
"""

from django.urls import path
from .views import MicrosoftOAuthCallbackView, MicrosoftIntegrationStatusView

app_name = 'microsoft'

urlpatterns = [
    path('callback/', MicrosoftOAuthCallbackView.as_view(), name='oauth_callback'),
    path('status/', MicrosoftIntegrationStatusView.as_view(), name='integration_status'),
]
