import type { Node } from '@xyflow/react';

const UI_ONLY_KEYS = new Set(['shadowConfig', 'configStatus', '_upstreamVariables', 'hasBreakpoint']);

function sanitizeShallowObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (UI_ONLY_KEYS.has(k)) continue;
    if (typeof v === 'function') continue;
    out[k] = v;
  }
  return out;
}

export function sanitizeNodeConfigForPersistence(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value;
  return sanitizeShallowObject(value as Record<string, unknown>);
}

/**
 * Shallow sanitizer for persisted node.data.
 *
 * Intentionally NOT recursive to avoid breaking user-provided JSON payloads
 * (e.g. headers/body objects that may contain underscore keys).
 */
export function sanitizeNodeDataForPersistence(data: unknown): Record<string, any> {
  const base = sanitizeNodeConfigForPersistence(data);
  const out = (base && typeof base === 'object' && !Array.isArray(base))
    ? (base as Record<string, any>)
    : {};

  if (out.config && typeof out.config === 'object' && !Array.isArray(out.config)) {
    out.config = sanitizeNodeConfigForPersistence(out.config) as Record<string, any>;
  }

  return out;
}

export function sanitizeNodesForPersistence(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: sanitizeNodeDataForPersistence(n.data),
  }));
}
