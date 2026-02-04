/**
 * WorkForms Layout Component
 * 
 * Parent layout for the WorkForms section with sub-navigation tabs.
 * Implements Phase 1 of the Cockpit & WorkForms Enhancement Plan.
 * 
 * Created: 2026-02-03
 * Updated: 2026-02-04 - Renamed from Forms & Flows to WorkForms
 * 
 * Features:
 * - Sub-navigation tabs (My Tasks, In Progress, Catalog, History)
 * - Badge support for action item counts
 * - Responsive layout
 */
import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { CheckSquare, Clock, BookOpen, History, FileText } from 'lucide-react';
import { useActionItems } from '../../contexts/ActionItemsContext';

// ============================================================================
// Types
// ============================================================================

interface TabItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badgeKey?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TABS: TabItem[] = [
  { path: '/workforms/tasks', label: 'My Tasks', icon: <CheckSquare size={18} />, badgeKey: 'actionRequired' },
  { path: '/workforms/in-progress', label: 'In Progress', icon: <Clock size={18} /> },
  { path: '/workforms/catalog', label: 'Catalog', icon: <BookOpen size={18} /> },
  { path: '/workforms/history', label: 'History', icon: <History size={18} /> },
];

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  min-height: calc(100vh - 64px);
  background: rgb(var(--color-background));
  
  @media (max-width: 768px) {
    min-height: calc(100vh - 56px);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  
  @media (max-width: 640px) {
    padding: 16px 16px 0;
    flex-wrap: wrap;
    gap: 12px;
  }
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
  border-radius: var(--radius-md, 8px);
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

const TabNav = styled.nav`
  display: flex;
  gap: 4px;
  padding: 0 24px;
  background: rgb(var(--color-surface));
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
  
  @media (max-width: 640px) {
    padding: 0 16px;
    gap: 0;
  }
`;

const TabLink = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
  
  &:hover {
    color: rgb(var(--color-text-primary));
    background: rgb(var(--color-surface-hover));
  }
  
  &.active {
    color: rgb(var(--color-primary));
    border-bottom-color: rgb(var(--color-primary));
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: -2px;
    border-radius: 4px;
  }
  
  @media (max-width: 640px) {
    padding: 12px 12px;
    font-size: 13px;
    gap: 6px;
    
    span {
      /* Hide label text on small screens if needed, show icon */
    }
  }
`;

const TabBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: rgb(239, 68, 68); /* Error red for action items */
  border-radius: 10px;
`;

const Content = styled.main`
  padding: 24px;
  
  @media (max-width: 640px) {
    padding: 16px;
  }
`;

// ============================================================================
// Component
// ============================================================================

const WorkFormsLayout: React.FC = () => {
  const location = useLocation();
  const { counts } = useActionItems();
  
  // Map badgeKey to counts
  const badgeCounts: Record<string, number> = {
    actionRequired: counts.total,
    overdue: counts.overdue,
    dueToday: counts.due_today,
    dueThisWeek: counts.due_this_week,
  };
  
  return (
    <Container>
      <Header>
        <HeaderLeft>
          <HeaderIcon>
            <FileText size={20} />
          </HeaderIcon>
          <div>
            <HeaderTitle>WorkForms</HeaderTitle>
            <HeaderSubtitle>Manage your workflow tasks and form submissions</HeaderSubtitle>
          </div>
        </HeaderLeft>
      </Header>
      
      <TabNav role="tablist">
        {TABS.map((tab) => (
          <TabLink
            key={tab.path}
            to={tab.path}
            role="tab"
            aria-selected={location.pathname === tab.path}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badgeKey && badgeCounts[tab.badgeKey] && badgeCounts[tab.badgeKey] > 0 && (
              <TabBadge>{badgeCounts[tab.badgeKey]}</TabBadge>
            )}
          </TabLink>
        ))}
      </TabNav>
      
      <Content>
        <Outlet />
      </Content>
    </Container>
  );
};

export default WorkFormsLayout;
