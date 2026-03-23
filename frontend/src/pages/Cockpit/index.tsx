/**
 * Cockpit Page - Search-First Command Center
 *
 * Main Cockpit command center featuring the dashboard and hero omnibox search.
 *
 * Implements Phase 7 consolidation: search-first navigation without Smart Wizard mode.
 *
 * Created: 2026-02-04 - Phase 1.2 Cockpit Enhancement
 */
import React from 'react';
import styled from 'styled-components';
import { Target } from 'lucide-react';
import CockpitDashboard from './CockpitDashboard';

// ============================================================================
// Constants
// ============================================================================

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
  padding: 20px 24px;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  
  @media (max-width: 640px) {
    padding: 16px;
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

const Content = styled.main``;

// ============================================================================
// Component
// ============================================================================

const CockpitPage: React.FC = () => {
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
      
      <Content id="cockpit-content" role="tabpanel">
        <CockpitDashboard />
      </Content>
    </Container>
  );
};

export default CockpitPage;

// Also export named for explicit imports
export { CockpitPage };
