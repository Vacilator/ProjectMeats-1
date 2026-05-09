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
 * - URL-synchronized AntD Tabs (deep-link safe)
 * - Badge support for action item counts
 * - Responsive layout
 */
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Tabs } from 'antd';
import { CheckSquare, Clock, BookOpen, History, FileText, Workflow } from 'lucide-react';
import { useActionItems } from '../../contexts/ActionItemsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// ============================================================================
// Types
// ============================================================================

interface TabItem {
  key: string;
  path: string;
  label: string;
  icon: React.ReactNode;
  badgeKey?: string;
  adminOnly?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TABS: TabItem[] = [
  { key: 'tasks', path: '/workforms/tasks', label: 'My Tasks', icon: <CheckSquare size={18} />, badgeKey: 'actionRequired' },
  { key: 'in-progress', path: '/workforms/in-progress', label: 'In Progress', icon: <Clock size={18} /> },
  { key: 'monitoring', path: '/workforms/monitoring', label: 'Monitoring', icon: <Workflow size={18} /> },
  { key: 'catalog', path: '/workforms/catalog', label: 'Catalog', icon: <BookOpen size={18} /> },
  { key: 'history', path: '/workforms/history', label: 'History', icon: <History size={18} /> },
  { key: 'editor', path: '/workforms/editor', label: 'Editor', icon: <FileText size={18} />, adminOnly: true },
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

const StyledTabs = styled(Tabs)`
  padding: 0 24px;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));

  .ant-tabs-nav {
    margin: 0;
  }

  .ant-tabs-content-holder {
    display: none;
  }

  @media (max-width: 640px) {
    padding: 0 16px;
  }
`;

const TabLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  color: rgb(var(--color-text-primary));
  background: rgba(var(--color-error), 0.15);
  border: 1px solid rgba(var(--color-error), 0.35);
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
  useDocumentTitle('WorkForms');
  const location = useLocation();
  const navigate = useNavigate();
  const { counts } = useActionItems();
  const { isAdmin } = useAuth();

  const badgeCounts: Record<string, number> = {
    actionRequired: counts.total,
    overdue: counts.overdue,
    dueToday: counts.due_today,
    dueThisWeek: counts.due_this_week,
  };

  const visibleTabs = React.useMemo(() => TABS.filter((tab) => !tab.adminOnly || isAdmin), [isAdmin]);

  const activeKey = React.useMemo(() => {
    const pathname = location.pathname;
    const match = visibleTabs.find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`));
    return match?.key ?? visibleTabs[0]?.key ?? 'tasks';
  }, [location.pathname, visibleTabs]);

  const tabItems = React.useMemo(
    () =>
      visibleTabs.map((tab) => ({
        key: tab.key,
        label: (
          <TabLabel>
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badgeKey && badgeCounts[tab.badgeKey] > 0 && <TabBadge>{badgeCounts[tab.badgeKey]}</TabBadge>}
          </TabLabel>
        ),
      })),
    [badgeCounts, visibleTabs]
  );

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <HeaderIcon>
            <FileText size={20} />
          </HeaderIcon>
          <div>
            <HeaderTitle>WorkForms</HeaderTitle>
            <HeaderSubtitle>Manage your WorkForm tasks and form submissions</HeaderSubtitle>
          </div>
        </HeaderLeft>
      </Header>

      <StyledTabs
        activeKey={activeKey}
        items={tabItems}
        onChange={(key) => navigate(`/workforms/${key}`)}
      />

      <Content>
        <Outlet />
      </Content>
    </Container>
  );
};

export default WorkFormsLayout;
