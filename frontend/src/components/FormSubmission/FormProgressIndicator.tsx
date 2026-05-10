/**
 * FormProgressIndicator Component
 *
 * Visual progress indicator for multi-step form submissions.
 * Shows current step, completed steps, and overall progress.
 */
import React from 'react';
import styled, { keyframes, css } from 'styled-components';

// ============================================================================
// TYPES
// ============================================================================

export interface FormStep {
  id: string;
  name: string;
  order: number;
  status: 'pending' | 'current' | 'completed' | 'skipped' | 'error';
  isOptional?: boolean;
}

export interface FormProgressIndicatorProps {
  steps: FormStep[];
  currentStepIndex: number;
  variant?: 'horizontal' | 'vertical' | 'compact';
  showLabels?: boolean;
  showStepNumbers?: boolean;
  className?: string;
}

// ============================================================================
// ANIMATIONS
// ============================================================================

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-primary), 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(var(--color-primary), 0); }
`;

const checkmark = keyframes`
  0% { stroke-dashoffset: 50; }
  100% { stroke-dashoffset: 0; }
`;

// ============================================================================
// STYLED COMPONENTS - HORIZONTAL VARIANT
// ============================================================================

const HorizontalContainer = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  padding: 16px 0;
`;

const HorizontalStepWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 16px;
    left: calc(50% + 20px);
    right: calc(-50% + 20px);
    height: 2px;
    background: rgb(var(--color-border, 224 224 224));
    z-index: 0;
  }
`;

const HorizontalConnector = styled.div<{ $completed: boolean }>`
  position: absolute;
  top: 16px;
  left: calc(50% + 20px);
  right: calc(-50% + 20px);
  height: 2px;
  background: ${props => props.$completed
    ? 'rgb(var(--color-success))'
    : 'rgb(var(--color-border, 224 224 224))'};
  z-index: 1;
  transition: background 0.3s ease;
`;

// ============================================================================
// STYLED COMPONENTS - VERTICAL VARIANT
// ============================================================================

const VerticalContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 8px 0;
`;

const VerticalStepWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  position: relative;
  min-height: 60px;

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 36px;
    left: 16px;
    width: 2px;
    bottom: 0;
    background: rgb(var(--color-border, 224 224 224));
  }
`;

const VerticalConnector = styled.div<{ $completed: boolean }>`
  position: absolute;
  top: 36px;
  left: 16px;
  width: 2px;
  bottom: 0;
  background: ${props => props.$completed
    ? 'rgb(var(--color-success))'
    : 'rgb(var(--color-border, 224 224 224))'};
  z-index: 1;
  transition: background 0.3s ease;
`;

const VerticalContent = styled.div`
  margin-left: 16px;
  padding-bottom: 24px;
`;

// ============================================================================
// STYLED COMPONENTS - COMPACT VARIANT
// ============================================================================

const CompactContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
`;

const CompactProgressBar = styled.div`
  flex: 1;
  height: 6px;
  background: rgb(var(--color-border, 224 224 224));
  border-radius: 3px;
  overflow: hidden;
`;

const CompactProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${props => props.$progress}%;
  background: linear-gradient(90deg, rgb(var(--color-success)), rgb(var(--color-primary)));
  border-radius: 3px;
  transition: width 0.3s ease;
`;

const CompactText = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary, 127 140 141));
  white-space: nowrap;
`;

// ============================================================================
// STYLED COMPONENTS - SHARED
// ============================================================================

const StepCircle = styled.div<{
  $status: FormStep['status'];
  $size?: 'small' | 'medium' | 'large';
}>`
  width: ${props => props.$size === 'small' ? '24px' : props.$size === 'large' ? '40px' : '32px'};
  height: ${props => props.$size === 'small' ? '24px' : props.$size === 'large' ? '40px' : '32px'};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${props => props.$size === 'small' ? '11px' : props.$size === 'large' ? '16px' : '13px'};
  font-weight: 600;
  z-index: 2;
  position: relative;
  transition: all 0.3s ease;
  flex-shrink: 0;

  ${props => {
    switch (props.$status) {
      case 'completed':
        return css`
          background: rgb(var(--color-success));
          color: rgb(var(--color-text-inverse));
          border: 2px solid rgb(var(--color-success));
        `;
      case 'current':
        return css`
          background: rgb(var(--color-primary, 102 126 234));
          color: rgb(var(--color-text-inverse));
          border: 2px solid rgb(var(--color-primary, 102 126 234));
          animation: ${pulse} 2s infinite;
        `;
      case 'error':
        return css`
          background: rgb(var(--color-error));
          color: rgb(var(--color-text-inverse));
          border: 2px solid rgb(var(--color-error));
        `;
      case 'skipped':
        return css`
          background: rgb(var(--color-background, 248 249 250));
          color: rgb(var(--color-text-secondary, 127 140 141));
          border: 2px dashed rgb(var(--color-border, 224 224 224));
        `;
      default: // pending
        return css`
          background: rgb(var(--color-background, 248 249 250));
          color: rgb(var(--color-text-secondary, 127 140 141));
          border: 2px solid rgb(var(--color-border, 224 224 224));
        `;
    }
  }}
`;

const StepLabel = styled.span<{ $status: FormStep['status'] }>`
  font-size: 13px;
  font-weight: 500;
  margin-top: 8px;
  text-align: center;
  max-width: 100px;
  color: ${props => {
    switch (props.$status) {
      case 'completed':
        return 'rgb(var(--color-success))';
      case 'current':
        return 'rgb(var(--color-primary, 102 126 234))';
      case 'error':
        return 'rgb(var(--color-error))';
      default:
        return 'rgb(var(--color-text-secondary, 127 140 141))';
    }
  }};
  transition: color 0.3s ease;
`;

const VerticalLabel = styled.div<{ $status: FormStep['status'] }>`
  font-size: 14px;
  font-weight: 500;
  color: ${props => {
    switch (props.$status) {
      case 'completed':
        return 'rgb(var(--color-success))';
      case 'current':
        return 'rgb(var(--color-text-primary, 44 62 80))';
      case 'error':
        return 'rgb(var(--color-error))';
      default:
        return 'rgb(var(--color-text-secondary, 127 140 141))';
    }
  }};
`;

const VerticalDescription = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin-top: 2px;
  display: block;
`;

const OptionalBadge = styled.span`
  font-size: 10px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  background: rgb(var(--color-background, 248 249 250));
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
`;

const CheckmarkSvg = styled.svg`
  width: 14px;
  height: 14px;

  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 50;
    stroke-dashoffset: 0;
    animation: ${checkmark} 0.3s ease forwards;
  }
`;

const ErrorIcon = styled.span`
  font-size: 14px;
`;

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const Checkmark: React.FC = () => (
  <CheckmarkSvg viewBox="0 0 24 24">
    <path d="M5 12l5 5L20 7" />
  </CheckmarkSvg>
);

const StepContent: React.FC<{
  step: FormStep;
  index: number;
  showNumber: boolean;
  size?: 'small' | 'medium' | 'large';
}> = ({ step, index, showNumber, size: _size = 'medium' }) => {
  if (step.status === 'completed') {
    return <Checkmark />;
  }
  if (step.status === 'error') {
    return <ErrorIcon>!</ErrorIcon>;
  }
  if (step.status === 'skipped') {
    return <span>—</span>;
  }
  return showNumber ? <span>{index + 1}</span> : null;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const FormProgressIndicator: React.FC<FormProgressIndicatorProps> = ({
  steps,
  currentStepIndex,
  variant = 'horizontal',
  showLabels = true,
  showStepNumbers = true,
  className,
}) => {
  // Calculate progress percentage for compact variant
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  // Compact variant
  if (variant === 'compact') {
    return (
      <CompactContainer className={className}>
        <CompactText>
          Step {currentStepIndex + 1} of {steps.length}
        </CompactText>
        <CompactProgressBar>
          <CompactProgressFill $progress={progressPercent} />
        </CompactProgressBar>
        <CompactText>{progressPercent}%</CompactText>
      </CompactContainer>
    );
  }

  // Vertical variant
  if (variant === 'vertical') {
    return (
      <VerticalContainer className={className}>
        {steps.map((step, index) => (
          <VerticalStepWrapper key={step.id}>
            <StepCircle $status={step.status} $size="medium">
              <StepContent step={step} index={index} showNumber={showStepNumbers} />
            </StepCircle>
            {index < steps.length - 1 && (
              <VerticalConnector $completed={step.status === 'completed'} />
            )}
            {showLabels && (
              <VerticalContent>
                <VerticalLabel $status={step.status}>
                  {step.name}
                  {step.isOptional && <OptionalBadge>Optional</OptionalBadge>}
                </VerticalLabel>
                {step.status === 'current' && (
                  <VerticalDescription>In progress...</VerticalDescription>
                )}
                {step.status === 'completed' && (
                  <VerticalDescription>Completed</VerticalDescription>
                )}
              </VerticalContent>
            )}
          </VerticalStepWrapper>
        ))}
      </VerticalContainer>
    );
  }

  // Horizontal variant (default)
  return (
    <HorizontalContainer className={className}>
      {steps.map((step, index) => (
        <HorizontalStepWrapper key={step.id}>
          <StepCircle $status={step.status} $size="medium">
            <StepContent step={step} index={index} showNumber={showStepNumbers} />
          </StepCircle>
          {index < steps.length - 1 && (
            <HorizontalConnector $completed={step.status === 'completed'} />
          )}
          {showLabels && (
            <StepLabel $status={step.status}>
              {step.name}
            </StepLabel>
          )}
        </HorizontalStepWrapper>
      ))}
    </HorizontalContainer>
  );
};

export default FormProgressIndicator;
