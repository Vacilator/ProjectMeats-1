"""
Celery Tasks for Background Processing (Phase 8.4)

Background job execution with parallel processing.
"""
from celery import shared_task, group, chord
from apps.core.caching import CacheService, ParallelExecutor
from typing import List, Dict, Any


@shared_task
def cache_workflow_data(tenant_id: str, workflow_id: str) -> Dict[str, Any]:
    """
    Pre-cache workflow data for faster rendering.
    
    Args:
        tenant_id: Tenant UUID
        workflow_id: Workflow UUID
        
    Returns:
        Cache status dict
    """
    from tenant_apps.workflows.models import TenantForm
    
    cache_key = f"workflow:{tenant_id}:{workflow_id}"
    
    def fetch_workflow():
        from apps.tenants.rls import tenant_rls

        with tenant_rls(str(tenant_id), strict=True):
            workflow = TenantForm.objects.get(
                id=workflow_id,
                tenant_id=tenant_id
            )
            return {
                'id': str(workflow.id),
                'name': workflow.name,
                'fields_count': workflow.fields.count()
            }
    
    CacheService.cache_query_result(cache_key, fetch_workflow)
    
    return {'cache_key': cache_key, 'cached': True}


@shared_task
def parallel_tenant_sync(tenant_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Sync multiple tenants in parallel.
    
    Args:
        tenant_ids: List of tenant UUIDs
        
    Returns:
        List of sync results
    """
    tasks = [
        lambda tid=tid: sync_single_tenant(tid)
        for tid in tenant_ids
    ]
    
    return ParallelExecutor.execute_parallel(tasks, max_workers=5)


def sync_single_tenant(tenant_id: str) -> Dict[str, Any]:
    """
    Sync data for a single tenant.
    """
    from apps.tenants.models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        
        from apps.tenants.rls import tenant_rls

        # Example: Sync workflow counts, user counts, etc.
        with tenant_rls(str(tenant_id), strict=True):
            workflow_count = tenant.tenant_forms.count()
            user_count = tenant.users.count()
        
        return {
            'tenant_id': tenant_id,
            'status': 'success',
            'workflow_count': workflow_count,
            'user_count': user_count
        }
    except Exception as e:
        return {
            'tenant_id': tenant_id,
            'status': 'error',
            'error': str(e)
        }


@shared_task
def batch_export_workflows(
    tenant_id: str,
    workflow_ids: List[str]
) -> Dict[str, Any]:
    """
    Export multiple workflows in parallel.
    
    Args:
        tenant_id: Tenant UUID
        workflow_ids: List of workflow UUIDs
        
    Returns:
        Export status dict
    """
    # Create parallel subtasks
    job = group([
        export_single_workflow.s(tenant_id, wid)
        for wid in workflow_ids
    ])
    
    result = job.apply_async()
    
    return {
        'job_id': result.id,
        'workflow_count': len(workflow_ids),
        'status': 'processing'
    }


@shared_task
def export_single_workflow(tenant_id: str, workflow_id: str) -> Dict[str, Any]:
    """
    Export a single workflow as JSON.
    """
    from tenant_apps.workflows.models import TenantForm
    from tenant_apps.workflows.serializers import TenantFormSerializer
    
    from apps.tenants.rls import tenant_rls

    try:
        with tenant_rls(str(tenant_id), strict=True):
            workflow = TenantForm.objects.get(
                id=workflow_id,
                tenant_id=tenant_id
            )

            serializer = TenantFormSerializer(workflow)

            return {
                'workflow_id': workflow_id,
                'status': 'success',
                'data': serializer.data
            }
    except Exception as e:
        return {
            'workflow_id': workflow_id,
            'status': 'error',
            'error': str(e)
        }


@shared_task
def aggregate_tenant_metrics(tenant_id: str) -> Dict[str, Any]:
    """
    Aggregate metrics across all tenant resources.
    
    Uses chord pattern for map-reduce style aggregation.
    """
    
    # Map phase: Count workflows by status
    count_tasks = [
        count_workflows_by_status.s(tenant_id, status)
        for status in ['draft', 'active', 'archived']
    ]
    
    # Reduce phase: Aggregate counts
    callback = aggregate_counts.s(tenant_id)
    
    # Execute map-reduce
    job = chord(count_tasks)(callback)
    
    return {
        'job_id': job.id,
        'tenant_id': tenant_id,
        'status': 'processing'
    }


@shared_task
def count_workflows_by_status(tenant_id: str, status: str) -> Dict[str, int]:
    """
    Count workflows for a specific status.
    """
    from tenant_apps.workflows.models import TenantForm
    
    from apps.tenants.rls import tenant_rls

    with tenant_rls(str(tenant_id), strict=True):
        count = TenantForm.objects.filter(
            tenant_id=tenant_id,
            status=status
        ).count()
    
    return {status: count}


@shared_task
def aggregate_counts(results: List[Dict[str, int]], tenant_id: str) -> Dict[str, Any]:
    """
    Aggregate workflow counts from map phase.
    """
    aggregated = {}
    for result in results:
        aggregated.update(result)
    
    # Cache aggregated metrics
    cache_key = f"metrics:{tenant_id}"
    CacheService.cache_query_result(
        cache_key,
        lambda: aggregated,
        ttl=300  # 5 minutes
    )
    
    return {
        'tenant_id': tenant_id,
        'metrics': aggregated,
        'cached': True
    }
