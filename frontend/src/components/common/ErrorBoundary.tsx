/**
 * Production Error Boundary
 * 
 * Catches React component errors and provides:
 * - User-friendly error UI
 * - Error logging to external services
 * - Recovery options (retry, reset state)
 * - Development mode stack traces
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Result, Button, Typography, Card, Space, Collapse } from 'antd';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { logger } from '../../utils/logger';
import { captureSentryException } from '../../utils/sentry';

const { Paragraph, Text } = Typography;
const { Panel } = Collapse;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Log error
    logger.error(
      'React Error Boundary caught an error',
      {
        component: 'ErrorBoundary',
        metadata: {
          errorCount: this.state.errorCount + 1,
          componentStack: errorInfo.componentStack
        }
      },
      {
        message: error.message,
        stack: error.stack
      }
    );

    // Send to Sentry
    captureSentryException(error, {
      component: 'ErrorBoundary',
      metadata: {
        errorCount: this.state.errorCount + 1,
        componentStack: errorInfo.componentStack,
        resetKeys: this.props.resetKeys,
      }
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }
    //   });
    // }
  }

  componentDidUpdate(prevProps: Props): void {
    // Reset error state if resetKeys change
    if (this.props.resetKeys && prevProps.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys![index]
      );

      if (hasChanged && this.state.hasError) {
        this.handleReset();
      }
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  renderErrorDetails(): ReactNode {
    const { error, errorInfo } = this.state;
    const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === 'development';

    if (!isDevelopment || !error || !errorInfo) return null;

    return (
      <Collapse
        ghost
        style={{ marginTop: 24, maxWidth: 800, margin: '24px auto 0' }}
      >
        <Panel
          header={
            <Space>
              <Bug size={16} />
              <Text>Error Details (Development Mode)</Text>
            </Space>
          }
          key="details"
        >
          <Card size="small" style={{ marginBottom: 16 }}>
            <Typography>
              <Paragraph>
                <Text strong>Error:</Text> {error.message}
              </Paragraph>
              <Paragraph>
                <Text strong>Stack Trace:</Text>
                <pre style={{ 
                  fontSize: 12, 
                  background: 'rgb(var(--color-bg-secondary))', 
                  padding: 12, 
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 300
                }}>
                  {error.stack}
                </pre>
              </Paragraph>
            </Typography>
          </Card>
          
          {errorInfo.componentStack && (
            <Card size="small">
              <Typography>
                <Paragraph>
                  <Text strong>Component Stack:</Text>
                  <pre style={{ 
                    fontSize: 12, 
                    background: 'rgb(var(--color-bg-secondary))', 
                    padding: 12, 
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: 300
                  }}>
                    {errorInfo.componentStack}
                  </pre>
                </Paragraph>
              </Typography>
            </Card>
          )}
        </Panel>
      </Collapse>
    );
  }

  render(): ReactNode {
    const { hasError, error, errorCount } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgb(var(--color-bg-secondary))',
          padding: 24
        }}>
          <Result
            status="error"
            icon={<AlertTriangle size={72} color="rgb(var(--color-error))" />}
            title={
              <Typography>
                <Text style={{ fontSize: 24, fontWeight: 600 }}>
                  Something went wrong
                </Text>
              </Typography>
            }
            subTitle={
              <Space direction="vertical" size="small">
                <Paragraph>
                  We're sorry, but something unexpected happened. 
                  {errorCount > 1 && ` This error has occurred ${errorCount} times.`}
                </Paragraph>
                <Paragraph type="secondary">
                  {error?.message || 'An unknown error occurred'}
                </Paragraph>
              </Space>
            }
            extra={
              <Space size="middle">
                <Button
                  type="primary"
                  icon={<RefreshCw size={16} />}
                  onClick={this.handleReset}
                >
                  Try Again
                </Button>
                <Button
                  icon={<RefreshCw size={16} />}
                  onClick={this.handleReload}
                >
                  Reload Page
                </Button>
                <Button
                  icon={<Home size={16} />}
                  onClick={this.handleGoHome}
                >
                  Go Home
                </Button>
              </Space>
            }
          />
          {this.renderErrorDetails()}
        </div>
      );
    }

    return children;
  }
}

/**
 * HOC to wrap component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
