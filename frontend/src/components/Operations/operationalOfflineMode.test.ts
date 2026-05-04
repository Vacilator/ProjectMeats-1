import { beforeEach, describe, expect, it } from 'vitest';

import {
  isOperationalOfflineQueueEnabled,
  OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY,
} from './operationalOfflineMode';

describe('operationalOfflineMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ENV;
  });

  it('defaults to enabled when no override is present', () => {
    expect(isOperationalOfflineQueueEnabled()).toBe(true);
  });

  it('disables the queue when the local rollout guard key is present', () => {
    window.localStorage.setItem(OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY, '1');

    expect(isOperationalOfflineQueueEnabled()).toBe(false);
  });

  it('prioritizes runtime config overrides over the local guard key', () => {
    window.localStorage.setItem(OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY, '1');
    window.ENV = {
      ENABLE_OPERATIONAL_OFFLINE_QUEUE: 'true',
    };

    expect(isOperationalOfflineQueueEnabled()).toBe(true);
  });
});
