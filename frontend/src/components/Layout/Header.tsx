import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import ProfileDropdown from '../ProfileDropdown';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Theme } from '../../config/theme';
import { ConnectivityStatus, useConnectivity } from '../../contexts/ConnectivityContext';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import QuickActionsEditor from '../QuickActions/QuickActionsEditor';
import { useOnboarding } from '../Onboarding';
import { Icon } from '../ui';
import TenantSelector from './TenantSelector';
import { authService } from '../../services/authService';
import { UserProfile } from '../../types';
import { NotificationBell } from '../Notifications';

interface HeaderProps {
  // No props needed currently
}

const Header: React.FC<HeaderProps> = () => {
  const { theme, themeName, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showOnboardingMenu, setShowOnboardingMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [_isEditMode, _setIsEditMode] = useState(false);
  const [showFormsSubmenu, setShowFormsSubmenu] = useState(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const onboardingMenuRef = useRef<HTMLDivElement>(null);
  const { getTourStatus, hasCompletedTour, launchTour } = useOnboarding();
  const { status: connectivityStatus } = useConnectivity();

  // Get current user info
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    void Promise.resolve(authService.getCurrentUser())
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const isSuperuser = user?.is_superuser || false;

  // Quick Actions context
  const {
    quickActions,
    availableForms,
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
    { label: 'Home', path: '/', icon: '🏠' },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(event.target as Node)) {
        setShowQuickMenu(false);
      }
      if (onboardingMenuRef.current && !onboardingMenuRef.current.contains(event.target as Node)) {
        setShowOnboardingMenu(false);
      }
    };

    if (showQuickMenu || showOnboardingMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOnboardingMenu, showQuickMenu]);

  const searchContextQuery = React.useMemo(() => '', []);

  useEffect(() => {
    setSearchQuery((current) => (current === searchContextQuery ? current : searchContextQuery));
  }, [searchContextQuery]);

  const handleQuickMenuClick = (path: string) => {
    navigate(path);
    setShowQuickMenu(false);
  };

  const handleQuickActionClick = (action: (typeof quickActions)[0]) => {
    if (action.type === 'form' && action.form_id) {
      openFormModal(action.form_id);
      setShowQuickMenu(false);
      return;
    }

    if (action.type === 'workflow' && action.workflow_id) {
      // Fail-closed + backward-compatible: if a saved quick action points at a legacy Form ID,
      // run it as a form instead of silently hitting the workform execute route.
      const match = availableForms.find((f) => f.id === action.workflow_id);
      if (match && (match.type ?? 'form') === 'form') {
        openFormModal(match.id);
        setShowQuickMenu(false);
        return;
      }

      navigate(`/workforms/execute/${action.workflow_id}`);
      setShowQuickMenu(false);
    }
  };

  const openCommandPalette = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('pm:open-command-palette'));
  }, []);

  const handleSearchFocus = React.useCallback(() => {
    openCommandPalette();
  }, [openCommandPalette]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    openCommandPalette();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowQuickMenu(false);
    openEditor();
  };

  const cockpitTourStatus = getTourStatus('cockpit');
  const workflowEditorTourStatus = getTourStatus('workflow-editor');
  const onHomeRoute = location.pathname === '/';
  const onWorkflowRoute =
    location.pathname.startsWith('/workflows') || location.pathname.startsWith('/workforms');

  const getTourActionLabel = (tourName: 'cockpit' | 'workflow-editor', fallback: string) => {
    if (hasCompletedTour(tourName)) {
      return `Replay ${fallback}`;
    }

    const tourStatus = tourName === 'cockpit' ? cockpitTourStatus : workflowEditorTourStatus;
    if (tourStatus.status === 'skipped' || tourStatus.status === 'in_progress') {
      return `Resume ${fallback}`;
    }

    return `Start ${fallback}`;
  };

  const handleCockpitTourClick = () => {
    setShowOnboardingMenu(false);

    if (!onHomeRoute) {
      navigate('/?tour=cockpit');
      return;
    }

    void launchTour('cockpit', hasCompletedTour('cockpit') ? 'restart' : 'resume');
  };

  const handleWorkflowTourClick = () => {
    setShowOnboardingMenu(false);
    void launchTour('workflow-editor', hasCompletedTour('workflow-editor') ? 'restart' : 'resume');
  };

  // Use custom quick actions if available, otherwise default items
  const hasCustomActions = quickActions.length > 0;

  return (
    <HeaderContainer $theme={theme}>
      <HeaderTitle $theme={theme}>{tenantName}</HeaderTitle>

      {/* Tenant Selector for Superusers */}
      <TenantSelector theme={theme} isSuperuser={isSuperuser} />

      {/* Global Search — opens command palette */}
      <SearchForm onSubmit={handleSearchSubmit}>
        <SearchInputWrapper $theme={theme}>
          <SearchIconWrapper $theme={theme}>
            <Icon name="search" size={16} />
          </SearchIconWrapper>
          <SearchInput
            ref={searchInputRef}
            type="text"
            placeholder="Search anything… (⌘K)"
            value={searchQuery}
            onFocus={handleSearchFocus}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            $theme={theme}
            aria-label="Global search"
          />
        </SearchInputWrapper>
      </SearchForm>

      <HeaderActions>
        {connectivityStatus !== 'online' && (
          <ConnectivityPill
            $status={connectivityStatus}
            $theme={theme}
            aria-live="polite"
            role="status"
          >
            <ConnectivityDot $status={connectivityStatus} $theme={theme} aria-hidden="true" />
            <span>{connectivityStatus === 'offline' ? 'Offline' : 'Reconnecting'}</span>
          </ConnectivityPill>
        )}

        <QuickMenuContainer ref={onboardingMenuRef}>
          <QuickMenuButton
            onClick={() => {
              setShowQuickMenu(false);
              setShowOnboardingMenu(!showOnboardingMenu);
            }}
            $theme={theme}
            title="Onboarding Help"
            aria-label="Onboarding Help"
          >
            ?
          </QuickMenuButton>
          {showOnboardingMenu && (
            <QuickMenuDropdown $theme={theme}>
              <QuickMenuHeader $theme={theme}>
                <span>Guided Tours</span>
              </QuickMenuHeader>
              <QuickMenuItem onClick={handleCockpitTourClick} $theme={theme}>
                <IconWrapper>🧭</IconWrapper>
                <span>{getTourActionLabel('cockpit', 'Workspace Tour')}</span>
              </QuickMenuItem>
              {onWorkflowRoute && (
                <QuickMenuItem onClick={handleWorkflowTourClick} $theme={theme}>
                  <IconWrapper>🛠️</IconWrapper>
                  <span>{getTourActionLabel('workflow-editor', 'Workforms Tour')}</span>
                </QuickMenuItem>
              )}
              <QuickMenuDivider />
              <QuickMenuItem
                $theme={theme}
                onClick={() => {
                  setShowOnboardingMenu(false);
                  navigate('/');
                }}
              >
                <IconWrapper>🏠</IconWrapper>
                <span>Open Home Dashboard</span>
              </QuickMenuItem>
            </QuickMenuDropdown>
          )}
        </QuickMenuContainer>

        {/* Quick Menu */}
        <QuickMenuContainer ref={quickMenuRef}>
          <QuickMenuButton
            onClick={() => {
              setShowOnboardingMenu(false);
              setShowQuickMenu(!showQuickMenu);
            }}
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
                <EditButton $theme={theme} onClick={handleEditClick} title="Edit Quick Actions">
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
                    <IconWrapper>
                      <Icon name={action.icon} size={18} />
                    </IconWrapper>
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
                    <IconWrapper>
                      <Icon name={item.icon} size={18} />
                    </IconWrapper>
                    <span>{item.label}</span>
                  </QuickMenuItem>
                ))
              )}

              {/* Forms Submenu - Always show regardless of custom actions */}
              <QuickMenuDivider />
              <QuickMenuItem
                $theme={theme}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFormsSubmenu(!showFormsSubmenu);
                }}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IconWrapper>📋</IconWrapper>
                  <span>Forms</span>
                </div>
                <span style={{ fontSize: '12px' }}>{showFormsSubmenu ? '▴' : '▾'}</span>
              </QuickMenuItem>

              {showFormsSubmenu && (
                <FormsSubmenu $theme={theme}>
                  <SubmenuItem
                    $theme={theme}
                    onClick={() => {
                      navigate('/workflows');
                      setShowQuickMenu(false);
                      setShowFormsSubmenu(false);
                    }}
                  >
                    <span>🗂️</span>
                    <span>View Legacy Workflows</span>
                  </SubmenuItem>

                  {availableForms.filter((f) => (f.type ?? 'form') === 'form').length > 0 && (
                    <>
                      <SubmenuDivider />
                      <SubmenuHeader>Published Forms</SubmenuHeader>
                      {availableForms
                        .filter((f) => (f.type ?? 'form') === 'form')
                        .slice(0, 5)
                        .map((form) => (
                          <SubmenuItem
                            key={form.id}
                            $theme={theme}
                            onClick={() => {
                              openFormModal(form.id);
                              setShowQuickMenu(false);
                              setShowFormsSubmenu(false);
                            }}
                            title={`Run ${form.name}`}
                          >
                            <span>▶️</span>
                            <span>{form.name}</span>
                          </SubmenuItem>
                        ))}
                      {availableForms.filter((f) => (f.type ?? 'form') === 'form').length > 5 && (
                        <SubmenuItem
                          $theme={theme}
                          style={{ fontSize: '11px', fontStyle: 'italic' }}
                          onClick={() => {
                            navigate('/workflows');
                            setShowQuickMenu(false);
                            setShowFormsSubmenu(false);
                          }}
                        >
                          <span>
                            +
                            {availableForms.filter((f) => (f.type ?? 'form') === 'form').length - 5}{' '}
                            more forms...
                          </span>
                        </SubmenuItem>
                      )}
                    </>
                  )}

                  {availableForms.filter((f) => (f.type ?? 'form') === 'workflow').length > 0 && (
                    <>
                      <SubmenuDivider />
                      <SubmenuHeader>Published WorkForms</SubmenuHeader>
                      {availableForms
                        .filter((f) => (f.type ?? 'form') === 'workflow')
                        .slice(0, 5)
                        .map((wf) => (
                          <SubmenuItem
                            key={wf.id}
                            $theme={theme}
                            onClick={() => {
                              navigate(`/workforms/execute/${wf.id}`);
                              setShowQuickMenu(false);
                              setShowFormsSubmenu(false);
                            }}
                            title={`Run ${wf.name}`}
                          >
                            <span>▶️</span>
                            <span>{wf.name}</span>
                          </SubmenuItem>
                        ))}
                      {availableForms.filter((f) => (f.type ?? 'form') === 'workflow').length >
                        5 && (
                        <SubmenuItem
                          $theme={theme}
                          style={{ fontSize: '11px', fontStyle: 'italic' }}
                          onClick={() => {
                            navigate('/workforms/catalog');
                            setShowQuickMenu(false);
                            setShowFormsSubmenu(false);
                          }}
                        >
                          <span>
                            +
                            {availableForms.filter((f) => (f.type ?? 'form') === 'workflow')
                              .length - 5}{' '}
                            more workforms...
                          </span>
                        </SubmenuItem>
                      )}
                    </>
                  )}

                  {availableForms.filter((f) => (f.type ?? 'form') === 'form').length === 0 &&
                    availableForms.filter((f) => (f.type ?? 'form') === 'workflow').length ===
                      0 && (
                      <SubmenuItem
                        $theme={theme}
                        style={{
                          fontSize: '12px',
                          fontStyle: 'italic',
                          cursor: 'default',
                          opacity: 0.6,
                        }}
                      >
                        <span>No published Forms or WorkForms yet</span>
                      </SubmenuItem>
                    )}
                </FormsSubmenu>
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

        {/* Notifications - Using NotificationBell component */}
        <NotificationBell />

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
  min-width: 0;
  max-width: 100%;

  /* Tablet: allow header content to wrap to avoid horizontal overflow */
  @media (max-width: 900px) {
    padding: 10px 12px;
    height: auto;
    min-height: 60px;
    flex-wrap: wrap;
    gap: 10px;
  }

  @media (max-width: 640px) {
    padding: 10px 12px;
    height: auto;
    min-height: 60px;
    flex-wrap: wrap;
    gap: 10px;
  }
`;

const HeaderTitle = styled.h1<{ $theme: Theme }>`
  font-size: 20px;
  font-weight: 600;
  color: ${(props) => props.$theme.colors.headerText};
  margin: 0;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 640px) {
    display: none;
  }
`;

const SearchForm = styled.form`
  flex: 1;
  max-width: 500px;
  min-width: 0;
  display: flex;
  align-items: center;
  min-width: 0;

  @media (max-width: 900px) {
    max-width: none;
  }

  @media (max-width: 640px) {
    order: 3;
    flex: 1 1 100%;
    max-width: none;
  }
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

  @media (max-width: 520px) {
    font-size: 16px; /* iOS Safari zoom-on-focus prevention */
  }

  &::placeholder {
    color: ${(props) => props.$theme.colors.textSecondary};
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 0 0 auto;

  @media (max-width: 640px) {
    gap: 10px;
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
`;

const ConnectivityPill = styled.div<{
  $status: Exclude<ConnectivityStatus, 'online'>;
  $theme: Theme;
}>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid
    ${(props) =>
      props.$status === 'offline' ? props.$theme.colors.error : props.$theme.colors.warning};
  background: ${(props) => props.$theme.colors.surface};
  color: ${(props) =>
    props.$status === 'offline' ? props.$theme.colors.error : props.$theme.colors.warning};
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
`;

const ConnectivityDot = styled.span<{
  $status: Exclude<ConnectivityStatus, 'online'>;
  $theme: Theme;
}>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(props) =>
    props.$status === 'offline' ? props.$theme.colors.error : props.$theme.colors.warning};
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

// Forms Submenu Styled Components
const QuickMenuDivider = styled.div`
  height: 1px;
  background: rgba(var(--color-border) / 0.3);
  margin: 4px 0;
`;

const FormsSubmenu = styled.div<{ $theme: Theme }>`
  margin-left: 16px;
  margin-right: 8px;
  margin-top: 4px;
  margin-bottom: 4px;
  padding-left: 16px;
  border-left: 2px solid ${(props) => props.$theme.colors.border};
`;

const SubmenuHeader = styled.div`
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SubmenuItem = styled.button<{ $theme: Theme }>`
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: ${(props) => props.$theme.colors.textSecondary};
  font-size: 13px;
  border-radius: 4px;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    background: ${(props) => props.$theme.colors.surfaceHover};
    color: ${(props) => props.$theme.colors.textPrimary};
  }

  span:first-child {
    font-size: 14px;
  }
`;

const SubmenuDivider = styled.div`
  height: 1px;
  background: rgba(var(--color-border) / 0.2);
  margin: 4px 8px;
`;

export default Header;
