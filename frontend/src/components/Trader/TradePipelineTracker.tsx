/**
 * TradePipelineTracker
 *
 * Visual horizontal step indicator showing the current position in the
 * trade orchestrator pipeline. Steps are clickable for details.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Tooltip } from 'antd';
import {
  CheckCircle2,
  CircleDot,
  Clock,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface PipelineStep {
  key: string;
  label: string;
  status: 'completed' | 'active' | 'pending' | 'blocked';
}

export interface TradePipelineTrackerProps {
  currentStep: string;
  route: 'FULFILL' | 'BROKER' | string;
  completed?: boolean;
  blocked?: boolean;
  className?: string;
}

// ============================================================================
// Step Definitions
// ============================================================================

const FULFILL_STEPS = [
  { key: 'draft_sales_order', label: 'Draft SO' },
  { key: 'approve_sales_order', label: 'Approve SO' },
  { key: 'carrier_fan_out', label: 'Carrier RFQ' },
  { key: 'carrier_reply_parse', label: 'Carrier Reply' },
  { key: 'draft_carrier_po', label: 'Carrier PO' },
  { key: 'completed', label: 'Complete' },
];

const BROKER_STEPS = [
  { key: 'supplier_rfq', label: 'Supplier RFQ' },
  { key: 'supplier_reply_parse', label: 'Supplier Reply' },
  { key: 'draft_supplier_po', label: 'Draft PO' },
  { key: 'approve_supplier_po', label: 'Approve PO' },
  { key: 'draft_sales_order', label: 'Draft SO' },
  { key: 'approve_sales_order', label: 'Approve SO' },
  { key: 'carrier_fan_out', label: 'Carrier RFQ' },
  { key: 'carrier_reply_parse', label: 'Carrier Reply' },
  { key: 'draft_carrier_po', label: 'Carrier PO' },
  { key: 'completed', label: 'Complete' },
];

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  padding: 8px 0;
`;

const StepItem = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: default;
  transition: background 0.15s;

  background: ${(p) =>
    p.$status === 'completed' ? 'rgba(var(--color-success), 0.08)' :
    p.$status === 'active' ? 'rgba(var(--color-primary), 0.1)' :
    p.$status === 'blocked' ? 'rgba(var(--color-error), 0.08)' :
    'transparent'};
  color: ${(p) =>
    p.$status === 'completed' ? 'rgb(var(--color-success))' :
    p.$status === 'active' ? 'rgb(var(--color-primary))' :
    p.$status === 'blocked' ? 'rgb(var(--color-error))' :
    'rgb(var(--color-text-tertiary, 156 163 175))'};
`;

const Connector = styled.div<{ $active: boolean }>`
  width: 16px;
  height: 2px;
  background: ${(p) =>
    p.$active
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-border, 229 231 235))'};
  flex-shrink: 0;
`;

// ============================================================================
// Component
// ============================================================================

const getStepIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={12} />;
    case 'active':
      return <CircleDot size={12} />;
    case 'blocked':
      return <Clock size={12} />;
    default:
      return <CircleDot size={12} style={{ opacity: 0.3 }} />;
  }
};

export const TradePipelineTracker: React.FC<TradePipelineTrackerProps> = ({
  currentStep,
  route,
  completed = false,
  blocked = false,
  className,
}) => {
  const steps = useMemo<PipelineStep[]>(() => {
    const rawSteps = route === 'BROKER' ? BROKER_STEPS : FULFILL_STEPS;
    const currentIdx = rawSteps.findIndex((s) => s.key === currentStep);

    return rawSteps.map((step, idx) => {
      let stepStatus: PipelineStep['status'] = 'pending';
      if (completed || idx < currentIdx) {
        stepStatus = 'completed';
      } else if (idx === currentIdx) {
        stepStatus = blocked ? 'blocked' : 'active';
      }
      return { ...step, status: stepStatus };
    });
  }, [currentStep, route, completed, blocked]);

  return (
    <Container className={className}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          {idx > 0 && <Connector $active={step.status === 'completed'} />}
          <Tooltip title={step.label}>
            <StepItem $status={step.status}>
              {getStepIcon(step.status)}
              {step.label}
            </StepItem>
          </Tooltip>
        </React.Fragment>
      ))}
    </Container>
  );
};

export default TradePipelineTracker;
