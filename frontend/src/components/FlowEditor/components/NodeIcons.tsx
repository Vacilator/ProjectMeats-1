/**
 * Node Icons Library
 * 
 * Centralized icon library for all workflow node types.
 * Provides consistent visual indicators with category-based color coding.
 * 
 * Sprint 1: Visual Excellence - Task 1.2
 * Created: 2026-02-17
 */
import React from 'react';
import {
  // Form & Input
  FileText, ListChecks, Calendar, Upload,
  // Logic & Control
  GitBranch, Repeat, Clock, Pause, Play, Square,
  // Data & Operations
  Database, Edit3, Trash2, Copy, Code,
  // Communication
  Mail, MessageSquare, Bell, Send,
  // Integration
  Zap, Cloud, Link, Package,
  // Container & Organization
  Folder, Layers, Box, Grid3x3,
  // Utility
  Settings, Wrench, FileSearch, Terminal,
  // Status
  CheckCircle, AlertCircle, AlertTriangle, Info,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type NodeIconType =
  // Forms
  | 'form' | 'form-step' | 'form-field' | 'form-process'
  // Logic
  | 'conditional' | 'loop' | 'wait' | 'delay'
  // Data
  | 'create-record' | 'update-record' | 'delete-record' | 'query'
  // Communication
  | 'email' | 'notification' | 'message'
  // Integration
  | 'api-call' | 'webhook' | 'integration'
  // Container
  | 'container' | 'group' | 'document'
  // Utility
  | 'utility' | 'script' | 'terminal'
  // Control
  | 'start' | 'end' | 'pause' | 'resume';

export interface NodeIconProps {
  type: NodeIconType;
  size?: number;
  color?: string;
  className?: string;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const iconMap: Record<NodeIconType, React.ComponentType<any>> = {
  // Forms
  'form': FileText,
  'form-step': ListChecks,
  'form-field': Edit3,
  'form-process': Layers,
  
  // Logic
  'conditional': GitBranch,
  'loop': Repeat,
  'wait': Clock,
  'delay': Pause,
  
  // Data Operations
  'create-record': Database,
  'update-record': Edit3,
  'delete-record': Trash2,
  'query': FileSearch,
  
  // Communication
  'email': Mail,
  'notification': Bell,
  'message': MessageSquare,
  
  // Integration
  'api-call': Zap,
  'webhook': Send,
  'integration': Link,
  
  // Container
  'container': Box,
  'group': Folder,
  'document': FileText,
  
  // Utility
  'utility': Wrench,
  'script': Code,
  'terminal': Terminal,
  
  // Control
  'start': Play,
  'end': Square,
  'pause': Pause,
  'resume': Play,
};

// ============================================================================
// Color Schemes by Category
// ============================================================================

export const iconColors = {
  form: '#667eea',         // Purple
  logic: '#f59e0b',        // Orange
  data: '#3b82f6',         // Blue
  communication: '#10b981', // Green
  integration: '#8b5cf6',  // Violet
  container: '#64748b',    // Slate
  utility: '#6b7280',      // Gray
  control: '#6366f1',      // Indigo
  status: {
    success: '#22c55e',    // Green
    error: '#ef4444',      // Red
    warning: '#f59e0b',    // Orange
    info: '#3b82f6',       // Blue
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon color based on node type
 */
export const getIconColor = (type: NodeIconType): string => {
  if (type.startsWith('form')) return iconColors.form;
  if (['conditional', 'loop', 'wait', 'delay'].includes(type)) return iconColors.logic;
  if (type.includes('record') || type === 'query') return iconColors.data;
  if (['email', 'notification', 'message'].includes(type)) return iconColors.communication;
  if (type.includes('api') || type === 'webhook' || type === 'integration') return iconColors.integration;
  if (['container', 'group', 'document'].includes(type)) return iconColors.container;
  if (['utility', 'script', 'terminal'].includes(type)) return iconColors.utility;
  if (['start', 'end', 'pause', 'resume'].includes(type)) return iconColors.control;
  return iconColors.utility; // Default
};

/**
 * Get category name for a node type
 */
export const getIconCategory = (type: NodeIconType): string => {
  if (type.startsWith('form')) return 'Forms';
  if (['conditional', 'loop', 'wait', 'delay'].includes(type)) return 'Logic';
  if (type.includes('record') || type === 'query') return 'Data';
  if (['email', 'notification', 'message'].includes(type)) return 'Communication';
  if (type.includes('api') || type === 'webhook' || type === 'integration') return 'Integration';
  if (['container', 'group', 'document'].includes(type)) return 'Container';
  if (['utility', 'script', 'terminal'].includes(type)) return 'Utility';
  if (['start', 'end', 'pause', 'resume'].includes(type)) return 'Control';
  return 'Other';
};

// ============================================================================
// Component
// ============================================================================

export const NodeIcon: React.FC<NodeIconProps> = ({
  type,
  size = 16,
  color,
  className = '',
}) => {
  const IconComponent = iconMap[type] || Wrench; // Default to Wrench icon
  const defaultColor = color || getIconColor(type);

  return (
    <IconComponent
      size={size}
      color={defaultColor}
      className={className}
      strokeWidth={2}
    />
  );
};

// ============================================================================
// Status Icons (Separate from NodeIcon)
// ============================================================================

export interface StatusIconProps {
  status: 'success' | 'error' | 'warning' | 'info';
  size?: number;
  className?: string;
}

export const StatusIcon: React.FC<StatusIconProps> = ({
  status,
  size = 16,
  className = '',
}) => {
  const iconComponents = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const IconComponent = iconComponents[status];
  const color = iconColors.status[status];

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      strokeWidth={2}
    />
  );
};

// ============================================================================
// Exports
// ============================================================================

export default NodeIcon;

// Export individual icon components for direct use
export {
  FileText, ListChecks, Calendar, Upload,
  GitBranch, Repeat, Clock, Pause, Play, Square,
  Database, Edit3, Trash2, Copy, Code,
  Mail, MessageSquare, Bell, Send,
  Zap, Cloud, Link, Package,
  Folder, Layers, Box, Grid3x3,
  Settings, Wrench, FileSearch, Terminal,
  CheckCircle, AlertCircle, AlertTriangle, Info,
};
