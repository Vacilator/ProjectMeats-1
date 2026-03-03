"""
Email Order Ingestion Engine for Microsoft Graph.

Polls inboxes for order-related emails and creates EmailLog entries for AI processing.
"""
import logging
from datetime import timedelta
from typing import List, Dict, Any
from django.utils import timezone
from django.db import transaction
from apps.integrations.models import ExternalAuthProvider, EmailLog
from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


class EmailIngestionService:
    """
    Service for ingesting emails from external providers.
    
    Multi-tenant aware - iterates through all active tenants with valid tokens.
    """
    
    # Keywords to identify order-related emails
    ORDER_KEYWORDS = [
        'order', 'purchase', 'quote', 'invoice', 'po ', 'p.o.', 
        'req ', 'requisition', 'meat', 'beef', 'pork', 'chicken',
        'delivery', 'shipment'
    ]
    
    def __init__(self):
        self.stats = {
            'tenants_processed': 0,
            'emails_fetched': 0,
            'emails_saved': 0,
            'emails_skipped': 0,
            'errors': 0,
        }
    
    def poll_all_tenants(self) -> Dict[str, int]:
        """
        Poll inbox for all active tenants with Microsoft connections.
        
        Returns:
            Dict with statistics (tenants_processed, emails_fetched, etc.)
        """
        logger.info("Starting email ingestion for all tenants")
        
        # Get all active tenants with valid Microsoft auth
        active_providers = ExternalAuthProvider.objects.filter(
            provider_type='microsoft',
            is_active=True
        ).select_related('tenant')
        
        for provider in active_providers:
            try:
                self._poll_tenant_inbox(provider)
                self.stats['tenants_processed'] += 1
            except Exception as e:
                logger.error(
                    f"Failed to poll inbox for tenant {provider.tenant.name}: {str(e)}",
                    exc_info=True
                )
                self.stats['errors'] += 1
        
        logger.info(f"Email ingestion complete: {self.stats}")
        return self.stats
    
    def _poll_tenant_inbox(self, provider: ExternalAuthProvider):
        """
        Poll inbox for a single tenant.
        
        Args:
            provider: ExternalAuthProvider for this tenant
        """
        from apps.integrations.providers import MicrosoftGraphProvider
        
        tenant = provider.tenant
        logger.info(f"Polling inbox for tenant: {tenant.name}")
        
        # Refresh token if needed
        if provider.is_token_expired():
            logger.info(f"Refreshing expired token for tenant {tenant.name}")
            provider.refresh_if_needed()
        
        # Get access token
        access_token = provider.get_decrypted_token('access')
        if not access_token:
            logger.error(f"No access token for tenant {tenant.name}")
            return
        
        # Initialize Microsoft Graph provider
        graph_provider = MicrosoftGraphProvider(tenant.id)
        
        # Fetch recent emails (last 7 days)
        cutoff_date = timezone.now() - timedelta(days=7)
        emails = self._fetch_inbox_messages(
            graph_provider,
            access_token,
            cutoff_date
        )
        
        self.stats['emails_fetched'] += len(emails)
        
        # Save emails to database
        for email_data in emails:
            try:
                self._save_email_log(tenant, provider, email_data)
            except Exception as e:
                logger.error(
                    f"Failed to save email {email_data.get('id')}: {str(e)}",
                    exc_info=True
                )
                self.stats['errors'] += 1
    
    def _fetch_inbox_messages(
        self,
        provider,
        access_token: str,
        since: timezone.datetime
    ) -> List[Dict[str, Any]]:
        """
        Fetch messages from inbox using Microsoft Graph API.
        
        Args:
            provider: MicrosoftGraphProvider instance
            access_token: Valid OAuth access token
            since: Only fetch emails received after this date
            
        Returns:
            List of email message dicts
        """
        import requests
        from datetime import datetime
        
        # Format date for OData filter
        since_str = since.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # Build filter for order-related emails
        keyword_filters = [
            f"contains(subject, '{keyword}')" for keyword in self.ORDER_KEYWORDS
        ]
        filter_query = f"receivedDateTime ge {since_str} and ({' or '.join(keyword_filters)} or hasAttachments eq true)"
        
        # Microsoft Graph API endpoint with filters
        url = f"{provider.GRAPH_API_BASE}/me/messages"
        params = {
            '$filter': filter_query,
            '$select': 'id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,conversationId',
            '$top': 50,  # Limit to 50 most recent
            '$orderby': 'receivedDateTime desc'
        }
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            messages = data.get('value', [])
            logger.info(f"Fetched {len(messages)} messages from inbox")
            return messages
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch inbox messages: {str(e)}")
            return []
    
    def _save_email_log(
        self,
        tenant: Tenant,
        provider: ExternalAuthProvider,
        email_data: Dict[str, Any]
    ):
        """
        Save email to EmailLog (if not already saved).
        
        Args:
            tenant: Tenant this email belongs to
            provider: ExternalAuthProvider used to fetch email
            email_data: Email data from Microsoft Graph API
        """
        message_id = email_data['id']
        
        # Check if already processed (prevent duplicates)
        if EmailLog.objects.filter(message_id=message_id).exists():
            logger.debug(f"Email {message_id} already logged, skipping")
            self.stats['emails_skipped'] += 1
            return
        
        # Parse sender info
        from_data = email_data.get('from', {}).get('emailAddress', {})
        sender_email = from_data.get('address', '')
        sender_name = from_data.get('name', '')
        
        # Parse email body
        body = email_data.get('body', {})
        body_html = body.get('content', '') if body.get('contentType') == 'html' else ''
        body_text = email_data.get('bodyPreview', '')
        
        # Parse received date
        received_str = email_data.get('receivedDateTime')
        try:
            from dateutil import parser
            received_at = parser.parse(received_str)
        except:
            received_at = timezone.now()
        
        # Create EmailLog entry
        with transaction.atomic():
            email_log = EmailLog.objects.create(
                tenant=tenant,
                provider=provider,
                message_id=message_id,
                thread_id=email_data.get('conversationId'),
                subject=email_data.get('subject', '(No Subject)'),
                sender_email=sender_email,
                sender_name=sender_name,
                received_at=received_at,
                body_text=body_text,
                body_html=body_html,
                has_attachments=email_data.get('hasAttachments', False),
                attachment_count=0,  # TODO: Fetch attachment count from API
                status='logged'
            )
        
        logger.info(
            f"Saved email log: {email_log.id} - {email_log.subject} "
            f"from {sender_email}"
        )
        self.stats['emails_saved'] += 1
    
    def poll_tenant_by_id(self, tenant_id: int) -> Dict[str, int]:
        """
        Poll inbox for a specific tenant (manual sync).
        
        Args:
            tenant_id: Tenant ID to poll
            
        Returns:
            Dict with statistics
        """
        try:
            provider = ExternalAuthProvider.objects.get(
                tenant_id=tenant_id,
                provider_type='microsoft',
                is_active=True
            )
            self._poll_tenant_inbox(provider)
            self.stats['tenants_processed'] = 1
            return self.stats
        except ExternalAuthProvider.DoesNotExist:
            logger.error(f"No active Microsoft provider for tenant {tenant_id}")
            return {'error': 'No active Microsoft account connected'}


def ai_extract_order_data(email_body: str) -> Dict[str, Any]:
    """
    Stub for AI extraction of order data from email body.
    
    This will call PrompterService to identify order quantities and products.
    
    Args:
        email_body: Email body text
        
    Returns:
        Dict with extracted order data
    """
    # TODO: Implement AI extraction using PrompterService
    # For now, return empty dict
    return {
        'products': [],
        'quantities': {},
        'confidence': 0.0,
        'extraction_method': 'not_implemented'
    }
