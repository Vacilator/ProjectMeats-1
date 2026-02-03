/**
 * Navigation configuration for ProjectMeats frontend
 * 
 * Defines the main navigation structure for the application.
 * This is the central location for managing navigation items.
 * 
 * Updated: 2026-02-03 - Phase 1 Forms & Flows Enhancement
 * - Renamed "Dashboard" to "Cockpit"
 * - Renamed "Call Log" to "Calls"
 * - Moved "Workflows" under "Workspace" as "Forms & Flows"
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
    label: 'Workspace',
    icon: '💼',
    children: [
      {
        label: 'Cockpit',
        icon: '🎯',
        path: '/workspace',
      },
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
        label: 'Forms & Flows',
        icon: '📋',
        path: '/forms-flows',
        badgeKey: 'actionRequired',
        children: [
          {
            label: 'My Tasks',
            icon: '✅',
            path: '/forms-flows/tasks',
            badgeKey: 'actionRequired',
          },
          {
            label: 'In Progress',
            icon: '⏳',
            path: '/forms-flows/in-progress',
          },
          {
            label: 'Catalog',
            icon: '📚',
            path: '/forms-flows/catalog',
          },
          {
            label: 'History',
            icon: '📜',
            path: '/forms-flows/history',
          },
        ],
      },
    ],
  },
  {
    label: 'Suppliers',
    icon: '🏭',
    path: '/suppliers',
    children: [
      {
        label: 'Plants',
        icon: '🏢',
        path: '/suppliers/plants',
      },
      {
        label: 'Contacts',
        icon: '📞',
        path: '/suppliers/contacts',
      },
    ],
  },
  {
    label: 'Customers',
    icon: '👥',
    path: '/customers',
    children: [
      {
        label: 'Locations',
        icon: '📍',
        path: '/customers/locations',
      },
      {
        label: 'Contacts',
        icon: '📞',
        path: '/customers/contacts',
      },
    ],
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
    path: '/carriers',
  },
  {
    label: 'Admin',
    icon: '⚙️',
    children: [
      {
        label: 'Option Lists',
        icon: '📋',
        path: '/admin/option-lists',
      },
    ],
  },
];

