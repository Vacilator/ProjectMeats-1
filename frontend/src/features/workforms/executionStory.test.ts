import { describe, expect, it } from 'vitest';

import { buildExecutionStory } from './executionStory';

describe('buildExecutionStory', () => {
  it('humanizes known events and maps node labels', () => {
    const execution: any = {
      id: 'ex-1',
      node_labels: { n1: 'Send Email' },
      audit_trail: [{ event: 'execution_start' }, { event: 'node_enter', node_id: 'n1' }],
    };

    const story = buildExecutionStory(execution);

    expect(story[0].title).toBe('Run started');
    expect(story[1].title).toBe('Entered step');
    expect(story[1].node?.label).toBe('Send Email');
  });

  it('renders unknown events as a fallback title', () => {
    const execution: any = {
      id: 'ex-1',
      audit_trail: [{ event: 'weird_backend_event' }],
    };

    const story = buildExecutionStory(execution);
    expect(story[0].title).toBe('weird backend event');
  });

  it('includes action_error message and routed_to description when present', () => {
    const execution: any = {
      id: 'ex-1',
      node_labels: { n2: 'Create Task' },
      audit_trail: [{ event: 'action_error', error: 'Boom', routed_to: 'n2' }],
    };

    const story = buildExecutionStory(execution);

    expect(story[0].variant).toBe('error');
    expect(story[0].description).toMatch(/Boom/);
    expect(story[0].description).toMatch(/Routed to: Create Task/);
  });
});
