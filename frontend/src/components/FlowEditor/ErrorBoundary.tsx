/**
 * Error Boundary Component
 * 
 * Catches React errors in child components and displays fallback UI.
 * Prevents entire app from crashing when a single component fails.
 * 
 * Usage:
 * <ErrorBoundary fallback={<ErrorPanel />}>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 * 
 * Created: 2026-02-21 - Comprehensive Enhancements
 * 
 * @module ErrorBoundary
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import styled from 'styled-components';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI to show on error */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Component name for debugging */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { componentName = 'Unknown', onError } = this.props;
    
    console.error(`[ErrorBoundary] Error in ${componentName}:`, {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, componentName = 'Component' } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <ErrorContainer>
          <ErrorIcon>
            <AlertTriangle size={48} />
          </ErrorIcon>
          
          <ErrorTitle>{componentName} Error</ErrorTitle>
          
          <ErrorMessage>
            {error?.message || 'An unexpected error occurred'}
          </ErrorMessage>

          {process.env.NODE_ENV === 'development' && errorInfo && (
            <ErrorDetails>
              <DetailsHeader>Stack Trace</DetailsHeader>
              <StackTrace>
                {error?.stack}
              </StackTrace>
              <DetailsHeader>Component Stack</DetailsHeader>
              <ComponentStack>
                {errorInfo.componentStack}
              </ComponentStack>
            </ErrorDetails>
          )}

          <ResetButton onClick={this.handleReset}>
            <RefreshCw size={16} />
            <span>Try Again</span>
          </ResetButton>
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  min-height: 300px;
  background: rgb(var(--color-background-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  margin: 16px;
`;

const ErrorIcon = styled.div`
  color: rgb(var(--color-error));
  margin-bottom: 16px;
`;

const ErrorTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ErrorMessage = styled.p`
  margin: 0 0 24px 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
  max-width: 500px;
`;

const ErrorDetails = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 24px 0;
  padding: 16px;
  background: rgb(var(--color-background-tertiary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  overflow: auto;
`;

const DetailsHeader = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  margin: 16px 0 8px 0;
  
  &:first-child {
    margin-top: 0;
  }
`;

const StackTrace = styled.pre`
  margin: 0;
  padding: 12px;
  background: rgb(var(--color-background-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: rgb(var(--color-text-secondary));
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ComponentStack = styled(StackTrace)``;

const ResetButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-primary-hover));
  }
  
  &:active {
    transform: translateY(1px);
  }
`;
