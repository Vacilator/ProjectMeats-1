import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../config/theme';
import { navigation, adminWorkspaceNavigation } from '../../config/navigation';
import { useAdminPermissions, isAdminOrOwner } from '../../hooks/useAdminPermissions';
import NavigationMenu from '../Navigation/NavigationMenu';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onHoverChange?: (isHovered: boolean) => void;
}


// Lock icons (replacing pin icon)
const LockOpenIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const LockIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onHoverChange }) => {
  const { theme, themeName, tenantBranding } = useTheme();
  const location = useLocation();
  const { permissions, isLoading: isPermissionsLoading } = useAdminPermissions();
  const showAdminWorkspace = !isPermissionsLoading && isAdminOrOwner(permissions);
  const [isHovered, setIsHovered] = useState(false);
  const [keepOpen, setKeepOpen] = useState(() => {
    // Load keep open preference from localStorage
    return localStorage.getItem('sidebarKeepOpen') === 'true';
  });

  // Check if we're on desktop (for pin functionality)
  // Using function to safely access window for SSR compatibility
  const getIsDesktop = () => typeof window !== 'undefined' && window.innerWidth >= 768;
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(getIsDesktop());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync keepOpen with parent isOpen state when keepOpen changes
  useEffect(() => {
    if (keepOpen && !isOpen) {
      onToggle();
    } else if (!keepOpen && isOpen) {
      onToggle();
    }
  }, [keepOpen, isOpen, onToggle]);

  // Reset hover state when sidebar is pinned (separate effect to avoid dependency issues)
  useEffect(() => {
    if (keepOpen) {
      setIsHovered(false);
    }
  }, [keepOpen]);

  // Auto-close on route change unless keepOpen is enabled
  useEffect(() => {
    if (!keepOpen && isOpen) {
      onToggle();
    }
  }, [location.pathname, keepOpen, isOpen, onToggle]);

  // Notify parent of hover state changes
  useEffect(() => {
    if (onHoverChange) {
      onHoverChange(isHovered);
    }
  }, [isHovered, onHoverChange]);

  const handleKeepOpenToggle = () => {
    const newKeepOpen = !keepOpen;
    setKeepOpen(newKeepOpen);
    localStorage.setItem('sidebarKeepOpen', String(newKeepOpen));
  };

  // Sidebar is expanded if: keepOpen is true, OR it's being hovered (when not kept open)
  const isExpanded = keepOpen || isHovered;
  const isDarkMode = themeName === 'dark';

  return (
    <SidebarContainer
      $isOpen={isExpanded}
      $theme={theme}
      onMouseEnter={() => !keepOpen && setIsHovered(true)}
      onMouseLeave={() => !keepOpen && setIsHovered(false)}
    >
      <SidebarHeader $theme={theme} $isExpanded={isExpanded}>
        <Logo>
          {tenantBranding?.logoUrl ? (
            <LogoImage src={tenantBranding.logoUrl} alt={tenantBranding.tenantName} />
          ) : (
            <LogoIconWrapper $isDarkMode={isDarkMode}>
              <span>🥩</span>
            </LogoIconWrapper>
          )}
          {isExpanded && <LogoText $isDarkMode={isDarkMode}>{tenantBranding?.tenantName || 'Meats Central'}</LogoText>}
        </Logo>
        {isExpanded && isDesktop && (
          <PinButton
            onClick={handleKeepOpenToggle}
            $theme={theme}
            $active={keepOpen}
            title={keepOpen ? "Unpin sidebar" : "Pin sidebar open"}
            aria-label={keepOpen ? "Unpin sidebar" : "Pin sidebar open"}
          >
            {keepOpen ? <LockIcon /> : <LockOpenIcon />}
          </PinButton>
        )}
      </SidebarHeader>

      <NavigationSection aria-label="Main navigation">
        <NavigationMenu items={navigation} isExpanded={isExpanded} />
      </NavigationSection>

      {/* Admin Workspace Section - Bottom Navigation */}
      {showAdminWorkspace ? (
        <AdminWorkspaceSection aria-label="Workspace navigation">
          <NavigationMenu items={adminWorkspaceNavigation} isExpanded={isExpanded} />
        </AdminWorkspaceSection>
      ) : null}

      <SidebarFooter $isExpanded={isExpanded}>
        {isExpanded && (
          <FooterText>
            © 2026 Meats Central
          </FooterText>
        )}
      </SidebarFooter>
    </SidebarContainer>
  );
};

const SidebarContainer = styled.div<{ $isOpen: boolean; $theme: Theme }>`
  width: ${(props) => (props.$isOpen ? '260px' : '64px')};
  height: 100vh;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  box-shadow: 2px 0 12px rgba(var(--color-overlay), 0.08);
  will-change: width;
  overflow: hidden;

  @media (max-width: 768px) {
    width: ${(props) => (props.$isOpen ? '100%' : '0')};
    transform: translateX(${(props) => (props.$isOpen ? '0' : '-100%')});
    transition: width 0.3s, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const SidebarHeader = styled.div<{ $theme: Theme; $isExpanded: boolean }>`
  padding: 16px;
  border-bottom: 1px solid rgba(var(--color-text-primary), 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 60px;
  height: 60px;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0; /* allow text to shrink so lock button stays visible */
`;

const LogoIconWrapper = styled.div<{ $isDarkMode: boolean }>`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.$isDarkMode
    ? 'linear-gradient(135deg, rgba(var(--color-primary), 0.8), rgba(var(--color-primary), 1))'
    : 'linear-gradient(135deg, rgb(var(--color-primary)), rgba(var(--color-primary), 0.8))'};
  border-radius: 8px;
  font-size: 18px;
`;

const LogoImage = styled.img`
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 8px;
`;

const LogoText = styled.h2<{ $isDarkMode: boolean }>`
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  color: rgb(var(--color-text-primary));
  letter-spacing: 0.01em;
`;

const PinButton = styled.button<{ $theme: Theme; $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  background: ${(props) => props.$active
    ? 'rgba(var(--color-primary), 0.2)'
    : 'transparent'};
  border: none;
  border-radius: 6px;
  color: ${(props) => props.$active
    ? 'rgb(var(--color-primary))'
    : 'rgb(var(--color-text-secondary))'};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${(props) => props.$active
      ? 'rgba(var(--color-primary), 0.3)'
      : 'rgba(var(--color-text-primary), 0.06)'};
    color: ${(props) => props.$active
      ? 'rgb(var(--color-primary))'
      : 'rgb(var(--color-text-primary))'};
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const NavigationSection = styled.nav`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(var(--color-text-primary), 0.15);
    border-radius: 3px;

    &:hover {
      background: rgba(var(--color-text-primary), 0.25);
    }
  }
`;

const AdminWorkspaceSection = styled.nav`
  border-top: 1px solid rgba(var(--color-text-primary), 0.08);
  padding: 8px 0;
  margin-top: auto;

  /* Subtle background to differentiate admin section */
  background: rgba(var(--color-overlay), 0.04);
`;

const SidebarFooter = styled.div<{ $isExpanded: boolean }>`
  padding: 12px 16px;
  border-top: 1px solid rgba(var(--color-text-primary), 0.08);
  min-height: ${(props) => props.$isExpanded ? '48px' : '0'};
  display: ${(props) => props.$isExpanded ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
`;

const FooterText = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  letter-spacing: 0.02em;
`;

export default Sidebar;
