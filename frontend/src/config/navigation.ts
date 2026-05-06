/**
 * Navigation configuration for ProjectMeats frontend
 * 
 * Defines the main navigation structure for the application.
 * This is the central location for managing navigation items.
 * 
 * Updated: 2026-02-04 - Phase 1 Cockpit & WorkForms Enhancement
 * - Changed Cockpit path from /workspace to /cockpit
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
    label: 'Cockpit',
    icon: '🎯',
    path: '/cockpit',
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
        label: 'WorkForms',
        icon: '📋',
        path: '/workforms',
        badgeKey: 'actionRequired',
        children: [
          {
            label: 'My Tasks',
            icon: '✅',
            path: '/workforms/tasks',
            badgeKey: 'actionRequired',
          },
          {
            label: 'In Progress',
            icon: '⏳',
            path: '/workforms/in-progress',
          },
          {
            label: 'Catalog',
            icon: '📚',
            path: '/workforms/catalog',
          },
          {
            label: 'History',
            icon: '📜',
            path: '/workforms/history',
          },
          {
            label: 'Editor',
            icon: '🎨',
            path: '/workforms/editor',
            roles: ['admin', 'superuser'],
          },
        ],
      },
    ],
  },
  {
    label: 'Suppliers',
    icon: '🏭',
    path: '/suppliers',
  },
  {
    label: 'Customers',
    icon: '👥',
    path: '/customers',
  },
  {
    label: 'Orders',
    icon: '📋',
    children: [
      {
        label: 'Inquiries',
        icon: '📋',
        path: '/inquiries',
        children: [
          {
            label: 'Templates',
            icon: '📝',
            path: '/inquiries/templates',
          },
          {
            label: 'Analytics',
            icon: '📊',
            path: '/inquiries/analytics',
          },
        ],
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
        children: [
          {
            label: 'Attachments',
            icon: '📎',
            path: '/purchase-orders/attachments',
          },
        ],
      },
      {
        label: "S.O.'s",
        icon: '🚚',
        path: '/sales-orders',
        children: [
          {
            label: 'Attachments',
            icon: '📎',
            path: '/sales-orders/attachments',
          },
        ],
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
];

/**
 * Admin Workspace Navigation (Bottom Section)
 * Tenant-specific administration and configuration pages
 * Updated 2026-02-21: Changed from /admin/* to /workspace/* to avoid Django conflict
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
