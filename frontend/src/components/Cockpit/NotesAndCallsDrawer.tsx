import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer, Button, Input, List, Typography, Tag, Spin, Modal, message } from 'antd';
import styled from 'styled-components';
import { businessApi } from '../../services/businessApi';
import { logger } from '@/utils/logger';

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

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  const fetchTimeline = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    try {
      // CRITICAL: trailing slash before query params prevents redirect loops (Nginx/Django APPEND_SLASH)
      const logsUrl = `/workspace/activity-logs/?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}&limit=20`;
      const callsUrl = `/workspace/scheduled-calls/?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}&limit=20`;

      const [logsResp, callsResp] = await Promise.all([
        businessApi.get(logsUrl),
        businessApi.get(callsUrl),
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
      // Non-fatal: suppress console noise on intermittent 5xx/502s.
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
      logger.error('Failed to create note', { component: 'NotesAndCallsDrawer' }, err);
    } finally {
      setSavingNote(false);
    }
  }, [entityId, entityType, fetchTimeline, noteText]);

  const getNoteId = useCallback((item: TimelineItem): number | null => {
    if (item.kind !== 'note') return null;
    const raw = String(item.id || '');
    const noteId = Number(raw.startsWith('note:') ? raw.split(':')[1] : raw);
    if (!Number.isFinite(noteId)) return null;
    return noteId;
  }, []);

  const openEdit = useCallback((item: TimelineItem) => {
    const noteId = getNoteId(item);
    if (!noteId) return;

    setEditId(noteId);
    setEditTitle(item.title || 'Note');
    setEditContent(item.content || '');
    setEditOpen(true);
  }, [getNoteId]);

  const handleDeleteNote = useCallback((item: TimelineItem) => {
    const noteId = getNoteId(item);
    if (!noteId) return;

    Modal.confirm({
      title: 'Delete note?',
      content: 'This cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        setDeletingNoteId(noteId);
        try {
          await businessApi.delete(`/workspace/activity-logs/${noteId}/`);
          message.success('Note deleted');
          void fetchTimeline();
        } catch (err) {
          message.error('Failed to delete note');
        } finally {
          setDeletingNoteId(null);
        }
      },
    });
  }, [fetchTimeline, getNoteId]);

  const handleSaveEdit = useCallback(async () => {
    if (!editId) return;

    const nextTitle = editTitle.trim() || 'Note';
    const nextContent = editContent.trim();
    if (!nextContent) return;

    setSavingEdit(true);
    try {
      await businessApi.patch(`/workspace/activity-logs/${editId}/`, {
        title: nextTitle,
        content: nextContent,
      });
      setEditOpen(false);
      setEditId(null);
      setEditTitle('');
      setEditContent('');
      void fetchTimeline();
    } catch (err) {
      logger.error('Failed to edit note', { component: 'NotesAndCallsDrawer' }, err);
    } finally {
      setSavingEdit(false);
    }
  }, [editContent, editId, editTitle, fetchTimeline]);

  return (
    <Drawer
      title={title}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      destroyOnHidden={false}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Tag color={item.kind === 'note' ? 'blue' : 'gold'}>{item.kind.toUpperCase()}</Tag>
                    <span style={{ fontWeight: 600 }}>{item.title}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.kind === 'note' ? (
                        <>
                          <Button size="small" onClick={() => openEdit(item)}>
                            Edit
                          </Button>
                          <Button
                            size="small"
                            danger
                            loading={deletingNoteId === getNoteId(item)}
                            onClick={() => handleDeleteNote(item)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                      <Text type="secondary">{new Date(item.createdAt).toLocaleString()}</Text>
                    </div>
                  </div>
                }
                description={
                  <div>
                    <div style={{ whiteSpace: 'pre-wrap', color: 'rgb(var(--color-text-primary))' }}>
                      {item.content}
                    </div>
                    {typeof item.meta?.created_by_name === 'string' && (
                      <Text type="secondary">By: {item.meta.created_by_name}</Text>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        title="Edit Note"
        open={editOpen}
        onCancel={() => {
          if (savingEdit) return;
          setEditOpen(false);
          setEditId(null);
          setEditTitle('');
          setEditContent('');
        }}
        onOk={() => void handleSaveEdit()}
        okText="Save"
        confirmLoading={savingEdit}
        okButtonProps={{ disabled: !editContent.trim() }}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
          <Input.TextArea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Note"
            autoSize={{ minRows: 4, maxRows: 10 }}
          />
          <Text type="secondary">
            Only the note author (or staff) can edit.
          </Text>
        </div>
      </Modal>

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
