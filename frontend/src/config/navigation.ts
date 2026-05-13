/**
 * Navigation configuration for ProjectMeats frontend
 *
 * Defines the main navigation structure for the application.
 * This is the central location for managing navigation items.
 *
 * Updated: 2026-02-04 - WorkForms Enhancement
 * - Renamed "Forms & Flows" to "WorkForms"
 * - Updated all paths from /forms-flows to /workforms
 * - Added badge support for action item counts
 */

export interface NavigationItem {
  label: string;
  path?: string;
  icon?: string;
  children?: NavigationItem[];
  requiresAuth?: boolean;
  roles?: string[];
  onClick?: () => void;
  color?: string;
  /** Badge count or text to display next to the item (e.g., "3" for action items) */
  badge?: number | string;
  /** Key for fetching dynamic badge count from context */
  badgeKey?: 'actionRequired' | 'waiting' | 'overdue' | 'total';
}

export const navigation: NavigationItem[] = [
  {
    label: 'Home',
    icon: '🏠',
    path: '/',
  },
  {
    label: 'Suppliers',
    icon: '🏭',
    path: '/suppliers',
    children: [
      {
        label: 'All Suppliers',
        icon: '🏭',
        path: '/suppliers',
      },
      {
        label: 'Plants & Facilities',
        icon: '🏗️',
        path: '/suppliers/plants',
      },
    ],
  },
  {
    label: 'Customers',
    icon: '👥',
    path: '/customers',
    children: [
      {
        label: 'All Customers',
        icon: '👥',
        path: '/customers',
      },
      {
        label: 'Locations',
        icon: '📍',
        path: '/customers/locations',
      },
    ],
  },
  {
    label: 'Contacts',
    icon: '📇',
    path: '/contacts',
  },
  {
    label: 'Orders',
    icon: '📋',
    children: [
      {
        label: 'Inquiries',
        icon: '📋',
        path: '/inquiries',
      },
      {
        label: 'Fulfillments',
        icon: '📦',
        path: '/fulfillments',
      },
      {
        label: "P.O.'s",
        icon: '📦',
        path: '/purchase-orders',
      },
      {
        label: "S.O.'s",
        icon: '🚚',
        path: '/sales-orders',
      },
    ],
  },
  {
    label: 'Accounting',
    icon: '💰',
    children: [
      {
        label: 'Payables',
        icon: '💸',
        path: '/accounting/payables',
        children: [
          {
            label: 'Claims',
            icon: '📋',
            path: '/accounting/payables/claims',
          },
          {
            label: "P.O.'s",
            icon: '📦',
            path: '/accounting/payables/pos',
          },
        ],
      },
      {
        label: 'Receivables',
        icon: '💵',
        path: '/accounts-receivables',
        children: [
          {
            label: 'Claims',
            icon: '📋',
            path: '/accounting/receivables/claims',
          },
          {
            label: "S.O.'s",
            icon: '🚚',
            path: '/accounting/receivables/sos',
          },
          {
            label: 'Invoices',
            icon: '🧾',
            path: '/accounting/receivables/invoices',
          },
        ],
      },
      {
        label: 'Settlements',
        icon: '🏦',
        path: '/accounting/settlements',
        roles: ['admin', 'owner', 'superuser'],
      },
    ],
  },
  {
    label: 'Cold Storage',
    icon: '❄️',
    path: '/cold-storage',
  },
  {
    label: 'Logistics',
    icon: '🚛',
    children: [
      {
        label: 'Carriers',
        icon: '🚛',
        path: '/carriers',
      },
      {
        label: 'Freight Orders',
        icon: '🧾',
        path: '/freight-orders',
      },
    ],
  },
  {
    label: 'Tools',
    icon: '🔧',
    children: [
      {
        label: 'Calls',
        icon: '📞',
        path: '/calls',
      },
      {
        label: 'Reports',
        icon: '📈',
        path: '/reports',
      },
      {
        label: 'Deals',
        icon: '🤝',
        path: '/deals',
      },
    ],
  },
  {
    label: 'WorkForms',
    icon: '📋',
    path: '/workforms',
  },
  {
    label: 'AI & Approvals',
    icon: '🤖',
    path: '/settings/ai',
    badgeKey: 'actionRequired',
  },
];

/**
 * Admin Workspace Navigation (Bottom Section)
 * Tenant-specific administration and configuration pages
 */
export const adminWorkspaceNavigation: NavigationItem[] = [
  {
    label: 'Admin Workspace',
    icon: '⚙️',
    children: [
      {
        label: 'Overview',
        icon: '🏠',
        path: '/workspace',
      },
      {
        label: 'Configurations',
        icon: '🔧',
        path: '/workspace/configurations',
      },
      {
        label: 'Users & Invitations',
        icon: '👥',
        path: '/workspace/users',
      },
      {
        label: 'Profile',
        icon: '🏢',
        path: '/workspace/profile',
      },
      {
        label: 'Billing',
        icon: '💳',
        path: '/workspace/billing',
      },
      {
        label: 'Option Lists',
        icon: '📋',
        path: '/workspace/option-lists',
      },
      {
        label: 'Activity & Audit Logs',
        icon: '🕒',
        path: '/workspace/activity',
      },
    ],
  },
];
