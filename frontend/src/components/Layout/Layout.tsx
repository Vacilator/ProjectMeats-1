import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import Sidebar from './Sidebar';
import Header from './Header';
import { PinnedToolsBar } from '../Cockpit/PinnedToolsBar';
import Breadcrumb from '../Navigation/Breadcrumb';
import Omnibox from '../AIAssistant/Omnibox';
import { CommandPalette } from '../Navigation/CommandPalette';
import { AIAgentWidget } from '../AIAssistant/AIAgentWidget';
import { useNavigation } from '../../contexts/NavigationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../config/theme';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';

const Layout: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useNavigation();
  const { theme } = useTheme();
  const [showOmnibox, setShowOmnibox] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarHoverChange = (isHovered: boolean) => {
    setSidebarHovered(isHovered);
  };

  useGlobalShortcuts({
    onOpenCommandPalette: () => setShowCommandPalette(true),
    onOpenOmnibox: () => setShowOmnibox(true),
    onToggleAIAgentWidget: () => window.dispatchEvent(new CustomEvent('pm:ai-toggle')),
  });

  const handleOmniboxSubmit = (_command: string) => {
    // Omnibox now dispatches pm:ai-send directly so the global widget can send
    // a context-aware message (path + active entity).
  };

  return (
    <LayoutContainer $theme={theme}>
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} onHoverChange={handleSidebarHoverChange} />
      <MainArea $sidebarOpen={sidebarOpen} $sidebarHovered={sidebarHovered}>
        <Header />
        <PinnedToolsBar />
        <Content $theme={theme}>
          <CenteredContainer>
            <Breadcrumb />
            <Outlet />
          </CenteredContainer>
        </Content>
      </MainArea>
      <Omnibox
        isOpen={showOmnibox}
        onClose={() => setShowOmnibox(false)}
        onSubmit={handleOmniboxSubmit}
      />
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
      <AIAgentWidget />
    </LayoutContainer>
  );
};

const LayoutContainer = styled.div<{ $theme: Theme }>`
  display: flex;
  min-height: 100vh;
  background-color: ${(props) => props.$theme.colors.background};
`;

const MainArea = styled.div<{ $sidebarOpen: boolean; $sidebarHovered: boolean }>`
  flex: 1;
  margin-left: ${(props) => (props.$sidebarOpen || props.$sidebarHovered ? '260px' : '64px')};
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  will-change: margin-left;
`;

const Content = styled.main<{ $theme: Theme }>`
  flex: 1;
  padding: 1rem;
  background-color: ${(props) => props.$theme.colors.background};
  overflow-y: auto;
  display: flex;
  justify-content: center;

  @media (min-width: 768px) {
    padding: 2rem;
  }
`;

const CenteredContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;

  @media (max-width: 768px) {
    padding: 0;
  }
`;

export default Layout;
