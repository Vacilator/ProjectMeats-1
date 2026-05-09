import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'antd';
import styled from 'styled-components';

import { activityFeedService, type ActivityFeedItem, type ActivityNoteResponse, type ActivitySource } from '@/services/activityFeedService';
import { formatToLocal } from '@/utils/formatters';

type ActivityEntityType =
  | 'supplier'
  | 'customer'
  | 'plant'
  | 'location'
  | 'purchase_order'
  | 'sales_order'
  | 'carrier'
  | 'product'
  | 'invoice'
  | 'contact'
  | 'inquiry'
  | 'fulfillment'
  | 'workform_execution';

type FilterSource = ActivitySource | 'all';

interface ActivityFeedProps {
  entityType?: ActivityEntityType;
  entityId?: string | number;
  showCreateForm?: boolean;
  showFilters?: boolean;
  title?: string;
  maxHeight?: string;
  limit?: number;
}

type EditableFormState = {
  title: string;
  content: string;
};

const NOTE_SUPPORTED_ENTITY_TYPES = new Set<ActivityEntityType>([
  'supplier',
  'customer',
  'plant',
  'location',
  'purchase_order',
  'sales_order',
  'carrier',
  'product',
  'invoice',
  'contact',
  'inquiry',
  'fulfillment',
]);

const SOURCE_OPTIONS: Array<{ value: FilterSource; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'audit', label: 'Audit' },
  { value: 'ai', label: 'AI' },
  { value: 'workflow', label: 'WorkForms' },
  { value: 'note', label: 'Notes' },
];

const ENTITY_OPTIONS: Array<{ value: ActivityEntityType; label: string }> = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'plant', label: 'Plant' },
  { value: 'location', label: 'Location' },
  { value: 'contact', label: 'Contact' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'carrier', label: 'Carrier' },
  { value: 'product', label: 'Product' },
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'workform_execution', label: 'WorkForm Run' },
];

const supportsNoteCreation = (entityType?: string, entityId?: string) => {
  const normalizedType = String(entityType || '').trim().toLowerCase() as ActivityEntityType;
  if (!NOTE_SUPPORTED_ENTITY_TYPES.has(normalizedType)) {
    return false;
  }

  const numericEntityId = Number(entityId);
  return Number.isFinite(numericEntityId) && numericEntityId > 0;
};

const parseTags = (rawTags: string[] | string | undefined): string[] => {
  if (Array.isArray(rawTags)) {
    return rawTags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(rawTags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const mapNoteToFeedItem = (note: ActivityNoteResponse): ActivityFeedItem => ({
  id: `note:${note.id}`,
  source: 'note',
  source_label: 'Note',
  action: 'note',
  title: note.title || 'Note',
  description: note.content || '',
  actor_name: note.created_by_name || 'System',
  actor_email: '',
  entity_type: String(note.entity_type || '').trim().toLowerCase(),
  entity_id: String(note.entity_id || ''),
  entity_label: '',
  source_record_id: String(note.id),
  occurred_at: note.modified_on || note.created_on,
  editable: true,
  tags: parseTags(note.tags),
  metadata: {
    is_pinned: Boolean(note.is_pinned),
  },
});

const FeedContainer = styled.div`
  width: 100%;
`;

const FeedHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const FeedTitle = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
`;

const Control = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  font-weight: 600;
`;

const InputBase = `
  width: 100%;
  min-height: 40px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const SelectInput = styled.select`
  ${InputBase}
`;

const TextInput = styled.input`
  ${InputBase}
`;

const TextArea = styled.textarea`
  ${InputBase}
  min-height: 110px;
  resize: vertical;
  font-family: inherit;
`;

const ActionButton = styled.button`
  min-height: 40px;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled(ActionButton)`
  background: transparent;
  color: rgb(var(--color-text-secondary));
`;

const NoteForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
`;

const TimelineContainer = styled.div<{ maxHeight?: string }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: ${({ maxHeight }) => maxHeight || 'none'};
  overflow-y: auto;
  padding-right: 4px;
`;

const ItemCard = styled.article`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
`;

const ItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ItemTitle = styled.h4`
  margin: 0;
  color: rgb(var(--color-text-primary));
  font-size: 1rem;
  font-weight: 600;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Badge = styled.span<{ $tone?: 'primary' | 'secondary' }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid
    ${({ $tone }) =>
      $tone === 'primary' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  color: ${({ $tone }) =>
    $tone === 'primary'
      ? 'rgb(var(--color-primary))'
      : 'rgb(var(--color-text-secondary))'};
  background: rgb(var(--color-surface));
`;

const MetaBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  text-align: right;
`;

const ItemDescription = styled.p`
  margin: 0;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
  line-height: 1.5;
`;

const EntityMeta = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: var(--radius-lg);
  color: rgb(var(--color-text-secondary));
  text-align: center;
`;

const LoadingState = styled.div`
  padding: 24px 16px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
`;

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  entityType,
  entityId,
  showCreateForm = false,
  showFilters = true,
  title = 'Activity Feed',
  maxHeight = '600px',
  limit = 50,
}) => {
  const fixedEntityType = useMemo(() => String(entityType || '').trim().toLowerCase(), [entityType]);
  const fixedEntityId = useMemo(() => String(entityId ?? '').trim(), [entityId]);

  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createState, setCreateState] = useState<EditableFormState>({ title: '', content: '' });
  const [editState, setEditState] = useState<EditableFormState>({ title: '', content: '' });
  const [sourceFilter, setSourceFilter] = useState<FilterSource>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState(fixedEntityType);
  const [entityIdFilter, setEntityIdFilter] = useState(fixedEntityId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (fixedEntityType) {
      setEntityTypeFilter(fixedEntityType);
    }
  }, [fixedEntityType]);

  useEffect(() => {
    if (fixedEntityId) {
      setEntityIdFilter(fixedEntityId);
    }
  }, [fixedEntityId]);

  const resolvedEntityType = fixedEntityType || entityTypeFilter;
  const resolvedEntityId = fixedEntityId || entityIdFilter;
  const canCreateNotes = showCreateForm && supportsNoteCreation(resolvedEntityType, resolvedEntityId);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await activityFeedService.list({
        entityType: resolvedEntityType || undefined,
        entityId: resolvedEntityId || undefined,
        sources: sourceFilter === 'all' ? undefined : [sourceFilter],
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit,
      });
      setItems(response.results || []);
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((typeof data.detail === 'string' ? data.detail : '') || (typeof data.error === 'string' ? data.error : '') || 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [endDate, limit, resolvedEntityId, resolvedEntityType, sourceFilter, startDate]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  const handleCreateNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateNotes || !createState.content.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const createdNote = await activityFeedService.createNote({
        entityType: resolvedEntityType,
        entityId: resolvedEntityId,
        title: createState.title,
        content: createState.content,
      });
      setItems((currentItems) => [mapNoteToFeedItem(createdNote), ...currentItems]);
      setCreateState({ title: '', content: '' });
      setShowNoteForm(false);
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((typeof data.detail === 'string' ? data.detail : '') || (typeof data.error === 'string' ? data.error : '') || 'Failed to save note.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: ActivityFeedItem) => {
    setEditingId(item.id);
    setEditState({
      title: item.title || 'Note',
      content: item.description || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState({ title: '', content: '' });
  };

  const saveEdit = async (item: ActivityFeedItem) => {
    if (!item.source_record_id || !editState.content.trim()) {
      return;
    }

    try {
      setSavingEdit(true);
      setError(null);
      const updatedNote = await activityFeedService.updateNote(item.source_record_id, {
        title: editState.title,
        content: editState.content,
      });
      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id ? mapNoteToFeedItem(updatedNote) : currentItem
        )
      );
      cancelEdit();
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((typeof data.detail === 'string' ? data.detail : '') || (typeof data.error === 'string' ? data.error : '') || 'Failed to update note.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <FeedContainer>
      <FeedHeader>
        <FeedTitle>{title}</FeedTitle>
        {canCreateNotes && !showNoteForm ? (
          <ActionButton type="button" onClick={() => setShowNoteForm(true)}>
            Add Note
          </ActionButton>
        ) : null}
      </FeedHeader>

      {showFilters ? (
        <Controls>
          <Control>
            Source
            <SelectInput
              aria-label="Filter activity by source"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as FilterSource)}
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </Control>

          {!fixedEntityType ? (
            <Control>
              Entity
              <SelectInput
                aria-label="Filter activity by entity type"
                value={entityTypeFilter}
                onChange={(event) => setEntityTypeFilter(event.target.value)}
              >
                <option value="">All entities</option>
                {ENTITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Control>
          ) : null}

          {!fixedEntityId ? (
            <Control>
              Entity ID
              <TextInput
                aria-label="Filter activity by entity id"
                type="text"
                value={entityIdFilter}
                onChange={(event) => setEntityIdFilter(event.target.value)}
                placeholder="e.g. 42 or execution UUID"
              />
            </Control>
          ) : null}

          <Control>
            From
            <TextInput
              aria-label="Filter activity start date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Control>

          <Control>
            To
            <TextInput
              aria-label="Filter activity end date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Control>
        </Controls>
      ) : null}

      {showNoteForm ? (
        <NoteForm onSubmit={handleCreateNote}>
          <TextInput
            aria-label="Note title"
            type="text"
            placeholder="Title"
            value={createState.title}
            onChange={(event) => setCreateState((current) => ({ ...current, title: event.target.value }))}
            disabled={submitting}
          />
          <TextArea
            aria-label="Note content"
            placeholder="What changed, who handled it, and any next-step context."
            value={createState.content}
            onChange={(event) => setCreateState((current) => ({ ...current, content: event.target.value }))}
            disabled={submitting}
            required
          />
          <BadgeRow>
            <SecondaryButton
              type="button"
              onClick={() => {
                setCreateState({ title: '', content: '' });
                setShowNoteForm(false);
              }}
              disabled={submitting}
            >
              Cancel
            </SecondaryButton>
            <ActionButton type="submit" disabled={submitting || !createState.content.trim()}>
              {submitting ? 'Saving…' : 'Save Note'}
            </ActionButton>
          </BadgeRow>
        </NoteForm>
      ) : null}

      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}

      {loading ? <LoadingState>Loading activity…</LoadingState> : null}

      {!loading && !error ? (
        <TimelineContainer maxHeight={maxHeight}>
          {items.length === 0 ? (
            <EmptyState>No matching activity yet.</EmptyState>
          ) : (
            items.map((item) => (
              <ItemCard key={item.id}>
                <ItemHeader>
                  <TitleBlock>
                    <BadgeRow>
                      <Badge $tone="primary">{item.source_label}</Badge>
                      <Badge>{item.action.replace(/_/g, ' ')}</Badge>
                      {(item.tags || []).map((tag) => (
                        <Badge key={`${item.id}:${tag}`}>{tag}</Badge>
                      ))}
                    </BadgeRow>
                    <ItemTitle>{item.title}</ItemTitle>
                  </TitleBlock>

                  <MetaBlock>
                    <span>{item.actor_name || 'System'}</span>
                    <span>{formatToLocal(item.occurred_at)}</span>
                    {item.editable && editingId !== item.id ? (
                      <SecondaryButton type="button" onClick={() => startEdit(item)}>
                        Edit
                      </SecondaryButton>
                    ) : null}
                  </MetaBlock>
                </ItemHeader>

                {!fixedEntityType || !fixedEntityId ? (
                  <EntityMeta>
                    Entity: {item.entity_label || item.entity_type || 'Unknown'}
                    {item.entity_id ? ` • ${item.entity_id}` : ''}
                  </EntityMeta>
                ) : null}

                {editingId === item.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <TextInput
                      aria-label="Edit note title"
                      type="text"
                      value={editState.title}
                      onChange={(event) => setEditState((current) => ({ ...current, title: event.target.value }))}
                      disabled={savingEdit}
                    />
                    <TextArea
                      aria-label="Edit note content"
                      value={editState.content}
                      onChange={(event) => setEditState((current) => ({ ...current, content: event.target.value }))}
                      disabled={savingEdit}
                    />
                    <BadgeRow>
                      <SecondaryButton type="button" onClick={cancelEdit} disabled={savingEdit}>
                        Cancel
                      </SecondaryButton>
                      <ActionButton
                        type="button"
                        onClick={() => void saveEdit(item)}
                        disabled={savingEdit || !editState.content.trim()}
                      >
                        {savingEdit ? 'Saving…' : 'Save Changes'}
                      </ActionButton>
                    </BadgeRow>
                  </div>
                ) : (
                  <ItemDescription>{item.description || 'No details provided.'}</ItemDescription>
                )}

                {item.actor_email ? <EntityMeta>{item.actor_email}</EntityMeta> : null}
              </ItemCard>
            ))
          )}
        </TimelineContainer>
      ) : null}
    </FeedContainer>
  );
};

export default ActivityFeed;
