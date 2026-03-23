import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer, Button, Input, List, Typography, Tag, Spin } from 'antd';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';

const { Text } = Typography;

type TimelineItem = {
  id: string;
  kind: 'note' | 'call';
  title: string;
  content: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

type ActivityLog = {
  id: number;
  title: string;
  content: string;
  created_on: string;
  is_pinned?: boolean;
  tags?: string;
  created_by_name?: string;
};

type ScheduledCall = {
  id: number;
  title: string;
  description?: string;
  scheduled_for: string;
  is_completed: boolean;
  created_by_name?: string;
};

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const Composer = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export interface NotesAndCallsDrawerProps {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityLabel?: string;
}

const normalizeList = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

export const NotesAndCallsDrawer: React.FC<NotesAndCallsDrawerProps> = ({
  open,
  onClose,
  entityType,
  entityId,
  entityLabel,
}) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchTimeline = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    try {
      const [logsResp, callsResp] = await Promise.all([
        businessApi.get('/workspace/activity-logs/', {
          params: {
            entity_type: entityType,
            entity_id: entityId,
            limit: 20,
          },
        }),
        businessApi.get('/workspace/scheduled-calls/', {
          params: {
            entity_type: entityType,
            entity_id: entityId,
            limit: 20,
          },
        }),
      ]);

      const logs = normalizeList(logsResp.data) as ActivityLog[];
      const calls = normalizeList(callsResp.data) as ScheduledCall[];

      const timeline: TimelineItem[] = [
        ...logs.map((l) => ({
          id: `note:${l.id}`,
          kind: 'note' as const,
          title: l.title || 'Note',
          content: l.content,
          createdAt: l.created_on,
          meta: {
            pinned: Boolean(l.is_pinned),
            tags: l.tags,
            created_by_name: l.created_by_name,
          },
        })),
        ...calls.map((c) => ({
          id: `call:${c.id}`,
          kind: 'call' as const,
          title: c.title,
          content: c.description || (c.is_completed ? 'Call completed' : 'Call scheduled'),
          createdAt: c.scheduled_for,
          meta: {
            is_completed: c.is_completed,
            created_by_name: c.created_by_name,
          },
        })),
      ].sort((a, b) => {
        const ta = Date.parse(a.createdAt || '');
        const tb = Date.parse(b.createdAt || '');
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });

      setItems(timeline);
    } catch (err) {
      console.error('[NotesAndCallsDrawer] Failed to load timeline', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, open]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  const title = useMemo(() => {
    const label = entityLabel ? `: ${entityLabel}` : '';
    return `Log Call / Notes${label}`;
  }, [entityLabel]);

  const handleCreateNote = useCallback(async () => {
    const content = noteText.trim();
    if (!content) return;

    setSavingNote(true);
    try {
      await businessApi.post('/workspace/activity-logs/', {
        entity_type: entityType,
        entity_id: Number(entityId),
        title: 'Note',
        content,
      });
      setNoteText('');
      void fetchTimeline();
    } catch (err) {
      console.error('[NotesAndCallsDrawer] Failed to create note', err);
    } finally {
      setSavingNote(false);
    }
  }, [entityId, entityType, fetchTimeline, noteText]);

  return (
    <Drawer
      title={title}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
    >
      <HeaderRow>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'rgb(var(--color-text-primary))' }}>
            All notes related to currently selected Contact
          </div>
          <Text type="secondary">Notes and calls are tenant-scoped and ordered most recent first.</Text>
        </div>
      </HeaderRow>

      {loading ? (
        <div style={{ padding: 16 }}><Spin /></div>
      ) : (
        <List
          dataSource={items}
          locale={{ emptyText: 'No notes or calls yet.' }}
          renderItem={(item) => (
            <List.Item style={{ alignItems: 'flex-start' }}>
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={item.kind === 'note' ? 'blue' : 'gold'}>{item.kind.toUpperCase()}</Tag>
                    <span style={{ fontWeight: 600 }}>{item.title}</span>
                    <Text type="secondary" style={{ marginLeft: 'auto' }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </div>
                }
                description={
                  <div>
                    <div style={{ whiteSpace: 'pre-wrap', color: 'rgb(var(--color-text-primary))' }}>
                      {item.content}
                    </div>
                    {item.meta?.created_by_name && (
                      <Text type="secondary">By: {String(item.meta.created_by_name)}</Text>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Composer>
        <Input.TextArea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Write a note…"
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setNoteText('')} disabled={!noteText.trim() || savingNote}>Clear</Button>
          <Button type="primary" onClick={handleCreateNote} loading={savingNote} disabled={!noteText.trim()}>
            Add Note
          </Button>
        </div>
      </Composer>
    </Drawer>
  );
};

export default NotesAndCallsDrawer;
