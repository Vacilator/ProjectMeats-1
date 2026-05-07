import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { resolveRouteBreadcrumbLabel } from '@/utils/entityDisplay';

/**
 * Context-aware Breadcrumb Component
 * 
 * Updated: 2026-02-04 - Phase 1 Cockpit & WorkForms Enhancement
 * - Removed hardcoded "Dashboard" root
 * - Uses first path segment as root (context-aware)
 * - Added comprehensive breadcrumb name mapping
 * - Uses design system colors
 */

const Breadcrumb: React.FC = () => {
  const location = useLocation();

  // Create breadcrumb items from current path
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Comprehensive breadcrumb name mapping
  const breadcrumbNameMap: { [key: string]: string } = {
    // Workspace section
    cockpit: 'Cockpit',
    workspace: 'Cockpit', // Legacy redirect
    calls: 'Calls',
    'call-log': 'Calls',
    reports: 'Reports',
    
    // WorkForms section
    workforms: 'WorkForms',
    'forms-flows': 'WorkForms', // Legacy redirect
    tasks: 'My Tasks',
    'in-progress': 'In Progress',
    catalog: 'Catalog',
    history: 'History',
    
    // Core entities
    suppliers: 'Suppliers',
    customers: 'Customers',
    'purchase-orders': 'Purchase Orders',
    'sales-orders': 'Sales Orders',
    'accounts-receivables': 'Accounts Receivables',
    contacts: 'Contacts',
    plants: 'Plants',
    products: 'Products',
    locations: 'Locations',
    carriers: 'Carriers',
    'cold-storage': 'Cold Storage',
    
    // Orders section
    inquiries: 'Inquiries',
    fulfillments: 'Fulfillments',
    templates: 'Templates',
    analytics: 'Analytics',
    attachments: 'Attachments',
    
    // Accounting section
    accounting: 'Accounting',
    payables: 'Payables',
    receivables: 'Receivables',
    claims: 'Claims',
    pos: "P.O.'s",
    sos: "S.O.'s",
    invoices: 'Invoices',
    
    // Admin & Settings
    admin: 'Admin',
    'option-lists': 'Option Lists',
    settings: 'Settings',
    notifications: 'Notifications',
    profile: 'Profile',
    
    // AI & Tools
    'ai-assistant': 'AI Assistant',
    
    // Workflows (legacy)
    workflows: 'Workflows',
    monitor: 'Monitor',
    run: 'Run',
    details: 'Details',
    
    // My items
    'my-submissions': 'My Submissions',
    'my-tasks': 'My Tasks',
  };

  // If at root, show nothing (user knows where they are)
  if (pathnames.length === 0) {
    return null;
  }

  return (
    <BreadcrumbContainer aria-label="Breadcrumb navigation">
      {pathnames.map((pathname, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const mappedName = breadcrumbNameMap[pathname];
        const resolved = mappedName
          ? { text: mappedName, tooltip: mappedName }
          : resolveRouteBreadcrumbLabel(pathname, pathnames[index - 1]);

        return (
          <BreadcrumbItem key={routeTo}>
            {isLast ? (
              <BreadcrumbText aria-current="page" title={resolved.tooltip || resolved.text}>
                {resolved.text}
              </BreadcrumbText>
            ) : (
              <>
                <BreadcrumbLink to={routeTo} title={resolved.tooltip || resolved.text}>
                  {resolved.text}
                </BreadcrumbLink>
                <Separator aria-hidden="true">/</Separator>
              </>
            )}
          </BreadcrumbItem>
        );
      })}
    </BreadcrumbContainer>
  );
};

const BreadcrumbContainer = styled.nav`
  display: flex;
  align-items: center;
  padding: 16px 0;
  font-size: 14px;
  flex-wrap: wrap;
  gap: 4px;
`;

const BreadcrumbItem = styled.div`
  display: flex;
  align-items: center;
`;

const BreadcrumbLink = styled(Link)`
  color: rgb(var(--color-text-secondary, 108, 117, 125));
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: rgb(var(--color-text-primary, 73, 80, 87));
    text-decoration: underline;
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary, 102, 126, 234));
    outline-offset: 2px;
    border-radius: 2px;
  }
`;

const BreadcrumbText = styled.span`
  color: rgb(var(--color-text-primary, 73, 80, 87));
  font-weight: 500;
`;

const Separator = styled.span`
  margin: 0 8px;
  color: rgb(var(--color-text-secondary, 108, 117, 125));
`;

export default Breadcrumb;
