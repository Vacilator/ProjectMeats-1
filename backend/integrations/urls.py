from django.urls import path
from .views.oauth import OAuthAuthorizeView, OAuthCallbackView

urlpatterns = [
    path('oauth/authorize/', OAuthAuthorizeView.as_view(), name='oauth_authorize'),
    path('oauth/callback/<str:provider>/', OAuthCallbackView.as_view(), name='oauth_callback'),
]

# Preserve existing integrations endpoints (status, disconnect, etc.) by including the
# canonical app URLConf behind this stable shim.
from django.urls import include  # noqa: E402

urlpatterns += [
    path('', include('apps.integrations.urls')),
]
