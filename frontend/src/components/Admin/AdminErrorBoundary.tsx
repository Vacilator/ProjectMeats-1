/**
 * Admin Error Boundary Component
 * 
 * Catches errors in admin workspace and displays user-friendly fallback UI.
 * Prevents entire app from crashing when admin pages encounter errors.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import styled from 'styled-components';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so next render shows fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and error reporting service
    console.error('❌ [AdminErrorBoundary] Caught error:', error);
    console.error('📍 [AdminErrorBoundary] Component stack:', errorInfo.componentStack);

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    // Reset error state and try to recover
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    // Navigate to home/dashboard
    window.location.href = '/';
  };

  handleReportBug = () => {
    // Open bug report with pre-filled error info
    const { error, errorInfo } = this.state;
    const errorDetails = encodeURIComponent(`
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
    `.trim());

    // Open GitHub issue or support email
    window.open(
      `https://github.com/Meats-Central/ProjectMeats/issues/new?title=Admin%20Error&body=${errorDetails}`,
      '_blank'
    );
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallbackTitle, showDetails } = this.props;

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
                  We encountered an unexpected error in the admin workspace.
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
              <SecondaryButton onClick={this.handleReportBug}>
                <Bug size={18} />
                Report Bug
              </SecondaryButton>
            </ErrorActions>

            <HelpText>
              If this problem persists, please contact support or report a bug with the details above.
            </HelpText>
          </ErrorCard>
        </ErrorContainer>
      );
    }

    return children;
  }
}

// Styled Components
const ErrorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
  background: rgb(var(--color-background));
`;

const ErrorCard = styled.div`
  max-width: 600px;
  width: 100%;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: var(--shadow-md);
`;

const ErrorIcon = styled.div`
  color: rgb(var(--color-error));
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
    color: rgb(var(--color-error));
    font-weight: 700;
  }
`;

const ErrorDetails = styled.div`
  background: rgb(var(--color-surface));
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
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: rgb(var(--color-error));
  margin: 0 0 0.5rem 0;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StackTrace = styled.pre`
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
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
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-primary-hover));
    transform: translateY(-1px);
  }
  
  &:active {
    background: rgb(var(--color-primary-active));
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
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgba(var(--color-primary), 0.55);
  }
`;

const HelpText = styled.p`
  font-size: 0.8125rem;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
`;

export default AdminErrorBoundary;
