/**
 * Confirm Dialog Component
 * 
 * A confirmation dialog for destructive actions in the admin workspace.
 * Uses the shared Modal component with predefined styling.
 * 
 * Usage:
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showConfirm}
 *   onClose={() => setShowConfirm(false)}
 *   onConfirm={handleDelete}
 *   title="Delete User"
 *   message="Are you sure you want to delete this user? This action cannot be undone."
 *   confirmText="Delete"
 *   confirmVariant="danger"
 * />
 * ```
 */

import React from 'react';
import styled from 'styled-components';
import Modal from '../../Modal/Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger' | 'warning';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  const footer = (
    <ButtonGroup>
      <CancelButton onClick={onClose} disabled={loading}>
        {cancelText}
      </CancelButton>
      <ConfirmButton
        onClick={handleConfirm}
        variant={confirmVariant}
        disabled={loading}
      >
        {loading ? 'Processing...' : confirmText}
      </ConfirmButton>
    </ButtonGroup>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="500px" footer={footer}>
      <Message>{message}</Message>
    </Modal>
  );
};

const Message = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  line-height: 1.6;
  margin: 0;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled(Button)`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  
  &:hover:not(:disabled) {
    background: rgb(var(--color-surface-hover));
  }
`;

const ConfirmButton = styled(Button)<{ variant: 'primary' | 'danger' | 'warning' }>`
  background: ${({ variant }) => getVariantColor(variant)};
  color: white;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

function getVariantColor(variant: 'primary' | 'danger' | 'warning'): string {
  const colors = {
    primary: 'rgb(var(--color-primary))',
    danger: 'rgb(239, 68, 68)',
    warning: 'rgb(234, 179, 8)',
  };
  return colors[variant];
}
