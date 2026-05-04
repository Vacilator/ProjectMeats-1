const RUNTIME_CONFIG_CACHE_KEY = 'projectmeats.runtime-config.v1';

export type RuntimeConfigSnapshot = Record<string, string>;

function canUseLocalStorage(): boolean {
  try {
    const probeKey = '__pm_runtime_config_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function sanitizeRuntimeConfigSnapshot(value: unknown): RuntimeConfigSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const snapshot: RuntimeConfigSnapshot = {};

  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      snapshot[key] = candidate;
    }
  }

  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

export function getCachedRuntimeConfigSnapshot(): RuntimeConfigSnapshot | null {
  if (typeof window === 'undefined' || !canUseLocalStorage()) {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(RUNTIME_CONFIG_CACHE_KEY);
    if (!cached) {
      return null;
    }

    return sanitizeRuntimeConfigSnapshot(JSON.parse(cached));
  } catch {
    return null;
  }
}

export function persistRuntimeConfigSnapshot(
  env: Window['ENV'] | undefined = window.ENV
): RuntimeConfigSnapshot | null {
  if (typeof window === 'undefined' || !canUseLocalStorage()) {
    return null;
  }

  const snapshot = sanitizeRuntimeConfigSnapshot(env);
  if (!snapshot) {
    return null;
  }

  window.localStorage.setItem(RUNTIME_CONFIG_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function hydrateRuntimeConfigFromCache(
  env: Window['ENV'] | undefined = window.ENV
): Window['ENV'] | undefined {
  if (typeof window === 'undefined') {
    return env;
  }

  const liveSnapshot = sanitizeRuntimeConfigSnapshot(env);
  if (liveSnapshot) {
    window.ENV = liveSnapshot;
    return window.ENV;
  }

  const cached = getCachedRuntimeConfigSnapshot();
  if (!cached) {
    return env;
  }

  window.ENV = cached;
  return window.ENV;
}
