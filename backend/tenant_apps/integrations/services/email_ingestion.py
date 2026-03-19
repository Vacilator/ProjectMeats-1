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
    
    def poll_provider_by_id(self, provider_id: int) -> Dict[str, int]:
        """Poll inbox for a specific ExternalAuthProvider.

        This is the unit of work used by the Phase 8.3 Celery fan-out.
        """
        provider = (
            ExternalAuthProvider.objects.select_related('tenant')
            .filter(id=provider_id, is_active=True)
            .first()
        )
        if not provider:
            logger.error('No active provider found for id=%s', provider_id)
            return {'error': 'Provider not found or inactive'}

        try:
            self._poll_tenant_inbox(provider)
            self.stats['tenants_processed'] = 1

            # Backward compatible aliases
            return {
                **self.stats,
                'tenant_id': str(provider.tenant_id),
                'provider_id': provider_id,
                'total_emails_fetched': self.stats.get('emails_fetched', 0),
                'total_emails_saved': self.stats.get('emails_saved', 0),
                'total_errors': self.stats.get('errors', 0),
            }
        except Exception as e:
            logger.error('Provider polling failed provider_id=%s: %s', provider_id, str(e), exc_info=True)
            self.stats['errors'] += 1
            return {
                **self.stats,
                'tenant_id': str(provider.tenant_id),
                'provider_id': provider_id,
                'error': str(e),
            }

    def poll_tenant_by_id(self, tenant_id: str) -> Dict[str, int]:
        """
        Poll inbox for a specific tenant (manual sync).
        
        Args:
            tenant_id: Tenant UUID to poll
            
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

    # -------------------------------------------------------------------------
    # Phase 6.5: AI Document Understanding + Smart Email Triggers (Scaffolding)
    # -------------------------------------------------------------------------

    def fetch_unread_emails(self, tenant: Tenant) -> List[Dict[str, Any]]:
        """Fetch unread emails (and attachments) for a tenant via Microsoft Graph.

        This is intentionally "scaffolding" code:
        - Focuses on correctness + clear hand-off boundaries.
        - Uses the existing ExternalAuthProvider token store (encrypted at rest).
        - Keeps all behavior additive (does not replace the Phase 8.3 ingestion pipeline).

        Returns:
            A list of dicts: {"message": <graph message>, "attachments": [ ... ]}
        """
        from apps.integrations.providers import MicrosoftGraphProvider
        import requests

        provider = (
            ExternalAuthProvider.objects.filter(
                tenant=tenant,
                provider_type='microsoft',
                is_active=True,
            )
            .select_related('tenant')
            .first()
        )
        if not provider:
            logger.info('No active Microsoft provider for tenant=%s', tenant.id)
            return []

        # Ensure a valid access token.
        try:
            provider.refresh_if_needed()
        except Exception:
            logger.warning('Token refresh failed for tenant=%s provider_id=%s', tenant.id, provider.id, exc_info=True)

        access_token = provider.get_decrypted_token('access')
        if not access_token:
            logger.warning('No access token available tenant=%s provider_id=%s', tenant.id, provider.id)
            return []

        graph_provider = MicrosoftGraphProvider(tenant.id)

        url = f"{graph_provider.GRAPH_API_BASE}/me/mailFolders/inbox/messages"
        params = {
            '$filter': 'isRead eq false',
            '$select': 'id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,conversationId,isRead',
            '$top': 25,
            '$orderby': 'receivedDateTime desc',
        }
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            messages = (resp.json() or {}).get('value', [])
        except Exception:
            logger.error('Graph unread fetch failed tenant=%s', tenant.id, exc_info=True)
            return []

        results: List[Dict[str, Any]] = []
        for msg in messages:
            attachments: List[Dict[str, Any]] = []
            if msg.get('hasAttachments'):
                attachments = self._download_attachments(graph_provider, access_token, message_id=msg.get('id'))
            results.append({'message': msg, 'attachments': attachments})

        return results

    def _download_attachments(self, graph_provider, access_token: str, message_id: str | None) -> List[Dict[str, Any]]:
        """Download attachments for a Graph message.

        Notes:
        - For fileAttachment, Graph may include `contentBytes` (base64). Large files may require `/$value`.
        - For Phase 6.5 scaffolding, we decode `contentBytes` when present.
        """
        if not message_id:
            return []

        import base64
        import requests

        url = f"{graph_provider.GRAPH_API_BASE}/me/messages/{message_id}/attachments"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
        }

        try:
            resp = requests.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            items = (resp.json() or {}).get('value', [])
        except Exception:
            logger.warning('Graph attachments fetch failed message_id=%s', message_id, exc_info=True)
            return []

        downloaded: List[Dict[str, Any]] = []
        for att in items:
            odata_type = att.get('@odata.type', '')
            name = att.get('name')
            content_type = att.get('contentType')
            size = att.get('size')

            content_bytes_b64 = att.get('contentBytes')
            content_bytes: bytes | None = None
            if content_bytes_b64 and 'fileAttachment' in odata_type:
                try:
                    content_bytes = base64.b64decode(content_bytes_b64)
                except Exception:
                    content_bytes = None

            downloaded.append(
                {
                    'id': att.get('id'),
                    'name': name,
                    'content_type': content_type,
                    'size': size,
                    'odata_type': odata_type,
                    'content_bytes': content_bytes,  # bytes (may be None)
                }
            )

        return downloaded

    def process_email_via_ai(self, email_data: Dict[str, Any], attachments: List[Dict[str, Any]]):
        """Hand-off point: email payload -> AI intent engine.

        This method intentionally does NOT persist anything yet.
        It produces a structured intent payload that downstream code can use to:
        - trigger workflows (TriggerType.EMAIL_RECEIVED)
        - create records (PO, invoice, claim intake)
        - route for human review
        """
        from tenant_apps.workflows.services.intent_engine import analyze_document_intent

        subject = email_data.get('subject')
        sender = (email_data.get('from') or {}).get('emailAddress', {}).get('address')

        body = email_data.get('body') or {}
        body_content = body.get('content') or email_data.get('bodyPreview') or ''

        # Scaffolding: only attempt text extraction for text/* attachments.
        attachment_text_chunks: List[str] = []
        for att in attachments or []:
            ct = (att.get('content_type') or '').lower()
            raw = att.get('content_bytes')
            if not raw or not ct.startswith('text/'):
                continue
            try:
                attachment_text_chunks.append(raw.decode('utf-8', errors='ignore'))
            except Exception:
                continue

        attachment_text = "\n\n".join(attachment_text_chunks)

        return analyze_document_intent(
            email_body=body_content,
            attachment_text=attachment_text,
            subject=subject,
            sender_email=sender,
        )


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
