"""
Email Order Ingestion Engine for Microsoft Graph.

Polls inboxes for order-related emails and creates EmailLog entries for AI processing.
"""
import logging
from datetime import timedelta
from typing import Any, Dict, List

import requests
from django.core.exceptions import SuspiciousFileOperation, ValidationError
from django.db import DatabaseError, transaction
from django.utils import timezone

from apps.integrations.models import ExternalAuthProvider, EmailLog
from apps.tenants.models import Tenant
from tenant_apps.ai_assistant.session_utils import (
    bind_attachment_allowlist,
    get_staged_attachment_status,
    session_matches_tenant,
)
from tenant_apps.ai_assistant.swarm.tools.microsoft_graph import (
    MAX_MAIL_LIMIT,
    ToolExecutionError,
    build_mail_request,
    classify_attachment_for_ai_ingest,
    decrypt_token_or_error,
    decryption_failed_payload,
    infer_content_type,
    post_filter_messages,
    serialize_graph_message,
    validate_graph_attachment_metadata,
)

logger = logging.getLogger(__name__)

MAX_AI_ATTACHMENT_BYTES = 25 * 1024 * 1024


class EmailIngestionService:
    """
    Service for ingesting emails from external providers.
    
    Multi-tenant aware - iterates through all active tenants with valid tokens.
    """
    
    # Keywords to identify order-related emails.
    # NOTE: Keep these fairly specific to avoid false positives.
    ORDER_KEYWORDS = [
        'purchase order',
        'sales order',
        'order confirmation',
        'order #',
        'invoice',
        'quote',
        'requisition',
        'req ',
        'po ',
        'po#',
        'p.o.',
        'p/o',
        'delivery',
        'shipment',
        'bol',
        'bill of lading',
        'packing list',
        'meat',
        'beef',
        'pork',
        'chicken',
    ]
    
    def __init__(
        self,
        tenant: Tenant | None = None,
        *,
        max_pages_attachments: int = 10,
        max_pages_all: int = 5,
        max_messages: int = 1500,
    ):
        # Optional tenant scope (Phase 6.5). When provided, the service can be used
        # as a single-tenant ingestion unit (e.g., smart triggers).
        self.tenant = tenant

        # Network/time safety:
        # - Manual "Sync Now" should be fast enough for an HTTP request.
        # - Scheduled/background polling can scan deeper.
        self.max_pages_attachments = max_pages_attachments
        self.max_pages_all = max_pages_all
        self.max_messages = max_messages

        self.stats = {
            'tenants_processed': 0,
            # Count of Graph messages scanned (before keyword/attachment filtering)
            'emails_scanned': 0,
            # Count of messages that matched our order heuristics
            'emails_matched': 0,
            # Count of messages returned from fetch stage (matched set)
            'emails_fetched': 0,
            'emails_saved': 0,
            'emails_skipped': 0,
            'errors': 0,
            'errors_detail': [],
            'last_cutoff': None,
        }

    @staticmethod
    def _build_attachment_source_metadata(
        *,
        message_id: str,
        attachment_id: str,
        attachment_metadata: Dict[str, Any],
        session: Any = None,
    ) -> Dict[str, Any]:
        metadata = {
            'source': 'microsoft_graph_attachment',
            'message_id': message_id,
            'attachment_id': attachment_id,
            'ingested_at': timezone.now().isoformat(),
        }
        if session is not None:
            metadata['session_id'] = str(getattr(session, 'id', '') or '')
        if attachment_metadata.get('name'):
            metadata['graph_name'] = str(attachment_metadata.get('name') or '').strip()
        if attachment_metadata.get('contentType'):
            metadata['graph_content_type'] = str(attachment_metadata.get('contentType') or '').strip()
        if attachment_metadata.get('size') is not None:
            metadata['graph_size'] = attachment_metadata.get('size')
        attachment_type = str(attachment_metadata.get('@odata.type') or '').strip()
        if attachment_type:
            metadata['graph_attachment_type'] = attachment_type
        return metadata

    def _get_existing_attachment_document(
        self,
        *,
        user: Any,
        session: Any = None,
        message_id: str,
        attachment_id: str,
    ):
        from tenant_apps.ai_assistant.models import AIDocument

        filters = {
            'tenant': self.tenant,
            'owner': user,
            'custom_data__source': 'microsoft_graph_attachment',
            'custom_data__message_id': message_id,
            'custom_data__attachment_id': attachment_id,
        }
        if session is None:
            filters['session__isnull'] = True
        else:
            filters['session'] = session

        return AIDocument.objects.filter(**filters).order_by('-created_on').first()
    
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
        
        # Refresh token if needed (never crash sync if refresh fails)
        if provider.is_token_expired():
            logger.info(f"Refreshing expired token for tenant {tenant.name}")
            try:
                provider.refresh_if_needed()
            except Exception as e:
                logger.warning(
                    'Token refresh failed tenant=%s provider_id=%s: %s',
                    tenant.id,
                    provider.id,
                    str(e),
                    exc_info=True,
                )
                self.stats['errors'] += 1
                self.stats.setdefault('errors_detail', []).append('Token refresh failed; reconnect Outlook if this persists.')

        # Get access token (decrypt errors must not bubble to API)
        try:
            access_token = provider.get_decrypted_token('access')
        except Exception as e:
            # Treat ANY decrypt failure as requiring a reconnect.
            # In practice we see InvalidToken (key mismatch) but other exceptions can occur
            # depending on config/state; the user action is the same.
            logger.error(
                'Failed to decrypt access token tenant=%s provider_id=%s: %s',
                tenant.id,
                provider.id,
                str(e),
                exc_info=True,
            )
            self.stats['errors'] += 1
            self.stats['error_code'] = 'decryption_failed'
            self.stats.setdefault('errors_detail', []).append(
                'DECRYPTION_FAILED: Your Outlook connection needs to be refreshed for security reasons.'
            )
            return

        if not access_token:
            logger.error(f"No access token for tenant {tenant.name}")
            self.stats['errors'] += 1
            self.stats.setdefault('errors_detail', []).append('No Microsoft access token available. Reconnect Outlook.')
            return
        
        # Initialize Microsoft Graph provider
        graph_provider = MicrosoftGraphProvider(tenant.id)

        # Validate token before claiming "no emails".
        try:
            if not graph_provider.validate_token(access_token):
                self.stats['errors'] += 1
                self.stats.setdefault('errors_detail', []).append('Microsoft token is invalid/expired. Reconnect Outlook to re-authorize Mail.ReadWrite.')
                return
        except Exception:
            # Don't fail the request, but ensure we don't silently report "no emails".
            self.stats['errors'] += 1
            self.stats.setdefault('errors_detail', []).append('Token validation failed. Outlook connection may be unhealthy.')
            return
        
        # Fetch recent emails (last 14 days)
        cutoff_date = timezone.now() - timedelta(days=14)
        self.stats['last_cutoff'] = cutoff_date.isoformat()

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
        
        # Format date for OData filter
        since_str = since.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # IMPORTANT: Microsoft Graph does not support complex contains() filters reliably across tenants.
        # We prefer simple, reliable server-side filters, then do keyword filtering locally in Python.
        #
        # Heuristic improvement:
        # - Many actionable order emails include attachments (POs, invoices, BOLs, packing lists).
        # - In busy mailboxes, scanning only the most recent N messages can miss order emails.
        #
        # So we do a two-pass scan:
        #  1) attachments-only (smaller set, higher signal)
        #  2) date-only fallback (for order emails without attachments)
        filter_query_attachments = f"receivedDateTime ge {since_str} and hasAttachments eq true"
        filter_query_all = f"receivedDateTime ge {since_str}"

        # Microsoft Graph API endpoint with filters.
        # NOTE: We intentionally use /me/messages (not just Inbox) because many orgs
        # auto-file order emails into subfolders.
        url = f"{provider.GRAPH_API_BASE}/me/messages"

        def _build_params(filter_query: str) -> Dict[str, Any]:
            return {
                '$filter': filter_query,
                '$select': 'id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,conversationId',
                '$top': 100,
                '$orderby': 'receivedDateTime desc',
            }

        params = _build_params(filter_query_attachments)
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            def _fetch_pages(initial_params: Dict[str, Any], max_pages: int) -> List[Dict[str, Any]]:
                all_messages: List[Dict[str, Any]] = []
                next_url = url
                next_params = initial_params
                page = 0

                while next_url and page < max_pages and len(all_messages) < self.max_messages:
                    response = requests.get(next_url, headers=headers, params=next_params, timeout=30)
                    response.raise_for_status()
                    data = response.json() or {}

                    batch = data.get('value', []) or []
                    all_messages.extend(batch)

                    next_url = data.get('@odata.nextLink')
                    next_params = None  # nextLink already contains query string
                    page += 1

                return all_messages

            # Pass 1: attachments-only (scan deeper; higher signal)
            scanned = _fetch_pages(params, max_pages=self.max_pages_attachments)

            # Pass 2: date-only fallback if we didn't scan much (helps mailboxes with few attachments)
            if len(scanned) < 100:
                scanned_ids = {m.get('id') for m in scanned if m.get('id')}
                scanned_all = _fetch_pages(_build_params(filter_query_all), max_pages=self.max_pages_all)
                for m in scanned_all:
                    mid = m.get('id')
                    if mid and mid in scanned_ids:
                        continue
                    scanned.append(m)

            self.stats['emails_scanned'] += len(scanned)

            # Local Python filtering (defensive against Graph filtering quirks)
            filtered_messages: List[Dict[str, Any]] = []
            for msg in scanned:
                subject = (msg.get('subject') or '').lower()
                body_preview = (msg.get('bodyPreview') or '').lower()
                has_attachments = bool(msg.get('hasAttachments', False))

                haystack = f"{subject}\n{body_preview}"

                is_order_related = any(kw in haystack for kw in self.ORDER_KEYWORDS)

                if is_order_related or has_attachments:
                    filtered_messages.append(msg)

            self.stats['emails_matched'] += len(filtered_messages)

            logger.info(
                'Graph scan complete: scanned=%s matched=%s (since=%s)',
                len(scanned),
                len(filtered_messages),
                since_str,
            )
            return filtered_messages
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch inbox messages: {str(e)}", exc_info=True)
            self.stats['errors'] += 1
            self.stats.setdefault('errors_detail', []).append(f'Graph fetch failed: {type(e).__name__}')
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
        if EmailLog.objects.filter(tenant=tenant, message_id=message_id).exists():
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
    
    def poll_provider_by_id(self, provider_id: int, *, tenant_id: str | None = None) -> Dict[str, int]:
        """Poll inbox for a specific ExternalAuthProvider.

        This is the unit of work used by the Phase 8.3 Celery fan-out.

        Note: Callers in Celery worker contexts must set tenant RLS session vars.
        Passing tenant_id provides additional defense-in-depth filtering.
        """
        qs = ExternalAuthProvider.objects.select_related('tenant').filter(id=provider_id, is_active=True)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        provider = qs.first()
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

    def fetch_unread_actionable_emails(self) -> List[Dict[str, Any]]:
        """Fetch unread actionable emails (unread + hasAttachments) for this service's tenant.

        Uses Microsoft Graph endpoint:
        /me/messages?$filter=isRead eq false and hasAttachments eq true

        Returns:
            List of results: {"message": <graph message>, "attachments": [...], "analysis": {...}}
        """
        if not self.tenant:
            raise ValueError('EmailIngestionService requires tenant for fetch_unread_actionable_emails')

        from apps.integrations.providers import MicrosoftGraphProvider
        import requests

        provider = (
            ExternalAuthProvider.objects.filter(
                tenant=self.tenant,
                provider_type='microsoft',
                is_active=True,
            )
            .select_related('tenant')
            .first()
        )
        if not provider:
            logger.info('No active Microsoft provider for tenant=%s', self.tenant.id)
            return []

        # Handle token expiration gracefully.
        try:
            provider.refresh_if_needed()
        except Exception:
            logger.warning('Token refresh failed for tenant=%s provider_id=%s', self.tenant.id, provider.id, exc_info=True)

        access_token = provider.get_decrypted_token('access')
        if not access_token:
            logger.warning('No access token available tenant=%s provider_id=%s', self.tenant.id, provider.id)
            return []

        graph_provider = MicrosoftGraphProvider(self.tenant.id)

        url = f"{graph_provider.GRAPH_API_BASE}/me/messages"
        params = {
            '$filter': 'isRead eq false and hasAttachments eq true',
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
            logger.error('Graph actionable unread fetch failed tenant=%s', self.tenant.id, exc_info=True)
            return []

        results: List[Dict[str, Any]] = []
        for msg in messages:
            attachments: List[Dict[str, Any]] = self._download_attachments(graph_provider, access_token, message_id=msg.get('id'))
            analysis = self.process_email_via_ai(msg, attachments)
            results.append({'message': msg, 'attachments': attachments, 'analysis': analysis})

        return results

    def fetch_emails_for_ai(
        self,
        *,
        folder: str | None = None,
        is_read: bool | None = None,
        has_attachments: bool | None = None,
        search_query: str | None = None,
        limit: int | None = None,
        user: Any = None,
        session_id: str | None = None,
    ) -> Dict[str, Any]:
        """Fetch a bounded, LLM-safe mail slice for the active tenant."""
        if not self.tenant:
            raise ToolExecutionError(
                error_code='TENANT_CONTEXT_MISSING',
                message='Tenant context is required before searching Outlook email.',
                hint='Retry from a tenant-scoped ProjectMeats session.',
                retryable=False,
            )

        provider = (
            ExternalAuthProvider.objects.filter(
                tenant=self.tenant,
                provider_type='microsoft',
                is_active=True,
            )
            .select_related('tenant')
            .first()
        )
        if not provider:
            raise ToolExecutionError(
                error_code='OUTLOOK_NOT_CONNECTED',
                message='Outlook is not connected for this tenant.',
                hint='Connect Outlook in Settings → Email Integrations before searching email.',
                retryable=False,
            )

        try:
            provider.refresh_if_needed()
        except Exception:
            logger.warning(
                'Token refresh failed for AI email search tenant=%s provider_id=%s',
                self.tenant.id,
                provider.id,
                exc_info=True,
            )

        if provider.is_token_expired():
            raise ToolExecutionError(
                error_code='OUTLOOK_CONNECTION_EXPIRED',
                message='Your Outlook connection has expired.',
                hint='Reconnect Outlook in Settings → Email Integrations.',
                retryable=False,
            )

        access_token, err = decrypt_token_or_error(provider_row=provider, token_type='access')
        if err:
            raise ToolExecutionError(
                error_code=err.get('error_code') or 'DECRYPTION_FAILED',
                message=err.get('message') or decryption_failed_payload()['message'],
                hint='Reconnect Outlook in Settings → Email Integrations.',
                retryable=False,
            )
        if not access_token:
            raise ToolExecutionError(
                error_code='OUTLOOK_ACCESS_TOKEN_MISSING',
                message='No Outlook access token is available for this tenant.',
                hint='Reconnect Outlook in Settings → Email Integrations.',
                retryable=False,
            )

        request_spec = build_mail_request(
            folder=folder,
            is_read=is_read,
            has_attachments=has_attachments,
            search_query=search_query,
            limit=limit,
        )

        from apps.integrations.providers import MicrosoftGraphProvider

        graph_provider = MicrosoftGraphProvider(self.tenant.id)
        results = self._fetch_graph_messages_for_ai(
            graph_provider=graph_provider,
            access_token=access_token,
            request_spec=request_spec,
            is_read=is_read,
            has_attachments=has_attachments,
        )
        if session_id:
            session = self._get_valid_session(user=user, session_id=session_id)
            staged_refs: list[dict[str, Any]] = []
            for message in results:
                message_id = str(message.get('id') or '').strip()
                for attachment in message.get('attachments') or []:
                    if not isinstance(attachment, dict):
                        continue
                    staged_refs.append(
                        {
                            'message_id': message_id,
                            'attachment_id': attachment.get('attachment_id'),
                            'name': attachment.get('name'),
                            'content_type': attachment.get('content_type'),
                            'size': attachment.get('size'),
                            'attachment_type': attachment.get('attachment_type'),
                        }
                    )
            updated_context = bind_attachment_allowlist(getattr(session, 'context_data', {}) or {}, staged_refs)
            if updated_context != (getattr(session, 'context_data', {}) or {}):
                session.context_data = updated_context
                session.save(update_fields=['context_data', 'modified_on'])

        return {
            'folder': request_spec['folder'],
            'limit': request_spec['limit'],
            'count': len(results),
            'filters': {
                'is_read': is_read,
                'has_attachments': has_attachments,
                'search_query': (str(search_query or '').strip() or None),
            },
            'messages': results,
        }

    def _get_valid_session(self, *, user: Any, session_id: str):
        if user is None:
            raise ValueError('Authenticated user context is required for session-bound email tools')

        from tenant_apps.ai_assistant.models import ChatSession

        session = ChatSession.objects.filter(id=session_id, owner=user).first()
        if not session:
            raise ValueError('Session not found')
        if not session_matches_tenant(session, self.tenant):
            raise ValueError('Session is not valid for this tenant')
        return session

    def ingest_email_attachment_for_ai(
        self,
        *,
        message_id: str,
        attachment_id: str,
        file_name: str,
        user: Any,
        session_id: str | None = None,
    ) -> Dict[str, Any]:
        """Download a Graph attachment and persist it as an AIDocument."""
        if not self.tenant:
            raise ToolExecutionError(
                error_code='TENANT_CONTEXT_MISSING',
                message='Tenant context is required before ingesting Outlook attachments.',
                hint='Retry from a tenant-scoped ProjectMeats session.',
                retryable=False,
            )

        message_id = str(message_id or '').strip()
        attachment_id = str(attachment_id or '').strip()
        file_name = str(file_name or '').strip()
        if not message_id or not attachment_id:
            raise ValueError('Missing required parameters: message_id, attachment_id')
        if user is None:
            raise ValueError('Authenticated user context is required for attachment ingestion')
        if not session_id:
            raise ToolExecutionError(
                error_code='SESSION_CONTEXT_REQUIRED',
                message='Outlook attachment ingest requires an active chat session.',
                hint='Use fetch_emails in the current AI chat first, then choose one of the returned attachments.',
                retryable=False,
            )

        provider = (
            ExternalAuthProvider.objects.filter(
                tenant=self.tenant,
                provider_type='microsoft',
                is_active=True,
            )
            .select_related('tenant')
            .first()
        )
        if not provider:
            raise ToolExecutionError(
                error_code='OUTLOOK_NOT_CONNECTED',
                message='Outlook is not connected for this tenant.',
                hint='Connect Outlook in Settings → Email Integrations before ingesting attachments.',
                retryable=False,
            )

        try:
            provider.refresh_if_needed()
        except Exception:
            logger.warning(
                'Token refresh failed for AI attachment ingest tenant=%s provider_id=%s',
                self.tenant.id,
                provider.id,
                exc_info=True,
            )

        if provider.is_token_expired():
            raise ToolExecutionError(
                error_code='OUTLOOK_CONNECTION_EXPIRED',
                message='Your Outlook connection has expired.',
                hint='Reconnect Outlook in Settings → Email Integrations.',
                retryable=False,
            )

        access_token, err = decrypt_token_or_error(provider_row=provider, token_type='access')
        if err:
            raise ToolExecutionError(
                error_code=err.get('error_code') or 'DECRYPTION_FAILED',
                message=err.get('message') or decryption_failed_payload()['message'],
                hint='Reconnect Outlook in Settings → Email Integrations.',
                retryable=False,
            )
        if not access_token:
            raise ToolExecutionError(
                error_code='OUTLOOK_ACCESS_TOKEN_MISSING',
                message='No Outlook access token is available for this tenant.',
                hint='Reconnect Outlook in Settings → Email Integrations.',
                retryable=False,
            )

        from apps.integrations.providers import MicrosoftGraphProvider
        from django.core.files.uploadedfile import SimpleUploadedFile
        from tenant_apps.ai_assistant.models import AIDocument, ChatMessage, ChatSession, MessageTypeChoices
        from tenant_apps.ai_assistant.services.document_parser import validate_ai_document_upload

        session = self._get_valid_session(user=user, session_id=session_id)
        stage_status, staged_attachment = get_staged_attachment_status(
            session,
            message_id=message_id,
            attachment_id=attachment_id,
        )
        if stage_status == 'expired':
            raise ToolExecutionError(
                error_code='ATTACHMENT_STAGE_EXPIRED',
                message='The selected Outlook attachment expired from the current AI session.',
                hint='Run fetch_emails again in this chat, then choose the attachment from the refreshed results.',
                retryable=False,
            )
        if stage_status != 'active' or staged_attachment is None:
            raise ToolExecutionError(
                error_code='ATTACHMENT_NOT_STAGED',
                message='That Outlook attachment is not staged for the current AI session.',
                hint='Use fetch_emails in this chat first, then ingest one of the returned attachments.',
                retryable=False,
            )

        staged_name = str(staged_attachment.get('name') or file_name).strip()
        staged_skip_reason = classify_attachment_for_ai_ingest(
            file_name=staged_name,
            content_type=staged_attachment.get('content_type'),
            is_inline=staged_attachment.get('is_inline'),
        )
        if staged_skip_reason:
            return {
                'status': 'skipped',
                'reason': staged_skip_reason,
                'message_id': message_id,
                'attachment_id': attachment_id,
                'file_name': staged_name or file_name,
            }

        existing_document = self._get_existing_attachment_document(
            user=user,
            session=session,
            message_id=message_id,
            attachment_id=attachment_id,
        )
        if existing_document is not None:
            return {
                'status': 'already_ingested',
                'document_id': str(existing_document.id),
                'message_id': message_id,
                'attachment_id': attachment_id,
                'file_name': existing_document.original_filename,
                'content_type': existing_document.content_type,
                'file_size': existing_document.file_size,
                'session_id': str(existing_document.session_id) if existing_document.session_id else None,
                'cache_hit': True,
                'source_metadata': dict(getattr(existing_document, 'custom_data', {}) or {}),
            }

        graph_provider = MicrosoftGraphProvider(self.tenant.id)
        metadata_url = (
            f"{graph_provider.GRAPH_API_BASE}/me/messages/{message_id}/attachments/{attachment_id}"
        )
        url = (
            f"{graph_provider.GRAPH_API_BASE}/me/messages/{message_id}/attachments/"
            f"{attachment_id}/$value"
        )
        metadata_headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
        }
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': '*/*',
        }

        try:
            metadata_response = requests.get(metadata_url, headers=metadata_headers, timeout=30)
            metadata_response.raise_for_status()
            attachment_metadata = metadata_response.json() or {}
            try:
                validate_graph_attachment_metadata(attachment_metadata)
            except ToolExecutionError as exc:
                if exc.error_code == 'UNSUPPORTED_ATTACHMENT_TYPE':
                    return {
                        'status': 'skipped',
                        'reason': exc.message,
                        'message_id': message_id,
                        'attachment_id': attachment_id,
                        'file_name': str(attachment_metadata.get('name') or staged_name or file_name).strip(),
                    }
                raise
        except requests.RequestException as exc:
            raise self._map_graph_exception(exc) from exc

        metadata_size = attachment_metadata.get('size')
        try:
            if metadata_size is not None and int(metadata_size) > MAX_AI_ATTACHMENT_BYTES:
                raise ToolExecutionError(
                    error_code='ATTACHMENT_TOO_LARGE',
                    message='The selected email attachment is too large to ingest safely.',
                    hint='Choose a smaller attachment or download it manually and upload it through the document UI.',
                    retryable=False,
                )
        except (TypeError, ValueError):
            metadata_size = None

        canonical_file_name = str(attachment_metadata.get('name') or staged_attachment.get('name') or file_name).strip()
        content_type = infer_content_type(
            file_name=canonical_file_name,
            fallback=attachment_metadata.get('contentType') or staged_attachment.get('content_type'),
        )
        metadata_skip_reason = classify_attachment_for_ai_ingest(
            file_name=canonical_file_name,
            content_type=attachment_metadata.get('contentType') or content_type,
            is_inline=attachment_metadata.get('isInline'),
        )
        if metadata_skip_reason:
            return {
                'status': 'skipped',
                'reason': metadata_skip_reason,
                'message_id': message_id,
                'attachment_id': attachment_id,
                'file_name': canonical_file_name,
            }
        try:
            validate_ai_document_upload(filename=canonical_file_name, content_type=content_type)
        except ValueError as exc:
            return {
                'status': 'skipped',
                'reason': str(exc),
                'message_id': message_id,
                'attachment_id': attachment_id,
                'file_name': canonical_file_name,
            }

        try:
            response = requests.get(url, headers=headers, timeout=30, stream=True)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise self._map_graph_exception(exc) from exc

        header_size = response.headers.get('Content-Length')
        if header_size:
            try:
                if int(header_size) > MAX_AI_ATTACHMENT_BYTES:
                    raise ToolExecutionError(
                        error_code='ATTACHMENT_TOO_LARGE',
                        message='The selected email attachment is too large to ingest safely.',
                        hint='Choose a smaller attachment or download it manually and upload it through the document UI.',
                        retryable=False,
                    )
            except ValueError:
                pass

        content = bytearray()
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if not chunk:
                continue
            content.extend(chunk)
            if len(content) > MAX_AI_ATTACHMENT_BYTES:
                raise ToolExecutionError(
                    error_code='ATTACHMENT_TOO_LARGE',
                    message='The selected email attachment is too large to ingest safely.',
                    hint='Choose a smaller attachment or download it manually and upload it through the document UI.',
                    retryable=False,
                )

        upload = SimpleUploadedFile(
            canonical_file_name,
            bytes(content),
            content_type=content_type,
        )
        source_metadata = self._build_attachment_source_metadata(
            message_id=message_id,
            attachment_id=attachment_id,
            attachment_metadata=attachment_metadata,
            session=session,
        )

        try:
            with transaction.atomic():
                document = AIDocument.objects.create(
                    tenant=self.tenant,
                    owner=user,
                    session=session,
                    file=upload,
                    original_filename=canonical_file_name,
                    content_type=content_type,
                    file_size=len(content),
                    custom_data=source_metadata,
                )
        except (DatabaseError, OSError, SuspiciousFileOperation, ValidationError, ValueError) as exc:
            logger.warning(
                'Graph attachment ingest: failed to persist attachment tenant=%s message=%s attachment=%s file=%s err=%s',
                self.tenant.id,
                message_id,
                attachment_id,
                canonical_file_name,
                str(exc),
                exc_info=True,
            )
            return {
                'status': 'failed',
                'reason': str(exc),
                'message_id': message_id,
                'attachment_id': attachment_id,
                'file_name': canonical_file_name,
            }

        if session:
            try:
                ChatMessage.objects.create(
                    session=session,
                    message_type=MessageTypeChoices.DOCUMENT,
                    content=document.original_filename or 'Document uploaded',
                    metadata={
                        'document_id': str(document.id),
                        'original_filename': document.original_filename,
                        'file_url': getattr(document.file, 'url', ''),
                        'content_type': document.content_type,
                        'file_size': document.file_size,
                        'source': 'microsoft_graph_attachment',
                        'message_id': message_id,
                        'attachment_id': attachment_id,
                        'source_metadata': source_metadata,
                    },
                    owner=user,
                    created_by=user,
                    modified_by=user,
                )
            except Exception:
                logger.warning(
                    'Graph attachment ingest: failed to create session document message document=%s session=%s',
                    document.id,
                    session.id,
                    exc_info=True,
                )

        try:
            from tenant_apps.ai_assistant.services.semantic_indexing import index_document_for_semantic_search

            index_document_for_semantic_search(document)
        except Exception as exc:
            logger.warning(
                'AIDocument graph attachment ingest: semantic indexing skipped for document=%s err=%s',
                document.id,
                str(exc),
                exc_info=True,
            )

        return {
            'status': 'success',
            'document_id': str(document.id),
            'message_id': message_id,
            'attachment_id': attachment_id,
            'file_name': document.original_filename,
            'content_type': document.content_type,
            'file_size': document.file_size,
            'session_id': str(document.session_id) if document.session_id else None,
            'cache_hit': False,
            'source_metadata': source_metadata,
        }

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

    def _fetch_graph_messages_for_ai(
        self,
        *,
        graph_provider,
        access_token: str,
        request_spec: Dict[str, Any],
        is_read: bool | None,
        has_attachments: bool | None,
    ) -> List[Dict[str, Any]]:
        url = f"{graph_provider.GRAPH_API_BASE}{request_spec['url_path']}"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
            **request_spec.get('headers', {}),
        }
        max_pages = 1

        try:
            messages = self._collect_graph_messages(
                url=url,
                headers=headers,
                params=request_spec['params'],
                limit=request_spec['limit'],
                max_pages=max_pages,
            )
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code == 400 and request_spec.get('requires_filter_fallback'):
                fallback_params = {
                    key: value for key, value in request_spec['params'].items() if key != '$filter'
                }
                fallback_params['$top'] = 25
                messages = self._collect_graph_messages(
                    url=url,
                    headers=headers,
                    params=fallback_params,
                    limit=MAX_MAIL_LIMIT,
                    max_pages=max_pages,
                )
                messages = post_filter_messages(
                    messages,
                    is_read=is_read,
                    has_attachments=has_attachments,
                )
            else:
                raise self._map_graph_exception(exc) from exc
        except requests.RequestException as exc:
            raise self._map_graph_exception(exc) from exc

        messages = sorted(
            messages,
            key=lambda row: str(row.get('receivedDateTime') or ''),
            reverse=True,
        )

        return [
            serialize_graph_message(message, folder=request_spec['folder'])
            for message in messages[: request_spec['limit']]
        ]

    def _collect_graph_messages(
        self,
        *,
        url: str,
        headers: Dict[str, str],
        params: Dict[str, Any] | None,
        limit: int,
        max_pages: int,
    ) -> List[Dict[str, Any]]:
        all_messages: List[Dict[str, Any]] = []
        next_url = url
        next_params = params
        page = 0

        while next_url and page < max_pages and len(all_messages) < limit:
            response = requests.get(next_url, headers=headers, params=next_params, timeout=30)
            response.raise_for_status()
            data = response.json() or {}

            batch = data.get('value', []) or []
            all_messages.extend(batch)

            next_url = data.get('@odata.nextLink')
            next_params = None
            page += 1

        return all_messages[:limit]

    def _map_graph_exception(self, exc: requests.RequestException) -> ToolExecutionError:
        if isinstance(exc, requests.Timeout):
            return ToolExecutionError(
                error_code='GRAPH_TIMEOUT',
                message='Microsoft Graph timed out while searching email.',
                hint='Try a smaller search query or a narrower folder.',
                retryable=True,
            )

        if isinstance(exc, requests.HTTPError):
            response = exc.response
            status_code = response.status_code if response is not None else None
            response_text = ''
            if response is not None:
                response_text = (response.text or '').strip()[:400]

            if status_code == 400:
                return ToolExecutionError(
                    error_code='GRAPH_QUERY_REJECTED',
                    message='Microsoft Graph rejected the email search query format.',
                    hint='Try simplifying your search terms or reducing the number of filters.',
                    retryable=False,
                    details=response_text or None,
                )
            if status_code == 404:
                return ToolExecutionError(
                    error_code='GRAPH_ATTACHMENT_NOT_FOUND',
                    message='The selected Outlook attachment could not be found.',
                    hint='Refresh the email search results and choose the attachment again.',
                    retryable=False,
                    details=response_text or None,
                )
            if status_code in {401, 403}:
                return ToolExecutionError(
                    error_code='GRAPH_AUTH_FAILED',
                    message='Microsoft Graph rejected the current Outlook credentials.',
                    hint='Reconnect Outlook in Settings → Email Integrations.',
                    retryable=False,
                    details=response_text or None,
                )

            return ToolExecutionError(
                error_code='GRAPH_HTTP_ERROR',
                message='Microsoft Graph returned an unexpected email search error.',
                hint='Try simplifying the email request or ask the user for clarification.',
                retryable=False,
                details=response_text or None,
            )

        return ToolExecutionError(
            error_code='GRAPH_REQUEST_FAILED',
            message='Microsoft Graph email search failed before returning results.',
            hint='Try a simpler request or ask the user to reconnect Outlook if the problem persists.',
            retryable=False,
            details=str(exc),
        )

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
        """Hand-off point: email payload -> OpenAI IntentEngine.

        Production-ready behavior:
        - The IntentEngine handles attachment text extraction (soft dependencies).
        - Uses tenant-scoped AIConfiguration when available.
        - Returns JSON suitable for TriggerType.EMAIL_RECEIVED routing.
        """
        from tenant_apps.workflows.services.intent_engine import IntentEngine

        tenant = self.tenant
        subject = email_data.get('subject')
        sender = (email_data.get('from') or {}).get('emailAddress', {}).get('address')

        body = email_data.get('body') or {}
        body_content = body.get('content') or email_data.get('bodyPreview') or ''

        engine = IntentEngine(tenant=tenant)
        return engine.analyze_document(email_body=body_content, attachments=attachments, subject=subject, sender_email=sender)


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
