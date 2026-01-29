import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Theme } from '../../config/theme';
import { tenantService } from '../../services/tenantService';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface TenantSelectorProps {
  theme: Theme;
  isSuperuser: boolean;
}

const SelectorContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  margin-right: 16px;
`;

const CurrentTenantButton = styled.button<{ $theme: Theme }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid ${props => props.$theme.colors.border};
  border-radius: 6px;
  background: ${props => props.$theme.colors.surface};
  color: ${props => props.$theme.colors.text};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 200px;
  
  &:hover {
    border-color: ${props => props.$theme.colors.primary};
    background: ${props => props.$theme.colors.backgroundAlt};
  }
  
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const TenantIcon = styled.span`
  font-size: 14px;
`;

const ChevronIcon = styled.span<{ $isOpen: boolean }>`
  font-size: 10px;
  transition: transform 0.2s ease;
  transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0)'};
`;

const Dropdown = styled.div<{ $theme: Theme }>`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  background: ${props => props.$theme.colors.surface};
  border: 1px solid ${props => props.$theme.colors.border};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
`;

const DropdownHeader = styled.div<{ $theme: Theme }>`
  padding: 10px 12px;
  border-bottom: 1px solid ${props => props.$theme.colors.border};
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: ${props => props.$theme.colors.textSecondary};
  letter-spacing: 0.5px;
`;

const TenantOption = styled.button<{ $theme: Theme; $isActive: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: ${props => props.$isActive ? props.$theme.colors.primary + '15' : 'transparent'};
  color: ${props => props.$theme.colors.text};
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
  gap: 10px;
  
  &:hover {
    background: ${props => props.$theme.colors.backgroundAlt};
  }
  
  span.name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  span.check {
    color: ${props => props.$theme.colors.primary};
    font-weight: bold;
  }
`;

const TenantSelector: React.FC<TenantSelectorProps> = ({ theme, isSuperuser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [currentTenantName, setCurrentTenantName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load tenants on mount
  useEffect(() => {
    const loadTenants = async () => {
      if (!isSuperuser) return;
      
      setIsLoading(true);
      try {
        const myTenants = await tenantService.getMyTenants();
        setTenants(myTenants);
      } catch (error) {
        console.error('Failed to load tenants:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTenants();
  }, [isSuperuser]);

  // Get current tenant from localStorage
  useEffect(() => {
    const tenantId = localStorage.getItem('tenantId');
    const tenantName = localStorage.getItem('tenantName');
    setCurrentTenantId(tenantId);
    setCurrentTenantName(tenantName || 'Select Tenant');
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTenantSelect = (tenant: Tenant) => {
    // Update localStorage
    localStorage.setItem('tenantId', tenant.id);
    localStorage.setItem('tenantName', tenant.name);
    localStorage.setItem('tenantSlug', tenant.slug);
    
    // Update state
    setCurrentTenantId(tenant.id);
    setCurrentTenantName(tenant.name);
    setIsOpen(false);
    
    // Reload the page to apply new tenant context
    window.location.reload();
  };

  // Don't render if not a superuser or only has one tenant
  if (!isSuperuser || tenants.length <= 1) {
    return null;
  }

  return (
    <SelectorContainer ref={dropdownRef}>
      <CurrentTenantButton 
        $theme={theme} 
        onClick={() => setIsOpen(!isOpen)}
        title={`Current tenant: ${currentTenantName}`}
      >
        <TenantIcon>🏢</TenantIcon>
        <span>{currentTenantName}</span>
        <ChevronIcon $isOpen={isOpen}>▼</ChevronIcon>
      </CurrentTenantButton>
      
      {isOpen && (
        <Dropdown $theme={theme}>
          <DropdownHeader $theme={theme}>
            Switch Tenant
          </DropdownHeader>
          {isLoading ? (
            <TenantOption $theme={theme} $isActive={false} disabled>
              Loading...
            </TenantOption>
          ) : (
            tenants.map((tenant) => (
              <TenantOption
                key={tenant.id}
                $theme={theme}
                $isActive={tenant.id === currentTenantId}
                onClick={() => handleTenantSelect(tenant)}
              >
                <span className="name">{tenant.name}</span>
                {tenant.id === currentTenantId && <span className="check">✓</span>}
              </TenantOption>
            ))
          )}
        </Dropdown>
      )}
    </SelectorContainer>
  );
};

export default TenantSelector;
