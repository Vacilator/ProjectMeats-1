/**
 * AIChatPage — Full-page AI Chat experience
 *
 * Renders AIAgentWidget in an expanded, full-page layout
 * for users who prefer a dedicated chat interface over the floating widget.
 */
import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const PageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  background: rgb(var(--color-bg-primary));
`;

const ChatHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-bg-secondary));
`;

const ChatTitle = styled.h1`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const ChatSubtitle = styled.span`
  font-size: 13px;
  color: rgb(var(--color-text-tertiary));
`;

const ChatContainer = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
`;

const AIChatPage: React.FC = () => {
  useDocumentTitle('AI Assistant');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dispatch event to open the AI widget in full-page mode
    window.dispatchEvent(new CustomEvent('pm:ai-chat-fullpage', { detail: { active: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent('pm:ai-chat-fullpage', { detail: { active: false } }));
    };
  }, []);

  return (
    <PageWrapper>
      <ChatHeader>
        <span role="img" aria-label="AI">🤖</span>
        <div>
          <ChatTitle>AI Assistant</ChatTitle>
          <ChatSubtitle>Ask me anything about your meat supply chain operations</ChatSubtitle>
        </div>
      </ChatHeader>
      <ChatContainer ref={containerRef}>
        {/* The AIAgentWidget is rendered globally in Layout.tsx and will detect
            the pm:ai-chat-fullpage event to expand into this container */}
        <FullPagePlaceholder>
          <PlaceholderIcon>💬</PlaceholderIcon>
          <PlaceholderText>
            The AI Assistant widget will expand here automatically.
            <br />
            You can also press the chat icon in the bottom-right corner.
          </PlaceholderText>
        </FullPagePlaceholder>
      </ChatContainer>
    </PageWrapper>
  );
};

const FullPagePlaceholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  opacity: 0.5;
`;

const PlaceholderIcon = styled.span`
  font-size: 48px;
`;

const PlaceholderText = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-tertiary));
  text-align: center;
  line-height: 1.6;
  margin: 0;
`;

export default AIChatPage;
