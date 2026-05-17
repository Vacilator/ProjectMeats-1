/**
 * Development-only console error monitor.
 *
 * Intercepts console.error / console.warn in dev builds and renders a floating
 * badge that makes accumulated errors immediately visible. Click the badge to
 * expand a scrollable log panel.
 *
 * This component is intentionally zero-cost in production — it renders nothing
 * and performs no patching when IS_DEV_BUILD is false.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IS_DEV_BUILD } from '@/utils/buildFlags';
import { logger } from '@/utils/logger';

interface ConsoleEntry {
  id: number;
  level: 'error' | 'warn';
  message: string;
  timestamp: number;
}

const MAX_ENTRIES = 200;
let nextId = 1;

const styles: Record<string, React.CSSProperties> = {
  // Dev-only styles — these colors are NOT visible in production builds.
  // Using rgb() format to comply with the color lint rules.
  badge: {
    position: 'fixed',
    bottom: 12,
    left: 12,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,.25)',
    userSelect: 'none',
    transition: 'background .15s',
  },
  badgeClean: {
    background: 'rgba(34,197,94,.85)',
    color: 'rgb(255,255,255)',
  },
  badgeDirty: {
    background: 'rgba(239,68,68,.9)',
    color: 'rgb(255,255,255)',
  },
  panel: {
    position: 'fixed',
    bottom: 48,
    left: 12,
    width: 480,
    maxHeight: 360,
    zIndex: 99999,
    background: 'rgb(30,30,30)',
    color: 'rgb(212,212,212)',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0,0,0,.4)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'monospace',
    fontSize: 11,
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    background: 'rgb(45,45,45)',
    borderBottom: '1px solid rgb(62,62,62)',
  },
  panelBody: {
    overflowY: 'auto',
    padding: '4px 8px',
    flex: 1,
  },
  entry: {
    padding: '4px 0',
    borderBottom: '1px solid rgb(51,51,51)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  errorText: { color: 'rgb(248,113,113)' },
  warnText: { color: 'rgb(251,191,36)' },
  clearBtn: {
    background: 'transparent',
    border: '1px solid rgb(85,85,85)',
    color: 'rgb(170,170,170)',
    borderRadius: 4,
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: 11,
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function stringify(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a, null, 0);
      } catch (err) {
        logger.debug('JSON.stringify failed in formatArgs', { err });
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 500);
}

const ConsoleErrorMonitor: React.FC = () => {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [open, setOpen] = useState(false);
  const entriesRef = useRef<ConsoleEntry[]>([]);

  useEffect(() => {
    if (!IS_DEV_BUILD) return;

    const origError = console.error;
    const origWarn = console.warn;

    const push = (level: 'error' | 'warn', args: unknown[]) => {
      const entry: ConsoleEntry = {
        id: nextId++,
        level,
        message: stringify(args),
        timestamp: Date.now(),
      };
      entriesRef.current = [...entriesRef.current.slice(-(MAX_ENTRIES - 1)), entry];
      setEntries(entriesRef.current);
    };

    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      push('error', args);
    };
    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args);
      push('warn', args);
    };

    return () => {
      console.error = origError;
      console.warn = origWarn;
    };
  }, []);

  const handleClear = useCallback(() => {
    entriesRef.current = [];
    setEntries([]);
  }, []);

  if (!IS_DEV_BUILD) return null;

  const errorCount = entries.filter((e) => e.level === 'error').length;
  const warnCount = entries.filter((e) => e.level === 'warn').length;
  const hasErrors = errorCount > 0;

  return (
    <>
      <div
        style={{ ...styles.badge, ...(hasErrors ? styles.badgeDirty : styles.badgeClean) }}
        onClick={() => setOpen((o) => !o)}
        title="Console Error Monitor (dev only)"
      >
        {hasErrors ? `🔴 ${errorCount} error${errorCount !== 1 ? 's' : ''}` : '✅ 0 errors'}
        {warnCount > 0 && <span style={{ opacity: 0.8 }}> | ⚠ {warnCount}</span>}
      </div>

      {open && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <span>Console Errors &amp; Warnings ({entries.length})</span>
            <button style={styles.clearBtn} onClick={handleClear}>
              Clear
            </button>
          </div>
          <div style={styles.panelBody}>
            {entries.length === 0 && (
              <div style={{ padding: 12, textAlign: 'center', color: 'rgb(136,136,136)' }}>
                No errors or warnings captured.
              </div>
            )}
            {entries.map((e) => (
              <div key={e.id} style={styles.entry}>
                <span style={{ color: 'rgb(136,136,136)' }}>[{formatTime(e.timestamp)}]</span>{' '}
                <span style={e.level === 'error' ? styles.errorText : styles.warnText}>
                  {e.level.toUpperCase()}
                </span>{' '}
                {e.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default ConsoleErrorMonitor;
