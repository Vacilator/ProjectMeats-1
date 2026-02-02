/**
 * Workspace Page (formerly Cockpit)
 * 
 * Main dashboard with customizable widget grid.
 * Implements the Cockpit Command Center from Master Plan v3.
 * 
 * Features:
 * - Draggable, resizable widgets
 * - Layout persistence
 * - Edit mode toggle
 * - Widget catalog
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { 
  LayoutGrid, Settings, Lock, Unlock, Plus, 
  RotateCcw, X 
} from 'lucide-react';
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
} from '../components/Widgets';

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

const STORAGE_KEY = 'workspace_layout';
const LAYOUT_VERSION = 1;

// Default widgets configuration
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'todays-numbers', type: 'TodaysNumbersWidget', title: "Today's Numbers" },
  { id: 'my-tasks', type: 'MyTasksWidget', title: 'My Tasks' },
  { id: 'quick-stats', type: 'QuickStatsWidget', title: 'Quick Stats' },
  { id: 'recent-activity', type: 'RecentActivityWidget', title: 'Recent Activity' },
  { id: 'upcoming-calls', type: 'UpcomingCallsWidget', title: 'Upcoming Calls' },
  { id: 'quick-actions', type: 'QuickActionsWidget', title: 'Quick Actions' },
  { id: 'entity-explorer', type: 'EntityExplorerWidget', title: 'Entity Explorer' },
];

// Default layout configuration
const DEFAULT_LAYOUT: WidgetLayout[] = [
  { i: 'todays-numbers', x: 0, y: 0, w: 6, h: 4 },
  { i: 'my-tasks', x: 6, y: 0, w: 6, h: 4 },
  { i: 'quick-stats', x: 0, y: 4, w: 4, h: 3 },
  { i: 'quick-actions', x: 4, y: 4, w: 4, h: 3 },
  { i: 'recent-activity', x: 8, y: 4, w: 4, h: 3 },
  { i: 'upcoming-calls', x: 0, y: 7, w: 6, h: 3 },
  { i: 'entity-explorer', x: 6, y: 7, w: 6, h: 3 },
];

// Widget catalog for adding new widgets
const WIDGET_CATALOG = [
  { type: 'TodaysNumbersWidget', title: "Today's Numbers", description: 'Detailed KPI dashboard with trends' },
  { type: 'MyTasksWidget', title: 'My Tasks', description: 'Your assigned tasks and deadlines' },
  { type: 'QuickStatsWidget', title: 'Quick Stats', description: 'Key metrics and KPIs' },
  { type: 'RecentActivityWidget', title: 'Recent Activity', description: 'Activity feed' },
  { type: 'UpcomingCallsWidget', title: 'Upcoming Calls', description: 'Scheduled callbacks' },
  { type: 'QuickActionsWidget', title: 'Quick Actions', description: 'Common shortcuts' },
  { type: 'EntityExplorerWidget', title: 'Entity Explorer', description: 'Browse entities' },
];

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  min-height: calc(100vh - 64px);
  background: rgb(var(--color-background));
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
`;

const HeaderTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderSubtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 4px 0 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          color: white;
          border: none;
          &:hover { opacity: 0.9; }
        `;
      case 'danger':
        return `
          background: rgb(239, 68, 68);
          color: white;
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
  border-radius: var(--radius-sm);
  background: rgb(234, 179, 8);
  color: black;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const GridWrapper = styled.div`
  padding: 24px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));

  svg {
    margin-bottom: 16px;
    opacity: 0.5;
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
    margin: 0 0 8px;
  }

  p {
    margin: 0 0 16px;
  }
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
  border-radius: var(--radius-lg);
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
  border-radius: var(--radius-sm);
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
  border-radius: var(--radius-md);
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
  border-radius: var(--radius-sm);
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

// ============================================================================
// Component
// ============================================================================

export const WorkspacePage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [layout, setLayout] = useState<WidgetLayout[]>(DEFAULT_LAYOUT);
  const [isEditing, setIsEditing] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [gridWidth, setGridWidth] = useState(1200);

  // Load saved layout from localStorage
  useEffect(() => {
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
      console.error('Failed to load workspace layout:', err);
    }
  }, []);

  // Calculate grid width based on container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.offsetWidth - 48); // Account for padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Save layout to localStorage
  const saveLayout = useCallback(() => {
    try {
      const data: SavedLayout = {
        layout,
        widgets,
        version: LAYOUT_VERSION,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save workspace layout:', err);
    }
  }, [layout, widgets]);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayout: WidgetLayout[]) => {
    setLayout(newLayout);
  }, []);

  // Save and exit edit mode
  const handleSaveLayout = useCallback(() => {
    saveLayout();
    setIsEditing(false);
  }, [saveLayout]);

  // Reset to default layout
  const handleResetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    setLayout(DEFAULT_LAYOUT);
    localStorage.removeItem(STORAGE_KEY);
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

  // Render widget based on type
  const renderWidget = useCallback((widget: WidgetConfig) => {
    switch (widget.type) {
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
      default:
        return <div>Unknown widget: {widget.type}</div>;
    }
  }, []);

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <HeaderIcon>
            <LayoutGrid size={20} />
          </HeaderIcon>
          <div>
            <HeaderTitle>Workspace</HeaderTitle>
            <HeaderSubtitle>Your personalized command center</HeaderSubtitle>
          </div>
          {isEditing && <EditBadge>Editing</EditBadge>}
        </HeaderLeft>
        
        <HeaderActions>
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
              <ActionButton $variant="primary" onClick={handleSaveLayout}>
                <Lock size={16} />
                Save & Lock
              </ActionButton>
            </>
          ) : (
            <ActionButton onClick={() => setIsEditing(true)}>
              <Unlock size={16} />
              Customize
            </ActionButton>
          )}
        </HeaderActions>
      </Header>

      <GridWrapper ref={containerRef}>
        {widgets.length === 0 ? (
          <EmptyState>
            <LayoutGrid size={48} />
            <h3>No widgets configured</h3>
            <p>Add widgets to build your personalized workspace</p>
            <ActionButton $variant="primary" onClick={() => setIsEditing(true)}>
              <Plus size={16} />
              Get Started
            </ActionButton>
          </EmptyState>
        ) : (
          <WidgetGrid
            widgets={widgets}
            layout={layout}
            onLayoutChange={handleLayoutChange}
            onRemoveWidget={handleRemoveWidget}
            renderWidget={renderWidget}
            width={gridWidth}
            cols={12}
            rowHeight={100}
            isEditing={isEditing}
          />
        )}
      </GridWrapper>

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
            {WIDGET_CATALOG.map(item => (
              <WidgetOption 
                key={item.type}
                onClick={() => handleAddWidget(item.type, item.title)}
              >
                <WidgetOptionIcon>
                  <LayoutGrid size={18} />
                </WidgetOptionIcon>
                <WidgetOptionContent>
                  <WidgetOptionTitle>{item.title}</WidgetOptionTitle>
                  <WidgetOptionDescription>{item.description}</WidgetOptionDescription>
                </WidgetOptionContent>
              </WidgetOption>
            ))}
          </ModalBody>
        </ModalContent>
      </ModalOverlay>
    </Container>
  );
};

export default WorkspacePage;
