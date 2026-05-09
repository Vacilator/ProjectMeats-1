/**
 * CallTimer Component
 *
 * A timer component for tracking call duration during active calls.
 * Implements Phase 6.2 of the Forms & Flows Enhancement Plan.
 *
 * Created: 2026-02-03
 *
 * Features:
 * - Start/Stop/Pause timer
 * - Visual elapsed time display (HH:MM:SS)
 * - Callback to save duration when stopped
 * - Compact and full display modes
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Phone, PhoneOff, Pause, Play, Clock } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface CallTimerProps {
  /** Initial seconds to start from (for resuming) */
  initialSeconds?: number;
  /** Callback when timer is stopped with final duration */
  onStop?: (durationSeconds: number) => void;
  /** Callback when timer value changes */
  onTick?: (durationSeconds: number) => void;
  /** Auto-start the timer when component mounts */
  autoStart?: boolean;
  /** Display mode - 'compact' shows just time, 'full' shows controls */
  mode?: 'compact' | 'full';
  /** Whether the timer is in a call-in-progress state */
  isActive?: boolean;
  /** Custom class name for styling */
  className?: string;
}

export interface CallTimerRef {
  start: () => void;
  stop: () => number;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  getElapsed: () => number;
}

// ============================================================================
// Styled Components
// ============================================================================

const TimerContainer = styled.div<{ $mode: 'compact' | 'full'; $isRunning: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${props => props.$mode === 'compact' ? '8px' : '12px'};
  padding: ${props => props.$mode === 'compact' ? '6px 12px' : '12px 16px'};
  background: ${props => props.$isRunning
    ? 'rgba(var(--color-success), 0.1)'
    : 'rgb(var(--color-surface))'};
  border: 1px solid ${props => props.$isRunning
    ? 'rgba(var(--color-success), 0.3)'
    : 'rgb(var(--color-border))'};
  border-radius: 8px;
  transition: all 0.2s ease;
`;

const TimerDisplay = styled.div<{ $isRunning: boolean }>`
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.$isRunning
    ? 'rgb(var(--color-success))'
    : 'rgb(var(--color-text-primary))'};
  min-width: 72px;
  text-align: center;
`;

const TimerIcon = styled.div<{ $isRunning: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$isRunning
    ? 'rgb(var(--color-success))'
    : 'rgb(var(--color-text-secondary))'};
`;

const TimerControls = styled.div`
  display: flex;
  gap: 8px;
`;

const TimerButton = styled.button<{ $variant?: 'start' | 'stop' | 'pause' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;

  background: ${props => {
    switch (props.$variant) {
      case 'start': return 'rgb(var(--color-success))';
      case 'stop': return 'rgb(var(--color-error))';
      case 'pause': return 'rgb(var(--color-warning))';
      default: return 'rgb(var(--color-primary))';
    }
  }};
  color: rgb(var(--color-text-inverse));

  &:hover {
    opacity: 0.9;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const PulsingDot = styled.span<{ $isRunning: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$isRunning ? 'rgb(var(--color-success))' : 'rgb(var(--color-text-secondary))'};
  animation: ${props => props.$isRunning ? 'pulse 1.5s infinite' : 'none'};

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats seconds into HH:MM:SS or MM:SS format
 */
export const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Parses duration string (HH:MM:SS or MM:SS) to total seconds
 */
export const parseDuration = (duration: string): number => {
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

// ============================================================================
// Component
// ============================================================================

export const CallTimer: React.FC<CallTimerProps> = ({
  initialSeconds = 0,
  onStop,
  onTick,
  autoStart = false,
  mode = 'full',
  isActive,
  className,
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(initialSeconds);

  // Use isActive prop if provided, otherwise use internal state
  const effectiveIsRunning = isActive !== undefined ? isActive : isRunning;

  // Tick handler
  useEffect(() => {
    if (effectiveIsRunning && !isPaused) {
      startTimeRef.current = Date.now() - (accumulatedRef.current * 1000);

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        setSeconds(elapsed);
        onTick?.(elapsed);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [effectiveIsRunning, isPaused, onTick]);

  // Handlers
  const handleStart = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onStop?.(seconds);
    return seconds;
  }, [seconds, onStop]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    accumulatedRef.current = seconds;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [seconds]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Compact mode - just shows time and pulsing indicator
  if (mode === 'compact') {
    return (
      <TimerContainer $mode="compact" $isRunning={effectiveIsRunning} className={className}>
        <PulsingDot $isRunning={effectiveIsRunning} />
        <TimerDisplay $isRunning={effectiveIsRunning}>
          {formatDuration(seconds)}
        </TimerDisplay>
      </TimerContainer>
    );
  }

  // Full mode - shows controls
  return (
    <TimerContainer $mode="full" $isRunning={effectiveIsRunning} className={className}>
      <TimerIcon $isRunning={effectiveIsRunning}>
        {effectiveIsRunning ? <Phone size={20} /> : <Clock size={20} />}
      </TimerIcon>

      <TimerDisplay $isRunning={effectiveIsRunning}>
        {formatDuration(seconds)}
      </TimerDisplay>

      <TimerControls>
        {!effectiveIsRunning && !isPaused && (
          <TimerButton
            $variant="start"
            onClick={handleStart}
            title="Start call timer"
            aria-label="Start call timer"
          >
            <Phone size={16} />
          </TimerButton>
        )}

        {effectiveIsRunning && !isPaused && (
          <TimerButton
            $variant="pause"
            onClick={handlePause}
            title="Pause timer"
            aria-label="Pause timer"
          >
            <Pause size={16} />
          </TimerButton>
        )}

        {isPaused && (
          <TimerButton
            $variant="start"
            onClick={handleResume}
            title="Resume timer"
            aria-label="Resume timer"
          >
            <Play size={16} />
          </TimerButton>
        )}

        {(effectiveIsRunning || isPaused) && (
          <TimerButton
            $variant="stop"
            onClick={handleStop}
            title="End call and save duration"
            aria-label="End call and save duration"
          >
            <PhoneOff size={16} />
          </TimerButton>
        )}
      </TimerControls>
    </TimerContainer>
  );
};

export default CallTimer;
