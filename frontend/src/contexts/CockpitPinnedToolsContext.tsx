import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { WidgetConfig } from '../components/Widgets/WidgetGrid';

export type PinnedToolKind = 'widget' | 'tool';

export interface PinnedTool {
  id: string;
  kind: PinnedToolKind;
  title: string;
  widget?: WidgetConfig;
}

export interface CockpitPinnedToolsContextType {
  pinned: PinnedTool[];
  pinWidget: (widget: WidgetConfig) => void;
  unpin: (pinnedId: string) => void;
  isWidgetPinned: (widgetId: string) => boolean;
}

const CockpitPinnedToolsContext = createContext<CockpitPinnedToolsContextType | undefined>(undefined);

const FALLBACK_CTX: CockpitPinnedToolsContextType = {
  pinned: [],
  pinWidget: () => {},
  unpin: () => {},
  isWidgetPinned: () => false,
};

export const useCockpitPinnedTools = () => {
  const ctx = useContext(CockpitPinnedToolsContext);
  return ctx ?? FALLBACK_CTX;
};

const getStorageKey = () => {
  const tenantId = localStorage.getItem('tenantId') || 'unknown';
  return `cockpit_pinned_tools_${tenantId}`;
};

export const CockpitPinnedToolsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pinned, setPinned] = useState<PinnedTool[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setPinned(parsed);
    } catch (e) {
      console.warn('[CockpitPinnedTools] Failed to load pinned tools:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(pinned));
    } catch (e) {
      console.warn('[CockpitPinnedTools] Failed to persist pinned tools:', e);
    }
  }, [pinned]);

  const pinWidget = useCallback((widget: WidgetConfig) => {
    setPinned((prev) => {
      const already = prev.some((p) => p.kind === 'widget' && p.widget?.id === widget.id);
      if (already) return prev;
      return [
        ...prev,
        {
          id: `widget:${widget.id}`,
          kind: 'widget',
          title: widget.title,
          widget,
        },
      ];
    });
  }, []);

  const unpin = useCallback((pinnedId: string) => {
    setPinned((prev) => prev.filter((p) => p.id !== pinnedId));
  }, []);

  const isWidgetPinned = useCallback(
    (widgetId: string) => pinned.some((p) => p.kind === 'widget' && p.widget?.id === widgetId),
    [pinned]
  );

  const value = useMemo<CockpitPinnedToolsContextType>(
    () => ({ pinned, pinWidget, unpin, isWidgetPinned }),
    [pinned, pinWidget, unpin, isWidgetPinned]
  );

  return <CockpitPinnedToolsContext.Provider value={value}>{children}</CockpitPinnedToolsContext.Provider>;
};
