import React from 'react';
import styled from 'styled-components';
import { logger } from '@/utils/logger';
import { captureSentryException } from '@/utils/sentry';

interface FormErrorBoundaryProps {
  children: React.ReactNode;
  onClose?: () => void;
  entityType?: string;
}

interface FormErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  text-align: center;
  gap: 16px;
`;

const ErrorIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgb(var(--color-error) / 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
`;

const ErrorTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const ErrorMessage = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  max-width: 360px;
  line-height: 1.5;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 8px;
`;

const RetryButton = styled.button`
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  background: rgb(var(--color-primary));
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.9; }
`;

const CloseButton = styled.button`
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: rgb(var(--color-surface-hover, var(--color-border)) / 0.3); }
`;

export class FormErrorBoundary extends React.Component<FormErrorBoundaryProps, FormErrorBoundaryState> {
  constructor(props: FormErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): FormErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(
      `[FormErrorBoundary] ${this.props.entityType ?? 'Form'} crashed: ${error.message}`,
      { component: 'FormErrorBoundary' },
      { error, errorInfo },
    );
    captureSentryException(error, {
      component: 'FormErrorBoundary',
      metadata: {
        entityType: this.props.entityType ?? 'Form',
        componentStack: errorInfo?.componentStack,
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClose = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  render() {
    if (this.state.hasError) {
      const isMaxUpdateDepth = this.state.error?.message?.includes('Maximum update depth') ||
                                this.state.error?.message?.includes('#185');

      return (
        <ErrorContainer>
          <ErrorIcon>⚠️</ErrorIcon>
          <ErrorTitle>
            {isMaxUpdateDepth ? 'Form loading issue' : 'Something went wrong'}
          </ErrorTitle>
          <ErrorMessage>
            {isMaxUpdateDepth
              ? `The ${this.props.entityType ?? 'form'} encountered a loading issue. This usually resolves on retry.`
              : `An unexpected error occurred while loading the ${this.props.entityType ?? 'form'}. Please try again.`}
          </ErrorMessage>
          <ButtonRow>
            <RetryButton onClick={this.handleRetry}>Try Again</RetryButton>
            {this.props.onClose && (
              <CloseButton onClick={this.handleClose}>Close</CloseButton>
            )}
          </ButtonRow>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}
