"""
CDN Integration Middleware (Phase 8.2)

Serves static assets via CDN with fallback to local.
"""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class CDNMiddleware(MiddlewareMixin):
    """
    Rewrite static file URLs to use CDN.
    
    Configuration:
        CDN_ENABLED: Enable/disable CDN (default: False)
        CDN_BASE_URL: CDN URL (e.g., https://cdn.meatscentral.com)
        STATIC_URL: Fallback local URL
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.cdn_enabled = getattr(settings, 'CDN_ENABLED', False)
        self.cdn_base_url = getattr(settings, 'CDN_BASE_URL', '')
        
    def process_response(self, request, response):
        """
        Rewrite static URLs in HTML responses.
        """
        if not self.cdn_enabled or not self.cdn_base_url:
            return response
        
        if 'text/html' not in response.get('Content-Type', ''):
            return response
        
        # Rewrite STATIC_URL to CDN_BASE_URL
        content = response.content.decode('utf-8')
        content = content.replace(
            f'"{settings.STATIC_URL}',
            f'"{self.cdn_base_url}/'
        )
        
        response.content = content.encode('utf-8')
        return response


class StaticFileCacheHeadersMiddleware(MiddlewareMixin):
    """
    Add cache headers for static files.
    
    Cache-Control: public, max-age=3600 (1 hour)
    """
    
    def process_response(self, request, response):
        """
        Add cache headers for static assets.
        """
        if request.path.startswith(settings.STATIC_URL):
            response['Cache-Control'] = 'public, max-age=3600'
            response['Vary'] = 'Accept-Encoding'
        
        return response


# CDN Configuration Example
"""
# settings.py

CDN_ENABLED = True
CDN_BASE_URL = 'https://cdn.meatscentral.com'

MIDDLEWARE = [
    ...
    'apps.core.cdn.CDNMiddleware',
    'apps.core.cdn.StaticFileCacheHeadersMiddleware',
]

# DigitalOcean Spaces CDN Configuration
AWS_S3_CUSTOM_DOMAIN = 'cdn.meatscentral.com'
AWS_STORAGE_BUCKET_NAME = 'projectmeats-static'
AWS_S3_REGION_NAME = 'nyc3'
AWS_S3_ENDPOINT_URL = 'https://nyc3.digitaloceanspaces.com'

# StaticFiles Storage
STATICFILES_STORAGE = 'storages.backends.s3boto3.S3StaticStorage'
"""
