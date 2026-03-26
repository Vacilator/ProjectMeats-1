/**
 * ChatWindow Component
 *
 * Main chat interface for the AI assistant.
 * Enhanced from PR #63 to integrate file upload into MessageInput and remove separate DocumentUpload component.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { ChatSession, ChatMessage } from '../../types';
import { chatApi, chatSessionsApi, documentsApi } from '../../services/aiService';
import { logger } from '../../utils/logger';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

interface ChatWindowProps {
  sessionId?: string;
  onSessionChange?: (session: ChatSession | null) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ sessionId, onSessionChange }) => {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSession = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setError(null);

        const [sessionData, messagesData] = await Promise.all([
          chatSessionsApi.get(id),
          chatSessionsApi.getMessages(id),
        ]);

        setSession(sessionData);
        setMessages(messagesData);
        onSessionChange?.(sessionData);
      } catch (err) {
        logger.error('[ChatWindow] Error loading session:', err);
        setError('Failed to load chat session');
      } finally {
        setLoading(false);
      }
    },
    [onSessionChange]
  );

  // Load session and messages
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else {
      // Reset state when no session
      setSession(null);
      setMessages([]);
      setError(null);
      onSessionChange?.(null);
    }
  }, [sessionId, loadSession, onSessionChange]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageContent: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await chatApi.sendMessage({
        message: messageContent,
        session_id: session?.id,
        context: {},
      });

      // If no session existed, we now have one
      if (!session && response.session_id) {
        const newSession = await chatSessionsApi.get(response.session_id);
        setSession(newSession);
        onSessionChange?.(newSession);
      }

      // Reload messages to get the latest
      if (response.session_id) {
        const updatedMessages = await chatSessionsApi.getMessages(response.session_id);
        setMessages(updatedMessages);
      }
    } catch (err) {
      logger.error('[ChatWindow] Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (file: File): Promise<{ id: string; status: string }> => {
    try {
      setLoading(true);
      setError(null);

      // Upload document
      const uploadResponse = await documentsApi.upload(file, session?.id);

      // Send a message about the upload
      const uploadMessage = `📄 I've uploaded "${file.name}" for analysis. What would you like me to help you with regarding this document?`;
      await sendMessage(uploadMessage);

      return {
        id: uploadResponse.id,
        status: uploadResponse.processing_status,
      };
    } catch (err) {
      logger.error('[ChatWindow] Error uploading document:', err);
      setError('Failed to upload document. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const renderWelcomeMessage = () => (
    <WelcomeContainer>
      <WelcomeIcon>🤖</WelcomeIcon>
      <WelcomeTitle>AI Assistant for Meat Market Operations</WelcomeTitle>
      <WelcomeSubtitle>
        I can help you with supplier management, purchase orders, customer relationships, inventory
        tracking, and business intelligence. Upload documents or ask me questions to get started.
      </WelcomeSubtitle>

      <FeatureGrid>
        <FeatureItem>
          <FeatureIcon>📊</FeatureIcon>
          <FeatureTitle>Supplier Analysis</FeatureTitle>
          <FeatureDescription>
            Track supplier performance, pricing, and delivery metrics
          </FeatureDescription>
        </FeatureItem>

        <FeatureItem>
          <FeatureIcon>📋</FeatureIcon>
          <FeatureTitle>Purchase Orders</FeatureTitle>
          <FeatureDescription>
            Manage POs, analyze spending patterns, ensure compliance
          </FeatureDescription>
        </FeatureItem>

        <FeatureItem>
          <FeatureIcon>👥</FeatureIcon>
          <FeatureTitle>Customer Insights</FeatureTitle>
          <FeatureDescription>
            Analyze customer data, preferences, and order history
          </FeatureDescription>
        </FeatureItem>

        <FeatureItem>
          <FeatureIcon>📈</FeatureIcon>
          <FeatureTitle>Business Intelligence</FeatureTitle>
          <FeatureDescription>
            Generate reports, pricing analysis, and market trends
          </FeatureDescription>
        </FeatureItem>

        <FeatureItem>
          <FeatureIcon>📄</FeatureIcon>
          <FeatureTitle>Document Processing</FeatureTitle>
          <FeatureDescription>
            Upload invoices, contracts, and receipts for AI analysis
          </FeatureDescription>
        </FeatureItem>

        <FeatureItem>
          <FeatureIcon>✅</FeatureIcon>
          <FeatureTitle>Quality Compliance</FeatureTitle>
          <FeatureDescription>
            USDA regulations, HACCP compliance, quality standards
          </FeatureDescription>
        </FeatureItem>
      </FeatureGrid>
    </WelcomeContainer>
  );

  if (loading && messages.length === 0) {
    return (
      <ChatContainer>
        <LoadingContainer>
          <LoadingSpinner />
          <LoadingText>Loading chat session...</LoadingText>
        </LoadingContainer>
      </ChatContainer>
    );
  }

  return (
    <ChatContainer>
      {error && (
        <ErrorBanner>
          <ErrorIcon>⚠️</ErrorIcon>
          <ErrorText>{error}</ErrorText>
          <ErrorClose onClick={() => setError(null)}>×</ErrorClose>
        </ErrorBanner>
      )}

      {/* Messages Area */}
      <MessagesArea>
        {messages.length === 0 ? renderWelcomeMessage() : <MessageList messages={messages} />}
        <div ref={messagesEndRef} />
      </MessagesArea>

      {/* Input Area */}
      <InputArea>
        <MessageInput
          onSendMessage={sendMessage}
          onFileUpload={uploadDocument}
          disabled={loading}
          placeholder={
            !session
              ? 'Start a conversation or upload a document...'
              : 'Type your message or drag files here...'
          }
        />
      </InputArea>
    </ChatContainer>
  );
};

// Styled Components
const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-background));
`;

const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(var(--color-error), 0.12);
  border-bottom: 1px solid rgba(var(--color-error), 0.25);
  color: rgb(var(--color-error));
  font-size: 14px;
`;

const ErrorIcon = styled.span`
  font-size: 16px;
`;

const ErrorText = styled.span`
  flex: 1;
`;

const ErrorClose = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-error));
  cursor: pointer;
  font-size: 18px;
  padding: 0;

  &:hover {
    opacity: 0.7;
  }
`;

const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 16px;
  color: rgb(var(--color-text-secondary));
`;

const LoadingSpinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid rgb(var(--color-border-light));
  border-radius: 50%;
  border-top-color: rgb(var(--color-primary));
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const WelcomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
`;

const WelcomeIcon = styled.div`
  font-size: 64px;
  margin-bottom: 24px;
`;

const WelcomeTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 16px 0;
`;

const WelcomeSubtitle = styled.p`
  font-size: 18px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.6;
  margin: 0 0 48px 0;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  width: 100%;
`;

const FeatureItem = styled.div`
  background: rgb(var(--color-surface));
  padding: 24px;
  border-radius: 12px;
  border: 1px solid rgb(var(--color-border));
  text-align: left;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-border));
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
`;

const FeatureIcon = styled.div`
  font-size: 32px;
  margin-bottom: 16px;
`;

const FeatureTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const FeatureDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
  margin: 0;
`;

const InputArea = styled.div`
  padding: 16px 20px 20px 20px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

export default ChatWindow;
