import type {
  WorkFormExecution,
  WorkFormExecutionAuditEvent,
} from '@/services/workformExecutionService';

export type ExecutionStoryEventVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

export type ExecutionStoryEvent = {
  key: string;
  ts?: string;
  title: string;
  variant: ExecutionStoryEventVariant;
  node?: {
    id?: string;
    label?: string;
    type?: string;
  };
  description?: string;
  meta?: Record<string, unknown>;
};

const EVENT_TITLES: Record<string, string> = {
  execution_start: 'Run started',
  execution_complete: 'Run completed',
  node_enter: 'Entered step',
  node_terminal: 'Reached end',
  action_start: 'Started action',
  action_success: 'Action completed',
  action_error: 'Action failed',
  loop_enqueued: 'Loop enqueued',
};

function humanizeEvent(raw: string): string {
  if (!raw) return 'Event';
  const direct = EVENT_TITLES[raw];
  if (direct) return direct;
  return raw.split('_').join(' ');
}

function getEventVariant(raw: string): ExecutionStoryEventVariant {
  if (raw === 'action_error') return 'error';
  if (raw === 'action_success' || raw === 'execution_complete' || raw === 'node_terminal') return 'success';
  if (raw === 'execution_start' || raw === 'node_enter' || raw === 'action_start' || raw === 'loop_enqueued') return 'info';
  return 'default';
}

function getEventError(row: WorkFormExecutionAuditEvent): string | undefined {
  const candidates = [row.error, row.detail, row.message];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  return undefined;
}

function toMeta(row: WorkFormExecutionAuditEvent): Record<string, unknown> | undefined {
  const { event: _event, ts: _ts, node_id: _nodeId, node_type: _nodeType, ...rest } = row;
  const keys = Object.keys(rest);
  if (keys.length === 0) return undefined;

  const meta: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (rest as any)[k];
    // Avoid huge blobs in the story details.
    if (k === 'context' || k === 'inputs' || k === 'raw') continue;
    meta[k] = v;
  }

  return Object.keys(meta).length ? meta : undefined;
}

export function buildExecutionStory(execution: WorkFormExecution): ExecutionStoryEvent[] {
  const labels = execution.node_labels ?? {};
  const trail = Array.isArray(execution.audit_trail) ? execution.audit_trail : [];

  return trail.map((row, idx) => {
    const event = typeof row.event === 'string' ? row.event : 'event';
    const nodeId = typeof row.node_id === 'string' && row.node_id.trim() ? row.node_id : undefined;

    const routedTo = typeof row.routed_to === 'string' && row.routed_to.trim() ? row.routed_to : undefined;

    const descParts: string[] = [];

    const err = getEventError(row);
    if (event === 'action_error' && err) {
      descParts.push(err);
    }

    if (routedTo) {
      const label = labels[routedTo];
      descParts.push(`Routed to: ${label ?? routedTo}`);
    }

    return {
      key: `${execution.id}:audit:${idx}`,
      ts: typeof row.ts === 'string' ? row.ts : undefined,
      title: humanizeEvent(event),
      variant: getEventVariant(event),
      node: nodeId
        ? {
            id: nodeId,
            label: labels[nodeId],
            type: typeof row.node_type === 'string' ? row.node_type : undefined,
          }
        : undefined,
      description: descParts.length ? descParts.join(' • ') : undefined,
      meta: toMeta(row),
    };
  });
}
