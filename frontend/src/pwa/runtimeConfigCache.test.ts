import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCachedRuntimeConfigSnapshot,
  hydrateRuntimeConfigFromCache,
  persistRuntimeConfigSnapshot,
} from './runtimeConfigCache';

describe('runtimeConfigCache', () => {
  beforeEach(() => {
    delete window.ENV;
    window.localStorage.clear();
  });

  it('persists the active runtime config snapshot', () => {
    window.ENV = {
      API_BASE_URL: 'https://api.example.com/api/v1',
      ENVIRONMENT: 'production',
      ENABLE_DEBUG: 'false',
    };

    const snapshot = persistRuntimeConfigSnapshot();

    expect(snapshot).toEqual({
      API_BASE_URL: 'https://api.example.com/api/v1',
      ENVIRONMENT: 'production',
      ENABLE_DEBUG: 'false',
    });
    expect(getCachedRuntimeConfigSnapshot()).toEqual(snapshot);
  });

  it('hydrates window.ENV from the cached snapshot when runtime config is unavailable', () => {
    window.localStorage.setItem(
      'projectmeats.runtime-config.v1',
      JSON.stringify({
        API_BASE_URL: 'https://offline.example.com/api/v1',
        ENVIRONMENT: 'production',
      })
    );

    const hydrated = hydrateRuntimeConfigFromCache();

    expect(hydrated).toEqual({
      API_BASE_URL: 'https://offline.example.com/api/v1',
      ENVIRONMENT: 'production',
    });
    expect(window.ENV).toEqual(hydrated);
  });

  it('prefers live runtime config values over stale cached values', () => {
    window.localStorage.setItem(
      'projectmeats.runtime-config.v1',
      JSON.stringify({
        API_BASE_URL: 'https://stale.example.com/api/v1',
        ENVIRONMENT: 'uat',
      })
    );
    window.ENV = {
      API_BASE_URL: 'https://live.example.com/api/v1',
      ENVIRONMENT: 'production',
      ENABLE_CHAT_EXPORT: 'true',
    };

    const hydrated = hydrateRuntimeConfigFromCache();

    expect(hydrated).toEqual({
      API_BASE_URL: 'https://live.example.com/api/v1',
      ENVIRONMENT: 'production',
      ENABLE_CHAT_EXPORT: 'true',
    });
    expect(window.ENV).toEqual({
      API_BASE_URL: 'https://live.example.com/api/v1',
      ENVIRONMENT: 'production',
      ENABLE_CHAT_EXPORT: 'true',
    });
  });

  it('preserves additional runtime flags from env-config on first load', () => {
    window.ENV = {
      ENVIRONMENT: 'production',
      GIT_COMMIT_SHA: 'abc123',
      SENTRY_ENABLED: 'true',
    };

    const hydrated = hydrateRuntimeConfigFromCache();

    expect(hydrated).toEqual({
      ENVIRONMENT: 'production',
      GIT_COMMIT_SHA: 'abc123',
      SENTRY_ENABLED: 'true',
    });
  });

  it('drops removed runtime keys when persisting a fresh live snapshot', () => {
    window.localStorage.setItem(
      'projectmeats.runtime-config.v1',
      JSON.stringify({
        API_BASE_URL: 'https://stale.example.com/api/v1',
        LEGACY_FLAG: 'true',
      })
    );

    const liveSnapshot = {
      API_BASE_URL: 'https://live.example.com/api/v1',
    };

    const hydrated = hydrateRuntimeConfigFromCache(liveSnapshot);
    persistRuntimeConfigSnapshot(liveSnapshot);

    expect(hydrated).toEqual({
      API_BASE_URL: 'https://live.example.com/api/v1',
    });
    expect(getCachedRuntimeConfigSnapshot()).toEqual({
      API_BASE_URL: 'https://live.example.com/api/v1',
    });
  });
});
