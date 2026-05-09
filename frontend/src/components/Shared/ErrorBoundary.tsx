/**
 * ErrorBoundary — Catches runtime errors in children and shows a minimal fallback.
 *
 * Use around any section that fetches data or renders dynamic content.
 * Falls back to a small, non-disruptive "Something went wrong" message
 * with an optional Retry button.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../../utils/logger';

const { Text } = Typography;

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Route through structured logger for telemetry
    logger.error('Caught error:', { component: 'ErrorBoundary', metadata: { error: error.message, stack: errorInfo.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '1.5rem 1rem',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={20} style={{ color: 'rgb(var(--color-text-tertiary, 156 163 175))' }} />
          <Text type="secondary" style={{ fontSize: '0.8rem', maxWidth: 260 }}>
            {this.props.fallbackMessage || 'This section encountered an error.'}
          </Text>
          <Button
            size="small"
            icon={<RefreshCw size={12} />}
            onClick={this.handleRetry}
            style={{ borderRadius: 8, marginTop: 4 }}
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
