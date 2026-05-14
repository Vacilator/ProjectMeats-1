/**
 * NavigationMenu Component
 *
 * Handles nested navigation with expandable/collapsible accordion submenus
 * Supports multi-level hierarchies with proper indentation and smooth animations
 *
 * Updated: 2026-02-03 - Phase 2 Forms & Flows Enhancement
 * - Added badge rendering support for action item counts
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { logger } from '@/utils/logger';

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { NavigationItem } from '../../config/navigation';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../config/theme';
import { useActionItems, getBadgeValue } from '../../contexts/ActionItemsContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui';

interface NavigationMenuProps {
  items: NavigationItem[];
  isExpanded: boolean;
  level?: number;
}

// Chevron icon component for accordion expand/collapse
const ChevronIcon: React.FC<{ isExpanded: boolean }> = ({ isExpanded }) => (
  <span
    style={{
      display: 'inline-flex',
      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
      flexShrink: 0,
    }}
  >
    <Icon name="chevron-right" size={12} />
  </span>
);

const NavigationMenu: React.FC<NavigationMenuProps> = ({ items, isExpanded: sidebarExpanded, level = 0 }) => {
  const { theme, themeName } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { counts } = useActionItems();
  const { user, isAdmin } = useAuth();
  // Changed from Set to string | null for exclusive accordion (only one open at a time)
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const isDarkMode = themeName === 'dark';
  const lastPathnameRef = useRef(location.pathname);

  // Filter items based on user roles
  const filterItemsByRole = useCallback((navItems: NavigationItem[]): NavigationItem[] => {
    return navItems.filter(item => {
      // If no roles specified, show to everyone
      if (!item.roles || item.roles.length === 0) {
        return true;
      }

      // Check if user has any of the required roles
      if (item.roles.includes('admin') && isAdmin) {
        return true;
      }

      if (item.roles.includes('superuser') && user?.is_superuser) {
        return true;
      }

      // Check against user's role if available
      if (user?.role && item.roles.includes(user.role)) {
        return true;
      }

      return false;
    }).map(item => {
      // Recursively filter children
      if (item.children) {
        return {
          ...item,
          children: filterItemsByRole(item.children)
        };
      }
      return item;
    });
  }, [isAdmin, user]);

  const filteredItems = useMemo(() => filterItemsByRole(items), [filterItemsByRole, items]);
  const filteredItemsRef = useRef<NavigationItem[]>(filteredItems);

  useEffect(() => {
    filteredItemsRef.current = filteredItems;
  }, [filteredItems]);

  // Auto-expand parent items only when navigation occurs (preserve manual toggles)
  useEffect(() => {
    if (location.pathname === lastPathnameRef.current) {
      return;
    }

    const findActiveParent = (navItems: NavigationItem[]): string | null => {
      for (const item of navItems) {
        if (item.path === location.pathname && item.children) {
          return item.label;
        }
        if (item.children) {
          const found = findActiveParent(item.children);
          if (found) {
            return item.label; // Return top-level parent only
          }
        }
      }
      return null;
    };

    const activeParent = findActiveParent(filteredItemsRef.current);
    if (activeParent) {
      setExpandedItem(activeParent);
    }
    lastPathnameRef.current = location.pathname;
  // Run only on pathname change to avoid fighting user-driven expand/collapse
  }, [location.pathname]);

  const toggleExpand = (label: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Exclusive accordion: if clicking the same item, collapse it; otherwise expand the new one
    setExpandedItem((prev) => (prev === label ? null : label));
  };

  const isActive = (item: NavigationItem): boolean => {
    if (item.path && location.pathname === item.path) return true;
    if (item.children) {
      return item.children.some((child) => isActive(child));
    }
    return false;
  };

  const isExactActive = (item: NavigationItem): boolean => {
    return item.path === location.pathname;
  };

  const hasExactActiveChild = (item: NavigationItem): boolean => {
    if (!item.children) return false;
    return item.children.some((child) => {
      if (child.path === location.pathname) return true;
      if (child.children) return hasExactActiveChild(child);
      return false;
    });
  };

  // Render a simple navigation link (no children)
  const renderNavLink = (item: NavigationItem, exactActive: boolean, active: boolean) => {
    const badgeValueRaw = item.badge ?? getBadgeValue(counts, item.badgeKey);
    const badgeValue = typeof badgeValueRaw === 'string' ? Number(badgeValueRaw) : badgeValueRaw;
    return (
      <StyledNavLink
        to={item.path!}
        $theme={theme}
        $level={level}
        $active={exactActive}
        $hasActiveChild={active && !exactActive}
        $isDarkMode={isDarkMode}
      >
        <NavIcon $color={item.color}>{item.icon}</NavIcon>
        {sidebarExpanded && <NavLabel>{item.label}</NavLabel>}
        {sidebarExpanded && badgeValue !== undefined && badgeValue > 0 && (
          <Badge $isDarkMode={isDarkMode}>{badgeValue > 99 ? '99+' : badgeValue}</Badge>
        )}
      </StyledNavLink>
    );
  };

  // Render accordion header content (icon and label)
  // Render accordion content - icon, label, badge
  const renderAccordionContent = (item: NavigationItem) => {
    const badgeValueRaw = item.badge ?? getBadgeValue(counts, item.badgeKey);
    const badgeValue = typeof badgeValueRaw === 'string' ? Number(badgeValueRaw) : badgeValueRaw;
    return (
      <>
        <NavIcon $color={item.color}>{item.icon}</NavIcon>
        {sidebarExpanded && <NavLabel>{item.label}</NavLabel>}
        {sidebarExpanded && badgeValue !== undefined && badgeValue > 0 && (
          <Badge $isDarkMode={isDarkMode}>{badgeValue > 99 ? '99+' : badgeValue}</Badge>
        )}
      </>
    );
  };

  // Render accordion header with expand/collapse button
  const renderAccordionHeader = (item: NavigationItem, isItemExpanded: boolean, active: boolean, hasActiveChild: boolean) => {
    // If item has a path, use a container with separate NavLink and ExpandButton
    // FIX: Separate NavLink from ExpandButton so both can handle clicks independently
    if (item.path) {
      return (
        <AccordionHeaderContainer
          $level={level}
          $active={active}
          $isDarkMode={isDarkMode}
        >
          <AccordionNavLinkInner
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logger.debug('[NavigationMenu] Parent item clicked:', {
                path: item.path,
                label: item.label,
                active,
                hasActiveChild,
                timestamp: new Date().toISOString()
              });
              if (item.path) {
                logger.debug('[NavigationMenu] Navigating to:', item.path);
                navigate(item.path);
              } else {
                logger.warn('[NavigationMenu] No path defined for:', item.label);
              }
            }}
            $theme={theme}
            $level={level}
            $active={active}
            $isDarkMode={isDarkMode}
            $hasExactActiveChild={hasActiveChild}
          >
            {renderAccordionContent(item)}
          </AccordionNavLinkInner>
          {sidebarExpanded && (
            <ExpandButton
              onClick={(e) => {
                // Prevent navigation for chevron click, only toggle accordion
                logger.debug('[NavigationMenu] ExpandButton clicked:', {
                  label: item.label,
                  isExpanded: isItemExpanded,
                  timestamp: new Date().toISOString()
                });
                e.preventDefault();
                e.stopPropagation();
                toggleExpand(item.label, e);
              }}
              $isExpanded={isItemExpanded}
              $isDarkMode={isDarkMode}
              aria-label={isItemExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronIcon isExpanded={isItemExpanded} />
            </ExpandButton>
          )}
        </AccordionHeaderContainer>
      );
    }

    // If item has NO path, use button for accordion toggle
    return (
      <AccordionHeader
        onClick={(e) => {
          logger.debug('[NavigationMenu] AccordionHeader clicked (no path):', {
            label: item.label,
            isExpanded: isItemExpanded,
            timestamp: new Date().toISOString()
          });
          e.preventDefault();
          e.stopPropagation();
          toggleExpand(item.label, e);
        }}
        $theme={theme}
        $level={level}
        $active={active}
        $isExpanded={isItemExpanded}
        $isDarkMode={isDarkMode}
        $hasExactActiveChild={hasActiveChild}
      >
        {renderAccordionContent(item)}
        {sidebarExpanded && (
          <ExpandButton
            onClick={(e) => {
              // Just for consistency, though the whole header is clickable
              e.preventDefault();
              e.stopPropagation();
              toggleExpand(item.label, e);
            }}
            $isExpanded={isItemExpanded}
            $isDarkMode={isDarkMode}
            aria-label={isItemExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon isExpanded={isItemExpanded} />
          </ExpandButton>
        )}
      </AccordionHeader>
    );
  };

  // Render menu button (fallback for items without path or children)
  const renderMenuButton = (item: NavigationItem, active: boolean) => (
    <MenuButton
      onClick={() => toggleExpand(item.label)}
      $theme={theme}
      $level={level}
      $active={active}
      $isDarkMode={isDarkMode}
    >
      <NavIcon $color={item.color}>{item.icon}</NavIcon>
      {sidebarExpanded && <NavLabel>{item.label}</NavLabel>}
    </MenuButton>
  );

  return (
    <MenuContainer>
      {filteredItems.map((item) => {
        const hasChildren = item.children && item.children.length > 0;
        const isItemExpanded = expandedItem === item.label; // Changed from Set.has() to direct comparison
        const active = isActive(item);
        const exactActive = isExactActive(item);
        const hasActiveChild = hasExactActiveChild(item);

        // Determine which component to render
        let menuItemContent;
        if (item.path && !hasChildren) {
          menuItemContent = renderNavLink(item, exactActive, active);
        } else if (hasChildren) {
          menuItemContent = renderAccordionHeader(item, isItemExpanded, active, hasActiveChild);
        } else {
          menuItemContent = renderMenuButton(item, active);
        }

        return (
          <MenuItem key={item.label} $level={level}>
            {item.divider && <NavDivider />}
            {menuItemContent}
            {hasChildren && (
              <AccordionContent $isExpanded={isItemExpanded && sidebarExpanded} $isDarkMode={isDarkMode}>
                <NavigationMenu
                  items={item.children!}
                  isExpanded={sidebarExpanded}
                  level={level + 1}
                />
              </AccordionContent>
            )}
          </MenuItem>
        );
      })}
    </MenuContainer>
  );
};

const MenuContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const MenuItem = styled.div<{ $level: number }>`
  position: relative;
  /* Ensure each menu item is in proper stacking context */
  z-index: ${(props) => 100 - props.$level};
  /* Removed margin-bottom to ensure consistent spacing handled by baseItemStyles */
`;

const NavDivider = styled.hr`
  border: none;
  border-top: 1px solid rgba(var(--color-text-primary), 0.08);
  margin: 4px 12px;
`;

const baseItemStyles = css<{ $level: number; $active: boolean; $isDarkMode: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 12px;
  padding-left: ${(props) => 12 + props.$level * 16}px;
  color: ${(props) => props.$active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))'};
  text-decoration: none;
  transition: all 0.15s ease;
  font-size: ${(props) => props.$level === 0 ? 14 : 13}px;
  border-radius: 8px;
  margin: 0 8px 4px 8px;
  height: 60px;
  box-sizing: border-box;

  &:hover {
    background-color: rgba(var(--color-text-primary), 0.08);
    color: rgb(var(--color-text-primary));
  }
`;

const activeStyles = css<{ $isDarkMode: boolean }>`
  background-color: ${(props) => props.$isDarkMode
    ? 'rgba(var(--color-primary), 0.15)'
    : 'rgba(var(--color-primary), 0.1)'};
  color: rgb(var(--color-text-primary));

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 24px;
    background: rgb(var(--color-primary));
    border-radius: 0 3px 3px 0;
  }

  &:hover {
    background-color: ${(props) => props.$isDarkMode
      ? 'rgba(var(--color-primary), 0.2)'
      : 'rgba(var(--color-primary), 0.15)'};
  }
`;

const StyledNavLink = styled(NavLink)<{ $theme: Theme; $level: number; $active: boolean; $hasActiveChild?: boolean; $isDarkMode: boolean }>`
  ${baseItemStyles}
  position: relative;

  ${(props) => props.$active && activeStyles}

  ${(props) => props.$hasActiveChild && css<{ $isDarkMode: boolean }>`
    color: rgb(var(--color-text-primary));
  `}

  &.active {
    ${activeStyles}
  }
`;

const AccordionHeader = styled.div<{ $theme: Theme; $level: number; $active: boolean; $isExpanded: boolean; $isDarkMode: boolean; $hasExactActiveChild?: boolean }>`
  ${baseItemStyles}
  position: relative;
  cursor: pointer;

  ${(props) => props.$active && !props.$hasExactActiveChild && css<{ $isDarkMode: boolean }>`
    background-color: ${props.$isDarkMode
      ? 'rgba(var(--color-primary), 0.15)'
      : 'rgba(var(--color-primary), 0.1)'};
    color: rgb(var(--color-text-primary));

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 32px;
      background: rgb(var(--color-primary));
      border-radius: 0 3px 3px 0;
    }

    &:hover {
      background-color: ${props.$isDarkMode
        ? 'rgba(var(--color-primary), 0.2)'
        : 'rgba(var(--color-primary), 0.15)'};
    }
  `}

  ${(props) => props.$active && props.$hasExactActiveChild && css<{ $isDarkMode: boolean }>`
    color: rgb(var(--color-text-primary));
  `}
`;

// Container for accordion header with NavLink and ExpandButton as siblings
const AccordionHeaderContainer = styled.div<{
  $level: number;
  $active: boolean;
  $isDarkMode: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  margin: 0 8px 4px 8px;
  border-radius: 8px;
  position: relative;

  /* Active state styling on container */
  ${(props) => props.$active && css<{ $isDarkMode: boolean }>`
    background-color: ${props.$isDarkMode
      ? 'rgba(var(--color-primary), 0.15)'
      : 'rgba(var(--color-primary), 0.1)'};

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
      background: rgb(var(--color-primary));
      border-radius: 0 3px 3px 0;
    }
  `}

  &:hover {
    background-color: rgba(var(--color-text-primary), 0.08);
  }
`;

// Clickable div for accordion item with path (sits inside AccordionHeaderContainer)
// Changed from NavLink to div with onClick handler for better click handling
const AccordionNavLinkInner = styled.div<{
  $theme: Theme;
  $level: number;
  $active: boolean;
  $isDarkMode: boolean;
  $hasExactActiveChild: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 12px;
  padding-left: ${(props) => 12 + props.$level * 16}px;
  color: ${(props) => props.$active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))'};
  text-decoration: none;
  font-size: ${(props) => props.$level === 0 ? 14 : 13}px;
  height: 60px;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  pointer-events: auto;
  z-index: 1;
  position: relative;

  /* Ensure it doesn't inherit container background */
  background: transparent;

  ${(props) => props.$hasExactActiveChild && css<{ $isDarkMode: boolean }>`
    color: rgb(var(--color-text-primary));
  `}
`;

const MenuButton = styled.button<{ $theme: Theme; $level: number; $active: boolean; $isDarkMode: boolean }>`
  ${baseItemStyles}
  width: calc(100% - 16px);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;

  ${(props) => props.$active && activeStyles}
`;

const ExpandButton = styled.button<{ $isExpanded: boolean; $isDarkMode: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  transition: all 0.15s ease;
  margin-left: auto;
  flex-shrink: 0;
  z-index: 2;
  position: relative;
  pointer-events: auto;

  &:hover {
    background: rgba(var(--color-text-primary), 0.08);
    color: rgb(var(--color-text-primary));
  }
`;

const NavIcon = styled.span<{ $color?: string }>`
  font-size: 18px;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  flex-shrink: 0;
  opacity: 0.9;
`;

const NavLabel = styled.span`
  flex: 1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
`;

const AccordionContent = styled.div<{ $isExpanded: boolean; $isDarkMode: boolean }>`
  overflow: hidden;
  /*
   * max-height is set to a large value to enable CSS transitions.
   * CSS cannot animate to 'auto' height, so we use a value large enough
   * to accommodate deeply nested navigation (supports ~25 items at 40px each).
   *
   * CRITICAL: Set display:none when collapsed to prevent invisible overlay blocking clicks
   */
  display: ${(props) => (props.$isExpanded ? 'block' : 'none')};
  max-height: ${(props) => (props.$isExpanded ? '2000px' : '0')};
  opacity: ${(props) => (props.$isExpanded ? 1 : 0)};
  transition: max-height 0.25s ease-out, opacity 0.2s ease;
  background: ${(props) => props.$isDarkMode
    ? 'rgba(var(--color-overlay), 0.15)'
    : 'rgba(var(--color-overlay), 0.02)'};
  margin: ${(props) => props.$isExpanded ? '2px 0' : '0'};
  border-radius: 4px;
  margin-left: 8px;
  margin-right: 8px;
  /* Ensure it doesn't block parent items */
  pointer-events: ${(props) => (props.$isExpanded ? 'auto' : 'none')};
  position: relative;
  z-index: auto;
`;

const Badge = styled.span<{ $isDarkMode: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  border-radius: 9px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  margin-left: auto;
  flex-shrink: 0;
  box-shadow: ${(props) => props.$isDarkMode
    ? '0 1px 3px rgba(var(--color-overlay), 0.3)'
    : '0 1px 3px rgba(var(--color-overlay), 0.15)'};
`;

export default NavigationMenu;
