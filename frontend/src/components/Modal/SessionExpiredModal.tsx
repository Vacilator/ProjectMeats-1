/**
 * Session Expired Modal
 *
 * Displays when JWT tokens expire and cannot be refreshed.
 * Provides a better UX than hard redirects to /login.
 *
 * Features:
 * - Blocks UI interaction until resolved
 * - "Re-login" button to authenticate
 * - "Go to Login" to navigate to login page
 * - Preserves tenant context for seamless re-auth
 *
 * Triggered by:
 * - apiService.ts response interceptor on unrecoverable 401
 * - AuthContext when token refresh fails
 */
import React from 'react';
import styled from 'styled-components';
import { AlertTriangle, LogIn, ArrowRight } from 'lucide-react';

export interface SessionExpiredModalProps {
  isOpen: boolean;
  onReLogin: () => void;
  onGoToLogin: () => void;
  message?: string;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onReLogin,
  onGoToLogin,
  message = 'Your session has expired. Please log in again to continue.',
}) => {
  if (!isOpen) return null;

  return (
    <Overlay>
      <ModalContainer role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
        <IconWrapper>
          <AlertTriangle size={48} strokeWidth={1.5} />
        </IconWrapper>

        <Title id="session-modal-title">Session Expired</Title>

        <Message>{message}</Message>

        <HelpText>
          Your login session has expired for security. You can re-login to continue where you left off.
        </HelpText>

        <Actions>
          <SecondaryButton onClick={onGoToLogin}>
            <LogIn size={18} />
            <span>Go to Login Page</span>
          </SecondaryButton>

          <PrimaryButton onClick={onReLogin} autoFocus>
            <span>Re-Login Now</span>
            <ArrowRight size={18} />
          </PrimaryButton>
        </Actions>

        <Footer>
          Your work and tenant context have been preserved.
        </Footer>
      </ModalContainer>
    </Overlay>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
`;

const ModalContainer = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  max-width: 480px;
  width: 100%;
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  @media (max-width: 640px) {
    padding: 32px 24px;
    max-width: 90%;
  }
`;

const IconWrapper = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(var(--color-warning), 0.1);
  color: rgb(var(--color-warning));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;

  svg {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.05);
    }
  }
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 16px 0;

  @media (max-width: 640px) {
    font-size: 20px;
  }
`;

const Message = styled.p`
  font-size: 16px;
  line-height: 1.6;
  color: rgb(var(--color-text-primary));
  margin: 0 0 12px 0;
`;

const HelpText = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 32px 0;
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  width: 100%;

  @media (max-width: 480px) {
    flex-direction: column-reverse;
  }
`;

const Button = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: var(--radius-md, 8px);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }

  @media (max-width: 480px) {
    width: 100%;
  }
`;

const PrimaryButton = styled(Button)`
  background: rgb(var(--color-primary));
  color: white;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const SecondaryButton = styled(Button)`
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }
`;

const Footer = styled.div`
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgb(var(--color-border));
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  font-style: italic;
`;
