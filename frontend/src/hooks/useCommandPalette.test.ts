/**
 * Tests for useCommandPalette Hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandPalette } from './useCommandPalette';

export {};

describe('useCommandPalette', () => {
  describe('initial state', () => {
    it('starts with closed state', () => {
      const { result } = renderHook(() => useCommandPalette());
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('open', () => {
    it('sets isOpen to true', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('calling open multiple times keeps it open', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
        result.current.open();
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('close', () => {
    it('sets isOpen to false', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('calling close when already closed keeps it closed', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('toggle', () => {
    it('opens when closed', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes when open', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('toggles back and forth', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('keyboard shortcuts', () => {
    it('toggles on Ctrl+K', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('toggles on Meta+K (Mac Cmd)', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('does not toggle on just K', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          bubbles: true,
        });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('does not toggle on Ctrl+other key', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'j',
          ctrlKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('closes on Ctrl+K when open', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useCommandPalette());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('function stability', () => {
    it('open function reference is stable', () => {
      const { result, rerender } = renderHook(() => useCommandPalette());

      const openRef1 = result.current.open;
      rerender();
      const openRef2 = result.current.open;

      expect(openRef1).toBe(openRef2);
    });

    it('close function reference is stable', () => {
      const { result, rerender } = renderHook(() => useCommandPalette());

      const closeRef1 = result.current.close;
      rerender();
      const closeRef2 = result.current.close;

      expect(closeRef1).toBe(closeRef2);
    });

    it('toggle function reference is stable', () => {
      const { result, rerender } = renderHook(() => useCommandPalette());

      const toggleRef1 = result.current.toggle;
      rerender();
      const toggleRef2 = result.current.toggle;

      expect(toggleRef1).toBe(toggleRef2);
    });
  });
});
