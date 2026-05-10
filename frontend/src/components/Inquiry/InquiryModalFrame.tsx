import React from 'react';
import styled from 'styled-components';

export const InquiryModalOverlay = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? 'flex' : 'none')};
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.55);
  z-index: 1100;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

export const InquiryModalContainer = styled.div<{ $maxWidth?: number }>`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: ${(p) => (p.$maxWidth ? `${p.$maxWidth}px` : '900px')};
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(var(--color-overlay), 0.3);
  display: flex;
  flex-direction: column;
`;

export const InquiryModalHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

export const InquiryModalTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

export const InquiryModalSubtitle = styled.div`
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

export const InquiryModalTitleBlock = styled.div``;

export const InquiryModalCloseButton = styled.button`
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 4px 8px;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

export const InquiryModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

export const InquiryModalFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
`;

export interface InquiryModalFrameProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
}

export const InquiryModalFrame: React.FC<InquiryModalFrameProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <InquiryModalOverlay $open={isOpen} onClick={onClose}>
      <InquiryModalContainer $maxWidth={maxWidth} onClick={(e) => e.stopPropagation()}>
        <InquiryModalHeader>
          <InquiryModalTitleBlock>
            <InquiryModalTitle>{title}</InquiryModalTitle>
            {subtitle ? <InquiryModalSubtitle>{subtitle}</InquiryModalSubtitle> : null}
          </InquiryModalTitleBlock>
          <InquiryModalCloseButton type="button" aria-label="Close" onClick={onClose}>
            ×
          </InquiryModalCloseButton>
        </InquiryModalHeader>
        {children}
      </InquiryModalContainer>
    </InquiryModalOverlay>
  );
};
