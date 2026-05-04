export const OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY = 'pm:disableOperationalOfflineQueue';

const isTruthyFlag = (value: string | undefined | null): boolean =>
  value === '1' || value === 'true';

const isFalsyFlag = (value: string | undefined | null): boolean =>
  value === '0' || value === 'false';

export const isOperationalOfflineQueueEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }

  const runtimeOverride = window.ENV?.ENABLE_OPERATIONAL_OFFLINE_QUEUE;
  if (isTruthyFlag(runtimeOverride)) {
    return true;
  }
  if (isFalsyFlag(runtimeOverride)) {
    return false;
  }

  return window.localStorage.getItem(OPERATIONAL_OFFLINE_QUEUE_DISABLE_KEY) !== '1';
};
