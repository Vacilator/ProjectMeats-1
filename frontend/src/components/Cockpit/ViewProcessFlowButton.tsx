/**
 * View Process Flow Button (PI-03 / cockpit-view-flow-button)
 *
 * Adds a "View Process Flow" action to entity records (Inquiry, SO, PO, Bid)
 * that opens a scoped TradeLineageFlow diagram in a modal.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Modal } from 'antd';
import { GitBranch } from 'lucide-react';
import { TradeLineageFlow } from './TradeLineageFlow';

// ============================================================================
// Types
// ============================================================================

export interface ViewProcessFlowButtonProps {
  /** The inquiry ID to scope the lineage view */
  inquiryId: string;
  /** Optional label override */
  label?: string;
  /** Compact button (icon only) */
  compact?: boolean;
  /** Called when a node in the flow is clicked */
  onNodeClick?: (entityType: string, entityId: string) => void;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const FlowButton = styled.button<{ $compact?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${(p) => (p.$compact ? '6px' : '6px 12px')};
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-primary));
    border-color: rgb(var(--color-primary));
  }

  &:active {
    transform: scale(0.97);
  }
`;

const ModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

// ============================================================================
// Component
// ============================================================================

export const ViewProcessFlowButton: React.FC<ViewProcessFlowButtonProps> = ({
  inquiryId,
  label = 'View Process Flow',
  compact = false,
  onNodeClick,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  if (!inquiryId) return null;

  return (
    <>
      <FlowButton
        $compact={compact}
        onClick={handleOpen}
        className={className}
        title={label}
        type="button"
        aria-label={label}
      >
        <GitBranch size={14} />
        {!compact && label}
      </FlowButton>

      <Modal
        open={open}
        onCancel={handleClose}
        footer={null}
        width={920}
        title={
          <ModalTitle>
            <GitBranch size={18} />
            Trade Process Flow
          </ModalTitle>
        }
        destroyOnHidden
      >
        <TradeLineageFlow
          inquiryId={inquiryId}
          onNodeClick={onNodeClick}
          compact={false}
        />
      </Modal>
    </>
  );
};

export default ViewProcessFlowButton;
