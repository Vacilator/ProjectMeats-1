"""
Celery Tasks for System Management

Phase 6: Ghost Node Cleanup
Automated tasks for cleaning orphaned TenantForm records.

Created: 2026-02-12
"""
from celery import shared_task
from datetime import timedelta
import logging

from django.db import connection
from django.utils import timezone

from apps.system.models import TenantForm
from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


def _reset_rls_session_vars() -> None:
    if connection.vendor != 'postgresql':
        return

    with connection.cursor() as cursor:
        cursor.execute('RESET app.current_tenant_id')
        cursor.execute('RESET app.current_tenant')


def _sync_execution_telemetry(execution) -> None:
    from tenant_apps.workflows.services.telemetry import persist_execution_event_logs

    persist_execution_event_logs(execution)


@shared_task(name='system.cleanup_orphaned_forms')
def cleanup_orphaned_forms():
    """
    Clean up orphaned TenantForm records.
    
    Phase 6: Ghost Node Cleanup
    Deletes TenantForms that:
    - Have usage_count = 0
    - Are not templates (is_template = False)
    - Are older than 30 days
    
    Runs daily via Celery beat schedule.
    
    Returns:
        dict: Statistics about cleanup operation
    """
    # Calculate cutoff date (30 days ago)
    cutoff_date = timezone.now() - timedelta(days=30)

    deleted_total = 0
    deleted_form_ids: list[str] = []

    # In Postgres with RLS, cross-tenant queries will be blocked unless session vars are set.
    # We therefore loop tenants and assert RLS vars per tenant.
    tenant_ids = list(Tenant.objects.filter(is_active=True).values_list('id', flat=True))

    for tenant_id in tenant_ids:
        try:
            if connection.vendor == 'postgresql':
                from apps.tenants.rls import set_current_tenant

                rls = set_current_tenant(str(tenant_id))
                if not rls.ok:
                    logger.warning('[Cleanup] Skipping tenant=%s (RLS set failed: %s)', tenant_id, rls.error)
                    continue

            orphaned_forms = TenantForm.objects.filter(
                tenant_id=tenant_id,
                usage_count=0,
                is_template=False,
                created_at__lt=cutoff_date,
            )

            count = orphaned_forms.count()
            if count == 0:
                continue

            deleted_form_ids.extend([str(fid) for fid in orphaned_forms.values_list('id', flat=True)])
            deleted_count, _ = orphaned_forms.delete()
            deleted_total += deleted_count
        finally:
            _reset_rls_session_vars()

    if deleted_total == 0:
        logger.info('[Cleanup] No orphaned forms to delete')
        return {
            'deleted': 0,
            'message': 'No orphaned forms found',
        }

    logger.info('[Cleanup] Deleted %s orphaned forms', deleted_total)

    return {
        'deleted': deleted_total,
        'form_ids': deleted_form_ids,
        'message': f'Successfully deleted {deleted_total} orphaned form(s)',
    }


@shared_task(name='system.audit_form_usage')
def audit_form_usage():
    """
    Audit form usage counts and fix discrepancies.
    
    Phase 6: Ghost Node Cleanup
    Verifies that usage_count matches actual workflow references.
    
    Returns:
        dict: Statistics about audit operation
    """
    from apps.system.models import TenantWorkForm

    fixed_count = 0
    discrepancies = []

    tenant_ids = list(Tenant.objects.filter(is_active=True).values_list('id', flat=True))

    for tenant_id in tenant_ids:
        try:
            if connection.vendor == 'postgresql':
                from apps.tenants.rls import set_current_tenant

                rls = set_current_tenant(str(tenant_id))
                if not rls.ok:
                    logger.warning('[Audit] Skipping tenant=%s (RLS set failed: %s)', tenant_id, rls.error)
                    continue

            for form in TenantForm.objects.filter(tenant_id=tenant_id):
                actual_count = TenantWorkForm.objects.filter(
                    tenant_id=tenant_id,
                    form_references__contains=[form.id],
                ).count()

                if actual_count != form.usage_count:
                    discrepancies.append(
                        {
                            'form_id': str(form.id),
                            'form_name': form.name,
                            'stored_count': form.usage_count,
                            'actual_count': actual_count,
                        }
                    )

                    form.usage_count = actual_count
                    form.save(update_fields=['usage_count'])
                    fixed_count += 1
        finally:
            _reset_rls_session_vars()
    
    if fixed_count > 0:
        logger.warning(f'[Audit] Fixed {fixed_count} usage count discrepancies: {discrepancies}')
    else:
        logger.info('[Audit] All form usage counts are accurate')
    
    return {
        'fixed': fixed_count,
        'discrepancies': discrepancies,
        'message': f'Fixed {fixed_count} discrepancy/discrepancies' if fixed_count > 0 else 'All counts accurate'
    }


@shared_task(name='system.pin_workflow_versions')
def pin_workflow_versions(workflow_id: str, tenant_id: str | None = None):
    """
    Pin all container versions when workflow becomes ACTIVE.
    
    Phase 6: Ghost Node Cleanup
    Locks all tenantFormId references to prevent template changes
    from affecting active workflows.
    
    Args:
        workflow_id (str): UUID of the workflow to pin
    
    Returns:
        dict: Pinning operation results
    """
    from apps.system.models import TenantWorkForm

    if connection.vendor == 'postgresql' and not tenant_id:
        logger.error('[Pin] Missing tenant_id for workflow=%s (required for RLS-safe pinning)', workflow_id)
        return {'success': False, 'error': 'tenant_id required'}

    try:
        if connection.vendor == 'postgresql':
            from apps.tenants.rls import set_current_tenant

            rls = set_current_tenant(str(tenant_id))
            if not rls.ok:
                logger.warning('[Pin] Skipping workflow=%s (RLS set failed: %s)', workflow_id, rls.error)
                return {'success': False, 'error': rls.error}

        workflow = TenantWorkForm.objects.get(id=workflow_id)

        # Only pin if status is ACTIVE
        if workflow.status != 'active':
            return {
                'success': False,
                'error': f'Workflow status is {workflow.status}, not active',
            }

        # Extract all container nodes
        nodes = workflow.workflow_definition.get('nodes', [])
        pinned_forms = []

        container_types = {
            'formBook',
            'formProcessGroup',
            'formProcess',
            'formMultiStepContainer',
            'smartWorkForm',
        }

        for node in nodes:
            if node.get('type') in container_types:
                tenant_form_id = (node.get('data') or {}).get('tenantFormId')

                if tenant_form_id:
                    try:
                        form = TenantForm.objects.get(id=tenant_form_id, tenant=workflow.tenant)
                        pinned_forms.append(
                            {
                                'node_id': node.get('id'),
                                'form_id': str(form.id),
                                'form_name': form.name,
                                'version': form.version,
                            }
                        )
                    except TenantForm.DoesNotExist:
                        logger.warning(f'[Pin] Form {tenant_form_id} not found for node {node.get("id")}')

        # Store version snapshot in workflow metadata
        if not workflow.metadata:
            workflow.metadata = {}

        workflow.metadata['pinned_versions'] = {
            'pinned_at': timezone.now().isoformat(),
            'forms': pinned_forms,
        }
        workflow.save(update_fields=['metadata'])

        logger.info(f'[Pin] Pinned {len(pinned_forms)} form versions for workflow {workflow_id}')

        return {
            'success': True,
            'workflow_id': str(workflow_id),
            'pinned_count': len(pinned_forms),
            'pinned_forms': pinned_forms,
        }
    except TenantWorkForm.DoesNotExist:
        logger.error(f'[Pin] Workflow {workflow_id} not found')
        return {
            'success': False,
            'error': 'Workflow not found',
        }
    finally:
        _reset_rls_session_vars()


@shared_task(name='system.execute_workform_execution', bind=True, max_retries=10)
def execute_workform_execution(self, execution_id: str, tenant_id: str) -> dict:
    """Execute a TenantWorkFormExecution asynchronously.

    Supports:
    - parallelPath fanout (Celery group/chord)
    - retry + DLQ for retryable action nodes (currently actionHTTP)

    This is used by the UI runtime route (/tenant-workforms/{id}/execute/) so
    Quick Actions can *run* workflows without blocking the request thread.
    """

    from apps.tenants.rls import set_current_tenant

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        logger.warning('[WorkFormExecution] Skipping execution=%s (RLS set failed: %s)', execution_id, rls.error)

        # Best-effort: mark the execution as failed so polling clients don't hang in perpetuity.
        try:
            from tenant_apps.workflows.models import TenantWorkFormExecution, TenantWorkFormExecutionStatus

            TenantWorkFormExecution.objects.filter(id=execution_id, tenant_id=tenant_id).update(
                status=TenantWorkFormExecutionStatus.FAILED,
                error_message=f'RLS set failed: {rls.error}',
                completed_at=timezone.now(),
            )
        except Exception:
            logger.exception('[WorkFormExecution] Failed to mark execution=%s as failed after RLS error', execution_id)

        return {'success': False, 'error': rls.error}

    from celery import chord, group

    from tenant_apps.workflows.models import (
        TenantWorkFormExecution,
        TenantWorkFormExecutionStatus,
        WorkflowDeadLetter,
    )
    from apps.system.services.workform_engine import (
        ParallelExecutionRequested,
        RetryableNodeError,
        WorkFormEngine,
    )

    try:
        execution = (
            TenantWorkFormExecution.objects.select_related('workform', 'tenant')
            .filter(id=execution_id, tenant_id=tenant_id)
            .first()
        )
        if not execution:
            return {'success': False, 'error': 'Execution not found'}

        workform = execution.workform
        initial_data = execution.initial_data or {}

        ctx = dict(execution.context_data or {})
        ctx.setdefault('trigger', initial_data)
        ctx.setdefault('variables', {})
        ctx.setdefault('errors', [])
        ctx.setdefault('audit_trail', [])
        ctx.setdefault('parallel', {})
        ctx.setdefault('resume_node_id', None)
        ctx['variables'] = dict(ctx.get('variables') or {})
        ctx['variables'].setdefault('execution_id', str(execution.id))

        start_node_id = ctx.get('resume_node_id') or None

        execution.status = TenantWorkFormExecutionStatus.IN_PROGRESS
        if not execution.started_at:
            execution.started_at = timezone.now()
        execution.save(update_fields=['status', 'started_at'])

        engine = WorkFormEngine(workform, initial_context=ctx)

        try:
            result = engine.execute(trigger_payload=initial_data, start_node_id=start_node_id)
        except RetryableNodeError as exc:
            checkpoint = dict(engine.context or {})
            checkpoint['resume_node_id'] = str(getattr(exc, 'node_id', '') or '')
            execution.context_data = checkpoint
            execution.audit_trail = (checkpoint or {}).get('audit_trail', [])
            execution.save(update_fields=['context_data', 'audit_trail'])
            _sync_execution_telemetry(execution)

            retries_so_far = int(getattr(self.request, 'retries', 0) or 0)
            max_retries = int(getattr(exc, 'max_retries', 0) or 0)
            if retries_so_far < max_retries:
                countdown = min(30 * (2 ** retries_so_far), 600)
                raise self.retry(countdown=countdown, exc=exc)

            WorkflowDeadLetter.objects.create(
                tenant_id=str(tenant_id),
                workform_id=str(workform.id),
                workform_execution_id=str(execution.id),
                node_id=str(getattr(exc, 'node_id', '') or ''),
                node_type=str(getattr(exc, 'node_type', '') or ''),
                task_id=str(getattr(self.request, 'id', '') or ''),
                trigger_data=initial_data,
                execution_context=checkpoint,
                error_message=str(getattr(exc, 'error', '') or str(exc)),
                retry_count=retries_so_far,
            )

            execution.status = TenantWorkFormExecutionStatus.SUSPENDED
            execution.error_message = str(getattr(exc, 'error', '') or str(exc))
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error_message', 'completed_at'])
            _sync_execution_telemetry(execution)
            return {'success': False, 'execution_id': str(execution.id), 'error': execution.error_message, 'suspended': True}
        except ParallelExecutionRequested as exc:
            plan = exc.plan

            execution.context_data = engine.context
            execution.audit_trail = (engine.context or {}).get('audit_trail', [])
            execution.save(update_fields=['context_data', 'audit_trail'])
            _sync_execution_telemetry(execution)

            branch_sigs = [
                execute_workform_parallel_branch.s(
                    execution_id=str(execution.id),
                    tenant_id=str(tenant_id),
                    workform_id=str(workform.id),
                    parallel_node_id=str(plan.node_id),
                    branch_index=int(idx),
                    start_node_id=str(start_id),
                    join_node_id=str(plan.join_node_id) if plan.join_node_id else None,
                    base_context=plan.base_context,
                )
                for idx, start_id in enumerate(plan.branch_start_node_ids)
            ]

            if plan.wait_strategy == 'none':
                group(branch_sigs).delay()

                if plan.join_node_id:
                    resumed = WorkFormEngine(workform, initial_context=engine.context)
                    result = resumed.execute(trigger_payload=initial_data, start_node_id=str(plan.join_node_id))
                else:
                    return {
                        'success': True,
                        'execution_id': str(execution.id),
                        'status': TenantWorkFormExecutionStatus.IN_PROGRESS,
                        'deferred': True,
                        'parallel_node_id': str(plan.node_id),
                    }
            else:
                cb = continue_workform_after_parallel.s(
                    execution_id=str(execution.id),
                    tenant_id=str(tenant_id),
                    workform_id=str(workform.id),
                    parallel_node_id=str(plan.node_id),
                    join_node_id=str(plan.join_node_id) if plan.join_node_id else '',
                    base_context=plan.base_context,
                    wait_strategy=str(plan.wait_strategy),
                    error_strategy=str(plan.error_strategy),
                )
                chord(group(branch_sigs))(cb)
                return {
                    'success': True,
                    'execution_id': str(execution.id),
                    'status': TenantWorkFormExecutionStatus.IN_PROGRESS,
                    'deferred': True,
                    'parallel_node_id': str(plan.node_id),
                    'join_node_id': str(plan.join_node_id) if plan.join_node_id else None,
                }

        execution.context_data = result.context
        execution.audit_trail = (result.context or {}).get('audit_trail', [])
        execution.completed_at = timezone.now()
        if result.success:
            execution.status = TenantWorkFormExecutionStatus.COMPLETED
            execution.error_message = ''
        else:
            execution.status = TenantWorkFormExecutionStatus.FAILED
            execution.error_message = str(result.error or '')
        execution.save(update_fields=['status', 'context_data', 'audit_trail', 'error_message', 'completed_at'])
        _sync_execution_telemetry(execution)

        return {'success': bool(result.success), 'execution_id': str(execution.id), 'error': result.error}
    except Exception as exc:  # noqa: BLE001
        if 'execution' in locals() and execution is not None:
            execution.status = TenantWorkFormExecutionStatus.FAILED
            execution.error_message = str(exc)
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error_message', 'completed_at'])
            _sync_execution_telemetry(execution)
        return {'success': False, 'execution_id': str(execution_id), 'error': str(exc)}
    finally:
        _reset_rls_session_vars()


@shared_task(name='system.execute_workform_parallel_branch', bind=True, max_retries=10)
def execute_workform_parallel_branch(
    self,
    *,
    execution_id: str,
    tenant_id: str,
    workform_id: str,
    parallel_node_id: str,
    branch_index: int,
    start_node_id: str,
    join_node_id: str | None,
    base_context: dict | None = None,
) -> dict:
    """Execute a single parallel branch as a bounded sub-traversal."""

    from apps.tenants.rls import set_current_tenant

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        return {'success': False, 'error': f'rls_set_failed:{rls.error}', 'branch_index': int(branch_index)}

    from apps.system.models import TenantWorkForm
    from apps.system.services.workform_engine import ParallelExecutionRequested, RetryableNodeError, WorkFormEngine
    from tenant_apps.workflows.models import WorkflowDeadLetter

    try:
        workform = TenantWorkForm.objects.get(id=workform_id, tenant_id=tenant_id)

        ctx = dict(base_context or {})
        ctx.setdefault('trigger', {})
        ctx.setdefault('variables', {})
        ctx.setdefault('errors', [])
        ctx.setdefault('audit_trail', [])
        ctx.setdefault('parallel', {})

        ctx['variables'] = {
            **dict(ctx.get('variables') or {}),
            'parallel_node_id': str(parallel_node_id),
            'parallel_branch_index': int(branch_index),
        }

        engine = WorkFormEngine(workform, initial_context=ctx)

        try:
            result = engine.execute(
                trigger_payload=ctx.get('trigger'),
                start_node_id=str(start_node_id),
                stop_node_ids=[str(join_node_id)] if join_node_id else None,
            )
        except RetryableNodeError as exc:
            retries_so_far = int(getattr(self.request, 'retries', 0) or 0)
            max_retries = int(getattr(exc, 'max_retries', 0) or 0)
            if retries_so_far < max_retries:
                countdown = min(30 * (2 ** retries_so_far), 600)
                raise self.retry(countdown=countdown, exc=exc)

            WorkflowDeadLetter.objects.create(
                tenant_id=str(tenant_id),
                workform_id=str(workform.id),
                workform_execution_id=str(execution_id),
                node_id=str(getattr(exc, 'node_id', '') or ''),
                node_type=str(getattr(exc, 'node_type', '') or ''),
                task_id=str(getattr(self.request, 'id', '') or ''),
                trigger_data=dict(ctx.get('trigger') or {}),
                execution_context=dict(engine.context or {}),
                error_message=str(getattr(exc, 'error', '') or str(exc)),
                retry_count=retries_so_far,
            )

            return {
                'success': False,
                'branch_index': int(branch_index),
                'parallel_node_id': str(parallel_node_id),
                'start_node_id': str(start_node_id),
                'join_node_id': str(join_node_id) if join_node_id else None,
                'error': str(getattr(exc, 'error', '') or str(exc)),
                'errors': [
                    {
                        'code': 'retry_exhausted',
                        'node_id': str(getattr(exc, 'node_id', '') or ''),
                        'node_type': str(getattr(exc, 'node_type', '') or ''),
                        'message': str(getattr(exc, 'error', '') or str(exc)),
                    }
                ],
                'audit_tail': [],
                'variables': dict(ctx.get('variables') or {}),
            }
        except ParallelExecutionRequested as exc:
            return {
                'success': False,
                'error': f'nested_parallel_not_supported:{exc.plan.node_id}',
                'branch_index': int(branch_index),
            }

        return {
            'success': bool(result.success),
            'branch_index': int(branch_index),
            'parallel_node_id': str(parallel_node_id),
            'start_node_id': str(start_node_id),
            'join_node_id': str(join_node_id) if join_node_id else None,
            'error': result.error,
            'errors': list((result.context or {}).get('errors') or []),
            'audit_tail': list((result.context or {}).get('audit_trail') or [])[-50:],
            'variables': dict((result.context or {}).get('variables') or {}),
        }
    finally:
        _reset_rls_session_vars()


@shared_task(name='system.continue_workform_after_parallel')
def continue_workform_after_parallel(
    results: list,
    *,
    execution_id: str,
    tenant_id: str,
    workform_id: str,
    parallel_node_id: str,
    join_node_id: str,
    base_context: dict,
    wait_strategy: str,
    error_strategy: str,
) -> dict:
    """Chord callback: merge branch results and continue from the join node."""

    from apps.tenants.rls import set_current_tenant

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        return {'success': False, 'error': f'rls_set_failed:{rls.error}'}

    from apps.system.models import TenantWorkForm
    from tenant_apps.workflows.models import TenantWorkFormExecution, TenantWorkFormExecutionStatus
    from apps.system.services.workform_engine import WorkFormEngine

    try:
        execution = (
            TenantWorkFormExecution.objects.select_related('workform', 'tenant')
            .filter(id=execution_id, tenant_id=tenant_id)
            .first()
        )
        if not execution:
            return {'success': False, 'error': 'Execution not found'}

        workform = TenantWorkForm.objects.get(id=workform_id, tenant_id=tenant_id)

        ctx = dict(base_context or {})
        ctx.setdefault('errors', [])
        ctx.setdefault('audit_trail', [])
        ctx.setdefault('variables', {})
        ctx.setdefault('parallel', {})

        branch_results = results if isinstance(results, list) else []

        ctx['parallel'][str(parallel_node_id)] = {
            'wait_strategy': str(wait_strategy),
            'error_strategy': str(error_strategy),
            'join_node_id': str(join_node_id) if join_node_id else None,
            'branches': branch_results,
        }

        any_failed = any((not r.get('success')) for r in branch_results if isinstance(r, dict))
        any_retry_exhausted = any(
            any((e or {}).get('code') == 'retry_exhausted' for e in (r.get('errors') or []))
            for r in branch_results
            if isinstance(r, dict)
        )

        if any_retry_exhausted:
            execution.status = TenantWorkFormExecutionStatus.SUSPENDED
            execution.error_message = 'Parallel branch exhausted retries'
            execution.context_data = ctx
            execution.audit_trail = (ctx or {}).get('audit_trail', [])
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error_message', 'context_data', 'audit_trail', 'completed_at'])
            _sync_execution_telemetry(execution)
            return {'success': False, 'execution_id': str(execution.id), 'error': execution.error_message, 'suspended': True}

        if any_failed and str(error_strategy) == 'stop':
            engine = WorkFormEngine(workform, initial_context=ctx)
            error_target = engine._next_node_id(str(parallel_node_id), prefer_error=True)  # noqa: SLF001
            if error_target:
                result = engine.execute(
                    trigger_payload=ctx.get('trigger') if isinstance(ctx, dict) else {},
                    start_node_id=str(error_target),
                )

                execution.context_data = result.context
                execution.audit_trail = (result.context or {}).get('audit_trail', [])
                execution.status = TenantWorkFormExecutionStatus.FAILED if not result.success else TenantWorkFormExecutionStatus.COMPLETED
                execution.error_message = str(result.error or '')
                execution.completed_at = timezone.now()
                execution.save(update_fields=['status', 'context_data', 'audit_trail', 'error_message', 'completed_at'])
                _sync_execution_telemetry(execution)
                return {'success': bool(result.success), 'execution_id': str(execution.id), 'error': result.error}

            execution.status = TenantWorkFormExecutionStatus.FAILED
            execution.error_message = 'Parallel branch failed (stop on error)'
            execution.context_data = ctx
            execution.audit_trail = (ctx or {}).get('audit_trail', [])
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error_message', 'context_data', 'audit_trail', 'completed_at'])
            _sync_execution_telemetry(execution)
            return {'success': False, 'execution_id': str(execution.id), 'error': execution.error_message}

        if join_node_id:
            engine = WorkFormEngine(workform, initial_context=ctx)
            result = engine.execute(
                trigger_payload=ctx.get('trigger') if isinstance(ctx, dict) else {},
                start_node_id=str(join_node_id),
            )

            execution.context_data = result.context
            execution.audit_trail = (result.context or {}).get('audit_trail', [])
            if result.success:
                execution.status = TenantWorkFormExecutionStatus.COMPLETED
                execution.error_message = ''
            else:
                execution.status = TenantWorkFormExecutionStatus.FAILED
                execution.error_message = str(result.error or '')
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'context_data', 'audit_trail', 'error_message', 'completed_at'])
            _sync_execution_telemetry(execution)
            return {'success': bool(result.success), 'execution_id': str(execution.id), 'error': result.error}

        execution.context_data = ctx
        execution.audit_trail = (ctx or {}).get('audit_trail', [])
        execution.completed_at = timezone.now()
        execution.status = TenantWorkFormExecutionStatus.FAILED if any_failed else TenantWorkFormExecutionStatus.COMPLETED
        execution.error_message = 'Parallel branch failed' if any_failed else ''
        execution.save(update_fields=['status', 'context_data', 'audit_trail', 'error_message', 'completed_at'])
        _sync_execution_telemetry(execution)
        return {'success': not any_failed, 'execution_id': str(execution.id), 'error': execution.error_message}
    finally:
        _reset_rls_session_vars()


@shared_task(name='system.execute_workform_loop_item')
def execute_workform_loop_item(
    workform_id: str,
    tenant_id: str,
    loop_node_id: str,
    loop_body_start_node_id: str,
    index: int,
    item: object,
    base_context: dict | None = None,
):
    """Execute a single loop iteration by running the loop-body subgraph.

    Inputs:
    - loop_body_start_node_id: the node at the head of the Loop Body edge.
    - base_context: serialized context from the parent execution (trigger + variables).

    Behavior:
    - Runs a bounded sub-traversal starting at loop_body_start_node_id.
    - Stops if it reaches loop_node_id again (cycle boundary) or terminates naturally.
    """
    from apps.system.models import TenantWorkForm
    from apps.system.services.workform_engine import WorkFormEngine

    logger.info('[LoopItem] workform=%s loop_node=%s index=%s', workform_id, loop_node_id, index)

    if connection.vendor == 'postgresql':
        from apps.tenants.rls import set_current_tenant

        rls = set_current_tenant(str(tenant_id))
        if not rls.ok:
            logger.warning('[LoopItem] Skipping workform=%s (RLS set failed: %s)', workform_id, rls.error)
            return {'success': False, 'workform_id': workform_id, 'error': rls.error}

    try:
        workform = TenantWorkForm.objects.get(id=workform_id, tenant_id=tenant_id)

        initial_context = dict(base_context or {})
        initial_context.setdefault('trigger', {})
        initial_context.setdefault('variables', {})
        initial_context.setdefault('errors', [])

        # Per-iteration variables
        initial_context['variables'] = {
            **dict(initial_context.get('variables') or {}),
            'item': item,
            'index': index,
        }

        engine = WorkFormEngine(workform, initial_context=initial_context)
        result = engine.execute(
            trigger_payload=initial_context.get('trigger'),
            start_node_id=loop_body_start_node_id,
            stop_node_ids=[loop_node_id],
        )

        return {
            'success': result.success,
            'workform_id': workform_id,
            'loop_node_id': loop_node_id,
            'loop_body_start_node_id': loop_body_start_node_id,
            'index': index,
            'error': result.error,
        }
    finally:
        _reset_rls_session_vars()
