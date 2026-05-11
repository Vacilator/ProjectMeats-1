import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export type ShortcutDef = {
  keys: string;
  label: string;
  category: 'navigation' | 'tools' | 'general';
};

/**
 * Canonical registry of all global keyboard shortcuts.
 * Used by both the handler and the ShortcutCheatsheet modal.
 */
export const SHORTCUT_REGISTRY: ShortcutDef[] = [
  { keys: '/', label: 'Quick search', category: 'general' },
  { keys: '⌘K', label: 'Command palette', category: 'general' },
  { keys: '⌘⇧K', label: 'AI command center', category: 'general' },
  { keys: '⌘J', label: 'Toggle AI assistant', category: 'general' },
  { keys: 'Esc', label: 'Close modal / panel', category: 'general' },
  { keys: '?', label: 'Keyboard shortcuts help', category: 'general' },
  { keys: 'g d', label: 'Go to Command Center', category: 'navigation' },
  { keys: 'g c', label: 'Go to Customers', category: 'navigation' },
  { keys: 'g s', label: 'Go to Suppliers', category: 'navigation' },
  { keys: 'g p', label: 'Go to Purchase Orders', category: 'navigation' },
  { keys: 'g o', label: 'Go to Sales Orders', category: 'navigation' },
  { keys: 'g i', label: 'Go to Inquiries', category: 'navigation' },
];

type UseGlobalShortcutsOptions = {
  onOpenCommandPalette: () => void;
  onToggleAIAgentWidget: () => void;
  onOpenOmnibox?: () => void;
  onShowCheatsheet?: () => void;
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
 *
 * Single-key: /, ?, Escape
 * Mod (⌘/Ctrl): ⌘K, ⌘⇧K, ⌘J
 * Vim-style go-to (g + letter): g d, g c, g s, g p, g o, g i
 */
export const useGlobalShortcuts = ({
  onOpenCommandPalette,
  onToggleAIAgentWidget,
  onOpenOmnibox,
  onShowCheatsheet,
  enabled = true,
}: UseGlobalShortcutsOptions) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;

    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const clearG = () => {
      gPending = false;
      if (gTimer) {
        clearTimeout(gTimer);
        gTimer = null;
      }
    };

    const GO_MAP: Record<string, string> = {
      d: '/command-center',
      c: '/customers',
      s: '/suppliers',
      p: '/purchase-orders',
      o: '/sales-orders',
      i: '/inquiries',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape — broadcast for custom overlays
      if (e.key === 'Escape') {
        clearG();
        window.dispatchEvent(new CustomEvent('pm:escape'));
        return;
      }

      if (isEditableTarget(e.target)) {
        clearG();
        return;
      }

      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;

      // Vim-style "g + letter" navigation
      if (gPending && !mod && !e.altKey) {
        clearG();
        const dest = GO_MAP[key];
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
        return;
      }

      if (key === 'g' && !mod && !e.altKey && !e.shiftKey) {
        clearG();
        gPending = true;
        gTimer = setTimeout(clearG, 800);
        return;
      }

      clearG();

      // Forward slash = quick search
      if (key === '/' && !mod && !e.altKey) {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // ? = shortcut cheatsheet
      if ((key === '?' || (e.shiftKey && key === '/')) && !mod && !e.altKey) {
        e.preventDefault();
        onShowCheatsheet?.();
        return;
      }

      if (!mod) return;

      if (key === 'k' && !e.shiftKey) {
        e.preventDefault();
        onOpenCommandPalette();
      }

      if (key === 'k' && e.shiftKey && onOpenOmnibox) {
        e.preventDefault();
        onOpenOmnibox();
      }

      if (key === 'j') {
        e.preventDefault();
        onToggleAIAgentWidget();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearG();
    };
  }, [enabled, navigate, onOpenCommandPalette, onOpenOmnibox, onShowCheatsheet, onToggleAIAgentWidget]);
};
