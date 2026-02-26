/**
 * HorizontalNavigation Component
 * 
 * Shopify-inspired horizontal tab navigation
 * Groups navigation by context: Build, Manage, Analyze
 * Mobile-responsive with dropdown collapse
 * 
 * Gap Analysis Phase 1.4: Navigation Redesign
 * Date: 2026-02-26
 */
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../../contexts/ThemeContext';
import { useActionItems, getBadgeValue } from '../../contexts/ActionItemsContext';
import { useAuth } from '../../contexts/AuthContext';
import { NavigationItem } from '../../config/navigation';

interface HorizontalNavigationProps {
  items: NavigationItem[];
  className?: string;
}

interface NavGroup {
  label: string;
  icon?: React.ReactNode;
  items: NavigationItem[];
}

// Group navigation items by category
const groupNavigationItems = (items: NavigationItem[]): NavGroup[] => {
  const buildItems: NavigationItem[] = [];
  const manageItems: NavigationItem[] = [];
  const analyzeItems: NavigationItem[] = [];
  const otherItems: NavigationItem[] = [];

  items.forEach(item => {
    const label = item.label.toLowerCase();
    
    // Build category: Forms, Workflows, Workforms
    if (label.includes('form') || label.includes('workflow') || label.includes('builder')) {
      buildItems.push(item);
    }
    // Analyze category: Cockpit, Reports, Analytics
    else if (label.includes('cockpit') || label.includes('report') || label.includes('analytic') || label.includes('dashboard')) {
      analyzeItems.push(item);
    }
    // Manage category: Everything else operational
    else if (label.includes('inquiry') || label.includes('order') || label.includes('fulfillment') || label.includes('customer') || label.includes('supplier')) {
      manageItems.push(item);
    }
    else {
      otherItems.push(item);
    }
  });

  const groups: NavGroup[] = [];
  
  if (buildItems.length > 0) {
    groups.push({ label: 'Build', items: buildItems });
  }
  
  if (manageItems.length > 0) {
    groups.push({ label: 'Manage', items: manageItems });
  }
  
  if (analyzeItems.length > 0) {
    groups.push({ label: 'Analyze', items: analyzeItems });
  }
  
  if (otherItems.length > 0) {
    groups.push({ label: 'More', items: otherItems });
  }

  return groups;
};

const HorizontalNavigation: React.FC<HorizontalNavigationProps> = ({ items, className }) => {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { counts } = useActionItems();
  const { user, isAdmin } = useAuth();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter items by role
  const filterItemsByRole = (navItems: NavigationItem[]): NavigationItem[] => {
    return navItems.filter(item => {
      if (!item.roles || item.roles.length === 0) return true;
      if (item.roles.includes('admin') && isAdmin) return true;
      if (item.roles.includes('superuser') && user?.is_superuser) return true;
      if (user?.role && item.roles.includes(user.role)) return true;
      return false;
    });
  };

  const filteredItems = filterItemsByRole(items);
  const navGroups = groupNavigationItems(filteredItems);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveGroup(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveGroup(null);
  }, [location.pathname]);

  const handleGroupClick = (groupLabel: string) => {
    setActiveGroup(activeGroup === groupLabel ? null : groupLabel);
  };

  const handleNavItemClick = (item: NavigationItem) => {
    if (item.path) {
      navigate(item.path);
    }
    if (item.onClick) {
      item.onClick();
    }
  };

  const isItemActive = (item: NavigationItem): boolean => {
    if (item.path === location.pathname) return true;
    if (item.children) {
      return item.children.some(child => isItemActive(child));
    }
    return false;
  };

  const isGroupActive = (group: NavGroup): boolean => {
    return group.items.some(item => isItemActive(item));
  };

  const getBadgeCount = (item: NavigationItem): number => {
    if (item.badge) {
      return getBadgeValue(counts, item.badge);
    }
    return 0;
  };

  return (
    <NavContainer className={className} theme={theme}>
      {/* Mobile hamburger menu */}
      <MobileMenuButton
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isMobileMenuOpen}
      >
        <HamburgerIcon isOpen={isMobileMenuOpen} />
      </MobileMenuButton>

      {/* Navigation tabs */}
      <NavTabs $isMobileOpen={isMobileMenuOpen}>
        {navGroups.map(group => (
          <NavGroupContainer key={group.label} ref={activeGroup === group.label ? dropdownRef : null}>
            <NavTab
              $isActive={isGroupActive(group)}
              $hasDropdown={activeGroup === group.label}
              onClick={() => handleGroupClick(group.label)}
              role="button"
              aria-haspopup="true"
              aria-expanded={activeGroup === group.label}
            >
              <TabLabel>{group.label}</TabLabel>
              <ChevronIcon $isOpen={activeGroup === group.label} />
            </NavTab>

            {/* Dropdown menu */}
            {activeGroup === group.label && (
              <DropdownMenu theme={theme}>
                {group.items.map(item => {
                  const badgeCount = getBadgeCount(item);
                  return (
                    <DropdownItem
                      key={item.label}
                      $isActive={isItemActive(item)}
                      onClick={() => handleNavItemClick(item)}
                      theme={theme}
                    >
                      {item.icon && <ItemIcon>{item.icon}</ItemIcon>}
                      <ItemLabel>{item.label}</ItemLabel>
                      {badgeCount > 0 && <Badge theme={theme}>{badgeCount}</Badge>}
                    </DropdownItem>
                  );
                })}
              </DropdownMenu>
            )}
          </NavGroupContainer>
        ))}
      </NavTabs>
    </NavContainer>
  );
};

export default React.memo(HorizontalNavigation);

// Styled Components

const NavContainer = styled.nav<{ theme: any }>`
  display: flex;
  align-items: center;
  height: 48px;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  padding: 0 1rem;
  position: sticky;
  top: 0;
  z-index: 100;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
    min-height: 48px;
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: rgb(var(--color-text-primary));
  
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  &:hover {
    opacity: 0.7;
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const HamburgerIcon = styled.div<{ isOpen: boolean }>`
  width: 24px;
  height: 20px;
  position: relative;
  
  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 2px;
    background: currentColor;
    transition: transform 0.2s ease, opacity 0.2s ease;
    left: 0;
  }
  
  &::before {
    top: ${props => props.isOpen ? '9px' : '0'};
    transform: ${props => props.isOpen ? 'rotate(45deg)' : 'none'};
  }
  
  &::after {
    bottom: ${props => props.isOpen ? '9px' : '0'};
    transform: ${props => props.isOpen ? 'rotate(-45deg)' : 'none'};
  }
  
  ${props => !props.isOpen && `
    &::before {
      box-shadow: 0 9px 0 currentColor;
    }
  `}
`;

const NavTabs = styled.div<{ $isMobileOpen: boolean }>`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex: 1;
  
  @media (max-width: 768px) {
    display: ${props => props.$isMobileOpen ? 'flex' : 'none'};
    flex-direction: column;
    width: 100%;
    padding: 0.5rem 0;
    gap: 0;
  }
`;

const NavGroupContainer = styled.div`
  position: relative;
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const NavTab = styled.button<{ $isActive: boolean; $hasDropdown: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: ${props => props.$isActive 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-text-secondary))'};
  font-weight: ${props => props.$isActive ? '600' : '500'};
  font-size: 0.875rem;
  transition: all 0.15s ease;
  position: relative;
  white-space: nowrap;
  
  ${props => props.$isActive && `
    &::after {
      content: '';
      position: absolute;
      bottom: -13px;
      left: 0;
      right: 0;
      height: 2px;
      background: rgb(var(--color-primary));
    }
  `}
  
  ${props => props.$hasDropdown && `
    background: rgba(var(--color-primary), 0.1);
  `}
  
  &:hover {
    background: rgba(var(--color-primary), 0.08);
    color: rgb(var(--color-primary));
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
    border-radius: 0;
    
    &::after {
      display: none;
    }
  }
`;

const TabLabel = styled.span`
  /* Label styling */
`;

const ChevronIcon = styled.div<{ $isOpen: boolean }>`
  width: 12px;
  height: 12px;
  transition: transform 0.2s ease;
  transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  
  &::after {
    content: '';
    display: block;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid currentColor;
    margin-top: 3px;
  }
`;

const DropdownMenu = styled.div<{ theme: any }>`
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  margin-top: 0.5rem;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1000;
  animation: slideDown 0.15s ease;
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    position: relative;
    box-shadow: none;
    border: none;
    border-radius: 0;
    margin-top: 0;
    background: rgba(var(--color-surface), 0.5);
  }
`;

const DropdownItem = styled.button<{ $isActive: boolean; theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: ${props => props.$isActive 
    ? 'rgba(var(--color-primary), 0.1)' 
    : 'transparent'};
  border: none;
  text-align: left;
  cursor: pointer;
  color: ${props => props.$isActive 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-text-primary))'};
  font-size: 0.875rem;
  font-weight: ${props => props.$isActive ? '600' : '400'};
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(var(--color-primary), 0.08);
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: -2px;
  }
  
  @media (max-width: 768px) {
    padding-left: 2rem;
  }
`;

const ItemIcon = styled.span`
  display: flex;
  align-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  
  svg {
    width: 100%;
    height: 100%;
  }
`;

const ItemLabel = styled.span`
  flex: 1;
`;

const Badge = styled.span<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgb(var(--color-primary));
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 10px;
  flex-shrink: 0;
`;
