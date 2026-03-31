"""
Celery Tasks for Workflow Execution.

Phase 5 Part 2 - Backend execution layer for scheduled and event-driven workflows.

Tasks:
- execute_scheduled_workflow: Run workflows on cron schedule
- execute_event_workflow: Run workflows triggered by entity changes
- execute_workflow_action: Execute individual workflow actions
- cleanup_old_executions: Maintenance task for execution history
- generate_ai_template_suggestions: Supply-chain AI suggestions with Redis caching

Note: Models are imported inside functions to avoid circular imports during app initialization.
"""
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

# Lazy-imported models used by generate_ai_template_suggestions.
# Kept as module attributes so unit tests can patch them.
Tenant = None
AIConfiguration = None


@shared_task(name='workflows.execute_scheduled_workflow')
def execute_scheduled_workflow(workflow_id: int, tenant_id: int):
    """
    Execute a scheduled workflow via Celery beat.
    
    Args:
        workflow_id: ID of the workflow to execute
        tenant_id: ID of the tenant (for multi-tenancy)
    
    Returns:
        dict: Execution result with status and execution_id
    """
    from .models import TenantWorkflow, WorkflowExecution
    from .engine import WorkflowEngine
    from apps.tenants.models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        workflow = TenantWorkflow.objects.get(id=workflow_id, tenant=tenant)
        
        logger.info(f"[Celery] Executing scheduled workflow: {workflow.name} (ID: {workflow_id})")
        
        # Create execution record
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            tenant=tenant,
            trigger_type='scheduled',
            status='running',
            started_at=timezone.now(),
        )
        
        # Execute workflow using the engine
        engine = WorkflowEngine(workflow)
        result = engine.execute(context={
            'execution_id': execution.id,
            'trigger': 'scheduled',
            'scheduled_at': timezone.now().isoformat(),
        })
        
        # Update execution record
        execution.status = 'completed' if result.get('success') else 'failed'
        execution.completed_at = timezone.now()
        execution.result_data = result
        execution.save()
        
        logger.info(f"[Celery] Workflow {workflow_id} completed with status: {execution.status}")
        
        return {
            'success': True,
            'execution_id': execution.id,
            'status': execution.status,
            'result': result,
        }
        
    except Tenant.DoesNotExist:
        logger.error(f"[Celery] Tenant {tenant_id} not found for workflow {workflow_id}")
        return {'success': False, 'error': 'Tenant not found'}
        
    except TenantWorkflow.DoesNotExist:
        logger.error(f"[Celery] Workflow {workflow_id} not found for tenant {tenant_id}")
        return {'success': False, 'error': 'Workflow not found'}
        
    except Exception as e:
        logger.exception(f"[Celery] Error executing workflow {workflow_id}: {str(e)}")
        
        if 'execution' in locals():
            execution.status = 'failed'
            execution.completed_at = timezone.now()
            execution.error_message = str(e)
            execution.save()
            
        return {'success': False, 'error': str(e)}


@shared_task(name='workflows.execute_event_workflow')
def execute_event_workflow(workflow_id: int, tenant_id: int, entity_type: str, entity_id: int, event_type: str):
    """
    Execute a workflow triggered by an entity event (create/update/delete).
    
    Args:
        workflow_id: ID of the workflow to execute
        tenant_id: ID of the tenant
        entity_type: Type of entity (e.g., 'customer', 'supplier')
        entity_id: ID of the entity that triggered the event
        event_type: Type of event ('created', 'updated', 'deleted')
    
    Returns:
        dict: Execution result
    """
    from .models import TenantWorkflow, WorkflowExecution
    from .engine import WorkflowEngine
    from apps.tenants.models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        workflow = TenantWorkflow.objects.get(id=workflow_id, tenant=tenant)
        
        logger.info(f"[Celery] Executing event workflow: {workflow.name} for {entity_type}:{entity_id} ({event_type})")
        
        # Create execution record
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            tenant=tenant,
            trigger_type='event',
            status='running',
            started_at=timezone.now(),
            trigger_data={
                'entity_type': entity_type,
                'entity_id': entity_id,
                'event_type': event_type,
            }
        )
        
        # Fetch entity data for context
        entity_data = _get_entity_data(entity_type, entity_id, tenant)
        
        # Execute workflow
        engine = WorkflowEngine(workflow)
        result = engine.execute(context={
            'execution_id': execution.id,
            'trigger': 'event',
            'event_type': event_type,
            'entity': entity_data,
        })
        
        # Update execution record
        execution.status = 'completed' if result.get('success') else 'failed'
        execution.completed_at = timezone.now()
        execution.result_data = result
        execution.save()
        
        logger.info(f"[Celery] Event workflow {workflow_id} completed: {execution.status}")
        
        return {
            'success': True,
            'execution_id': execution.id,
            'status': execution.status,
        }
        
    except Exception as e:
        logger.exception(f"[Celery] Error executing event workflow {workflow_id}: {str(e)}")
        
        if 'execution' in locals():
            execution.status = 'failed'
            execution.completed_at = timezone.now()
            execution.error_message = str(e)
            execution.save()
            
        return {'success': False, 'error': str(e)}


@shared_task(name='workflows.execute_workflow_action')
def execute_workflow_action(action_type: str, action_config: dict, context: dict, tenant_id: int):
    """
    Execute a single workflow action asynchronously.
    
    Args:
        action_type: Type of action (email, create_record, etc.)
        action_config: Action configuration from workflow node
        context: Execution context with variables
        tenant_id: Tenant ID for isolation
    
    Returns:
        dict: Action result
    """
    from .services.action_executor import ActionExecutor
    from apps.tenants.models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        
        logger.info(f"[Celery] Executing action: {action_type} for tenant {tenant_id}")
        
        executor = ActionExecutor(tenant=tenant, context=context)
        result = executor.execute(action_type, action_config)
        
        logger.info(f"[Celery] Action {action_type} completed: {result.get('success')}")
        
        return result
        
    except Exception as e:
        logger.exception(f"[Celery] Error executing action {action_type}: {str(e)}")
        return {'success': False, 'error': str(e)}


@shared_task(name='workflows.cleanup_old_executions')
def cleanup_old_executions(days_to_keep: int = 90):
    """
    Clean up old workflow executions (maintenance task).
    
    Args:
        days_to_keep: Number of days to retain execution history
    
    Returns:
        dict: Cleanup statistics
    """
    from .models import WorkflowExecution
    
    try:
        cutoff_date = timezone.now() - timedelta(days=days_to_keep)
        
        deleted_count, _ = WorkflowExecution.objects.filter(
            completed_at__lt=cutoff_date
        ).delete()
        
        logger.info(f"[Celery] Cleaned up {deleted_count} old workflow executions")
        
        return {
            'success': True,
            'deleted_count': deleted_count,
            'cutoff_date': cutoff_date.isoformat(),
        }
        
    except Exception as e:
        logger.exception(f"[Celery] Error cleaning up executions: {str(e)}")
        return {'success': False, 'error': str(e)}


def _get_entity_data(entity_type: str, entity_id: int, tenant):
    """
    Fetch entity data for workflow context.
    
    Args:
        entity_type: Type of entity
        entity_id: Entity ID
        tenant: Tenant instance
    
    Returns:
        dict: Entity data
    """
    from tenant_apps.suppliers.models import Supplier
    from tenant_apps.customers.models import Customer
    from tenant_apps.purchase_orders.models import PurchaseOrder
    from tenant_apps.sales_orders.models import SalesOrder
    from tenant_apps.invoices.models import Invoice
    from tenant_apps.products.models import MasterProduct
    
    model_map = {
        'supplier': Supplier,
        'customer': Customer,
        'purchase_order': PurchaseOrder,
        'sales_order': SalesOrder,
        'invoice': Invoice,
        'product': MasterProduct,
    }
    
    model = model_map.get(entity_type)
    if not model:
        return {'id': entity_id, 'type': entity_type}
    
    try:
        instance = model.objects.get(id=entity_id, tenant=tenant)
        
        # Return basic serialized data
        data = {
            'id': instance.id,
            'type': entity_type,
        }
        
        # Add common fields if they exist
        for field in ['name', 'email', 'status', 'total', 'reference_number']:
            if hasattr(instance, field):
                data[field] = getattr(instance, field)
        
        return data
        
    except model.DoesNotExist:
        return {'id': entity_id, 'type': entity_type, 'error': 'Not found'}


# ---------------------------------------------------------------------------
# Supply-Chain AI Template Suggestions
# ---------------------------------------------------------------------------

SUPPLY_CHAIN_DOMAINS = ('cold_storage_monitoring', 'quality_inspection', 'carrier_compliance')

#: Redis cache TTL for AI-generated template suggestions (24 hours).
AI_TEMPLATE_CACHE_TTL = 60 * 60 * 24


@shared_task(
    name='workflows.generate_ai_template_suggestions',
    max_retries=2,
    default_retry_delay=30,
)
def generate_ai_template_suggestions(
    tenant_id: int,
    template_domain: str,
    current_flow: dict = None,
) -> dict:
    """
    Generate AI-powered node suggestions for a supply-chain workflow template.

    Uses the dedicated ``supply_chain_templates_v1.prompt`` golden template
    together with the tenant's OpenAI ``AIConfiguration``.  Results are cached
    in Redis for 24 hours to avoid repeated API calls for the same domain.

    Falls back to ``AIPrompter.get_fallback_suggestions()`` when:
    - No active ``AIConfiguration`` exists for the tenant
    - The OpenAI API call raises any exception

    Args:
        tenant_id: ID of the tenant requesting suggestions
        template_domain: One of ``cold_storage_monitoring``,
            ``quality_inspection``, or ``carrier_compliance``
        current_flow: Optional current workflow state (nodes/edges dict).
            Defaults to an empty flow when not supplied.

    Returns:
        dict: Suggestions payload compatible with
            ``AIPrompter.parse_ai_response()``::

            {
                "suggestions": [...],
                "confidence": float,
                "mode": "ai" | "static",
                "template_domain": str,
                "cached": bool,
            }
    """
    from django.core.cache import cache
    from tenant_apps.workflows.services.prompter import AIPrompter

    if template_domain not in SUPPLY_CHAIN_DOMAINS:
        logger.warning(
            "[Celery] generate_ai_template_suggestions called with unknown domain '%s'",
            template_domain,
        )
        return {
            "success": False,
            "error": (
                f"Unknown template_domain '{template_domain}'. "
                f"Must be one of: {SUPPLY_CHAIN_DOMAINS}"
            ),
        }

    global Tenant, AIConfiguration
    if Tenant is None:
        from apps.tenants.models import Tenant as TenantModel

        Tenant = TenantModel

    current_flow = current_flow or {"nodes": [], "edges": []}
    cache_key = f"ai_template_suggestions:{tenant_id}:{template_domain}"

    # --- Cache hit ---
    cached = cache.get(cache_key)
    if cached is not None:
        logger.info(
            "[Celery] Returning cached AI template suggestions for tenant %s / domain %s",
            tenant_id,
            template_domain,
        )
        cached["cached"] = True
        return cached

    from apps.tenants.models import Tenant as TenantModel

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except TenantModel.DoesNotExist:
        logger.error("[Celery] Tenant %s not found", tenant_id)
        return {"success": False, "error": "Tenant not found"}

    prompter = AIPrompter()

    if AIConfiguration is None:
        try:
            from tenant_apps.ai_assistant.models import AIConfiguration as AIConfigurationModel

            AIConfiguration = AIConfigurationModel
        except Exception:
            # ai_assistant may be disabled in some test settings; treat as no-config.
            AIConfiguration = False

    # --- Try OpenAI if a configuration is available ---
    ai_config = None
    if AIConfiguration:
        ai_config = (
            AIConfiguration.objects.filter(tenant=tenant, is_active=True, is_default=True)
            .first()
        )

    if ai_config:
        try:
            import openai  # Soft import — only required when a config exists

            api_key = getattr(ai_config, "api_key", None)
            if not api_key:
                raise ValueError("AIConfiguration has no api_key — skipping OpenAI call")

            openai.api_key = api_key
            model_name = getattr(ai_config, "model_name", "gpt-4o-mini")

            prompt_text = prompter.build_supply_chain_template_prompt(
                tenant=tenant,
                template_domain=template_domain,
                current_flow=current_flow,
            )

            response = openai.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt_text}],
                temperature=0.3,
                max_tokens=600,
            )

            raw_text = response.choices[0].message.content
            result = prompter.parse_ai_response(raw_text)
            result["mode"] = "ai"
            result["template_domain"] = template_domain
            result["cached"] = False

            # Store in Redis for 24 hours
            cache.set(cache_key, result, AI_TEMPLATE_CACHE_TTL)

            logger.info(
                "[Celery] AI template suggestions generated for tenant %s / domain %s",
                tenant_id,
                template_domain,
            )
            return result

        except Exception as exc:
            _ai_error = str(exc)
            logger.warning(
                "[Celery] OpenAI call failed for tenant %s / domain %s: %s — falling back to static",
                tenant_id,
                template_domain,
                _ai_error,
            )
    else:
        _ai_error = "No active AIConfiguration found for tenant"

    # --- Static fallback ---
    result = prompter.get_fallback_suggestions(
        tenant=tenant,
        current_flow=current_flow,
        template_domain=template_domain,
    )
    result["cached"] = False
    result["error_reason"] = _ai_error

    # Cache static fallback for a shorter period (1 hour) to retry AI sooner
    cache.set(cache_key, result, 60 * 60)

    logger.info(
        "[Celery] Static fallback suggestions returned for tenant %s / domain %s",
        tenant_id,
        template_domain,
    )
    return result
