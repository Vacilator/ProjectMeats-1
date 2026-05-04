"""
Email Webhook Views

Handles webhook subscriptions and notifications from Outlook (MS Graph) and Gmail (Pub/Sub).
Processes real-time email events for workflow triggers.

Created: 2026-02-26 - Email Webhooks Implementation
"""

import base64
import hashlib
import json
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.email_integration.models import EmailAccount, EmailLog

logger = logging.getLogger(__name__)


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _create_outlook_client_state() -> str:
    """Create an unpredictable clientState for Microsoft Graph webhook subscriptions."""

    return secrets.token_urlsafe(32)


def _get_outlook_account_for_notification(
    *,
    subscription_id: str,
    client_state: str,
    tenant=None,
) -> EmailAccount | None:
    """Verify Outlook notification authenticity and route to EmailAccount.

    We bind notifications to an EmailAccount by subscriptionId (stored as webhook_id)
    and verify clientState against the stored SHA256 hash.
    """

    if not subscription_id or not client_state:
        return None

    qs = EmailAccount.objects.filter(provider='outlook', webhook_id=subscription_id)
    if tenant is not None:
        qs = qs.filter(tenant=tenant)

    email_account = qs.first()
    if not email_account or not getattr(email_account, 'webhook_client_state_hash', ''):
        return None

    supplied_hash = _sha256_hex(client_state)
    if not secrets.compare_digest(email_account.webhook_client_state_hash, supplied_hash):
        return None

    return email_account


def _is_valid_gmail_pubsub_push(request) -> bool:
    """Validate Pub/Sub push notification authenticity.

    Supports either:
    - Query-string token: GMAIL_PUBSUB_VERIFICATION_TOKEN (recommended for simple setups)
    - Google-signed OIDC JWT in Authorization header: GOOGLE_PUBSUB_AUDIENCE

    If neither is configured, processing is disabled (fail-closed).
    """

    expected_token = getattr(settings, 'GMAIL_PUBSUB_VERIFICATION_TOKEN', None)
    if expected_token:
        supplied = request.GET.get('token') or ''
        return secrets.compare_digest(supplied, expected_token)

    audience = getattr(settings, 'GOOGLE_PUBSUB_AUDIENCE', None)
    if audience:
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if auth.startswith('Bearer '):
            jwt = auth.split(' ', 1)[1].strip()
            try:
                from google.auth.transport import requests as google_requests
                from google.oauth2 import id_token

                id_info = id_token.verify_oauth2_token(jwt, google_requests.Request(), audience=audience)
                issuer = id_info.get('iss')
                return issuer in ('accounts.google.com', 'https://accounts.google.com')
            except Exception:
                return False
        return False

    logger.error('Gmail webhook verification not configured; set GMAIL_PUBSUB_VERIFICATION_TOKEN or GOOGLE_PUBSUB_AUDIENCE')
    return False


def _set_webhook_tenant_context(request, *, tenant_id):
    from apps.tenants.models import Tenant
    from apps.tenants.rls import set_current_tenant

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return None

    django_request = getattr(request, '_request', request)

    # Ensure tenant context is available on both DRF Request and the underlying HttpRequest
    # (important when calling wrapped api_view handlers).
    request.tenant = tenant
    django_request.tenant = tenant

    set_current_tenant(str(tenant.id))

    request._rls_set = True
    django_request._rls_set = True

    return tenant


def _get_outlook_access_token(email_account: EmailAccount) -> str:
    access_token = email_account.get_valid_access_token()
    if access_token:
        return access_token
    raise ValueError('Access token expired. Please reconnect your Outlook account.')


def _build_gmail_credentials(email_account: EmailAccount):
    creds = email_account.build_google_credentials()
    if creds is None:
        raise ValueError('Access token missing. Please reconnect your Gmail account.')
    return creds


# ============================================================================
# Microsoft Graph Webhook Management
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def outlook_webhook_subscribe(request, account_id):
    """
    Create Microsoft Graph webhook subscription for an email account.
    
    Subscription will notify us of new emails, sent items, and other events.
    Max duration: 4230 minutes (~3 days), must renew before expiration.
    """
    import requests

    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'tenant_required', 'detail': 'Tenant context is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_account = EmailAccount.objects.get(
            id=account_id,
            tenant=tenant,
            user=request.user,
            provider='outlook',
        )
        
        try:
            access_token = _get_outlook_access_token(email_account)
        except ValueError as exc:
            return Response(
                {'error': 'Access token expired', 'detail': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        # Microsoft Graph subscription endpoint
        graph_url = 'https://graph.microsoft.com/v1.0/subscriptions'
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        client_state = _create_outlook_client_state()

        # Webhook notification URL (must be HTTPS with valid cert)
        notification_url = request.build_absolute_uri(
            reverse(
                'tenant-outlook-email-webhook-notifications',
                kwargs={'tenant_id': tenant.id},
            )
        )

        # Subscribe to mailbox changes
        subscription_data = {
            'changeType': 'created,updated',
            'notificationUrl': notification_url,
            'resource': '/me/mailFolders/inbox/messages',
            'expirationDateTime': (timezone.now() + timedelta(days=3)).isoformat(),
            'clientState': client_state,
        }
        
        response = requests.post(
            graph_url,
            headers=headers,
            json=subscription_data,
            timeout=10
        )
        
        if response.status_code == 201:
            subscription = response.json()
            
            # Update email account with webhook details
            email_account.webhook_id = subscription['id']
            email_account.webhook_expires_at = timezone.datetime.fromisoformat(
                subscription['expirationDateTime'].replace('Z', '+00:00')
            )
            email_account.webhook_client_state_hash = _sha256_hex(client_state)
            email_account.save(update_fields=['webhook_id', 'webhook_expires_at', 'webhook_client_state_hash'])
            
            logger.info(f"Created Outlook webhook subscription: {subscription['id']}")
            
            return Response({
                'success': True,
                'subscription_id': subscription['id'],
                'expires_at': subscription['expirationDateTime'],
                'message': 'Webhook subscription created successfully'
            })
        else:
            logger.error(f"Failed to create Outlook subscription: {response.status_code} - {response.text}")
            return Response({
                'error': 'Failed to create subscription',
                'detail': response.text
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    except EmailAccount.DoesNotExist:
        return Response({
            'error': 'Email account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Outlook webhook subscribe error: {str(e)}", exc_info=True)
        return Response({
            'error': 'Internal server error',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def outlook_webhook_renew(request, account_id):
    """
    Renew Microsoft Graph webhook subscription before expiration.
    """
    import requests

    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'tenant_required', 'detail': 'Tenant context is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_account = EmailAccount.objects.get(
            id=account_id,
            tenant=tenant,
            user=request.user,
            provider='outlook',
        )
        
        try:
            access_token = _get_outlook_access_token(email_account)
        except ValueError as exc:
            return Response(
                {'error': 'Access token expired', 'detail': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not email_account.webhook_id:
            return Response({
                'error': 'No active subscription',
                'detail': 'Create a subscription first'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Renew subscription
        graph_url = f'https://graph.microsoft.com/v1.0/subscriptions/{email_account.webhook_id}'
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        renewal_data = {
            'expirationDateTime': (timezone.now() + timedelta(days=3)).isoformat()
        }
        
        response = requests.patch(
            graph_url,
            headers=headers,
            json=renewal_data,
            timeout=10
        )
        
        if response.status_code == 200:
            subscription = response.json()
            
            email_account.webhook_expires_at = timezone.datetime.fromisoformat(
                subscription['expirationDateTime'].replace('Z', '+00:00')
            )
            email_account.save(update_fields=['webhook_expires_at'])
            
            logger.info(f"Renewed Outlook webhook subscription: {email_account.webhook_id}")
            
            return Response({
                'success': True,
                'expires_at': subscription['expirationDateTime'],
                'message': 'Webhook subscription renewed successfully'
            })
        else:
            logger.error(f"Failed to renew Outlook subscription: {response.status_code} - {response.text}")
            return Response({
                'error': 'Failed to renew subscription',
                'detail': response.text
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    except EmailAccount.DoesNotExist:
        return Response({
            'error': 'Email account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Outlook webhook renew error: {str(e)}", exc_info=True)
        return Response({
            'error': 'Internal server error',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def outlook_webhook_unsubscribe(request, account_id):
    """
    Delete Microsoft Graph webhook subscription.
    """
    import requests

    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'tenant_required', 'detail': 'Tenant context is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_account = EmailAccount.objects.get(
            id=account_id,
            tenant=tenant,
            user=request.user,
            provider='outlook',
        )
        
        if not email_account.webhook_id:
            return Response({
                'success': True,
                'message': 'No active subscription to delete'
            })
        
        try:
            access_token = _get_outlook_access_token(email_account)
        except ValueError as exc:
            return Response(
                {'error': 'Access token expired', 'detail': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Delete subscription
        graph_url = f'https://graph.microsoft.com/v1.0/subscriptions/{email_account.webhook_id}'
        
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.delete(
            graph_url,
            headers=headers,
            timeout=10
        )
        
        if response.status_code in [204, 404]:
            # Clear webhook fields
            email_account.webhook_id = ''
            email_account.webhook_expires_at = None
            email_account.webhook_client_state_hash = ''
            email_account.save(update_fields=['webhook_id', 'webhook_expires_at', 'webhook_client_state_hash'])
            
            logger.info(f"Deleted Outlook webhook subscription for account {account_id}")
            
            return Response({
                'success': True,
                'message': 'Webhook subscription deleted successfully'
            })
        else:
            logger.error(f"Failed to delete Outlook subscription: {response.status_code} - {response.text}")
            return Response({
                'error': 'Failed to delete subscription',
                'detail': response.text
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    except EmailAccount.DoesNotExist:
        return Response({
            'error': 'Email account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Outlook webhook unsubscribe error: {str(e)}", exc_info=True)
        return Response({
            'error': 'Internal server error',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# Microsoft Graph Webhook Notification Handler
# ============================================================================

@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def outlook_webhook_notifications(request):
    """
    Handle webhook notifications from Microsoft Graph.
    
    Validates requests and processes email events.
    Supports validation token handshake and change notifications.
    """
    # Validation handshake (initial subscription verification)
    validation_token = request.GET.get('validationToken')
    if validation_token:
        logger.info("Outlook webhook validation request received")
        return HttpResponse(validation_token, content_type='text/plain')
    
    try:
        # Parse notification payload
        payload = json.loads(request.body)
        
        if 'value' not in payload:
            logger.warning("Invalid Outlook webhook payload: missing 'value'")
            return HttpResponse(status=400)
        
        notifications = payload['value']
        
        for notification in notifications:
            client_state = (notification.get('clientState') or '').strip()
            subscription_id = (notification.get('subscriptionId') or '').strip()
            resource = notification.get('resource')
            change_type = notification.get('changeType')

            logger.info(f"Outlook notification: {change_type} on {resource}")

            email_account = _get_outlook_account_for_notification(
                subscription_id=subscription_id,
                client_state=client_state,
                tenant=getattr(request, 'tenant', None),
            )
            if not email_account:
                logger.warning('Ignoring Outlook notification: invalid subscription/clientState')
                continue

            # Process the notification
            process_outlook_notification(
                email_account=email_account,
                resource=resource,
                change_type=change_type,
                notification_data=notification,
            )
        
        return HttpResponse(status=202)  # Accepted
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON in Outlook webhook notification")
        return HttpResponse(status=400)
    
    except Exception as e:
        logger.error(f"Outlook webhook notification error: {str(e)}", exc_info=True)
        return HttpResponse(status=500)


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def tenant_outlook_webhook_notifications(request, tenant_id):
    tenant = _set_webhook_tenant_context(request, tenant_id=tenant_id)
    if not tenant:
        return HttpResponse(status=404)

    return outlook_webhook_notifications(getattr(request, '_request', request))


def process_outlook_notification(*, email_account: EmailAccount, resource, change_type, notification_data):
    """Process a single Outlook webhook notification.

    Note: the caller is responsible for verifying the webhook and setting tenant/RLS
    context before invoking this function.
    """

    import requests

    try:
        # Fetch the actual email message details
        # Resource format: /me/mailFolders/inbox/messages/{message_id}
        if 'messages/' in resource:
            message_id = resource.split('messages/')[-1]

            access_token = email_account.get_valid_access_token()
            if not access_token:
                logger.warning(
                    'Skipping Outlook webhook message fetch: no valid token for account=%s',
                    email_account.id,
                )
                return

            headers = {
                'Authorization': f'Bearer {access_token}',
            }

            message_url = f'https://graph.microsoft.com/v1.0/me/messages/{message_id}'
            response = requests.get(message_url, headers=headers, timeout=10)

            if response.status_code == 200:
                message_data = response.json()

                # Log the webhook event (raw email payload stored for debugging)
                EmailLog.objects.create(
                    email_account=email_account,
                    tenant=email_account.tenant,
                    log_type='webhook',
                    workflow_node_id='',
                    subject=message_data.get('subject', ''),
                    from_address=message_data.get('from', {}).get('emailAddress', {}).get('address', ''),
                    to_address=', '.join(
                        [
                            addr.get('emailAddress', {}).get('address', '')
                            for addr in message_data.get('toRecipients', [])
                            if addr.get('emailAddress', {}).get('address')
                        ]
                    ),
                    success=True,
                    raw_data={
                        'change_type': change_type,
                        'resource': resource,
                        'message_id': message_data.get('id'),
                        'message': message_data,
                        'notification': notification_data,
                        'subscription_id': notification_data.get('subscriptionId'),
                    },
                )

                # TODO: Trigger EmailTrigger workflow nodes
                # This will be implemented in the workflow execution service

                logger.info(f"Processed Outlook email: {message_data.get('subject')}")

    except Exception as e:
        logger.error(f"Failed to process Outlook notification: {str(e)}", exc_info=True)


# ============================================================================
# Gmail Pub/Sub Webhook Management
# ============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gmail_webhook_subscribe(request, account_id):
    """
    Set up Gmail Pub/Sub watch for push notifications.

    Gmail uses Google Cloud Pub/Sub for webhooks.
    Requires: GCP project with Gmail API + Pub/Sub enabled.
    """
    from googleapiclient.discovery import build

    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'tenant_required', 'detail': 'Tenant context is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_account = EmailAccount.objects.get(
            id=account_id,
            tenant=tenant,
            user=request.user,
            provider='gmail',
        )
        
        # Create credentials object
        try:
            creds = _build_gmail_credentials(email_account)
        except ValueError as exc:
            return Response(
                {'error': 'Access token expired', 'detail': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        # Build Gmail API service
        service = build('gmail', 'v1', credentials=creds)
        
        topic_name = getattr(settings, 'GMAIL_PUBSUB_TOPIC', None)
        if not topic_name:
            return Response(
                {
                    'error': 'not_configured',
                    'detail': 'GMAIL_PUBSUB_TOPIC is required to enable Gmail watch subscriptions.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Create watch request
        request_body = {
            'topicName': topic_name,  # e.g., 'projects/my-project/topics/gmail-push'
            'labelIds': ['INBOX'],  # Watch inbox only
            'labelFilterAction': 'include',
        }
        
        watch_response = service.users().watch(
            userId='me',
            body=request_body
        ).execute()
        
        # Update email account with watch details
        email_account.webhook_id = watch_response['historyId']
        email_account.webhook_expires_at = timezone.now() + timedelta(days=7)  # Gmail watch expires in 7 days
        email_account.save(update_fields=['webhook_id', 'webhook_expires_at'])
        
        logger.info(f"Created Gmail watch: historyId={watch_response['historyId']}")
        
        return Response({
            'success': True,
            'history_id': watch_response['historyId'],
            'expiration': watch_response.get('expiration'),
            'message': 'Gmail watch created successfully'
        })
    
    except EmailAccount.DoesNotExist:
        return Response({
            'error': 'Email account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Gmail webhook subscribe error: {str(e)}", exc_info=True)
        return Response({
            'error': 'Internal server error',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gmail_webhook_renew(request, account_id):
    """
    Renew Gmail Pub/Sub watch (must renew before 7-day expiration).
    """
    # Gmail watch renewal is the same as creating a new watch
    return gmail_webhook_subscribe(request, account_id)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def gmail_webhook_unsubscribe(request, account_id):
    """
    Stop Gmail Pub/Sub watch.
    """
    from googleapiclient.discovery import build

    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'tenant_required', 'detail': 'Tenant context is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email_account = EmailAccount.objects.get(
            id=account_id,
            tenant=tenant,
            user=request.user,
            provider='gmail',
        )
        
        # Create credentials
        try:
            creds = _build_gmail_credentials(email_account)
        except ValueError as exc:
            return Response(
                {'error': 'Access token expired', 'detail': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        
        # Build Gmail API service
        service = build('gmail', 'v1', credentials=creds)
        
        # Stop watch
        service.users().stop(userId='me').execute()
        
        # Clear webhook fields
        email_account.webhook_id = ''
        email_account.webhook_expires_at = None
        email_account.save(update_fields=['webhook_id', 'webhook_expires_at'])
        
        logger.info(f"Stopped Gmail watch for account {account_id}")
        
        return Response({
            'success': True,
            'message': 'Gmail watch stopped successfully'
        })
    
    except EmailAccount.DoesNotExist:
        return Response({
            'error': 'Email account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        logger.error(f"Gmail webhook unsubscribe error: {str(e)}", exc_info=True)
        return Response({
            'error': 'Internal server error',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# Gmail Pub/Sub Notification Handler
# ============================================================================

@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def gmail_webhook_notifications(request):
    """
    Handle Pub/Sub push notifications from Gmail.
    
    Format: Base64-encoded JSON with historyId and emailAddress.
    """

    if not _is_valid_gmail_pubsub_push(request):
        logger.warning('Ignoring Gmail webhook notification: invalid verification')
        return HttpResponse(status=200)

    try:
        # Parse Pub/Sub message
        payload = json.loads(request.body)
        
        if 'message' not in payload:
            logger.warning("Invalid Gmail webhook payload: missing 'message'")
            return HttpResponse(status=400)
        
        # Decode base64 message data
        message_data = payload['message']['data']
        decoded_data = base64.b64decode(message_data).decode('utf-8')
        notification = json.loads(decoded_data)
        
        email_address = notification.get('emailAddress')
        history_id = notification.get('historyId')
        
        logger.info(f"Gmail notification: historyId={history_id}, email={email_address}")
        
        # Process the notification
        process_gmail_notification(
            email_address=email_address,
            history_id=history_id,
            tenant=getattr(request, 'tenant', None),
        )
        
        return HttpResponse(status=200)
    
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error(f"Invalid Gmail webhook payload: {str(e)}")
        return HttpResponse(status=400)
    
    except Exception as e:
        logger.error(f"Gmail webhook notification error: {str(e)}", exc_info=True)
        return HttpResponse(status=500)


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def tenant_gmail_webhook_notifications(request, tenant_id):
    tenant = _set_webhook_tenant_context(request, tenant_id=tenant_id)
    if not tenant:
        return HttpResponse(status=404)

    return gmail_webhook_notifications(getattr(request, '_request', request))


def process_gmail_notification(email_address, history_id, *, tenant=None):
    """
    Process a Gmail Pub/Sub notification.
    Fetches new messages and triggers workflows.
    """
    from googleapiclient.discovery import build
    
    try:
        # Find email account by address (must be tenant-scoped once RLS is enabled)
        if tenant is None:
            logger.warning('Ignoring Gmail notification: tenant context is required')
            return

        email_account = (
            EmailAccount.objects.filter(
                tenant=tenant,
                email_address=email_address,
                provider='gmail',
            )
            .order_by('-updated_at')
            .first()
        )
        
        if not email_account:
            logger.warning(f"No Gmail account found for {email_address}")
            return
        
        # Create credentials
        try:
            creds = _build_gmail_credentials(email_account)
        except ValueError as exc:
            logger.warning('Skipping Gmail notification: %s', str(exc))
            return
        
        # Build Gmail API service
        service = build('gmail', 'v1', credentials=creds)
        
        # Get history since last webhook_id
        start_history_id = email_account.webhook_id or history_id
        
        history_response = service.users().history().list(
            userId='me',
            startHistoryId=start_history_id,
            historyTypes=['messageAdded']
        ).execute()
        
        if 'history' in history_response:
            for history_item in history_response['history']:
                if 'messagesAdded' in history_item:
                    for message_added in history_item['messagesAdded']:
                        message = message_added['message']
                        
                        # Fetch full message details
                        full_message = service.users().messages().get(
                            userId='me',
                            id=message['id'],
                            format='full'
                        ).execute()
                        
                        # Extract headers
                        headers = {
                            h['name']: h['value'] 
                            for h in full_message['payload']['headers']
                        }
                        
                        # Log the webhook event (raw email payload stored for debugging)
                        EmailLog.objects.create(
                            email_account=email_account,
                            tenant=email_account.tenant,
                            log_type='webhook',
                            workflow_node_id='',
                            subject=headers.get('Subject', ''),
                            from_address=headers.get('From', ''),
                            to_address=headers.get('To', ''),
                            success=True,
                            raw_data={
                                'message_id': message.get('id'),
                                'history_id': history_id,
                                'headers': headers,
                                'full_message': full_message,
                            },
                        )
                        
                        logger.info(f"Processed Gmail email: {headers.get('Subject')}")
        
        # Update webhook_id to latest history_id
        email_account.webhook_id = history_id
        email_account.save(update_fields=['webhook_id'])
    
    except Exception as e:
        logger.error(f"Failed to process Gmail notification: {str(e)}", exc_info=True)
