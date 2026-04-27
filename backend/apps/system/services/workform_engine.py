"""apps.system.services.workform_engine

Vanguard 1 (Scale Phase): Graph execution scaffolding for TenantWorkForm.

This is a *minimal* traversal engine for React Flow-style graphs stored in
`TenantWorkForm.workflow_definition`.

Capabilities (scaffold):
- Walk node graph from trigger/start nodes
- Execute Action nodes via `tenant_apps.workflows.services.action_executor.ActionExecutor`
- Try/except routing: if an Action node fails and has an outgoing `edge.type == 'error'`,
  push error payload into context and route execution down the error edge.
- Loop node placeholder: for loop nodes, resolve input array and enqueue a Celery task
  per item (sub-execution), then continue down the non-error path.

NOTE: This engine is intentionally conservative and does NOT yet implement full
loop-body subgraphs, parallelism, or persistence of execution logs.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from django.utils import timezone

from apps.system.models.tenant_workform import TenantWorkForm
from tenant_apps.workflows.services.action_executor import ActionExecutor

from apps.system.tasks import execute_workform_loop_item

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    success: bool
    context: Dict[str, Any]
    error: Optional[str] = None


@dataclass
class ParallelExecutionPlan:
    node_id: str
    branch_start_node_ids: List[str]
    join_node_id: Optional[str]
    wait_strategy: str
    error_strategy: str
    base_context: Dict[str, Any]


class ParallelExecutionRequested(Exception):
    def __init__(self, plan: ParallelExecutionPlan):
        super().__init__(f'parallel_execution_requested:{plan.node_id}')
        self.plan = plan


class RetryableNodeError(Exception):
    def __init__(
        self,
        *,
        node_id: str,
        node_type: str,
        error: str,
        max_retries: int = 0,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(error)
        self.node_id = node_id
        self.node_type = node_type
        self.error = error
        self.max_retries = int(max_retries or 0)
        self.details = details or {}


class WorkFormEngine:
    """Primary graph traversal loop for TenantWorkForm."""

    def __init__(self, workform: TenantWorkForm, *, initial_context: Optional[Dict[str, Any]] = None):
        self.workform = workform
        self.definition = workform.workflow_definition or {}
        self.nodes: List[Dict[str, Any]] = self.definition.get('nodes', []) or []
        self.edges: List[Dict[str, Any]] = self.definition.get('edges', []) or []
        self.node_by_id: Dict[str, Dict[str, Any]] = {n.get('id'): n for n in self.nodes if isinstance(n, dict) and n.get('id')}

        self.context: Dict[str, Any] = initial_context or {}
        self.context.setdefault('variables', {})
        self.context.setdefault('errors', [])
        self.context.setdefault('audit_trail', [])

        self.action_executor = ActionExecutor(workform.tenant, self.context)

    def execute(
        self,
        trigger_payload: Optional[Dict[str, Any]] = None,
        *,
        start_node_id: Optional[str] = None,
        stop_node_ids: Optional[List[str]] = None,
    ) -> ExecutionResult:
        self.context.setdefault('trigger', trigger_payload or {})

        start_id = start_node_id or self._find_start_node_id()
        if not start_id:
            return ExecutionResult(success=False, context=self.context, error='No start/trigger node found')

        self._append_audit_event('execution_start', node_id=start_id)

        stop_set = set(stop_node_ids or [])

        current_id: Optional[str] = start_id
        visited_guard = 0

        while current_id:
            if current_id in stop_set:
                break
            visited_guard += 1
            if visited_guard > 5000:
                return ExecutionResult(success=False, context=self.context, error='Traversal guard tripped (possible cycle)')

            node = self.node_by_id.get(current_id)
            if not node:
                return ExecutionResult(success=False, context=self.context, error=f'Node not found: {current_id}')

            node_type = (node.get('type') or '').strip()
            self._append_audit_event('node_enter', node_id=current_id, node_type=node_type)

            # Terminal nodes
            if node_type.startswith('end') or node_type.startswith('terminal'):
                self._append_audit_event('node_terminal', node_id=current_id, node_type=node_type)
                break

            # Loop nodes
            if node_type.startswith('loop'):
                loop_body_start = self._next_node_id(current_id, prefer_error=False, source_handle='loop-body')
                on_complete = self._next_node_id(current_id, prefer_error=False, source_handle='on-complete')

                # Enqueue sub-executions for each array item down the Loop Body edge.
                enqueued = 0
                if loop_body_start:
                    enqueued = self._handle_loop_node(node, loop_body_start_node_id=loop_body_start)

                self._append_audit_event('loop_enqueued', node_id=current_id, node_type=node_type, items=enqueued)

                # Continue down the On Complete path (or fall back to first non-error edge).
                current_id = on_complete or self._next_node_id(
                    current_id,
                    prefer_error=False,
                    exclude_source_handles={'loop-body'},
                )
                continue

            # Parallel fanout: defer orchestration to Celery so branches can execute concurrently.
            if node_type == 'parallelPath':
                plan = self._plan_parallel_execution(node_id=current_id)
                self._append_audit_event(
                    'parallel_deferred',
                    node_id=current_id,
                    node_type=node_type,
                    branches=len(plan.branch_start_node_ids),
                    join_node_id=plan.join_node_id,
                    wait_strategy=plan.wait_strategy,
                    error_strategy=plan.error_strategy,
                )
                raise ParallelExecutionRequested(plan)

            # Action nodes: wrap with try/except and route to error edge if present
            if node_type.startswith('action'):
                try:
                    self._append_audit_event('action_start', node_id=current_id, node_type=node_type)
                    self._execute_action_node(node)
                    self._append_audit_event('action_success', node_id=current_id, node_type=node_type)
                    current_id = self._next_node_id(current_id, prefer_error=False)
                    continue
                except RetryableNodeError:
                    raise
                except Exception as e:  # noqa: BLE001 - routing policy
                    error_target = self._next_node_id(current_id, prefer_error=True)
                    if error_target:
                        payload = {
                            'node_id': current_id,
                            'node_type': node_type,
                            'error': str(e),
                        }
                        self.context['errors'].append(payload)
                        self.context['variables']['last_error'] = payload
                        self._append_audit_event('action_error', node_id=current_id, node_type=node_type, error=str(e), routed_to=error_target)
                        logger.warning('[WorkFormEngine] Routed error from %s to %s: %s', current_id, error_target, e)
                        current_id = error_target
                        continue

                    self._append_audit_event('action_error', node_id=current_id, node_type=node_type, error=str(e))
                    return ExecutionResult(success=False, context=self.context, error=str(e))

            # Default: traverse first non-error outgoing edge
            current_id = self._next_node_id(current_id, prefer_error=False)

        # Execution bookkeeping
        try:
            self.workform.increment_execution_count()
        except Exception:
            logger.exception('[WorkFormEngine] Failed to increment execution count')

        self._append_audit_event('execution_complete')
        return ExecutionResult(success=True, context=self.context)

    # ---------------------------------------------------------------------
    # Internals
    # ---------------------------------------------------------------------

    def _append_audit_event(self, event: str, *, node_id: Optional[str] = None, node_type: Optional[str] = None, **meta) -> None:
        trail = self.context.get('audit_trail')
        if not isinstance(trail, list):
            trail = []
            self.context['audit_trail'] = trail

        row: Dict[str, Any] = {
            'ts': timezone.now().isoformat(),
            'event': event,
        }
        if node_id:
            row['node_id'] = node_id
        if node_type:
            row['node_type'] = node_type
        if meta:
            row.update(meta)

        trail.append(row)

    def _find_start_node_id(self) -> Optional[str]:
        # Prefer trigger* nodes
        for n in self.nodes:
            if not isinstance(n, dict):
                continue
            t = (n.get('type') or '')
            if t.startswith('trigger'):
                return n.get('id')

        # Fallback: node with no incoming edges
        incoming = {e.get('target') for e in self.edges if isinstance(e, dict)}
        for n in self.nodes:
            if not isinstance(n, dict):
                continue
            nid = n.get('id')
            if nid and nid not in incoming:
                return nid
        return None

    def _plan_parallel_execution(self, *, node_id: str) -> ParallelExecutionPlan:
        node = self.node_by_id.get(node_id) or {}
        data = node.get('data') or {}
        config = data.get('config') or {}

        wait_strategy = str(config.get('waitStrategy') or 'all').strip() or 'all'
        error_strategy = str(config.get('errorStrategy') or 'stop').strip() or 'stop'

        branch_start_node_ids = self._outgoing_targets(node_id, exclude_error=True)

        join_node_id = None
        if branch_start_node_ids:
            join_node_id = self._nearest_common_descendant(branch_start_node_ids)

        base_context = dict(self.context or {})

        return ParallelExecutionPlan(
            node_id=str(node_id),
            branch_start_node_ids=[str(x) for x in branch_start_node_ids],
            join_node_id=str(join_node_id) if join_node_id else None,
            wait_strategy=wait_strategy,
            error_strategy=error_strategy,
            base_context=base_context,
        )

    def _outgoing_edges(self, source_id: str, *, exclude_error: bool) -> List[Dict[str, Any]]:
        edges = [e for e in self.edges if isinstance(e, dict) and e.get('source') == source_id]
        if exclude_error:
            edges = [e for e in edges if (e.get('type') or '') != 'error']
        return edges

    def _outgoing_targets(self, source_id: str, *, exclude_error: bool) -> List[str]:
        targets: List[str] = []
        for e in self._outgoing_edges(source_id, exclude_error=exclude_error):
            t = e.get('target')
            if t:
                targets.append(str(t))
        return targets

    def _reachable_distances(self, start_id: str) -> Dict[str, int]:
        # BFS over non-error edges
        q: List[str] = [start_id]
        dist: Dict[str, int] = {start_id: 0}

        i = 0
        while i < len(q):
            cur = q[i]
            i += 1

            if dist[cur] > 2000:
                # Safety: overly deep graphs are considered invalid.
                break

            for nxt in self._outgoing_targets(cur, exclude_error=True):
                if nxt not in dist:
                    dist[nxt] = dist[cur] + 1
                    q.append(nxt)

        return dist

    def _nearest_common_descendant(self, branch_start_ids: List[str]) -> Optional[str]:
        if not branch_start_ids:
            return None

        dists = [self._reachable_distances(s) for s in branch_start_ids]
        common = set(dists[0].keys())
        for d in dists[1:]:
            common &= set(d.keys())

        if not common:
            return None

        # Prefer a node that is not one of the branch starts.
        common -= set(branch_start_ids)
        if not common:
            return None

        best_node = None
        best_score = None
        for nid in common:
            # Deterministic join: minimize max distance across branches; tie-break by sum.
            distances = [d.get(nid, 10**9) for d in dists]
            score = (max(distances), sum(distances), str(nid))
            if best_score is None or score < best_score:
                best_score = score
                best_node = nid

        return best_node

    def _next_node_id(
        self,
        source_id: str,
        *,
        prefer_error: bool,
        source_handle: Optional[str] = None,
        exclude_source_handles: Optional[set[str]] = None,
    ) -> Optional[str]:
        outgoing = [e for e in self.edges if isinstance(e, dict) and e.get('source') == source_id]
        exclude_source_handles = exclude_source_handles or set()

        def _handle_of(edge: Dict[str, Any]) -> Optional[str]:
            return edge.get('sourceHandle') or edge.get('source_handle')

        if source_handle:
            outgoing = [e for e in outgoing if _handle_of(e) == source_handle]
        else:
            outgoing = [e for e in outgoing if _handle_of(e) not in exclude_source_handles]

        if prefer_error:
            for e in outgoing:
                if (e.get('type') or '') == 'error':
                    return e.get('target')
            return None

        # Non-error path
        for e in outgoing:
            if (e.get('type') or '') != 'error':
                return e.get('target')
        return None

    def _execute_action_node(self, node: Dict[str, Any]) -> None:
        node_type = node.get('type')
        data = node.get('data') or {}
        config = data.get('config') or data

        action_type = self._map_action_type(node_type)
        result = self.action_executor.execute(action_type, config)

        if not result.get('success', False):
            error_handling = str(config.get('errorHandling') or config.get('error_handling') or 'none').strip()
            max_retries = config.get('maxRetries') or config.get('max_retries')
            try:
                max_retries = int(max_retries) if max_retries is not None else 3
            except (TypeError, ValueError):
                max_retries = 3

            transient = bool(result.get('transient'))
            if transient and error_handling == 'retry':
                raise RetryableNodeError(
                    node_id=str(node.get('id') or ''),
                    node_type=str(node_type or ''),
                    error=str(result.get('error') or 'Action failed'),
                    max_retries=max_retries,
                    details=dict(result),
                )

            raise RuntimeError(result.get('error') or 'Action failed')

        self.context['variables']['last_action_result'] = result

    def _handle_loop_node(self, node: Dict[str, Any], *, loop_body_start_node_id: str) -> int:
        data = node.get('data') or {}
        config = data.get('config') or {}

        array_expr = config.get('arrayVariable') or config.get('collection') or config.get('array')
        max_iterations = int(config.get('maxIterations') or config.get('max_iterations') or 1000)

        items = self._resolve_array(array_expr)
        if items is None:
            logger.warning('[WorkFormEngine] Loop array resolved to None: %s', array_expr)
            return 0

        if not isinstance(items, list):
            logger.warning('[WorkFormEngine] Loop array is not a list (%s): %s', type(items).__name__, array_expr)
            return 0

        if len(items) > max_iterations:
            items = items[:max_iterations]

        base_context = {
            'trigger': self.context.get('trigger', {}),
            'variables': dict(self.context.get('variables', {})),
        }

        for idx, item in enumerate(items):
            execute_workform_loop_item.delay(
                workform_id=str(self.workform.id),
                tenant_id=str(self.workform.tenant_id),
                loop_node_id=str(node.get('id')),
                loop_body_start_node_id=str(loop_body_start_node_id),
                index=idx,
                item=item,
                base_context=base_context,
            )

        return len(items)

    def _resolve_array(self, expr: Any) -> Optional[Any]:
        if not expr:
            return None

        if isinstance(expr, str):
            path = expr.strip()
            if path.startswith('{{') and path.endswith('}}'):
                path = path[2:-2].strip()

            # Allow both trigger.items and items
            if not path.startswith('trigger.'):
                path = f'trigger.{path}'

            cur: Any = self.context
            for part in path.split('.'):
                if isinstance(cur, dict):
                    cur = cur.get(part)
                else:
                    return None
            return cur

        return expr

    @staticmethod
    def _map_action_type(node_type: str) -> str:
        # Minimal mapping (scaffold)
        mapping = {
            'actionEmail': 'send_email',
            'actionCreateRecord': 'create_record',
            'actionUpdateRecord': 'update_record',
            'actionNotification': 'send_notification',
            'actionNotify': 'send_notification',  # canonical FlowEditor node type
            'notify': 'send_notification',  # legacy/alias
            'actionHTTP': 'http_request',
        }
        return mapping.get(node_type, node_type)
