"""
Stable URL shim that delegates to the canonical app URLConf.

Historical note: this file previously duplicated oauth/authorize/ and
oauth/callback/<provider>/ before including apps.integrations.urls, which
shadowed the canonical routes. Consolidated to a single include so OAuth
callback routes are defined in exactly one place (apps.integrations.urls).
"""
from django.urls import include, path

urlpatterns = [
    path('', include('apps.integrations.urls')),
]
