import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import ProfileDropdown from '../ProfileDropdown';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Theme } from '../../config/theme';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import QuickActionsEditor from '../QuickActions/QuickActionsEditor';
import { Icon } from '../ui';
import TenantSelector from './TenantSelector';
import { authService } from '../../services/authService';

interface HeaderProps {
  // No props needed currently
}

// Search icon SVG component
const SearchIcon: React.FC = () => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const Header: React.FC<HeaderProps> = () => {
  const { theme, themeName, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  
  // Get current user info
  const user = authService.getCurrentUser();
  const isSuperuser = user?.is_superuser || false;
  
  // Quick Actions context
  const {
    quickActions,
    isLoading: quickActionsLoading,
    openFormModal,
    isEditorOpen,
    openEditor,
    closeEditor,
  } = useQuickActions();
  
  // Get tenant name from localStorage
  const tenantName = localStorage.getItem('tenantName') || 'Meats Central';

  // Default quick menu items (fallback when no custom actions)
  const defaultMenuItems = [
    { label: 'New Supplier', path: '/suppliers/new', icon: '🏭' },
    { label: 'New Customer', path: '/customers/new', icon: '👥' },
    { label: 'New Purchase Order', path: '/purchase-orders/new', icon: '📋' },
    { label: 'View Dashboard', path: '/', icon: '📊' },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(event.target as Node)) {
        setShowQuickMenu(false);
      }
    };
    
    if (showQuickMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQuickMenu]);

  const handleQuickMenuClick = (path: string) => {
    navigate(path);
    setShowQuickMenu(false);
  };
  
  const handleQuickActionClick = (action: typeof quickActions[0]) => {
    if (action.type === 'form' && action.form_id) {
      openFormModal(action.form_id);
      setShowQuickMenu(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('Search query:', searchQuery);
    }
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowQuickMenu(false);
    openEditor();
  };

  // Use custom quick actions if available, otherwise default items
  const hasCustomActions = quickActions.length > 0;

  return (
    <HeaderContainer $theme={theme}>
      <HeaderTitle $theme={theme}>{tenantName}</HeaderTitle>
      
      {/* Tenant Selector for Superusers */}
      <TenantSelector theme={theme} isSuperuser={isSuperuser} />
      
      {/* Global Search */}
      <SearchForm onSubmit={handleSearchSubmit}>
        <SearchInputWrapper $theme={theme}>
          <SearchIconWrapper $theme={theme}>
            <SearchIcon />
          </SearchIconWrapper>
          <SearchInput
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            $theme={theme}
            aria-label="Global search"
          />
        </SearchInputWrapper>
      </SearchForm>
      
      <HeaderActions>
        {/* Quick Menu */}
        <QuickMenuContainer ref={quickMenuRef}>
          <QuickMenuButton
            onClick={() => setShowQuickMenu(!showQuickMenu)}
            $theme={theme}
            title="Quick Actions"
            aria-label="Quick Actions Menu"
          >
            ⚡
          </QuickMenuButton>
          {showQuickMenu && (
            <QuickMenuDropdown $theme={theme}>
              {/* Header with Edit Button */}
              <QuickMenuHeader $theme={theme}>
                <span>Quick Actions</span>
                <EditButton 
                  $theme={theme} 
                  onClick={handleEditClick}
                  title="Edit Quick Actions"
                >
                  ✏️
                </EditButton>
              </QuickMenuHeader>
              
              {quickActionsLoading ? (
                <QuickMenuItem $theme={theme} style={{ justifyContent: 'center' }}>
                  <span>Loading...</span>
                </QuickMenuItem>
              ) : hasCustomActions ? (
                /* Custom Quick Actions from API */
                quickActions.map((action) => (
                  <QuickMenuItem
                    key={action.id}
                    onClick={() => handleQuickActionClick(action)}
                    $theme={theme}
                  >
                    <IconWrapper><Icon name={action.icon} size={18} /></IconWrapper>
                    <span>{action.label}</span>
                  </QuickMenuItem>
                ))
              ) : (
                /* Default Menu Items */
                defaultMenuItems.map((item) => (
                  <QuickMenuItem
                    key={item.path}
                    onClick={() => handleQuickMenuClick(item.path)}
                    $theme={theme}
                  >
                    <IconWrapper><Icon name={item.icon} size={18} /></IconWrapper>
                    <span>{item.label}</span>
                  </QuickMenuItem>
                ))
              )}
              
              {/* Customize Link */}
              {!hasCustomActions && (
                <QuickMenuFooter $theme={theme} onClick={handleEditClick}>
                  <span>⚙️</span>
                  <span>Customize Quick Actions</span>
                </QuickMenuFooter>
              )}
            </QuickMenuDropdown>
          )}
        </QuickMenuContainer>
        
        {/* Quick Actions Editor Modal */}
        <QuickActionsEditor isOpen={isEditorOpen} onClose={closeEditor} />

        {/* Theme Toggle */}
        <ThemeToggleButton
          onClick={toggleTheme}
          $theme={theme}
          title={`Switch to ${themeName === 'light' ? 'dark' : 'light'} mode`}
          aria-label={`Switch to ${themeName === 'light' ? 'dark' : 'light'} mode`}
        >
          {themeName === 'light' ? '🌙' : '☀️'}
        </ThemeToggleButton>

        {/* Notifications */}
        <NotificationButton $theme={theme} title="Notifications" aria-label="Notifications">
          🔔
        </NotificationButton>

        {/* Profile */}
        <ProfileDropdown />
      </HeaderActions>
    </HeaderContainer>
  );
};

const HeaderContainer = styled.header<{ $theme: Theme }>`
  height: 60px;
  background: ${(props) => props.$theme.colors.headerBackground};
  border-bottom: 1px solid ${(props) => props.$theme.colors.headerBorder};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  box-shadow: 0 2px 4px ${(props) => props.$theme.colors.shadow};
  transition: all 0.3s ease;
  gap: 20px;
`;

const HeaderTitle = styled.h1<{ $theme: Theme }>`
  font-size: 20px;
  font-weight: 600;
  color: ${(props) => props.$theme.colors.headerText};
  margin: 0;
  white-space: nowrap;
`;

const SearchForm = styled.form`
  flex: 1;
  max-width: 500px;
  display: flex;
  align-items: center;
`;

const SearchInputWrapper = styled.div<{ $theme: Theme }>`
  display: flex;
  align-items: center;
  width: 100%;
  background: ${(props) => props.$theme.colors.surface};
  border-radius: 8px;
  padding: 8px 12px;
  gap: 8px;
  border: 1px solid ${(props) => props.$theme.colors.border};
  transition: all 0.2s ease;

  &:focus-within {
    border-color: ${(props) => props.$theme.colors.primary};
    box-shadow: 0 0 0 3px ${(props) => props.$theme.colors.primary}20;
  }
`;

const SearchIconWrapper = styled.div<{ $theme: Theme }>`
  color: ${(props) => props.$theme.colors.textSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SearchInput = styled.input<{ $theme: Theme }>`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: ${(props) => props.$theme.colors.textPrimary};
  
  &::placeholder {
    color: ${(props) => props.$theme.colors.textSecondary};
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const QuickMenuContainer = styled.div`
  position: relative;
`;

const QuickMenuButton = styled.button<{ $theme: Theme }>`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
  color: ${(props) => props.$theme.colors.textPrimary};

  &:hover {
    background-color: ${(props) => props.$theme.colors.surfaceHover};
  }
`;

const QuickMenuDropdown = styled.div<{ $theme: Theme }>`
  position: absolute;
  top: 45px;
  right: 0;
  min-width: 220px;
  background: ${(props) => props.$theme.colors.surface};
  border: 1px solid ${(props) => props.$theme.colors.border};
  border-radius: 8px;
  box-shadow: 0 4px 12px ${(props) => props.$theme.colors.shadowMedium};
  z-index: 1000;
  overflow: hidden;
`;

const QuickMenuItem = styled.button<{ $theme: Theme }>`
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  color: ${(props) => props.$theme.colors.textPrimary};
  font-size: 14px;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${(props) => props.$theme.colors.surfaceHover};
  }

  span:first-child {
    font-size: 18px;
  }
`;

const QuickMenuHeader = styled.div<{ $theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid ${(props) => props.$theme.colors.border};
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => props.$theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const EditButton = styled.button<{ $theme: Theme }>`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  
  &:hover {
    background: ${(props) => props.$theme.colors.surfaceHover};
  }
`;

const QuickMenuFooter = styled.button<{ $theme: Theme }>`
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-top: 1px solid ${(props) => props.$theme.colors.border};
  background: none;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  color: ${(props) => props.$theme.colors.textSecondary};
  font-size: 13px;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${(props) => props.$theme.colors.surfaceHover};
    color: ${(props) => props.$theme.colors.textPrimary};
  }

  span:first-child {
    font-size: 16px;
  }
`;

const IconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
`;

const ThemeToggleButton = styled.button<{ $theme: Theme }>`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
  color: ${(props) => props.$theme.colors.textPrimary};

  &:hover {
    background-color: ${(props) => props.$theme.colors.surfaceHover};
    transform: scale(1.1);
  }
`;

const NotificationButton = styled.button<{ $theme: Theme }>`
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
  color: ${(props) => props.$theme.colors.textPrimary};

  &:hover {
    background-color: ${(props) => props.$theme.colors.surfaceHover};
  }
`;

export default Header;
