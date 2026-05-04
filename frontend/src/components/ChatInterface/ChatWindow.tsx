/**
 * ChatWindow Component
 *
 * Main chat interface for the AI assistant.
 * Enhanced from PR #63 to integrate file upload into MessageInput and remove separate DocumentUpload component.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useLocation } from 'react-router-dom';
import { ChatSession, ChatMessage } from '../../types';
import {
  chatApi,
  chatSessionsApi,
  documentsApi,
  hydrateDocumentMessageMetadata,
} from '../../services/aiService';
import { useCockpitNavigation } from '@/contexts/CockpitNavigationContext';
import { buildAIPageContext } from '@/services/aiContext';
import { groupChatSessionsByDate } from './sessionHistory';
import { useStickyAutoScroll } from '@/hooks/useStickyAutoScroll';
import { logger } from '../../utils/logger';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

interface ChatWindowProps {
  sessionId?: string;
  onSessionChange?: (session: ChatSession | null) => void;
}

const PAGE_SESSION_STORAGE_KEY = 'pm.ai.page.sessionId';

const ChatWindow: React.FC<ChatWindowProps> = ({ sessionId, onSessionChange }) => {
  const location = useLocation();
  const cockpitNav = useCockpitNavigation();

  const pageContext = useMemo(
    () => buildAIPageContext({ pathname: location.pathname, search: location.search }, cockpitNav.path),
    [location.pathname, location.search, cockpitNav.path]
  );

  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (sessionId) {
      return sessionId;
    }

    try {
      return localStorage.getItem(PAGE_SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { containerRef: messagesRef } = useStickyAutoScroll<HTMLDivElement>([
    activeSessionId,
    loading,
    messages.length,
  ]);

  const groupedSessions = useMemo(() => groupChatSessionsByDate(sessions), [sessions]);

  const loadSessions = useCallback(async () => {
    try {
      const sessionList = await chatSessionsApi.list();
      setSessions(sessionList);
    } catch (err) {
      logger.error('[ChatWindow] Error loading session list:', err);
      setSessions([]);
    }
  }, []);

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
        setMessages(await hydrateDocumentMessageMetadata(messagesData));
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

  useEffect(() => {
    if (sessionId) {
      setActiveSessionId(sessionId);
      return;
    }

    try {
      const persisted = localStorage.getItem(PAGE_SESSION_STORAGE_KEY);
      if (persisted) {
        setActiveSessionId(persisted);
      }
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!sessions.length) {
      if (!activeSessionId) {
        setSession(null);
        setMessages([]);
        onSessionChange?.(null);
      }
      return;
    }

    if (activeSessionId && sessions.some((item) => item.id === activeSessionId)) {
      return;
    }

    const fallbackSessionId = sessionId && sessions.some((item) => item.id === sessionId)
      ? sessionId
      : sessions[0]?.id;
    if (fallbackSessionId) {
      setActiveSessionId(fallbackSessionId);
    }
  }, [activeSessionId, onSessionChange, sessionId, sessions]);

  useEffect(() => {
    if (!activeSessionId) {
      setSession(null);
      setMessages([]);
      setError(null);
      onSessionChange?.(null);
      return;
    }

    try {
      localStorage.setItem(PAGE_SESSION_STORAGE_KEY, activeSessionId);
    } catch {
      // ignore
    }

    void loadSession(activeSessionId);
  }, [activeSessionId, loadSession, onSessionChange]);

  const sendMessage = async (messageContent: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await chatApi.sendMessage({
        message: messageContent,
        session_id: activeSessionId ?? session?.id,
        context: {
          ui_source: 'ChatWindow',
          ...pageContext,
        },
      });

      if (response.session_id) {
        setActiveSessionId(response.session_id);
        const [nextSession, updatedMessages] = await Promise.all([
          chatSessionsApi.get(response.session_id),
          chatSessionsApi.getMessages(response.session_id),
        ]);
        setSession(nextSession);
        setMessages(await hydrateDocumentMessageMetadata(updatedMessages));
        onSessionChange?.(nextSession);
        await loadSessions();
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

      const uploadResponse = await documentsApi.upload(file, activeSessionId ?? session?.id);

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

  const handleSelectSession = (nextSessionId: string) => {
    setActiveSessionId(nextSessionId);
  };

  const handleNewChat = async () => {
    try {
      setLoading(true);
      setError(null);

      const nextSession = await chatSessionsApi.create({
        title: `Chat ${new Date().toLocaleString()}`,
        context_data: { ui_source: 'ChatWindow', ...pageContext },
      });
      setActiveSessionId(nextSession.id);
      setSession(nextSession);
      setMessages([]);
      onSessionChange?.(nextSession);
      await loadSessions();
    } catch (err) {
      logger.error('[ChatWindow] Error creating session:', err);
      setError('Failed to start a new chat session.');
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
      <SessionSidebar>
        <SidebarHeader>
          <SidebarTitle>History</SidebarTitle>
          <NewChatButton type="button" onClick={() => void handleNewChat()}>
            New Chat
          </NewChatButton>
        </SidebarHeader>
        <SessionList>
          {groupedSessions.length ? (
            groupedSessions.map((group) => (
              <div key={group.label}>
                <SessionGroupHeader>{group.label}</SessionGroupHeader>
                {group.sessions.map((item) => (
                  <SessionButton
                    key={item.id}
                    type="button"
                    $active={item.id === activeSessionId}
                    onClick={() => handleSelectSession(item.id)}
                  >
                    <SessionButtonTitle>{item.title || `Session ${item.id.slice(0, 8)}…`}</SessionButtonTitle>
                    <SessionButtonMeta>
                      {typeof item.message_count === 'number' ? `${item.message_count} msgs` : '—'}
                      {item.last_activity ? ` • ${new Date(item.last_activity).toLocaleString()}` : ''}
                    </SessionButtonMeta>
                  </SessionButton>
                ))}
              </div>
            ))
          ) : (
            <EmptySidebarText>No prior sessions yet.</EmptySidebarText>
          )}
        </SessionList>
      </SessionSidebar>

      <ConversationPane>
        {error && (
          <ErrorBanner>
            <ErrorIcon>⚠️</ErrorIcon>
            <ErrorText>{error}</ErrorText>
            <ErrorClose onClick={() => setError(null)}>×</ErrorClose>
          </ErrorBanner>
        )}

        <MessagesArea ref={messagesRef}>
          {messages.length === 0 ? renderWelcomeMessage() : <MessageList messages={messages} />}
        </MessagesArea>

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
      </ConversationPane>
    </ChatContainer>
  );
};

// Styled Components
const ChatContainer = styled.div`
  display: grid;
  grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
  height: 100%;
  background: rgb(var(--color-background));

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
`;

const SessionSidebar = styled.aside`
  border-right: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  display: flex;
  flex-direction: column;
  min-height: 0;

  @media (max-width: 900px) {
    border-right: none;
    border-bottom: 1px solid rgb(var(--color-border));
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const NewChatButton = styled.button`
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;

  &:hover {
    background: rgb(var(--color-primary) / 0.08);
  }
`;

const SessionList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 10px;
`;

const SessionGroupHeader = styled.div`
  padding: 8px 6px 6px;
  font-size: 11px;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const SessionButton = styled.button<{ $active: boolean }>`
  width: 100%;
  text-align: left;
  border: 1px solid ${({ $active }) =>
    $active ? 'rgb(var(--color-primary) / 0.35)' : 'transparent'};
  background: ${({ $active }) =>
    $active ? 'rgb(var(--color-primary) / 0.08)' : 'transparent'};
  color: rgb(var(--color-text-primary));
  border-radius: 12px;
  padding: 10px;
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-primary) / 0.08);
  }
`;

const SessionButtonTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
`;

const SessionButtonMeta = styled.div`
  margin-top: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const EmptySidebarText = styled.div`
  padding: 12px 6px;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const ConversationPane = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
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
