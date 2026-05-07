import React from 'react';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type ChunkRecoveryOptions = {
  source?: string;
  href?: string;
  storage?: StorageLike | null;
  navigate?: (url: string) => void;
};

export const CHUNK_RECOVERY_STORAGE_KEY = 'pm:chunk-recovery';

const CHUNK_ERROR_PATTERNS = [
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'loading chunk',
];

const getSessionStorage = (): StorageLike | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
};

const getErrorText = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return `${error.name} ${error.message} ${error.stack ?? ''}`;
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error ?? '');
};

export const isChunkLoadError = (error: unknown): boolean => {
  const text = getErrorText(error).toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
};

export const buildChunkRecoveryUrl = (href: string): string => {
  const url = new URL(href);
  url.searchParams.set('__chunk_reload', String(Date.now()));
  return url.toString();
};

export const clearChunkRecoveryMarker = (storage: StorageLike | null = getSessionStorage()): void => {
  storage?.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
};

export const attemptChunkRecovery = (
  error: unknown,
  options?: ChunkRecoveryOptions
): boolean => {
  if (!isChunkLoadError(error)) {
    return false;
  }

  const storage = options?.storage ?? getSessionStorage();
  const href = options?.href ?? (typeof window !== 'undefined' ? window.location.href : '');
  if (!storage || !href) {
    return false;
  }

  if (storage.getItem(CHUNK_RECOVERY_STORAGE_KEY)) {
    return false;
  }

  const nextUrl = buildChunkRecoveryUrl(href);
  try {
    storage.setItem(
      CHUNK_RECOVERY_STORAGE_KEY,
      JSON.stringify({
        source: options?.source ?? 'unknown',
        url: nextUrl,
        at: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage failures; navigation still gives the user the best chance to recover.
  }

  const navigate =
    options?.navigate ??
    ((url: string) => {
      if (typeof window !== 'undefined') {
        window.location.replace(url);
      }
    });

  navigate(nextUrl);
  return true;
};

export const reloadApplication = (source = 'manual-reload'): void => {
  const href = typeof window !== 'undefined' ? window.location.href : '';
  if (!href) {
    return;
  }

  clearChunkRecoveryMarker();
  const nextUrl = buildChunkRecoveryUrl(href);
  const storage = getSessionStorage();
  try {
    storage?.setItem(
      CHUNK_RECOVERY_STORAGE_KEY,
      JSON.stringify({
        source,
        url: nextUrl,
        forced: true,
        at: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore storage failures; the reload is still useful.
  }

  window.location.replace(nextUrl);
};

export const importWithChunkRecovery = async <T>(
  loader: () => Promise<T>,
  source: string,
  options?: Omit<ChunkRecoveryOptions, 'source'>
): Promise<T> => {
  try {
    const module = await loader();
    clearChunkRecoveryMarker();
    return module;
  } catch (error) {
    if (attemptChunkRecovery(error, { ...options, source })) {
      return new Promise<T>(() => {});
    }
    throw error;
  }
};

export const lazyWithChunkRecovery = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  source: string
) => React.lazy(() => importWithChunkRecovery(loader, source));

export const getChunkRecoveryMessage = (error: unknown): string | null => {
  if (!isChunkLoadError(error)) {
    return null;
  }

  return 'A newer frontend bundle was deployed. Reload to fetch the latest assets.';
};
