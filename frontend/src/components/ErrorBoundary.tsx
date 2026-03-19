/**
 * Global Error Boundary Component
 * 
 * Catches errors anywhere in the component tree and displays fallback UI.
 * Prevents the entire app from crashing when unexpected errors occur.
 * 
 * Based on: AdminErrorBoundary.tsx
 * Created: 2026-02-19
 * 
 * Features:
 * - User-friendly error fallback UI
 * - Integrated ReportBugButton for quick bug reporting
 * - Console logging and optional telemetry integration
 * - Error count tracking for persistent issues
 * - Recovery options (reset, go home)
 * - Show/hide technical details
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import styled from 'styled-components';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { ReportBugButton } from './ReportBugButton';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  showDetails?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

// ============================================================================
// Error Boundary Class Component
// ============================================================================

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  /**
   * Update state when error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error and update state with details
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console
    console.error('❌ [ErrorBoundary] Caught error:', error);
    console.error('📍 [ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Update state
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to Sentry if configured
    if (typeof window !== 'undefined' && window.ENV?.SENTRY_DSN) {
      const Sentry = require('@sentry/react');
      Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
          errorCount: this.state.errorCount + 1,
        },
      });
    }
    
    // Optional: Send to backend telemetry endpoint
    this.sendToTelemetry(error, errorInfo);
  }

  /**
   * Send error data to backend telemetry (optional)
   */
  private sendToTelemetry = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Check if telemetry endpoint exists
      const telemetryEndpoint = '/api/telemetry/errors/';
      
      const payload = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };
      
      // Non-blocking fetch (fire and forget)
      fetch(telemetryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => {
        // Silently fail if telemetry endpoint doesn't exist
        console.warn('Telemetry endpoint not available:', err);
      });
    } catch (e) {
      // Don't throw errors from telemetry
      console.warn('Failed to send telemetry:', e);
    }
  };

  /**
   * Reset error state and attempt recovery
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Navigate to home/dashboard
   */
  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallbackTitle, showDetails = false } = this.props;

    if (hasError) {
      return (
        <ErrorContainer>
          <ErrorCard>
            <ErrorIcon>
              <AlertTriangle size={64} />
            </ErrorIcon>

            <ErrorTitle>
              {fallbackTitle || 'Oops! Something went wrong'}
            </ErrorTitle>

            <ErrorMessage>
              {errorCount > 1 ? (
                <>
                  This error has occurred <strong>{errorCount} times</strong>.
                  There may be a persistent issue.
                </>
              ) : (
                <>
                  We encountered an unexpected error.
                  Your data is safe, but this feature may not work correctly.
                </>
              )}
            </ErrorMessage>

            {showDetails && error && (
              <ErrorDetails>
                <DetailsTitle>Technical Details:</DetailsTitle>
                <ErrorCode>{error.message}</ErrorCode>
                {error.stack && (
                  <StackTrace>{error.stack}</StackTrace>
                )}
                {errorInfo?.componentStack && (
                  <>
                    <DetailsTitle style={{ marginTop: '1rem' }}>Component Stack:</DetailsTitle>
                    <StackTrace>{errorInfo.componentStack}</StackTrace>
                  </>
                )}
              </ErrorDetails>
            )}

            <ErrorActions>
              <PrimaryButton onClick={this.handleReset}>
                <RefreshCw size={18} />
                Try Again
              </PrimaryButton>
              <SecondaryButton onClick={this.handleGoHome}>
                <Home size={18} />
                Go to Dashboard
              </SecondaryButton>
              <ReportBugButton
                error={error}
                variant="secondary"
                context={errorInfo?.componentStack ?? undefined}
              />
            </ErrorActions>

            <HelpText>
              If this problem persists, please report a bug with the details above.
            </HelpText>
          </ErrorCard>
        </ErrorContainer>
      );
    }

    return children;
  }
}

// ============================================================================
// Styled Components
// ============================================================================

const ErrorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
  background: rgb(var(--color-bg-primary));
`;

const ErrorCard = styled.div`
  max-width: 600px;
  width: 100%;
  background: rgb(var(--color-bg-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 1rem;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const ErrorIcon = styled.div`
  color: #ef4444;
  margin-bottom: 1.5rem;
  
  svg {
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

const ErrorTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 1rem 0;
`;

const ErrorMessage = styled.p`
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
  line-height: 1.6;
  margin: 0 0 2rem 0;
  
  strong {
    color: #ef4444;
    font-weight: 600;
  }
`;

const ErrorDetails = styled.div`
  background: rgb(var(--color-bg-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 2rem;
  text-align: left;
`;

const DetailsTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 0.75rem;
`;

const ErrorCode = styled.pre`
  font-family: 'Courier New', monospace;
  font-size: 0.8125rem;
  color: #ef4444;
  margin: 0 0 0.5rem 0;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StackTrace = styled.pre`
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: rgb(var(--color-text-tertiary));
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
`;

const ErrorActions = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgb(var(--color-primary));
  color: #ffffff;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-primary-dark));
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const SecondaryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-bg-tertiary));
    border-color: rgb(var(--color-primary));
  }
`;

const HelpText = styled.p`
  font-size: 0.8125rem;
  color: rgb(var(--color-text-tertiary));
  margin: 0;
  line-height: 1.5;
`;

// Default export
export default ErrorBoundary;
