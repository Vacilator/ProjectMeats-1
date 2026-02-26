"""
Email Webhook Views

Handles webhook subscriptions and notifications from Outlook (MS Graph) and Gmail (Pub/Sub).
Processes real-time email events for workflow triggers.

Created: 2026-02-26 - Email Webhooks Implementation
"""

import logging
import json
import hmac
import hashlib
import base64
from datetime import timedelta
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.email_integration.models import EmailAccount, EmailLog

logger = logging.getLogger(__name__)


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
        email_account = EmailAccount.objects.get(
            id=account_id,
            user=request.user,
            provider='outlook'
        )
        
        if email_account.is_token_expired:
            return Response({
                'error': 'Access token expired',
                'detail': 'Please reconnect your Outlook account'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Microsoft Graph subscription endpoint
        graph_url = 'https://graph.microsoft.com/v1.0/subscriptions'
        
        headers = {
            'Authorization': f'Bearer {email_account.access_token}',
            'Content-Type': 'application/json'
        }
        
        # Webhook notification URL (must be HTTPS with valid cert)
        notification_url = f"{settings.BACKEND_URL}/api/v1/webhooks/outlook/notifications/"
        
        # Subscribe to mailbox changes
        subscription_data = {
            'changeType': 'created,updated',
            'notificationUrl': notification_url,
            'resource': '/me/mailFolders/inbox/messages',
            'expirationDateTime': (timezone.now() + timedelta(days=3)).isoformat(),
            'clientState': f'account_{account_id}_{email_account.user.id}'  # Verify authenticity
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
            email_account.save(update_fields=['webhook_id', 'webhook_expires_at'])
            
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
        email_account = EmailAccount.objects.get(
            id=account_id,
            user=request.user,
            provider='outlook'
        )
        
        if not email_account.webhook_id:
            return Response({
                'error': 'No active subscription',
                'detail': 'Create a subscription first'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Renew subscription
        graph_url = f'https://graph.microsoft.com/v1.0/subscriptions/{email_account.webhook_id}'
        
        headers = {
            'Authorization': f'Bearer {email_account.access_token}',
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
        email_account = EmailAccount.objects.get(
            id=account_id,
            user=request.user,
            provider='outlook'
        )
        
        if not email_account.webhook_id:
            return Response({
                'success': True,
                'message': 'No active subscription to delete'
            })
        
        # Delete subscription
        graph_url = f'https://graph.microsoft.com/v1.0/subscriptions/{email_account.webhook_id}'
        
        headers = {
            'Authorization': f'Bearer {email_account.access_token}'
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
            email_account.save(update_fields=['webhook_id', 'webhook_expires_at'])
            
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
            client_state = notification.get('clientState', '')
            subscription_id = notification.get('subscriptionId')
            resource = notification.get('resource')
            change_type = notification.get('changeType')
            
            logger.info(f"Outlook notification: {change_type} on {resource}")
            
            # Verify client state matches our pattern
            if not client_state.startswith('account_'):
                logger.warning(f"Invalid client state: {client_state}")
                continue
            
            # Extract account ID from client state
            try:
                _, account_id, user_id = client_state.split('_')
                account_id = int(account_id)
                user_id = int(user_id)
            except (ValueError, IndexError):
                logger.warning(f"Malformed client state: {client_state}")
                continue
            
            # Process the notification
            process_outlook_notification(
                account_id=account_id,
                user_id=user_id,
                resource=resource,
                change_type=change_type,
                notification_data=notification
            )
        
        return HttpResponse(status=202)  # Accepted
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON in Outlook webhook notification")
        return HttpResponse(status=400)
    
    except Exception as e:
        logger.error(f"Outlook webhook notification error: {str(e)}", exc_info=True)
        return HttpResponse(status=500)


def process_outlook_notification(account_id, user_id, resource, change_type, notification_data):
    """
    Process a single Outlook webhook notification.
    Triggers workflow execution for EmailTrigger nodes.
    """
    import requests
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    try:
        email_account = EmailAccount.objects.get(id=account_id, user_id=user_id)
        
        # Fetch the actual email message details
        # Resource format: /me/mailFolders/inbox/messages/{message_id}
        if 'messages/' in resource:
            message_id = resource.split('messages/')[-1]
            
            headers = {
                'Authorization': f'Bearer {email_account.access_token}'
            }
            
            message_url = f'https://graph.microsoft.com/v1.0/me/messages/{message_id}'
            response = requests.get(message_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                message_data = response.json()
                
                # Log the email event
                EmailLog.objects.create(
                    email_account=email_account,
                    event_type='received' if change_type == 'created' else 'updated',
                    subject=message_data.get('subject', ''),
                    from_address=message_data.get('from', {}).get('emailAddress', {}).get('address', ''),
                    to_addresses=', '.join([
                        addr['emailAddress']['address'] 
                        for addr in message_data.get('toRecipients', [])
                    ]),
                    message_id=message_data.get('id'),
                    metadata=message_data
                )
                
                # TODO: Trigger EmailTrigger workflow nodes
                # This will be implemented in the workflow execution service
                
                logger.info(f"Processed Outlook email: {message_data.get('subject')}")
    
    except EmailAccount.DoesNotExist:
        logger.error(f"Email account not found: {account_id}")
    
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
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    
    try:
        email_account = EmailAccount.objects.get(
            id=account_id,
            user=request.user,
            provider='gmail'
        )
        
        if email_account.is_token_expired:
            return Response({
                'error': 'Access token expired',
                'detail': 'Please reconnect your Gmail account'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Create credentials object
        creds = Credentials(
            token=email_account.access_token,
            refresh_token=email_account.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET
        )
        
        # Build Gmail API service
        service = build('gmail', 'v1', credentials=creds)
        
        # Create watch request
        request_body = {
            'topicName': settings.GMAIL_PUBSUB_TOPIC,  # e.g., 'projects/my-project/topics/gmail-push'
            'labelIds': ['INBOX'],  # Watch inbox only
            'labelFilterAction': 'include'
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
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    
    try:
        email_account = EmailAccount.objects.get(
            id=account_id,
            user=request.user,
            provider='gmail'
        )
        
        # Create credentials
        creds = Credentials(
            token=email_account.access_token,
            refresh_token=email_account.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET
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
def gmail_webhook_notifications(request):
    """
    Handle Pub/Sub push notifications from Gmail.
    
    Format: Base64-encoded JSON with historyId and emailAddress.
    """
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
            history_id=history_id
        )
        
        return HttpResponse(status=200)
    
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error(f"Invalid Gmail webhook payload: {str(e)}")
        return HttpResponse(status=400)
    
    except Exception as e:
        logger.error(f"Gmail webhook notification error: {str(e)}", exc_info=True)
        return HttpResponse(status=500)


def process_gmail_notification(email_address, history_id):
    """
    Process a Gmail Pub/Sub notification.
    Fetches new messages and triggers workflows.
    """
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    
    try:
        # Find email account by address
        email_account = EmailAccount.objects.filter(
            email_address=email_address,
            provider='gmail'
        ).first()
        
        if not email_account:
            logger.warning(f"No Gmail account found for {email_address}")
            return
        
        # Create credentials
        creds = Credentials(
            token=email_account.access_token,
            refresh_token=email_account.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET
        )
        
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
                        
                        # Log the email event
                        EmailLog.objects.create(
                            email_account=email_account,
                            event_type='received',
                            subject=headers.get('Subject', ''),
                            from_address=headers.get('From', ''),
                            to_addresses=headers.get('To', ''),
                            message_id=message['id'],
                            metadata=full_message
                        )
                        
                        logger.info(f"Processed Gmail email: {headers.get('Subject')}")
        
        # Update webhook_id to latest history_id
        email_account.webhook_id = history_id
        email_account.save(update_fields=['webhook_id'])
    
    except Exception as e:
        logger.error(f"Failed to process Gmail notification: {str(e)}", exc_info=True)
