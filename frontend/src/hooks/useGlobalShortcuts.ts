import { useEffect } from 'react';

type UseGlobalShortcutsOptions = {
  onOpenCommandPalette: () => void;
  onToggleAIAgentWidget: () => void;
  onOpenOmnibox?: () => void;
  enabled?: boolean;
};

const isEditableTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/**
 * Global keyboard shortcuts (power-user UX)
 * - Cmd/Ctrl + K: open command palette
 * - Cmd/Ctrl + J: toggle AI agent widget
 */
export const useGlobalShortcuts = ({
  onOpenCommandPalette,
  onToggleAIAgentWidget,
  onOpenOmnibox,
  enabled = true,
}: UseGlobalShortcutsOptions) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();

      // Forward slash = quick command palette (when not typing)
      if (key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd/Ctrl + K = Universal Search (CommandPalette)
      if (key === 'k' && !e.shiftKey) {
        e.preventDefault();
        onOpenCommandPalette();
      }

      // Cmd/Ctrl + Shift + K = AI Command Center (Omnibox)
      if (key === 'k' && e.shiftKey && onOpenOmnibox) {
        e.preventDefault();
        onOpenOmnibox();
      }

      // Cmd/Ctrl + J = toggle AI widget
      if (key === 'j') {
        e.preventDefault();
        onToggleAIAgentWidget();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onOpenCommandPalette, onOpenOmnibox, onToggleAIAgentWidget]);
};
