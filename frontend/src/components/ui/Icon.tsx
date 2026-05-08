/**
 * Icon Component
 * 
 * Renders icons from either:
 * - Lucide icon names (e.g., "file-text", "clipboard-list")
 * - Emoji strings (e.g., "📄", "📋")
 * 
 * Automatically detects the type and renders appropriately.
 */
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { logger } from '@/utils/logger';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}

// Convert kebab-case to PascalCase for Lucide icon lookup
const kebabToPascal = (str: string): string => {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

// Check if string is an emoji (contains non-ASCII characters typical of emojis)
const isEmoji = (str: string): boolean => {
  if (!str || str.length === 0) return false;
  // Emoji pattern: starts with a character outside basic ASCII
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/u;
  return emojiRegex.test(str) || str.codePointAt(0)! > 127;
};

// Common icon name mappings (kebab-case to Lucide component name)
const ICON_ALIASES: Record<string, string> = {
  'file-text': 'FileText',
  'clipboard-list': 'ClipboardList',
  'user': 'User',
  'users': 'Users',
  'building': 'Building',
  'truck': 'Truck',
  'box': 'Box',
  'package': 'Package',
  'shopping-cart': 'ShoppingCart',
  'dollar-sign': 'DollarSign',
  'calendar': 'Calendar',
  'clock': 'Clock',
  'check-circle': 'CheckCircle',
  'x-circle': 'XCircle',
  'alert-circle': 'AlertCircle',
  'info': 'Info',
  'settings': 'Settings',
  'mail': 'Mail',
  'phone': 'Phone',
  'map-pin': 'MapPin',
  'tag': 'Tag',
  'folder': 'Folder',
  'file': 'File',
  'edit': 'Edit',
  'trash': 'Trash',
  'plus': 'Plus',
  'minus': 'Minus',
  'search': 'Search',
  'filter': 'Filter',
  'list': 'List',
  'grid': 'Grid',
  'home': 'Home',
  'menu': 'Menu',
  'more-vertical': 'MoreVertical',
  'more-horizontal': 'MoreHorizontal',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
  'chevron-up': 'ChevronUp',
  'chevron-down': 'ChevronDown',
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
  'arrow-up': 'ArrowUp',
  'arrow-down': 'ArrowDown',
  'external-link': 'ExternalLink',
  'link': 'Link',
  'copy': 'Copy',
  'download': 'Download',
  'upload': 'Upload',
  'refresh-cw': 'RefreshCw',
  'loader': 'Loader',
  'star': 'Star',
  'heart': 'Heart',
  'bell': 'Bell',
  'eye': 'Eye',
  'eye-off': 'EyeOff',
  'lock': 'Lock',
  'unlock': 'Unlock',
  'key': 'Key',
  'credit-card': 'CreditCard',
  'receipt': 'Receipt',
  'briefcase': 'Briefcase',
  'activity': 'Activity',
  'bar-chart': 'BarChart',
  'pie-chart': 'PieChart',
  'trending-up': 'TrendingUp',
  'trending-down': 'TrendingDown',
  'zap': 'Zap',
  'message-square': 'MessageSquare',
  'message-circle': 'MessageCircle',
  'send': 'Send',
  'paperclip': 'Paperclip',
  'image': 'Image',
  'camera': 'Camera',
  'video': 'Video',
  'mic': 'Mic',
  'volume': 'Volume',
  'play': 'Play',
  'pause': 'Pause',
  'stop': 'Stop',
  'skip-forward': 'SkipForward',
  'skip-back': 'SkipBack',
  'layers': 'Layers',
  'layout': 'Layout',
  'sidebar': 'Sidebar',
  'terminal': 'Terminal',
  'code': 'Code',
  'database': 'Database',
  'server': 'Server',
  'cloud': 'Cloud',
  'globe': 'Globe',
  'wifi': 'Wifi',
  'bluetooth': 'Bluetooth',
  'cpu': 'Cpu',
  'hard-drive': 'HardDrive',
  'printer': 'Printer',
  'smartphone': 'Smartphone',
  'tablet': 'Tablet',
  'monitor': 'Monitor',
  'book': 'Book',
  'book-open': 'BookOpen',
  'graduation-cap': 'GraduationCap',
  'award': 'Award',
  'gift': 'Gift',
  'shopping-bag': 'ShoppingBag',
  'percent': 'Percent',
  'hash': 'Hash',
  'at-sign': 'AtSign',
  'clipboard': 'Clipboard',
  'clipboard-check': 'ClipboardCheck',
  'form-input': 'FormInput',
  'file-plus': 'FilePlus',
  'file-minus': 'FileMinus',
  'file-check': 'FileCheck',
  'file-x': 'FileX',
  'folder-plus': 'FolderPlus',
  'folder-minus': 'FolderMinus',
  'folder-open': 'FolderOpen',
};

const Icon: React.FC<IconProps> = ({ name, size = 20, className = '', color }) => {
  // Handle empty or undefined
  if (!name) {
    const DefaultIcon = LucideIcons.FileText;
    return <DefaultIcon size={size} className={className} color={color} />;
  }

  // If it's an emoji, render as text
  if (isEmoji(name)) {
    return (
      <span 
        className={className} 
        style={{ 
          fontSize: `${size}px`, 
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {name}
      </span>
    );
  }

  // Try to find the Lucide icon
  const pascalName = ICON_ALIASES[name.toLowerCase()] || kebabToPascal(name);
  const LucideIcon = (LucideIcons as unknown as Record<string, React.ComponentType<any>>)[pascalName];

  if (LucideIcon) {
    return <LucideIcon size={size} className={className} color={color} />;
  }

  // Fallback: render the name as text (for debugging) or use a default icon
  logger.warn('Icon not found', { component: 'Icon', metadata: { name, pascalName } });
  const FallbackIcon = LucideIcons.HelpCircle;
  return <FallbackIcon size={size} className={className} color={color} />;
};

// Icon picker data for form builder
export const AVAILABLE_ICONS = [
  // Documents
  { name: 'file-text', label: 'Document', category: 'documents' },
  { name: 'file', label: 'File', category: 'documents' },
  { name: 'file-plus', label: 'New File', category: 'documents' },
  { name: 'file-check', label: 'Approved File', category: 'documents' },
  { name: 'clipboard', label: 'Clipboard', category: 'documents' },
  { name: 'clipboard-list', label: 'Checklist', category: 'documents' },
  { name: 'clipboard-check', label: 'Completed', category: 'documents' },
  { name: 'folder', label: 'Folder', category: 'documents' },
  { name: 'folder-open', label: 'Open Folder', category: 'documents' },
  
  // People
  { name: 'user', label: 'Person', category: 'people' },
  { name: 'users', label: 'Team', category: 'people' },
  { name: 'building', label: 'Company', category: 'people' },
  
  // Business
  { name: 'briefcase', label: 'Business', category: 'business' },
  { name: 'shopping-cart', label: 'Order', category: 'business' },
  { name: 'shopping-bag', label: 'Purchase', category: 'business' },
  { name: 'dollar-sign', label: 'Money', category: 'business' },
  { name: 'credit-card', label: 'Payment', category: 'business' },
  { name: 'receipt', label: 'Invoice', category: 'business' },
  { name: 'percent', label: 'Discount', category: 'business' },
  { name: 'tag', label: 'Price Tag', category: 'business' },
  
  // Logistics
  { name: 'truck', label: 'Shipping', category: 'logistics' },
  { name: 'box', label: 'Box', category: 'logistics' },
  { name: 'package', label: 'Package', category: 'logistics' },
  { name: 'map-pin', label: 'Location', category: 'logistics' },
  { name: 'globe', label: 'Global', category: 'logistics' },
  
  // Communication
  { name: 'mail', label: 'Email', category: 'communication' },
  { name: 'phone', label: 'Phone', category: 'communication' },
  { name: 'message-square', label: 'Message', category: 'communication' },
  { name: 'send', label: 'Send', category: 'communication' },
  { name: 'bell', label: 'Notification', category: 'communication' },
  
  // Time
  { name: 'calendar', label: 'Calendar', category: 'time' },
  { name: 'clock', label: 'Time', category: 'time' },
  
  // Status
  { name: 'check-circle', label: 'Success', category: 'status' },
  { name: 'x-circle', label: 'Error', category: 'status' },
  { name: 'alert-circle', label: 'Warning', category: 'status' },
  { name: 'info', label: 'Info', category: 'status' },
  { name: 'star', label: 'Favorite', category: 'status' },
  { name: 'activity', label: 'Activity', category: 'status' },
  
  // Actions
  { name: 'edit', label: 'Edit', category: 'actions' },
  { name: 'trash', label: 'Delete', category: 'actions' },
  { name: 'plus', label: 'Add', category: 'actions' },
  { name: 'search', label: 'Search', category: 'actions' },
  { name: 'filter', label: 'Filter', category: 'actions' },
  { name: 'download', label: 'Download', category: 'actions' },
  { name: 'upload', label: 'Upload', category: 'actions' },
  { name: 'refresh-cw', label: 'Refresh', category: 'actions' },
  { name: 'copy', label: 'Copy', category: 'actions' },
  { name: 'link', label: 'Link', category: 'actions' },
  { name: 'external-link', label: 'External', category: 'actions' },
  
  // Security
  { name: 'lock', label: 'Locked', category: 'security' },
  { name: 'unlock', label: 'Unlocked', category: 'security' },
  { name: 'key', label: 'Key', category: 'security' },
  { name: 'eye', label: 'View', category: 'security' },
  { name: 'eye-off', label: 'Hidden', category: 'security' },
  
  // Charts
  { name: 'bar-chart', label: 'Bar Chart', category: 'charts' },
  { name: 'pie-chart', label: 'Pie Chart', category: 'charts' },
  { name: 'trending-up', label: 'Growth', category: 'charts' },
  { name: 'trending-down', label: 'Decline', category: 'charts' },
  
  // Tech
  { name: 'settings', label: 'Settings', category: 'tech' },
  { name: 'database', label: 'Database', category: 'tech' },
  { name: 'server', label: 'Server', category: 'tech' },
  { name: 'code', label: 'Code', category: 'tech' },
  { name: 'terminal', label: 'Terminal', category: 'tech' },
  { name: 'layers', label: 'Layers', category: 'tech' },
  { name: 'zap', label: 'Power', category: 'tech' },
];

export const ICON_CATEGORIES = [
  { id: 'documents', label: '📄 Documents' },
  { id: 'people', label: '👥 People' },
  { id: 'business', label: '💼 Business' },
  { id: 'logistics', label: '📦 Logistics' },
  { id: 'communication', label: '💬 Communication' },
  { id: 'time', label: '⏰ Time' },
  { id: 'status', label: '✅ Status' },
  { id: 'actions', label: '⚡ Actions' },
  { id: 'security', label: '🔒 Security' },
  { id: 'charts', label: '📊 Charts' },
  { id: 'tech', label: '💻 Tech' },
];

export default Icon;
