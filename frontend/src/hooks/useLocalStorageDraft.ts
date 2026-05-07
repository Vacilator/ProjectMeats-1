import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isEqual } from 'lodash';

import { useDebounce } from '@/utils/performance';

type DraftValues = Record<string, unknown>;

const EMPTY_VALUES: DraftValues = {};

const safeReadDraft = (storageKey: string): DraftValues | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as DraftValues;
    }
  } catch {
    return null;
  }

  return null;
};

const safeRemoveDraft = (storageKey: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // best-effort only
  }
};

const safeWriteDraft = (storageKey: string, values: DraftValues): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch {
    // best-effort only
  }
};

const getSignature = (values: DraftValues): string => {
  try {
    return JSON.stringify(values);
  } catch {
    return String(values);
  }
};

export interface UseLocalStorageDraftOptions {
  storageKey: string;
  baseValues?: DraftValues;
  enabled?: boolean;
  delay?: number;
}

export interface UseLocalStorageDraftResult {
  hydratedInitialValues: DraftValues;
  persistDraft: (values: DraftValues) => void;
  clearDraft: () => void;
}

export const useLocalStorageDraft = ({
  storageKey,
  baseValues = EMPTY_VALUES,
  enabled = true,
  delay = 30000,
}: UseLocalStorageDraftOptions): UseLocalStorageDraftResult => {
  const stableBaseValues = useMemo(
    () => (baseValues && typeof baseValues === 'object' ? baseValues : EMPTY_VALUES),
    [baseValues],
  );
  const [hydratedInitialValues, setHydratedInitialValues] = useState<DraftValues>(stableBaseValues);
  const baselineSignatureRef = useRef(getSignature(stableBaseValues));

  useEffect(() => {
    if (!enabled) {
      baselineSignatureRef.current = getSignature(stableBaseValues);
      setHydratedInitialValues((prev) =>
        isEqual(prev, stableBaseValues) ? prev : stableBaseValues,
      );
      return;
    }

    const storedDraft = safeReadDraft(storageKey);
    const mergedValues = {
      ...stableBaseValues,
      ...(storedDraft || {}),
    };

    baselineSignatureRef.current = getSignature(mergedValues);
    setHydratedInitialValues((prev) => (isEqual(prev, mergedValues) ? prev : mergedValues));
  }, [enabled, stableBaseValues, storageKey]);

  const writeDraftNow = useCallback(
    (values: DraftValues) => {
      safeWriteDraft(storageKey, values);
    },
    [storageKey],
  );
  const debouncedWriteDraft = useDebounce(writeDraftNow, delay);

  const persistDraft = useCallback(
    (values: DraftValues) => {
      if (!enabled) {
        return;
      }

      const nextValues =
        values && typeof values === 'object' && !Array.isArray(values) ? values : EMPTY_VALUES;
      const nextSignature = getSignature(nextValues);

      if (nextSignature === baselineSignatureRef.current) {
        safeRemoveDraft(storageKey);
        return;
      }

      debouncedWriteDraft(nextValues);
    },
    [debouncedWriteDraft, enabled, storageKey],
  );

  const clearDraft = useCallback(() => {
    safeRemoveDraft(storageKey);
    baselineSignatureRef.current = getSignature(stableBaseValues);
  }, [stableBaseValues, storageKey]);

  return {
    hydratedInitialValues,
    persistDraft,
    clearDraft,
  };
};
