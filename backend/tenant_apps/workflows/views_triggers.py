"""
Workflow Trigger API Views

Provides endpoints for managing workflow triggers:
- Webhook URL generation
- Manual trigger execution
- Webhook receiver endpoint

Created: 2026-02-21
Phase: 5 - Backend Integration
"""

import hashlib
import hmac
import secrets
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenants.models import TenantUser
from apps.tenants.rls import set_current_tenant

from .models import TenantWorkflow
from .services.workflow_executor import execute_workflow


def _set_tenant_context(request, tenant) -> None:
    request.tenant = tenant

    result = set_current_tenant(str(tenant.id))
    if result.ok:
        # Allow TenantMiddleware to clean up RLS session vars at the end of the request.
        setattr(request, '_rls_set', True)


def _enforce_membership_if_authenticated(request, tenant):
    if not request.user or not request.user.is_authenticated:
        return None

    if request.user.is_superuser or request.user.is_staff:
        return None

    if not TenantUser.objects.filter(tenant=tenant, user=request.user, is_active=True).exists():
        return Response({'error': 'Tenant membership required'}, status=status.HTTP_403_FORBIDDEN)

    return None


def _webhook_not_found() -> Response:
    # Uniform not-found to reduce enumeration signal.
    return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


def _process_workflow_webhook(request, workflow: TenantWorkflow, webhook_token: str) -> Response:
    """Shared workflow webhook receiver logic (legacy + tenant-scoped endpoints)."""

    # Set request tenant context + RLS session variables.
    tenant = workflow.tenant
    if not tenant or not getattr(tenant, 'is_active', True):
        return _webhook_not_found()

    _set_tenant_context(request, tenant)

    membership_error = _enforce_membership_if_authenticated(request, tenant)
    if membership_error is not None:
        return membership_error

    # Verify workflow is active and webhook-triggered
    if workflow.status != 'active':
        return Response({'error': 'Workflow is not active'}, status=status.HTTP_400_BAD_REQUEST)

    if workflow.trigger_type != 'webhook':
        return Response({'error': 'Workflow is not configured for webhook triggers'}, status=status.HTTP_400_BAD_REQUEST)

    trigger_config = workflow.trigger_config or {}

    # Verify webhook token (fail closed; no existence signal)
    expected_token = str(trigger_config.get('webhook_token') or '')
    if not expected_token or not hmac.compare_digest(expected_token, str(webhook_token or '')):
        return _webhook_not_found()

    # Verify authentication if required
    auth_method = trigger_config.get('webhook_auth', 'token')
    if auth_method != 'none':
        if auth_method == 'token':
            auth_header = request.headers.get('Authorization', '')
            expected_auth = f"Bearer {trigger_config.get('webhook_secret', '')}"
            if not hmac.compare_digest(auth_header, expected_auth):
                return _webhook_not_found()

        elif auth_method == 'hmac':
            signature = request.headers.get('X-Webhook-Signature', '')
            secret = str(trigger_config.get('webhook_secret', '')).encode()
            expected_signature = hmac.new(secret, request.body, hashlib.sha256).hexdigest()

            if not hmac.compare_digest(signature, expected_signature):
                return _webhook_not_found()

    try:
        execution_log = execute_workflow(workflow, request.data)

        return Response(
            {
                'message': 'Webhook received and workflow executed successfully',
                'execution_id': str(getattr(execution_log, 'id', '')),
                'status': getattr(execution_log, 'status', 'completed'),
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        return Response(
            {
                'error': 'Workflow execution failed',
                'message': str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class WorkflowWebhookAPIView(APIView):
    """
    Manage webhook triggers for a workflow.
    
    POST /api/v1/workflows/workflows/{id}/webhooks/ - Generate webhook URL
    GET /api/v1/workflows/workflows/{id}/webhooks/ - Get webhook config
    DELETE /api/v1/workflows/workflows/{id}/webhooks/ - Revoke webhook
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, workflow_id):
        """Get webhook configuration for a workflow."""
        try:
            workflow = TenantWorkflow.objects.get(
                id=workflow_id,
                tenant=request.tenant
            )
        except TenantWorkflow.DoesNotExist:
            return Response(
                {"error": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if workflow has webhook trigger
        if workflow.trigger_type != 'webhook':
            return Response(
                {"error": "Workflow is not configured for webhook triggers"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        trigger_config = workflow.trigger_config or {}
        
        # Ensure webhook credentials exist and URLs reflect the current canonical route.
        needs_save = False

        if not trigger_config.get('webhook_token'):
            trigger_config['webhook_token'] = secrets.token_urlsafe(32)
            needs_save = True
        if not trigger_config.get('webhook_secret'):
            trigger_config['webhook_secret'] = secrets.token_urlsafe(32)
            needs_save = True

        webhook_token = trigger_config['webhook_token']

        webhook_url = request.build_absolute_uri(
            f"/api/v1/tenants/{request.tenant.id}/workflows/webhooks/{workflow.id}/{webhook_token}/"
        )
        legacy_webhook_url = request.build_absolute_uri(
            f"/api/v1/workflows/webhooks/{workflow.id}/{webhook_token}/"
        )

        if trigger_config.get('webhook_url') != webhook_url:
            trigger_config['webhook_url'] = webhook_url
            needs_save = True
        if trigger_config.get('legacy_webhook_url') != legacy_webhook_url:
            trigger_config['legacy_webhook_url'] = legacy_webhook_url
            needs_save = True

        if needs_save:
            workflow.trigger_config = trigger_config
            workflow.save(update_fields=['trigger_config', 'updated_at'])
        
        return Response({
            "workflow_id": str(workflow.id),
            "webhook_url": trigger_config.get('webhook_url'),
            "legacy_webhook_url": trigger_config.get('legacy_webhook_url'),
            "webhook_secret": trigger_config.get('webhook_secret'),
            "auth_method": trigger_config.get('webhook_auth', 'token'),
            "allowed_methods": trigger_config.get('webhook_method', ['POST']),
        })
    
    def post(self, request, workflow_id):
        """Generate or regenerate webhook URL for a workflow."""
        try:
            workflow = TenantWorkflow.objects.get(
                id=workflow_id,
                tenant=request.tenant
            )
        except TenantWorkflow.DoesNotExist:
            return Response(
                {"error": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update trigger type to webhook if needed
        if workflow.trigger_type != 'webhook':
            workflow.trigger_type = 'webhook'
        
        # Generate new webhook credentials
        webhook_token = secrets.token_urlsafe(32)
        webhook_secret = secrets.token_urlsafe(32)

        webhook_url = request.build_absolute_uri(
            f"/api/v1/tenants/{request.tenant.id}/workflows/webhooks/{workflow.id}/{webhook_token}/"
        )
        legacy_webhook_url = request.build_absolute_uri(
            f"/api/v1/workflows/webhooks/{workflow.id}/{webhook_token}/"
        )

        trigger_config = workflow.trigger_config or {}
        trigger_config.update({
            'webhook_url': webhook_url,
            'legacy_webhook_url': legacy_webhook_url,
            'webhook_token': webhook_token,
            'webhook_secret': webhook_secret,
            'webhook_auth': request.data.get('auth_method', 'token'),
            'webhook_method': request.data.get('allowed_methods', ['POST']),
        })
        
        workflow.trigger_config = trigger_config
        workflow.save(update_fields=['trigger_type', 'trigger_config', 'updated_at'])
        
        return Response({
            "message": "Webhook URL generated successfully",
            "workflow_id": str(workflow.id),
            "webhook_url": webhook_url,
            "legacy_webhook_url": legacy_webhook_url,
            "webhook_secret": webhook_secret,
            "auth_method": trigger_config['webhook_auth'],
            "allowed_methods": trigger_config['webhook_method'],
        }, status=status.HTTP_201_CREATED)
    
    def delete(self, request, workflow_id):
        """Revoke webhook for a workflow."""
        try:
            workflow = TenantWorkflow.objects.get(
                id=workflow_id,
                tenant=request.tenant
            )
        except TenantWorkflow.DoesNotExist:
            return Response(
                {"error": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Clear webhook configuration
        trigger_config = workflow.trigger_config or {}
        trigger_config.pop('webhook_url', None)
        trigger_config.pop('legacy_webhook_url', None)
        trigger_config.pop('webhook_token', None)
        trigger_config.pop('webhook_secret', None)
        
        workflow.trigger_config = trigger_config
        workflow.save(update_fields=['trigger_config', 'updated_at'])
        
        return Response({
            "message": "Webhook revoked successfully"
        })


class TenantScopedWebhookReceiverAPIView(APIView):
    """Canonical public workflow webhook receiver.

    POST /api/v1/tenants/{tenant_id}/workflows/webhooks/{workflow_id}/{webhook_token}/

    Tenant selection is via path param only (public endpoints must not honor X-Tenant-ID).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, tenant_id, workflow_id, webhook_token):
        try:
            workflow = TenantWorkflow.objects.select_related('tenant').get(id=workflow_id, tenant_id=tenant_id)
        except TenantWorkflow.DoesNotExist:
            return _webhook_not_found()

        return _process_workflow_webhook(request, workflow, webhook_token)


class WebhookReceiverAPIView(APIView):
    """Legacy public workflow webhook receiver (kept for backwards compatibility).

    POST /api/v1/workflows/webhooks/{workflow_id}/{webhook_token}/
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, workflow_id, webhook_token):
        try:
            workflow = TenantWorkflow.objects.select_related('tenant').get(id=workflow_id)
        except TenantWorkflow.DoesNotExist:
            return _webhook_not_found()

        return _process_workflow_webhook(request, workflow, webhook_token)


class ManualTriggerAPIView(APIView):
    """
    Manual workflow trigger endpoint.
    
    POST /api/v1/workflows/workflows/{id}/trigger/ - Execute workflow manually
    """
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request, workflow_id):
        """Manually trigger a workflow."""
        try:
            workflow = TenantWorkflow.objects.get(
                id=workflow_id,
                tenant=request.tenant
            )
        except TenantWorkflow.DoesNotExist:
            return Response(
                {"error": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify workflow is active
        if workflow.status != 'active':
            return Response(
                {"error": "Workflow is not active"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify workflow allows manual triggers
        if workflow.trigger_type != 'manual':
            return Response(
                {"error": "Workflow is not configured for manual triggers"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if confirmation is required
        trigger_config = workflow.trigger_config or {}
        if trigger_config.get('require_confirmation') and not request.data.get('confirmed'):
            return Response({
                "confirmation_required": True,
                "message": f"Are you sure you want to run workflow '{workflow.name}'?",
                "workflow_id": str(workflow.id),
                "workflow_name": workflow.name
            }, status=status.HTTP_200_OK)
        
        # Execute workflow using execution engine
        from .services.workflow_executor import execute_workflow
        
        try:
            execution_log = execute_workflow(workflow, request.data)
            
            # Update workflow stats
            workflow.last_run_at = timezone.now()
            workflow.run_count += 1
            workflow.save(update_fields=['last_run_at', 'run_count'])
            
            return Response({
                "message": "Workflow executed successfully",
                "execution_id": str(execution_log.id),
                "status": "completed"
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            execution_log.status = 'failed'
            execution_log.error_message = str(e)
            execution_log.completed_at = timezone.now()
            execution_log.save(update_fields=['status', 'error_message', 'completed_at'])
            
            return Response({
                "error": "Workflow execution failed",
                "execution_id": str(execution_log.id),
                "message": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
