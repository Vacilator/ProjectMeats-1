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

from .models import TenantWorkflow


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
        
        # Generate webhook URL if not exists
        if not trigger_config.get('webhook_url'):
            webhook_token = secrets.token_urlsafe(32)
            webhook_url = f"{request.build_absolute_uri('/api/v1/webhooks/')}{workflow.id}/{webhook_token}/"
            
            trigger_config['webhook_url'] = webhook_url
            trigger_config['webhook_token'] = webhook_token
            trigger_config['webhook_secret'] = secrets.token_urlsafe(32)
            
            workflow.trigger_config = trigger_config
            workflow.save(update_fields=['trigger_config', 'updated_at'])
        
        return Response({
            "workflow_id": str(workflow.id),
            "webhook_url": trigger_config.get('webhook_url'),
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
        webhook_url = f"{request.build_absolute_uri('/api/v1/webhooks/')}{workflow.id}/{webhook_token}/"
        webhook_secret = secrets.token_urlsafe(32)
        
        trigger_config = workflow.trigger_config or {}
        trigger_config.update({
            'webhook_url': webhook_url,
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
        trigger_config.pop('webhook_token', None)
        trigger_config.pop('webhook_secret', None)
        
        workflow.trigger_config = trigger_config
        workflow.save(update_fields=['trigger_config', 'updated_at'])
        
        return Response({
            "message": "Webhook revoked successfully"
        })


class WebhookReceiverAPIView(APIView):
    """
    Webhook receiver endpoint.
    
    POST /api/v1/webhooks/{workflow_id}/{webhook_token}/ - Receive webhook
    
    Public endpoint (no authentication required - uses webhook token).
    """
    
    permission_classes = [AllowAny]
    
    def post(self, request, workflow_id, webhook_token):
        """Receive and process webhook."""
        try:
            workflow = TenantWorkflow.objects.select_related('tenant').get(id=workflow_id)
        except TenantWorkflow.DoesNotExist:
            return Response(
                {"error": "Workflow not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify workflow is active and webhook-triggered
        if workflow.status != 'active':
            return Response(
                {"error": "Workflow is not active"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if workflow.trigger_type != 'webhook':
            return Response(
                {"error": "Workflow is not configured for webhook triggers"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        trigger_config = workflow.trigger_config or {}
        
        # Verify webhook token
        if trigger_config.get('webhook_token') != webhook_token:
            return Response(
                {"error": "Invalid webhook token"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify HTTP method
        allowed_methods = trigger_config.get('webhook_method', ['POST'])
        if request.method not in allowed_methods:
            return Response(
                {"error": f"Method {request.method} not allowed"},
                status=status.HTTP_405_METHOD_NOT_ALLOWED
            )
        
        # Verify authentication if required
        auth_method = trigger_config.get('webhook_auth', 'token')
        if auth_method != 'none':
            if auth_method == 'token':
                auth_header = request.headers.get('Authorization', '')
                expected_token = f"Bearer {trigger_config.get('webhook_secret', '')}"
                if auth_header != expected_token:
                    return Response(
                        {"error": "Invalid authorization token"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            elif auth_method == 'hmac':
                signature = request.headers.get('X-Webhook-Signature', '')
                secret = trigger_config.get('webhook_secret', '').encode()
                expected_signature = hmac.new(
                    secret,
                    request.body,
                    hashlib.sha256
                ).hexdigest()
                
                if not hmac.compare_digest(signature, expected_signature):
                    return Response(
                        {"error": "Invalid HMAC signature"},
                        status=status.HTTP_403_FORBIDDEN
                    )
        
        # Execute workflow using execution engine
        from .services.workflow_executor import execute_workflow
        
        try:
            execution_log = execute_workflow(workflow, request.data)
            
            # Update workflow stats
            workflow.last_run_at = timezone.now()
            workflow.run_count += 1
            workflow.save(update_fields=['last_run_at', 'run_count'])
            
            return Response({
                "message": "Webhook received and workflow executed successfully",
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
