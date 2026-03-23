import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Drawer, Button, Spin } from 'antd';
import { Calculator, Mail, PinOff, Search, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';
import { useCockpitPinnedTools } from '../../contexts/CockpitPinnedToolsContext';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import { notify } from '../../utils/notify';
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
  const { quickActions, availableForms, openFormModal, openEditor } = useQuickActions();

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
    if (openPinnedId === 'tool:record') {
      return { id: openPinnedId, title: 'Record Context', icon: <Search size={14} /> };
    }
    return null;
  }, [openPinnedId]);

  const loadActiveRecord = useCallback(async () => {
    if (!activeRecord) return null;
    setRecordLoading(true);
    try {
      const resp = await businessApi.get(
        `/system/entities/${encodeURIComponent(activeRecord.type)}/${encodeURIComponent(String(activeRecord.id))}/`
      );
      setRecordDetail(resp.data);
      return resp.data;
    } catch (e) {
      console.warn('[PinnedToolsBar] Failed to load active record context:', e);
      setRecordDetail(null);
      return null;
    } finally {
      setRecordLoading(false);
    }
  }, [activeRecord]);

  useEffect(() => {
    if (openPinnedId === 'tool:record' && activeRecord) {
      void loadActiveRecord();
    }
  }, [openPinnedId, activeRecord, loadActiveRecord]);

  const runTool = useCallback(
    async (tool: 'email' | 'quote') => {
      if (!activeRecord) return;

      // Ensure we have the full record detail so we can pass context to the runner
      const detail = recordDetail ?? (recordLoading ? null : await loadActiveRecord());

      try {
        sessionStorage.setItem(
          'pm.activeRecordContext',
          JSON.stringify({
            activeRecord,
            recordDetail: detail,
          })
        );
      } catch (e) {
        console.warn('[PinnedToolsBar] Failed to persist active record context:', e);
      }

      const desiredLabel = tool === 'email' ? 'Email Drafter' : 'Smart Quote';
      const quickAction = quickActions.find(
        (a) => a.type === 'form' && a.form_id && a.label?.toLowerCase() === desiredLabel.toLowerCase()
      );
      const fallbackForm = availableForms.find(
        (f) => f.id && f.name?.toLowerCase() === desiredLabel.toLowerCase()
      );

      const formId = quickAction?.form_id ?? fallbackForm?.id ?? null;
      if (!formId) {
        notify.error(
          `No form configured for “${desiredLabel}”. Click Configure Tools to add a Quick Action with that label.`
        );
        openEditor();
        return;
      }

      await openFormModal(formId);
    },
    [
      activeRecord,
      availableForms,
      loadActiveRecord,
      openEditor,
      openFormModal,
      quickActions,
      recordDetail,
      recordLoading,
    ]
  );

  useEffect(() => {
    if (!isCockpit) return;

    const handleOpenTool = (event: Event) => {
      const toolId = (event as CustomEvent<{ toolId?: string }>).detail?.toolId;
      if (typeof toolId !== 'string' || toolId.length === 0) return;

      if (toolId === 'tool:email') {
        void runTool('email');
        return;
      }

      if (toolId === 'tool:quote') {
        void runTool('quote');
        return;
      }

      setOpenPinnedId(toolId);
    };

    window.addEventListener('pm:open-tool', handleOpenTool as EventListener);
    return () => window.removeEventListener('pm:open-tool', handleOpenTool as EventListener);
  }, [isCockpit, runTool]);

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
          onClick={() => void runTool('email')}
          title="Email Drafter"
          aria-label="Email Drafter"
          disabled={!activeRecord}
        >
          <Mail size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => void runTool('quote')}
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

        <ToolButton
          onClick={openEditor}
          title="Configure Tools"
          aria-label="Configure Tools"
        >
          <Settings size={16} />
        </ToolButton>

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
        ) : (
          <div style={{ color: 'rgb(var(--color-text-tertiary))' }}>No content</div>
        )}
      </Drawer>
    </Bar>
  );
};

export default PinnedToolsBar;
