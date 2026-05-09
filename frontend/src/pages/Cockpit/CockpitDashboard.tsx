/**
 * Cockpit Dashboard Component
 *
 * Widget grid dashboard for the Cockpit command center.
 * Refactored from Workspace.tsx for dual-mode Cockpit interface.
 *
 * Features:
 * - Draggable, resizable widgets
 * - Layout persistence
 * - Edit mode toggle
 * - Widget catalog
 * - CommandBar for universal search (⌘K)
 *
 * Updated: 2026-02-04 - Refactored from Workspace.tsx
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled from 'styled-components';
import {
  LayoutGrid, Lock, Unlock, Plus,
  RotateCcw, X
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  WidgetGrid,
  WidgetConfig,
  WidgetLayout,
  QuickStatsWidget,
  RecentActivityWidget,
  UpcomingCallsWidget,
  QuickActionsWidget,
  EntityExplorerWidget,
  MyTasksWidget,
  TodaysNumbersWidget,
  ActionItemsWidget,
  CalendarWidget,
  EmailIntegrationWidget,
  EmailIngestionMonitorWidget,
  ConfidenceScoringWidget,
} from '../../components/Widgets';
import {
  CockpitTour,
  COCKPIT_TOUR_SELECTORS,
  SmartSearch,
  BreadcrumbBar,
} from '../../components/Cockpit';
import { AILearningMetricsWidget } from '../../components/Cockpit/AILearningMetricsWidget';
import { EmptyState } from '../../components/Admin';
import { CockpitWelcomeEmptyState, useOnboarding } from '../../components/Onboarding';
import { useCockpitNavigation } from '../../contexts/CockpitNavigationContext';
import { useCockpitStats, type CockpitStats } from '../../hooks/useCockpitStats';
import { businessApi } from '../../services/businessApi';
import { useCockpitPinnedTools } from '../../contexts/CockpitPinnedToolsContext';
import { logger } from '../../utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SavedLayout {
  layout: WidgetLayout[];
  widgets: WidgetConfig[];
  version: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'cockpit_dashboard_layout';
const LAYOUT_VERSION = 1;

const normalizeWidgetType = (widgetType: string): string =>
  widgetType.includes('-')
    ? `${widgetType
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')}Widget`
    : widgetType;

const isCockpitBlankSlate = (stats: CockpitStats | null): boolean => {
  if (!stats) {
    return false;
  }

  return (
    stats.quick_stats.total_orders === 0 &&
    stats.quick_stats.total_revenue === 0 &&
    stats.quick_stats.total_customers === 0 &&
    stats.quick_stats.total_suppliers === 0 &&
    stats.todays_numbers.orders_today === 0 &&
    stats.todays_numbers.pending_orders === 0 &&
    stats.todays_numbers.completed_today === 0 &&
    stats.todays_numbers.active_customers === 0 &&
    stats.recent_activity.length === 0 &&
    stats.upcoming_calls.length === 0
  );
};

// Default widgets configuration — limited to ≤4 focused sections for clarity.
// Users can add more widgets from the catalog via edit mode.
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'todays-numbers', type: 'TodaysNumbersWidget', title: "Today's Numbers" },
  { id: 'quick-actions', type: 'QuickActionsWidget', title: 'Quick Actions' },
  { id: 'recent-activity', type: 'RecentActivityWidget', title: 'Recent Activity' },
  { id: 'my-tasks', type: 'MyTasksWidget', title: 'My Tasks' },
];

// Default layout — spacious 2×2 grid with generous sizing
const DEFAULT_LAYOUT: WidgetLayout[] = [
  { i: 'todays-numbers', x: 0, y: 0, w: 6, h: 5 },
  { i: 'quick-actions', x: 6, y: 0, w: 6, h: 5 },
  { i: 'recent-activity', x: 0, y: 5, w: 6, h: 5 },
  { i: 'my-tasks', x: 6, y: 5, w: 6, h: 5 },
];

// Widget catalog for adding new widgets - organized by category
const WIDGET_CATALOG = [
  {
    type: 'TodaysNumbersWidget',
    title: "Today's Numbers",
    description: 'Detailed KPI dashboard with trends',
    category: 'metrics',
    icon: '📊',
  },
  {
    type: 'MyTasksWidget',
    title: 'My Tasks',
    description: 'Your assigned tasks and deadlines',
    category: 'productivity',
    icon: '✅',
  },
  {
    type: 'QuickStatsWidget',
    title: 'Quick Stats',
    description: 'Key metrics and KPIs',
    category: 'metrics',
    icon: '📈',
  },
  {
    type: 'RecentActivityWidget',
    title: 'Recent Activity',
    description: 'Activity feed',
    category: 'information',
    icon: '📰',
  },
  {
    type: 'UpcomingCallsWidget',
    title: 'Upcoming Calls',
    description: 'Scheduled callbacks',
    category: 'productivity',
    icon: '📞',
  },
  {
    type: 'QuickActionsWidget',
    title: 'Quick Actions',
    description: 'Common shortcuts',
    category: 'productivity',
    icon: '⚡',
  },
  {
    type: 'EntityExplorerWidget',
    title: 'Entity Explorer',
    description: 'Browse and explore entities',
    category: 'information',
    icon: '🔍',
  },
  {
    type: 'EmailIntegrationWidget',
    title: 'Email Integrations',
    description: 'Manage connected email accounts',
    category: 'integrations',
    icon: '📧',
  },
  {
    type: 'EmailIngestionMonitorWidget',
    title: 'Email Ingestion Monitor',
    description: 'Track order-related emails and AI processing',
    category: 'integrations',
    icon: '📬',
  },
  {
    type: 'ConfidenceScoringWidget',
    title: 'AI Confidence',
    description: 'AI parsing confidence metrics and auto-processing stats',
    category: 'metrics',
    icon: '🧠',
  },
];

const WIDGET_CATEGORIES: Record<string, string> = {
  metrics: '📊 Metrics & KPIs',
  productivity: '✅ Productivity',
  information: '📰 Information',
  integrations: '🔌 Integrations',
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  min-height: calc(100vh - 180px);
  background: rgb(var(--color-background));
`;

const ToolbarWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 16px 24px 0;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);

  @media (max-width: 640px) {
    margin: 12px 16px 0;
    flex-wrap: wrap;
    gap: 12px;
  }
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          color: rgb(var(--color-text-inverse));
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'danger':
        return `
          background: rgb(var(--color-error));
          color: rgb(var(--color-text-inverse));
          border: none;
          &:hover { opacity: 0.9; }
        `;
      default:
        return `
          background: rgb(var(--color-surface));
          color: rgb(var(--color-text-primary));
          border: 1px solid rgb(var(--color-border));
          &:hover { background: rgb(var(--color-background)); }
        `;
    }
  }}
`;

const EditBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: var(--radius-sm, 4px);
  background: rgb(var(--color-warning));
  color: rgb(var(--color-text-primary));
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const GridWrapper = styled.div`
  padding: 24px;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

const HeroSearchSection = styled.div`
  padding: 20px 24px 12px;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

const HeroSearchInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

// Widget catalog modal
const ModalOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg, 12px);
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const ModalTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const ModalClose = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm, 4px);
  color: rgb(var(--color-text-tertiary));
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }
`;

const ModalBody = styled.div`
  padding: 16px 20px;
  overflow-y: auto;
  max-height: calc(80vh - 60px);
`;

const WidgetOption = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-background));
  text-align: left;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.05);
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const WidgetOptionIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm, 4px);
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
`;

const WidgetOptionContent = styled.div`
  flex: 1;
`;

const WidgetOptionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const WidgetOptionDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 2px;
`;

const CategoryHeader = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  padding: 8px 0;
  margin-top: 16px;
  border-bottom: 1px solid rgb(var(--color-border));

  &:first-child {
    margin-top: 0;
  }
`;

const WidgetIcon = styled.span`
  font-size: 20px;
`;

// ============================================================================
// Component
// ============================================================================

type InlineActionState = {
  action: 'create' | 'edit' | 'view';
  entityType: string;
  contextData: any;
} | null;

export const CockpitDashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { hasCompletedTour, launchTour } = useOnboarding();
  const { stats } = useCockpitStats();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [inlineAction, setInlineAction] = useState<InlineActionState>(null);
  const [layout, setLayout] = useState<WidgetLayout[]>(DEFAULT_LAYOUT);
  const [isEditing, setIsEditing] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [gridWidth, setGridWidth] = useState(1200);
  const [isSaving, setIsSaving] = useState(false);
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);

  // Header owns global Ctrl+K search. Cockpit reads query from URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const cockpitQuery = searchParams.get('q') ?? '';

  useEffect(() => {
    if (searchParams.get('tour') !== 'cockpit') {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete('tour');
    setSearchParams(next, { replace: true });
    void launchTour('cockpit', hasCompletedTour('cockpit') ? 'restart' : 'resume');
  }, [hasCompletedTour, launchTour, searchParams, setSearchParams]);

  // Handle search query changes from SmartSearch component
  // NOTE: use replace=true so typing doesn't spam browser history.
  const handleQueryChange = useCallback((newQuery: string) => {
    const next = new URLSearchParams(searchParams);

    if (newQuery && newQuery.trim().length > 0) {
      next.set('q', newQuery);
    } else {
      next.delete('q');
    }

    // This subview is only meaningful when a record context is active.
    next.delete('cockpit_subview');

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Cockpit navigation context
  const navigation = useCockpitNavigation();
  const pinnedTools = useCockpitPinnedTools();

  const isSearchActive = cockpitQuery.trim().length > 0;
  const isRecordActive = navigation.path.length > 0;
  const showDashboardWidgets = !isSearchActive && !isRecordActive;
  const showWelcomeEmptyState =
    showDashboardWidgets &&
    !isEditing &&
    !isCatalogOpen &&
    (!hasCompletedTour('cockpit') || isCockpitBlankSlate(stats));
  const hasQuickActionsWidget = useMemo(
    () => widgets.some((widget) => normalizeWidgetType(widget.type) === 'QuickActionsWidget'),
    [widgets],
  );
  const cockpitTourAvailableSelectors = useMemo(() => {
    const selectors: string[] = [COCKPIT_TOUR_SELECTORS.smartSearch];

    if (showDashboardWidgets && !showWelcomeEmptyState) {
      selectors.push(COCKPIT_TOUR_SELECTORS.widgetGrid);

      if (hasQuickActionsWidget) {
        selectors.push(COCKPIT_TOUR_SELECTORS.quickActions);
      }
    }

    return selectors;
  }, [hasQuickActionsWidget, showDashboardWidgets, showWelcomeEmptyState]);
  const isCockpitLoaded = isLayoutLoaded && gridWidth > 0;

  // If the user edits the search input, we should exit any selected record context
  // so results refresh immediately on every keystroke.
  const lastQueryRef = useRef<string>(cockpitQuery);
  useEffect(() => {
    if (lastQueryRef.current === cockpitQuery) return;
    lastQueryRef.current = cockpitQuery;

    if (navigation.path.length > 0) {
      navigation.clearPath();
    }

    if (inlineAction) {
      setInlineAction(null);
    }
  }, [cockpitQuery, inlineAction, navigation]);

  const generateSmartContext = useCallback((sourceEntity: any, targetType: string) => {
    if (!sourceEntity) return {};

    const sourceType = String(sourceEntity.entityType ?? sourceEntity.type ?? '').toLowerCase();
    const sourceId = String(sourceEntity.id ?? sourceEntity.entityId ?? '').trim();
    if (!sourceType || !sourceId) return {};

    const context: any = {};

    if (sourceType === 'customer' && (targetType === 'sales_order' || targetType === 'inquiry' || targetType === 'invoice')) {
      context.customer = sourceId;
    }
    if (sourceType === 'supplier' && (targetType === 'purchase_order' || targetType === 'inquiry')) {
      context.supplier = sourceId;
    }

    context[`${sourceType}_id`] = sourceId;
    return context;
  }, []);

  const openInlineCreate = useCallback(
    (targetType: string, currentRecord: any) => {
      setInlineAction({
        action: 'create',
        entityType: targetType,
        contextData: generateSmartContext(currentRecord, targetType),
      });
    },
    [generateSmartContext]
  );

  // Exit edit mode whenever the dashboard grid isn't visible (searching or viewing a record)
  useEffect(() => {
    if (isSearchActive || isRecordActive) {
      setIsEditing(false);
      setIsCatalogOpen(false);
    }
  }, [isRecordActive, isSearchActive]);

  // Load saved layout from backend API with localStorage fallback
  useEffect(() => {
    const loadLayout = async () => {
      try {
        try {
          // Try backend API first
          const response = await businessApi.get('cockpit/workspace-layout/');
          const saved = response.data;
          if (saved.version === LAYOUT_VERSION) {
            setWidgets(saved.widgets);
            setLayout(saved.layout);
            return;
          }
        } catch (err: any) {
          // 404 means no saved layout - fall through to localStorage
          if (err.response?.status !== 404) {
            logger.error(
              'Failed to load cockpit layout from API',
              { component: 'CockpitDashboard' },
              err,
            );
          }
        }

        // Fallback to localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed: SavedLayout = JSON.parse(saved);
            if (parsed.version === LAYOUT_VERSION) {
              setWidgets(parsed.widgets);
              setLayout(parsed.layout);
            }
          }
        } catch (err) {
          logger.error(
            'Failed to load cockpit layout from localStorage',
            { component: 'CockpitDashboard' },
            err,
          );
        }
      } finally {
        setIsLayoutLoaded(true);
      }
    };

    loadLayout();
  }, []);

  // Calculate grid width based on container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.offsetWidth - 48);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Save layout to both backend API and localStorage
  const saveLayout = useCallback(async () => {
    const data: SavedLayout = {
      layout,
      widgets,
      version: LAYOUT_VERSION,
    };

    // Always save to localStorage as fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      logger.error(
        'Failed to save cockpit layout to localStorage',
        { component: 'CockpitDashboard' },
        err,
      );
    }

    // Also save to backend API
    try {
      setIsSaving(true);
      await businessApi.put('cockpit/workspace-layout/', data);
    } catch (err) {
      logger.error(
        'Failed to save cockpit layout to API',
        { component: 'CockpitDashboard' },
        err,
      );
    } finally {
      setIsSaving(false);
    }
  }, [layout, widgets]);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayout: WidgetLayout[]) => {
    setLayout(newLayout);
  }, []);

  // Save and exit edit mode
  const handleSaveLayout = useCallback(async () => {
    await saveLayout();
    setIsEditing(false);
  }, [saveLayout]);

  // Reset to default layout
  const handleResetLayout = useCallback(async () => {
    setWidgets(DEFAULT_WIDGETS);
    setLayout(DEFAULT_LAYOUT);
    localStorage.removeItem(STORAGE_KEY);

    // Also delete from backend (silently handle 404 as expected)
    try {
      await businessApi.delete('cockpit/workspace-layout/');
      } catch (err) {
        // Silently ignore 404 (expected when no saved layout exists)
        // Only log other errors
        if ((err as any).response?.status !== 404) {
          logger.error(
            'Failed to reset cockpit layout in API',
            { component: 'CockpitDashboard' },
            err,
          );
        }
        // Suppress 404 completely - it's expected
      }

    setIsEditing(false);
  }, []);

  // Add widget from catalog
  const handleAddWidget = useCallback((type: string, title: string) => {
    const id = `${type.toLowerCase()}-${Date.now()}`;
    const newWidget: WidgetConfig = { id, type, title };
    const newLayoutItem: WidgetLayout = { i: id, x: 0, y: Infinity, w: 4, h: 3 };

    setWidgets(prev => [...prev, newWidget]);
    setLayout(prev => [...prev, newLayoutItem]);
    setIsCatalogOpen(false);
  }, []);

  // Remove widget
  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setLayout(prev => prev.filter(l => l.i !== widgetId));
  }, []);

  // Pin widget into the tools bar (and remove from grid)
  const handlePinWidget = useCallback((widget: WidgetConfig) => {
    pinnedTools.pinWidget(widget);
    setWidgets(prev => prev.filter(w => w.id !== widget.id));
    setLayout(prev => prev.filter(l => l.i !== widget.id));
  }, [pinnedTools]);

  const handleStartCockpitTour = useCallback(() => {
    void launchTour('cockpit', hasCompletedTour('cockpit') ? 'restart' : 'resume');
  }, [hasCompletedTour, launchTour]);

  // Render widget based on type
  const renderWidget = useCallback((widget: WidgetConfig) => {
    const normalizedType = normalizeWidgetType(widget.type);

    switch (normalizedType) {
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
      case 'calendar': // Handle lowercase directly
        return <CalendarWidget />;
      case 'EmailIntegrationWidget':
        return <EmailIntegrationWidget />;
      case 'EmailIngestionMonitorWidget':
        return <EmailIngestionMonitorWidget />;
      case 'ConfidenceScoringWidget':
        return <ConfidenceScoringWidget />;
      default:
        logger.warn('Unknown cockpit widget type encountered', {
          component: 'CockpitDashboard',
          widgetType: widget.type,
          normalizedType,
        });
        return (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'rgb(var(--color-text-tertiary))'
          }}>
            <p>⚠️ Widget not found</p>
            <p style={{ fontSize: '12px' }}>Type: {widget.type}</p>
          </div>
        );
    }
  }, []);

  return (
    <Container>
      {/* Guided Tour */}
      <CockpitTour
        enabled={true}
        isCockpitLoaded={isCockpitLoaded}
        availableSelectors={cockpitTourAvailableSelectors}
      />

      {/* Breadcrumb navigation bar - Elevated above search and grid */}
      {navigation.path.length > 0 && (
        <div style={{ padding: '16px 24px 0 24px' }}>
          <BreadcrumbBar
            extraCrumbs={
              inlineAction?.action === 'create'
                ? [{
                    label: `New ${inlineAction.entityType
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())}`,
                  }]
                : inlineAction?.action === 'edit'
                  ? [{
                      label: `Edit ${inlineAction.entityType
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase())}`,
                    }]
                  : []
            }
          />
        </div>
      )}

      {/* Hero Search (SmartSearch) */}
      <HeroSearchSection>
        <HeroSearchInner>
          <SmartSearch
            query={cockpitQuery}
            onQueryChange={handleQueryChange}
            inlineAction={inlineAction}
            onInlineCancel={() => setInlineAction(null)}
            onInlineSuccess={(created) => {
              const row = (created && typeof created === 'object' ? (created as any) : {}) as any;
              const createdId = String(row?.id ?? row?.uuid ?? row?.pk ?? '').trim();
              const createdType = String(inlineAction?.entityType ?? '').trim();

              if (createdId && createdType) {
                setInlineAction({
                  action: 'view',
                  entityType: createdType,
                  contextData: { ...(inlineAction?.contextData || {}), entityId: createdId },
                });

                const next = new URLSearchParams(searchParams);
                next.set('cockpit_entity_type', createdType);
                next.set('cockpit_entity_id', createdId);
                setSearchParams(next, { replace: true });
                return;
              }

              setInlineAction(null);
            }}
            onOpenInlineCreate={openInlineCreate}
          />
        </HeroSearchInner>
      </HeroSearchSection>

      {/* Phase 3: AI Learning Metrics */}
      {showDashboardWidgets && showWelcomeEmptyState && (
        <div style={{ padding: '16px 24px 0' }}>
          <CockpitWelcomeEmptyState
            onCustomizeDashboard={() => setIsEditing(true)}
            onStartTour={handleStartCockpitTour}
          />
        </div>
      )}

      {showDashboardWidgets && !showWelcomeEmptyState && (
        <div style={{ padding: '16px 24px 0' }}>
          <AILearningMetricsWidget />
        </div>
      )}

      {/* Widget layout toolbar (applies to widgets only) */}
      {showDashboardWidgets && !showWelcomeEmptyState && (
        <ToolbarWrapper>
          <ToolbarLeft>
            {isEditing && <EditBadge>Editing Layout</EditBadge>}
          </ToolbarLeft>

          <ToolbarActions>
            {isEditing ? (
              <>
                <ActionButton onClick={() => setIsCatalogOpen(true)}>
                  <Plus size={16} />
                  Add Widget
                </ActionButton>
                <ActionButton onClick={handleResetLayout}>
                  <RotateCcw size={16} />
                  Reset
                </ActionButton>
                <ActionButton $variant="primary" onClick={handleSaveLayout} disabled={isSaving}>
                  <Lock size={16} />
                  {isSaving ? 'Saving...' : 'Save & Lock'}
                </ActionButton>
              </>
            ) : (
              <ActionButton onClick={() => setIsEditing(true)}>
                <Unlock size={16} />
                Customize
              </ActionButton>
            )}
          </ToolbarActions>
        </ToolbarWrapper>
      )}

      {/* Widget Grid (hidden when searching or a record is active) */}
      {showDashboardWidgets && !showWelcomeEmptyState && (
        <GridWrapper
          ref={containerRef}
          id="tour-cockpit-grid"
          data-testid="tour-cockpit-grid"
          data-tour="search-results"
        >
          {widgets.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid size={48} />}
              title="No widgets configured"
              message="Add widgets to build your personalized dashboard."
              actions={[
                {
                  label: 'Customize Dashboard',
                  onClick: () => setIsEditing(true),
                  variant: 'primary',
                },
                {
                  label: 'Restart Cockpit Tour',
                  onClick: handleStartCockpitTour,
                  variant: 'secondary',
                },
              ]}
            />
          ) : (
            <WidgetGrid
              widgets={widgets}
              layout={layout}
              onLayoutChange={handleLayoutChange}
              onRemoveWidget={handleRemoveWidget}
              onPinWidget={handlePinWidget}
              renderWidget={renderWidget}
              width={gridWidth}
              cols={12}
              rowHeight={100}
              isEditing={isEditing}
            />
          )}
        </GridWrapper>
      )}

      {/* Widget Catalog Modal */}
      <ModalOverlay $isOpen={isCatalogOpen} onClick={() => setIsCatalogOpen(false)}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>Add Widget</ModalTitle>
            <ModalClose onClick={() => setIsCatalogOpen(false)}>
              <X size={18} />
            </ModalClose>
          </ModalHeader>
          <ModalBody>
            {Object.entries(WIDGET_CATEGORIES).map(([category, label]) => {
              const categoryWidgets = WIDGET_CATALOG.filter(w => w.category === category);
              if (categoryWidgets.length === 0) return null;

              return (
                <div key={category}>
                  <CategoryHeader>{label}</CategoryHeader>
                  {categoryWidgets.map(item => (
                    <WidgetOption
                      key={item.type}
                      onClick={() => handleAddWidget(item.type, item.title)}
                    >
                      <WidgetOptionIcon>
                        <WidgetIcon>{item.icon}</WidgetIcon>
                      </WidgetOptionIcon>
                      <WidgetOptionContent>
                        <WidgetOptionTitle>{item.title}</WidgetOptionTitle>
                        <WidgetOptionDescription>{item.description}</WidgetOptionDescription>
                      </WidgetOptionContent>
                    </WidgetOption>
                  ))}
                </div>
              );
            })}
          </ModalBody>
        </ModalContent>
      </ModalOverlay>
    </Container>
  );
};

export default CockpitDashboard;
