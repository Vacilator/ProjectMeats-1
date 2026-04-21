import React from 'react';

import type { WorkFormExecution } from '@/services/workformExecutionService';
import { buildExecutionStory } from './executionStory';

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace('.000Z', 'Z');
}

function variantStyles(variant: string): { border: string; background: string; color: string } {
  switch (variant) {
    case 'error':
      return {
        border: 'rgb(var(--color-error))',
        background: 'rgb(var(--color-error) / 0.08)',
        color: 'rgb(var(--color-error))',
      };
    case 'success':
      return {
        border: 'rgb(var(--color-success))',
        background: 'rgb(var(--color-success) / 0.10)',
        color: 'rgb(var(--color-success))',
      };
    case 'warning':
      return {
        border: 'rgb(var(--color-warning))',
        background: 'rgb(var(--color-warning) / 0.10)',
        color: 'rgb(var(--color-warning))',
      };
    case 'info':
      return {
        border: 'rgb(var(--color-info))',
        background: 'rgb(var(--color-info) / 0.10)',
        color: 'rgb(var(--color-info))',
      };
    default:
      return {
        border: 'rgb(var(--color-border))',
        background: 'rgb(var(--color-surface))',
        color: 'rgb(var(--color-text-secondary))',
      };
  }
}

export const ExecutionStoryView: React.FC<{ execution: WorkFormExecution }> = ({ execution }) => {
  const events = React.useMemo(() => buildExecutionStory(execution), [execution]);

  return (
    <section aria-labelledby="execution-story-heading">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2 id="execution-story-heading" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
          Execution story
        </h2>
        <div style={{ color: 'rgb(var(--color-text-tertiary))', fontSize: 12 }}>
          {execution.started_at ? (
            <time dateTime={execution.started_at}>Started: {formatTs(execution.started_at)}</time>
          ) : null}
          {execution.completed_at ? (
            <>
              {' '}•{' '}
              <time dateTime={execution.completed_at}>Completed: {formatTs(execution.completed_at)}</time>
            </>
          ) : null}
        </div>
      </div>

      {events.length === 0 ? (
        <div style={{ color: 'rgb(var(--color-text-secondary))', marginTop: 8 }}>
          No events recorded yet.
        </div>
      ) : (
        <ol
          role="list"
          aria-label="Execution story"
          style={{
            margin: '12px 0 0',
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {events.map((ev) => {
            const styles = variantStyles(ev.variant);
            return (
              <li
                key={ev.key}
                role="listitem"
                style={{
                  border: `1px solid ${styles.border}`,
                  borderRadius: 12,
                  padding: 12,
                  background: styles.background,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 700, color: 'rgb(var(--color-text-primary))' }}>{ev.title}</div>

                    {ev.node?.id ? (
                      <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                        Step:{' '}
                        <span style={{ fontWeight: 600 }}>
                          {ev.node.label ?? ev.node.id}
                        </span>
                        {ev.node.label ? (
                          <span style={{ color: 'rgb(var(--color-text-tertiary))' }}> ({ev.node.id})</span>
                        ) : null}
                        {ev.node.type ? <span> • {ev.node.type}</span> : null}
                      </div>
                    ) : null}

                    {ev.description ? (
                      <div style={{ color: styles.color, fontSize: 13, fontWeight: 600 }}>{ev.description}</div>
                    ) : null}
                  </div>

                  {ev.ts ? (
                    <time dateTime={ev.ts} style={{ color: 'rgb(var(--color-text-tertiary))', fontSize: 12 }}>
                      {formatTs(ev.ts)}
                    </time>
                  ) : null}
                </div>

                {ev.meta ? (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', color: 'rgb(var(--color-text-secondary))' }}>
                      Details (JSON)
                    </summary>
                    <pre
                      style={{
                        background: 'rgb(var(--color-surface))',
                        border: '1px solid rgb(var(--color-border))',
                        borderRadius: 8,
                        padding: 12,
                        overflow: 'auto',
                        maxHeight: 240,
                        marginTop: 8,
                      }}
                    >
                      {JSON.stringify(ev.meta, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
