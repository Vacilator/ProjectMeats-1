/**
 * Cockpit Page - Dual-Mode Interface
 * 
 * Main Cockpit command center with two modes:
 * - Dashboard: Widget grid with customizable layout
 * - Wizard: Guided action interface ("What would you like to do today?")
 * 
 * Implements Phase 1.2 of the Cockpit & WorkForms Enhancement Plan.
 * 
 * Features:
 * - Mode toggle (Dashboard/Wizard)
 * - Mode persistence in localStorage
 * - Responsive header with icon and title
 * - Smooth mode transitions
 * 
 * Created: 2026-02-04 - Phase 1.2 Cockpit Enhancement
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { LayoutGrid, Sparkles, Target } from 'lucide-react';
import CockpitDashboard from './CockpitDashboard';
import SmartWizard from './SmartWizard';

// ============================================================================
// Types
// ============================================================================

type CockpitMode = 'dashboard' | 'wizard';

// ============================================================================
// Constants
// ============================================================================

const MODE_STORAGE_KEY = 'cockpit_mode';

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

const ModeToggle = styled.div`
  display: flex;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
  padding: 4px;
  gap: 4px;
`;

const ModeButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.$active ? `
    background: rgb(var(--color-primary));
    color: white;
    box-shadow: 0 2px 8px rgb(var(--color-primary) / 0.3);
  ` : `
    background: transparent;
    color: rgb(var(--color-text-secondary));
    
    &:hover {
      background: rgb(var(--color-surface-hover, var(--color-border)));
      color: rgb(var(--color-text-primary));
    }
  `}
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
  
  @media (max-width: 480px) {
    padding: 8px 10px;
    
    span {
      display: none;
    }
  }
`;

const Content = styled.main`
  /* Content area for Dashboard or Wizard */
`;

// ============================================================================
// Component
// ============================================================================

const CockpitPage: React.FC = () => {
  const [mode, setMode] = useState<CockpitMode>('wizard');
  
  // Load saved mode from localStorage
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
      if (savedMode === 'dashboard' || savedMode === 'wizard') {
        setMode(savedMode);
      }
    } catch {
      // Ignore errors
    }
  }, []);
  
  // Save mode to localStorage on change
  const handleModeChange = (newMode: CockpitMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch {
      // Ignore errors
    }
  };
  
  return (
    <Container>
      <Header>
        <HeaderLeft>
          <HeaderIcon>
            <Target size={20} />
          </HeaderIcon>
          <HeaderTitleGroup>
            <HeaderTitle>Cockpit</HeaderTitle>
            <HeaderSubtitle>
              {mode === 'wizard' 
                ? 'Your intelligent command center'
                : 'Your personalized dashboard'
              }
            </HeaderSubtitle>
          </HeaderTitleGroup>
        </HeaderLeft>
        
        <ModeToggle role="tablist" aria-label="Cockpit view mode">
          <ModeButton
            $active={mode === 'wizard'}
            onClick={() => handleModeChange('wizard')}
            role="tab"
            aria-selected={mode === 'wizard'}
            aria-controls="cockpit-content"
          >
            <Sparkles size={16} />
            <span>Smart Wizard</span>
          </ModeButton>
          <ModeButton
            $active={mode === 'dashboard'}
            onClick={() => handleModeChange('dashboard')}
            role="tab"
            aria-selected={mode === 'dashboard'}
            aria-controls="cockpit-content"
          >
            <LayoutGrid size={16} />
            <span>Dashboard</span>
          </ModeButton>
        </ModeToggle>
      </Header>
      
      <Content id="cockpit-content" role="tabpanel">
        {mode === 'wizard' ? <SmartWizard /> : <CockpitDashboard />}
      </Content>
    </Container>
  );
};

export default CockpitPage;

// Also export named for explicit imports
export { CockpitPage };
