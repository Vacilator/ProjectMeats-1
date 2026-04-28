import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'antd';
import styled from 'styled-components';

import { commentsService, type CommentRecord, type MentionSuggestion } from '../../services/commentsService';
import { formatToLocal } from '../../utils/formatters';
import { logger } from '../../utils/logger';

export interface CommentsPanelProps {
  entityType: string;
  entityId: string | number;
  title?: string;
  emptyStateMessage?: string;
}

const Container = styled.div`
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
`;

const ComposerCard = styled.div`
  position: relative;
  margin-bottom: 12px;
  padding: 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

const Header = styled.div`
  margin-bottom: 8px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 110px;
  padding: 10px 12px;
  resize: vertical;
  font: inherit;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const ComposerFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
`;

const Hint = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const SubmitButton = styled.button`
  border: none;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  padding: 8px 14px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Suggestions = styled.div`
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 64px;
  z-index: 2;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgb(var(--color-text-primary) / 0.08);
  max-height: 220px;
  overflow-y: auto;
`;

const SuggestionButton = styled.button`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  text-align: left;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const SuggestionMeta = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const CommentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CommentCard = styled.div`
  padding: 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  min-width: 0;
`;

const CommentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`;

const CommentAuthor = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const CommentTimestamp = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const CommentBody = styled.div`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: rgb(var(--color-text-primary));
`;

const MentionSummary = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  padding: 20px 12px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  border: 1px dashed rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

const getMentionQuery = (value: string): string | null => {
  const match = value.match(/(?:^|\s)@([a-zA-Z0-9._-]{1,})$/);
  return match?.[1] ?? null;
};

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  entityType,
  entityId,
  title = 'Comments',
  emptyStateMessage = 'No comments yet.',
}) => {
  const normalizedEntityType = useMemo(
    () => String(entityType || '').trim().toLowerCase().replace(/-/g, '_'),
    [entityType]
  );
  const normalizedEntityId = useMemo(() => String(entityId ?? '').trim(), [entityId]);

  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const [mentionMap, setMentionMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextComments = await commentsService.listComments(normalizedEntityType, normalizedEntityId);
        if (!cancelled) {
          setComments(nextComments);
        }
      } catch (err) {
        logger.error('[CommentsPanel] Failed to load comments', err);
        if (!cancelled) {
          setError('Failed to load comments.');
          setComments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [normalizedEntityId, normalizedEntityType]);

  useEffect(() => {
    const query = getMentionQuery(draft);
    if (!query) {
      setMentionSuggestions([]);
      setMentionsLoading(false);
      return;
    }

    let cancelled = false;
    setMentionsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const suggestions = await commentsService.searchMentionSuggestions(query);
        if (!cancelled) {
          setMentionSuggestions(suggestions);
        }
      } catch (err) {
        logger.warn('[CommentsPanel] Failed to load mention suggestions', err);
        if (!cancelled) {
          setMentionSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setMentionsLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft]);

  const handleSelectMention = (suggestion: MentionSuggestion) => {
    const nextDraft = draft.replace(/@([a-zA-Z0-9._-]{1,})$/, `@${suggestion.username} `);
    setDraft(nextDraft);
    setMentionSuggestions([]);
    setMentionMap((current) => ({
      ...current,
      [`@${suggestion.username}`]: suggestion.id,
    }));
  };

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body) return;

    const mentionedUserIds = Array.from(
      new Set(
        Object.entries(mentionMap)
          .filter(([token]) => body.includes(token))
          .map(([, userId]) => userId)
      )
    );

    setSubmitting(true);
    try {
      const created = await commentsService.createComment({
        entityType: normalizedEntityType,
        entityId: normalizedEntityId,
        body,
        mentionedUserIds,
      });

      setComments((current) => [created, ...current]);
      setDraft('');
      setMentionSuggestions([]);
      setMentionMap({});
      setError(null);
    } catch (err) {
      logger.error('[CommentsPanel] Failed to create comment', err);
      setError('Failed to save comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container>
      <ComposerCard>
        <Header>
          <Title>{title}</Title>
          <Subtitle>Use @username to mention teammates.</Subtitle>
        </Header>

        {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} /> : null}

        {mentionSuggestions.length > 0 ? (
          <Suggestions role="listbox" aria-label="Mention suggestions">
            {mentionSuggestions.map((suggestion) => (
              <SuggestionButton key={suggestion.id} type="button" onClick={() => handleSelectMention(suggestion)}>
                <span>{suggestion.displayName}</span>
                <SuggestionMeta>
                  @{suggestion.username}
                  {suggestion.email ? ` • ${suggestion.email}` : ''}
                </SuggestionMeta>
              </SuggestionButton>
            ))}
          </Suggestions>
        ) : null}

        <Textarea
          aria-label="Comment body"
          placeholder="Add a comment"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />

        <ComposerFooter>
          <Hint>{mentionsLoading ? 'Loading mentions…' : 'Comments are tenant-scoped.'}</Hint>
          <SubmitButton type="button" onClick={handleSubmit} disabled={submitting || !draft.trim()}>
            {submitting ? 'Posting…' : 'Post comment'}
          </SubmitButton>
        </ComposerFooter>
      </ComposerCard>

      {loading ? <EmptyState>Loading comments…</EmptyState> : null}
      {!loading && comments.length === 0 ? <EmptyState>{emptyStateMessage}</EmptyState> : null}

      {!loading && comments.length > 0 ? (
        <CommentsList>
          {comments.map((comment) => (
            <CommentCard key={comment.id}>
              <CommentHeader>
                <CommentAuthor>{comment.created_by_name || comment.created_by?.display_name || 'Unknown user'}</CommentAuthor>
                <CommentTimestamp>{formatToLocal(comment.created_on)}</CommentTimestamp>
              </CommentHeader>
              <CommentBody>{comment.body}</CommentBody>
              {comment.mentioned_users.length > 0 ? (
                <MentionSummary>
                  Mentioned: {comment.mentioned_users.map((user) => user.display_name || user.username).join(', ')}
                </MentionSummary>
              ) : null}
            </CommentCard>
          ))}
        </CommentsList>
      ) : null}
    </Container>
  );
};

export default CommentsPanel;
