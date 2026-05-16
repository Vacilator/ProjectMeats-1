import React, { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumb from '../Navigation/Breadcrumb';
import Omnibox from '../AIAssistant/Omnibox';
import { CommandPalette } from '../Navigation/CommandPalette';
import { ShortcutCheatsheet } from '../Navigation/ShortcutCheatsheet';
import { AIAgentWidget } from '../AIAssistant/AIAgentWidget';
import { ConnectivityBanner } from '../common/ConnectivityBanner';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useNavigation } from '../../contexts/NavigationContext';
import { ConnectivityProvider } from '../../contexts/ConnectivityContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../config/theme';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';

const Layout: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useNavigation();
  const { theme } = useTheme();
  const [showOmnibox, setShowOmnibox] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const handleOmniboxClose = useCallback(() => setShowOmnibox(false), []);
  const handleCommandPaletteClose = useCallback(() => setShowCommandPalette(false), []);
  const handleCheatsheetClose = useCallback(() => setShowCheatsheet(false), []);

  // Listen for pm:open-command-palette CustomEvent (dispatched from Home page, etc.)
  useEffect(() => {
    const handler = () => setShowCommandPalette(true);
    window.addEventListener('pm:open-command-palette', handler);
    return () => window.removeEventListener('pm:open-command-palette', handler);
  }, []);

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
    onShowCheatsheet: () => setShowCheatsheet(true),
  });

  const handleOmniboxSubmit = (_command: string) => {
    // Omnibox now dispatches pm:ai-send directly so the global widget can send
    // a context-aware message (path + active entity).
  };

  return (
    <ConnectivityProvider>
      <LayoutContainer $theme={theme}>
        <SkipNavLink href="#main-content">Skip to main content</SkipNavLink>
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          onHoverChange={handleSidebarHoverChange}
        />
        <MainArea $sidebarOpen={sidebarOpen} $sidebarHovered={sidebarHovered}>
          <Header />
          <ConnectivityBanner />
          <Content $theme={theme} id="main-content">
            <CenteredContainer>
              <Breadcrumb />
              <Outlet />
            </CenteredContainer>
          </Content>
        </MainArea>
        <Omnibox
          isOpen={showOmnibox}
          onClose={handleOmniboxClose}
          onSubmit={handleOmniboxSubmit}
        />
        <CommandPalette isOpen={showCommandPalette} onClose={handleCommandPaletteClose} />
        <ShortcutCheatsheet open={showCheatsheet} onClose={handleCheatsheetClose} />
        <ErrorBoundary fallback={<div />}>
          <AIAgentWidget />
        </ErrorBoundary>
      </LayoutContainer>
    </ConnectivityProvider>
  );
};

const LayoutContainer = styled.div<{ $theme: Theme }>`
  display: flex;
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  background-color: ${(props) => props.$theme.colors.background};
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
`;

const SkipNavLink = styled.a`
  position: absolute;
  top: -100%;
  left: 0;
  z-index: 10000;
  padding: 0.75rem 1.5rem;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse, 255 255 255));
  font-weight: 600;
  text-decoration: none;
  border-radius: 0 0 4px 0;

  &:focus {
    top: 0;
    outline: 2px solid rgb(var(--color-text-inverse, 255 255 255));
    outline-offset: 2px;
  }
`;

const MainArea = styled.div<{ $sidebarOpen: boolean; $sidebarHovered: boolean }>`
  flex: 1;
  margin-left: ${(props) => (props.$sidebarOpen || props.$sidebarHovered ? '260px' : '64px')};
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  will-change: margin-left;
  width: 100%;
  max-width: 100%;
  min-width: 0;

  /* On mobile, the sidebar overlays instead of shifting the app shell, preventing horizontal overflow. */
  @media (max-width: 768px) {
    margin-left: 0;
  }
`;

const Content = styled.main<{ $theme: Theme }>`
  flex: 1;
  padding: 1rem;
  background-color: ${(props) => props.$theme.colors.background};
  overflow-y: auto;
  display: flex;
  justify-content: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;

  @media (min-width: 768px) {
    padding: 2rem;
  }
`;

const CenteredContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  min-width: 0;

  @media (max-width: 768px) {
    padding: 0;
  }
`;

export default Layout;
