import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attemptChunkRecovery,
  buildChunkRecoveryUrl,
  CHUNK_RECOVERY_STORAGE_KEY,
  importWithChunkRecovery,
  isChunkLoadError,
} from './chunkLoadRecovery';

describe('chunkLoadRecovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('detects common chunk import failures', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 123 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Boom'))).toBe(false);
  });

  it('adds a cache-busting query parameter to recovery urls', () => {
    const nextUrl = buildChunkRecoveryUrl('https://dev.meatscentral.com/cockpit?tab=plants');
    expect(nextUrl).toContain('__chunk_reload=');
    expect(nextUrl).toContain('tab=plants');
  });

  it('attempts chunk recovery only once per session marker', () => {
    const navigate = vi.fn();
    const href = 'https://dev.meatscentral.com/workforms/editor';
    const error = new Error('Failed to fetch dynamically imported module');

    expect(
      attemptChunkRecovery(error, {
        source: 'test',
        href,
        storage: window.sessionStorage,
        navigate,
      })
    ).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY)).toContain('"source":"test"');

    expect(
      attemptChunkRecovery(error, {
        source: 'test',
        href,
        storage: window.sessionStorage,
        navigate,
      })
    ).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('keeps bootstrap imports pending after scheduling a chunk recovery reload', async () => {
    const navigate = vi.fn();
    const promise = importWithChunkRecovery(
      async () => {
        throw new Error('Failed to fetch dynamically imported module');
      },
      'bootstrap-test',
      {
        href: 'https://dev.meatscentral.com/',
        storage: window.sessionStorage,
        navigate,
      }
    );

    const pendingState = Promise.race([
      promise.then(() => 'resolved'),
      Promise.resolve().then(() => 'pending'),
    ]);

    expect(await pendingState).toBe('pending');
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
