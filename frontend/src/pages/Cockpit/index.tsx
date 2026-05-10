/**
 * Cockpit Page - Search-First Command Center
 *
 * Cockpit layout with URL-synchronized sub-navigation.
 *
 * Created: 2026-02-04 - Phase 1.2 Cockpit Enhancement
 */
import React from 'react';
import styled from 'styled-components';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs } from 'antd';
import { Target, LayoutGrid, Workflow, PhoneCall } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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

const HeaderTitleGroup = styled.div``;

const HeaderTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;

  @media (max-width: 640px) {
    font-size: 20px;
  }
`;

const HeaderSubtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 4px 0 0;

  @media (max-width: 640px) {
    font-size: 13px;
  }
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

const Content = styled.main``;

// ============================================================================
// Component
// ============================================================================

const TAB_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutGrid size={18} /> },
  { key: 'process-monitor', label: 'Process Monitor', icon: <Workflow size={18} /> },
  { key: 'calls', label: 'Calls', icon: <PhoneCall size={18} /> },
] as const;

const CockpitPage: React.FC = () => {
  useDocumentTitle('Cockpit');
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = React.useMemo(() => {
    const pathname = location.pathname;
    if (pathname.startsWith('/process-cockpit')) return 'process-monitor';
    if (pathname.startsWith('/cockpit/process-monitor')) return 'process-monitor';
    if (pathname.startsWith('/cockpit/calls')) return 'calls';
    return 'dashboard';
  }, [location.pathname]);

  const handleTabChange = React.useCallback(
    (key: string) => {
      if (key === 'process-monitor') {
        navigate('/command-center?tab=action-required');
        return;
      }
      navigate(`/cockpit/${key}`);
    },
    [navigate],
  );

  const items = React.useMemo(
    () =>
      TAB_ITEMS.map((t) => ({
        key: t.key,
        label: (
          <TabLabel>
            {t.icon}
            <span>{t.label}</span>
          </TabLabel>
        ),
      })),
    []
  );

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <HeaderIcon>
            <Target size={20} />
          </HeaderIcon>
          <HeaderTitleGroup>
            <HeaderTitle>Cockpit</HeaderTitle>
            <HeaderSubtitle>Your search-first operational command center</HeaderSubtitle>
          </HeaderTitleGroup>
        </HeaderLeft>
      </Header>

      <StyledTabs activeKey={activeKey} items={items} onChange={handleTabChange} />

      <Content id="cockpit-content" role="tabpanel">
        <Outlet />
      </Content>
    </Container>
  );
};

export default CockpitPage;

export { CockpitPage };
