import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Drawer, Button, Spin } from 'antd';
import { Calculator, Mail, PinOff, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';
import { useCockpitPinnedTools } from '../../contexts/CockpitPinnedToolsContext';
import { businessApi } from '../../services/businessApi';
import {
  ActionItemsWidget,
  CalendarWidget,
  EmailIngestionMonitorWidget,
  EmailIntegrationWidget,
  EntityExplorerWidget,
  MyTasksWidget,
  QuickActionsWidget,
  QuickStatsWidget,
  RecentActivityWidget,
  TodaysNumbersWidget,
  UpcomingCallsWidget,
} from '../Widgets';

const Bar = styled.div`
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  padding: 8px 12px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
`;

const ToolButton = styled.button<{ $active?: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: ${(p) => (p.$active ? 'rgb(var(--color-primary) / 0.1)' : 'rgb(var(--color-background))')};
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  flex: 0 0 auto;

  &:hover {
    border-color: rgb(var(--color-primary));
  }
`;

const ToolLabel = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-left: 8px;
  white-space: nowrap;
`;

const normalizeWidgetType = (type: string) =>
  type.includes('-')
    ? type
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('') + 'Widget'
    : type;

const renderWidget = (type: string) => {
  switch (normalizeWidgetType(type)) {
    case 'QuickStatsWidget':
      return <QuickStatsWidget />;
    case 'RecentActivityWidget':
      return <RecentActivityWidget />;
    case 'UpcomingCallsWidget':
      return <UpcomingCallsWidget />;
    case 'QuickActionsWidget':
      return <QuickActionsWidget />;
    case 'EntityExplorerWidget':
      return <EntityExplorerWidget />;
    case 'MyTasksWidget':
      return <MyTasksWidget />;
    case 'TodaysNumbersWidget':
      return <TodaysNumbersWidget />;
    case 'ActionItemsWidget':
      return <ActionItemsWidget />;
    case 'CalendarWidget':
    case 'calendar':
      return <CalendarWidget />;
    case 'EmailIntegrationWidget':
      return <EmailIntegrationWidget />;
    case 'EmailIngestionMonitorWidget':
      return <EmailIngestionMonitorWidget />;
    default:
      return (
        <div style={{ padding: 16, color: 'rgb(var(--color-text-tertiary))' }}>
          Unknown widget: {type}
        </div>
      );
  }
};

export const PinnedToolsBar: React.FC = () => {
  const location = useLocation();
  const { path } = useCockpitNavigation();
  const { pinned, unpin } = useCockpitPinnedTools();

  const isCockpit = location.pathname.startsWith('/cockpit');
  const activeRecord = path[path.length - 1];

  const [openPinnedId, setOpenPinnedId] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<any>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const openPinned = useMemo(
    () => pinned.find((p) => p.id === openPinnedId) ?? null,
    [pinned, openPinnedId]
  );

  const openBuiltin = useMemo(() => {
    if (!openPinnedId) return null;
    if (openPinnedId === 'tool:record') return { id: openPinnedId, title: 'Record Context', icon: <Search size={14} /> };
    if (openPinnedId === 'tool:email') return { id: openPinnedId, title: 'Email Drafter', icon: <Mail size={14} /> };
    if (openPinnedId === 'tool:quote') return { id: openPinnedId, title: 'Smart Quote', icon: <Calculator size={14} /> };
    return null;
  }, [openPinnedId]);

  const loadActiveRecord = useCallback(async () => {
    if (!activeRecord) return;
    setRecordLoading(true);
    try {
      const resp = await businessApi.get(`/system/entities/${encodeURIComponent(activeRecord.type)}/${encodeURIComponent(String(activeRecord.id))}/`);
      setRecordDetail(resp.data);
    } catch (e) {
      console.warn('[PinnedToolsBar] Failed to load active record context:', e);
      setRecordDetail(null);
    } finally {
      setRecordLoading(false);
    }
  }, [activeRecord]);

  useEffect(() => {
    if (openPinnedId === 'tool:record' && activeRecord) {
      void loadActiveRecord();
    }
  }, [openPinnedId, activeRecord, loadActiveRecord]);

  if (!isCockpit) return null;

  const drawerTitle = openPinned?.title ?? openBuiltin?.title ?? '';
  const isDrawerOpen = Boolean(openPinned || openBuiltin);

  return (
    <Bar>
      <Row>
        <ToolButton
          $active={openPinnedId === 'tool:record'}
          onClick={() => setOpenPinnedId(openPinnedId === 'tool:record' ? null : 'tool:record')}
          title="Record Context"
          aria-label="Record Context"
          disabled={!activeRecord}
        >
          <Search size={16} />
        </ToolButton>
        <ToolButton
          $active={openPinnedId === 'tool:email'}
          onClick={() => setOpenPinnedId(openPinnedId === 'tool:email' ? null : 'tool:email')}
          title="Email Drafter"
          aria-label="Email Drafter"
          disabled={!activeRecord}
        >
          <Mail size={16} />
        </ToolButton>
        <ToolButton
          $active={openPinnedId === 'tool:quote'}
          onClick={() => setOpenPinnedId(openPinnedId === 'tool:quote' ? null : 'tool:quote')}
          title="Smart Quote"
          aria-label="Smart Quote"
          disabled={!activeRecord}
        >
          <Calculator size={16} />
        </ToolButton>

        {pinned.map((p) => (
          <ToolButton
            key={p.id}
            $active={openPinnedId === p.id}
            onClick={() => setOpenPinnedId(openPinnedId === p.id ? null : p.id)}
            title={p.title}
            aria-label={p.title}
          >
            📌
          </ToolButton>
        ))}

        {activeRecord && <ToolLabel>Active: {activeRecord.label}</ToolLabel>}
      </Row>

      <Drawer
        open={isDrawerOpen}
        onClose={() => setOpenPinnedId(null)}
        width={520}
        title={drawerTitle}
        extra={
          openPinned ? (
            <Button
              icon={<PinOff size={14} /> as any}
              onClick={() => {
                unpin(openPinned.id);
                setOpenPinnedId(null);
              }}
            >
              Unpin
            </Button>
          ) : null
        }
      >
        {openPinned?.kind === 'widget' && openPinned.widget ? (
          renderWidget(openPinned.widget.type)
        ) : openPinnedId === 'tool:record' ? (
          recordLoading ? (
            <Spin />
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(recordDetail, null, 2)}
            </pre>
          )
        ) : openPinnedId === 'tool:email' ? (
          <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Drafting from active record: <b>{activeRecord?.label}</b>. (Template + rules TBD.)
          </div>
        ) : openPinnedId === 'tool:quote' ? (
          <div style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Smart Quote for: <b>{activeRecord?.label}</b>. (Formula TBD.)
          </div>
        ) : (
          <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No content</div>
        )}
      </Drawer>
    </Bar>
  );
};

export default PinnedToolsBar;
