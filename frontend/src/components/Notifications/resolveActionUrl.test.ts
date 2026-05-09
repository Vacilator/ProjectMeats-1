import { describe, it, expect } from 'vitest';
import { resolveActionUrl } from './NotificationPanel';

describe('resolveActionUrl', () => {
  it('returns empty string when action_url is empty', () => {
    expect(resolveActionUrl({ action_url: '', metadata: {} })).toBe('');
  });

  it('returns empty string when action_url is null/undefined', () => {
    expect(resolveActionUrl({ action_url: undefined as unknown as string, metadata: {} })).toBe('');
  });

  // --- Process Cockpit redirects ---

  it('redirects /process-cockpit to command-center action-required tab', () => {
    const result = resolveActionUrl({ action_url: '/process-cockpit', metadata: {} });
    expect(result).toBe('/command-center?tab=action-required');
  });

  it('redirects /process-cockpit with draft_id to command-center with item param', () => {
    const result = resolveActionUrl({
      action_url: '/process-cockpit/items/123',
      metadata: { draft_id: 'draft-xyz' },
    });
    expect(result).toBe('/command-center?tab=action-required&item=draft-xyz');
  });

  it('redirects URLs containing process-cockpit anywhere', () => {
    const result = resolveActionUrl({
      action_url: '/some/path/process-cockpit/view',
      metadata: {},
    });
    expect(result).toBe('/command-center?tab=action-required');
  });

  // --- Trader Cockpit redirects ---

  it('redirects /trader-cockpit to command-center pipeline tab', () => {
    const result = resolveActionUrl({ action_url: '/trader-cockpit', metadata: {} });
    expect(result).toBe('/command-center?tab=pipeline');
  });

  it('redirects /trader-cockpit subpath to command-center pipeline tab', () => {
    const result = resolveActionUrl({ action_url: '/trader-cockpit/trades/abc', metadata: {} });
    expect(result).toBe('/command-center?tab=pipeline');
  });

  // --- AI Assistant redirects ---

  it('redirects /ai-assistant to command-center action-required tab', () => {
    const result = resolveActionUrl({ action_url: '/ai-assistant', metadata: {} });
    expect(result).toBe('/command-center?tab=action-required');
  });

  it('redirects /ai-assistant with review_id to command-center with item param', () => {
    const result = resolveActionUrl({
      action_url: '/ai-assistant/review/r1',
      metadata: { review_id: 'review-abc' },
    });
    expect(result).toBe('/command-center?tab=action-required&item=review-abc');
  });

  it('redirects ai-assistant with item_id metadata', () => {
    const result = resolveActionUrl({
      action_url: '/ai-assistant',
      metadata: { item_id: 'item-999' },
    });
    expect(result).toBe('/command-center?tab=action-required&item=item-999');
  });

  // --- Activity redirects ---

  it('redirects /activity to command-center action-required tab', () => {
    const result = resolveActionUrl({ action_url: '/activity', metadata: {} });
    expect(result).toBe('/command-center?tab=action-required');
  });

  it('redirects /activity/feed to command-center action-required tab', () => {
    const result = resolveActionUrl({ action_url: '/activity/feed', metadata: {} });
    expect(result).toBe('/command-center?tab=action-required');
  });

  // --- Passthrough (unknown URLs) ---

  it('passes through unknown URLs unchanged', () => {
    expect(resolveActionUrl({ action_url: '/inquiries/inq-1', metadata: {} })).toBe('/inquiries/inq-1');
  });

  it('passes through workforms URLs unchanged', () => {
    expect(resolveActionUrl({ action_url: '/workforms/tasks', metadata: {} })).toBe('/workforms/tasks');
  });

  it('passes through my-tasks URLs unchanged', () => {
    expect(resolveActionUrl({
      action_url: '/my-tasks?tab=ai-review&draft=draft-1',
      metadata: {},
    })).toBe('/my-tasks?tab=ai-review&draft=draft-1');
  });

  // --- Metadata priority ---

  it('uses draft_id first, then review_id, then item_id', () => {
    const result = resolveActionUrl({
      action_url: '/process-cockpit',
      metadata: { draft_id: 'first', review_id: 'second', item_id: 'third' },
    });
    expect(result).toBe('/command-center?tab=action-required&item=first');
  });

  it('falls back to review_id when draft_id is absent', () => {
    const result = resolveActionUrl({
      action_url: '/ai-assistant',
      metadata: { review_id: 'review-2', item_id: 'item-3' },
    });
    expect(result).toBe('/command-center?tab=action-required&item=review-2');
  });

  it('handles empty metadata gracefully', () => {
    const result = resolveActionUrl({ action_url: '/process-cockpit', metadata: null as any });
    expect(result).toBe('/command-center?tab=action-required');
  });
});
