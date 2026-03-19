/**
 * MyTasks Page Component
 * 
 * Displays action items assigned to the current user across all forms and workflows.
 * Connects to the action-items API endpoint.
 * Supports task delegation via DelegateTaskModal.
 * 
 * Phase 5 Enhancement: Added "In Progress Workflows" section
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useNotifications, ActionItem } from '../../contexts/NotificationsContext';
import { DelegateTaskModal, DelegationData, User } from '../../components/Delegation';
import { DelegationHistory } from '../../components/Delegation';
import { workflowExecutionService } from '../../services/workflowExecutionService';
import { WorkflowExecution } from '../../types/workflows';

// Styled Components
const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const StatsBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(234, 179, 8, 0.05) 100%);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
`;


const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0;
`;

const CountBadge = styled.span`
  background: rgb(var(--color-primary, 102 126 234));
  color: white;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 16px;
  margin-left: 12px;
`;

const FiltersBar = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding: 16px;
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FilterLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 6px;
  font-size: 14px;
  color: rgb(var(--color-text-primary, 44 62 80));
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
  }
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 6px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary, 127 140 141));
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled.div<{ $variant?: 'danger' | 'warning' | 'info' | 'default' }>`
  padding: 20px;
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid ${props => {
    switch (props.$variant) {
      case 'danger': return 'rgb(239, 68, 68)';
      case 'warning': return 'rgb(234, 179, 8)';
      case 'info': return 'rgb(59, 130, 246)';
      default: return 'rgb(var(--color-primary, 102 126 234))';
    }
  }};
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--color-text-primary, 44 62 80));
`;

const StatLabel = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin-top: 4px;
`;

const TaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TaskCard = styled.div<{ $priority: string; $isOverdue: boolean; $isAtRisk?: boolean }>`
  display: flex;
  align-items: flex-start;
  padding: 16px 20px;
  background: ${props => props.$isAtRisk 
    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgb(var(--color-surface, 255 255 255)) 100%)'
    : 'rgb(var(--color-surface, 255 255 255))'
  };
  border-radius: 8px;
  box-shadow: ${props => props.$isAtRisk 
    ? '0 2px 8px rgba(239, 68, 68, 0.2)'
    : '0 1px 3px rgba(0, 0, 0, 0.1)'
  };
  border-left: 4px solid ${props => {
    if (props.$isAtRisk) return 'rgb(239, 68, 68)';
    if (props.$isOverdue) return 'rgb(239, 68, 68)';
    switch (props.$priority) {
      case 'urgent': return 'rgb(239, 68, 68)';
      case 'high': return 'rgb(234, 179, 8)';
      case 'normal': return 'rgb(59, 130, 246)';
      default: return 'rgb(var(--color-border, 224 224 224))';
    }
  }};
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateX(4px);
    box-shadow: ${props => props.$isAtRisk
      ? '0 4px 12px rgba(239, 68, 68, 0.3)'
      : '0 4px 12px rgba(0, 0, 0, 0.1)'
    };
  }
`;

const TaskContent = styled.div`
  flex: 1;
`;

const TaskTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0 0 4px 0;
`;

const TaskDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin: 0 0 12px 0;
`;

const TaskMeta = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`;

const TaskMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const PriorityBadge = styled.span<{ $priority: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => {
    switch (props.$priority) {
      case 'urgent': return 'rgba(239, 68, 68, 0.1)';
      case 'high': return 'rgba(234, 179, 8, 0.1)';
      case 'normal': return 'rgba(59, 130, 246, 0.1)';
      default: return 'rgba(127, 140, 141, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$priority) {
      case 'urgent': return 'rgb(239, 68, 68)';
      case 'high': return 'rgb(180, 140, 8)';
      case 'normal': return 'rgb(59, 130, 246)';
      default: return 'rgb(127, 140, 141)';
    }
  }};
`;

const OverdueBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
`;

const AtRiskBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(239, 68, 68, 0.15);
  color: rgb(239, 68, 68);
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`;

const TaskActions = styled.div`
  display: flex;
  gap: 8px;
  margin-left: 16px;
`;

const ActionButton = styled.button`
  padding: 8px 16px;
  background: rgb(var(--color-primary, 102 126 234));
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }
`;

const SecondaryButton = styled.button`
  padding: 8px 16px;
  background: transparent;
  color: rgb(var(--color-primary, 102 126 234));
  border: 1px solid rgb(var(--color-primary, 102 126 234));
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(var(--color-primary, 102 126 234), 0.1);
  }
`;

const HistoryToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgb(var(--color-surface, 255 255 255));
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
  cursor: pointer;
  transition: border-color 0.15s ease;
  margin-bottom: 24px;

  &:hover {
    border-color: rgb(var(--color-primary, 102 126 234));
  }
`;

const HistoryContainer = styled.div<{ $isOpen: boolean }>`
  max-height: ${props => props.$isOpen ? '600px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
  margin-bottom: ${props => props.$isOpen ? '24px' : '0'};
`;

const WorkflowsSection = styled.div`
  margin-bottom: 32px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0;
`;

const WorkflowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
`;

const WorkflowCard = styled.div`
  background: rgb(var(--color-surface, 255 255 255));
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  padding: 20px;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const WorkflowHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const WorkflowTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0 0 4px 0;
  flex: 1;
`;

const WorkflowMeta = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin-bottom: 12px;
`;

const ProgressBar = styled.div`
  height: 6px;
  background: rgb(var(--color-border, 224 224 224));
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: rgb(var(--color-primary, 102 126 234));
  border-radius: 3px;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary, 127 140 141));
  margin-bottom: 12px;
`;

const WorkflowActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ResumeButton = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgb(var(--color-primary, 102 126 234));
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0 0 8px 0;
`;

const EmptyText = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  margin: 0;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px;
  
  &::after {
    content: '';
    width: 40px;
    height: 40px;
    border: 3px solid rgb(var(--color-border, 224 224 224));
    border-top-color: rgb(var(--color-primary, 102 126 234));
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  padding: 16px 20px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: rgb(239, 68, 68);
  margin-bottom: 24px;
`;

// Filter types
type PriorityFilter = 'all' | 'urgent' | 'high' | 'normal' | 'low';
type StatusFilter = 'all' | 'action_needed' | 'in_progress' | 'waiting' | 'overdue';

// Format date helper
const formatDueDate = (dateStr: string | null): string => {
  if (!dateStr) return 'No due date';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days} days`;
  
  return `Due ${date.toLocaleDateString()}`;
};

/**
 * MyTasks page component.
 */
export const MyTasks: React.FC = () => {
  const { actionItems, actionItemCounts, loading, error, fetchActionItems } = useNotifications();
  
  // Workflow executions state
  const [workflowExecutions, setWorkflowExecutions] = useState<WorkflowExecution[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [workflowsError, setWorkflowsError] = useState('');
  const [resumingId, setResumingId] = useState<string | null>(null);
  
  // Local filter state
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'smart' | 'due_date' | 'priority' | 'form'>('smart');
  
  // Delegation state
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ActionItem | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);
  const [showDelegationHistory, setShowDelegationHistory] = useState(false);
  
  // Mock available users - in production, this would come from an API
  const [availableUsers] = useState<User[]>([
    { id: '1', name: 'John Smith', email: 'john@example.com', role: 'Sales Rep', department: 'Sales' },
    { id: '2', name: 'Jane Doe', email: 'jane@example.com', role: 'Manager', department: 'Operations' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'Analyst', department: 'Finance' },
  ]);
  
  // Delegation history - in production, this would come from an API
  const [delegationHistory] = useState([
    {
      id: '1',
      taskName: 'Review Purchase Order #1234',
      fromUser: { id: 'current', name: 'You', email: 'me@example.com' },
      toUser: { id: '1', name: 'John Smith', email: 'john@example.com' },
      delegatedAt: new Date(Date.now() - 86400000).toISOString(),
      reason: 'Out of office this week',
      status: 'active' as const,
    },
  ]);

  // Fetch workflow executions
  const fetchWorkflowExecutions = useCallback(async () => {
    setWorkflowsLoading(true);
    setWorkflowsError('');
    setWorkflowExecutions([]);
    try {
      const response = await workflowExecutionService.getExecutions({
        status: 'in_progress',
        assigned_to: 'me',
        page_size: 25,
      });
      setWorkflowExecutions(response.results);
    } catch (err) {
      console.error('Failed to fetch workflow executions:', err);
      const status = (err as any)?.response?.status;

      // Degrade gracefully: prefer the normal empty-state UI over a scary error banner.
      // (This page already has a Retry button.)
      if (status === 404 || status === 403) {
        setWorkflowsError('No workflows available for your tenant yet.');
      } else {
        setWorkflowsError('');
      }
      setWorkflowExecutions([]);
    } finally {
      setWorkflowsLoading(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchWorkflowExecutions();
  }, [fetchWorkflowExecutions]);

  // Handle resume workflow
  const handleResumeWorkflow = async (execution: WorkflowExecution) => {
    setResumingId(execution.id);
    try {
      await workflowExecutionService.resumeExecution(execution.id);
      // Navigate to the workflow
      window.location.href = `/workflows/submissions/${execution.id}`;
    } catch (err) {
      console.error('Failed to resume workflow:', err);
      alert('Failed to resume workflow. Please try again.');
    } finally {
      setResumingId(null);
    }
  };

  // Format time ago helper
  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const daysUntilDue = (dueDate: string | null): number | null => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const computeUrgencyValueScore = (item: ActionItem): number => {
    const priorityWeight: Record<string, number> = {
      urgent: 1.5,
      high: 1.0,
      normal: 0.5,
      low: 0.2,
    };
    const days = daysUntilDue(item.due_date);
    const isOverdue = item.is_overdue || (days !== null && days < 0);
    const daysWeight = isOverdue ? 10 : days !== null ? Math.max(0, 7 - Math.min(days, 30)) / 7 : 0;
    const value = item.related_po_value ?? 0;
    const valueWeight = Math.log10(value > 0 ? value + 1 : 1); // diminishing returns
    const priority = priorityWeight[item.priority] ?? 0.3;
    return (isOverdue ? 5 : 0) + daysWeight * 3 + valueWeight * 2 + priority;
  };

  // Filter and sort action items
  const filteredItems = useMemo(() => {
    let items = [...actionItems];

    // Apply priority filter
    if (priorityFilter !== 'all') {
      items = items.filter(item => item.priority === priorityFilter);
    }

    // Apply status filter
    if (statusFilter === 'overdue') {
      items = items.filter(item => item.is_overdue);
    } else if (statusFilter !== 'all') {
      items = items.filter(item => item.status === statusFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.form_name?.toLowerCase().includes(query) ||
        item.step_name?.toLowerCase().includes(query)
      );
    }

    // Sort
    items.sort((a, b) => {
      switch (sortBy) {
        case 'smart':
          return computeUrgencyValueScore(b) - computeUrgencyValueScore(a);
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'priority': {
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4) -
                 (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4);
        }
        case 'form':
          return (a.form_name || '').localeCompare(b.form_name || '');
        default:
          return 0;
      }
    });

    return items;
  }, [actionItems, priorityFilter, statusFilter, searchQuery, sortBy]);

  // Calculate "At Risk" tasks (high-value + overdue/due soon)
  const isAtRisk = (item: ActionItem): boolean => {
    const days = daysUntilDue(item.due_date);
    const highValue = (item.related_po_value ?? 0) >= 10000; // $10k+ threshold
    const timeCritical = item.is_overdue || (days !== null && days <= 2);
    return highValue && timeCritical;
  };

  const atRiskStats = useMemo(() => {
    const atRiskItems = filteredItems.filter(isAtRisk);
    const totalValue = atRiskItems.reduce((sum, item) => sum + (item.related_po_value ?? 0), 0);
    const overdue = atRiskItems.filter(item => item.is_overdue).length;
    const dueSoon = atRiskItems.filter(item => !item.is_overdue).length;
    return { count: atRiskItems.length, totalValue, overdue, dueSoon };
  }, [filteredItems]);

  const riskStats = useMemo(() => {
    const atRiskItems = filteredItems.filter((item) => {
      const days = daysUntilDue(item.due_date);
      const value = item.related_po_value ?? 0;
      return (item.is_overdue || (days !== null && days <= 2)) && value >= 10000;
    });
    const totalValue = atRiskItems.reduce((sum, item) => sum + (item.related_po_value ?? 0), 0);
    return { count: atRiskItems.length, totalValue };
  }, [filteredItems]);

  // Handle task click
  const handleTaskClick = (item: ActionItem) => {
    // Navigate to the form submission
    if (item.submission_id) {
      window.location.href = `/workflows/submissions/${item.submission_id}`;
    }
  };
  
  // Handle delegate click
  const handleDelegateClick = useCallback((e: React.MouseEvent, item: ActionItem) => {
    e.stopPropagation();
    setSelectedTask(item);
    setShowDelegateModal(true);
  }, []);
  
  // Handle delegation
  const handleDelegate = useCallback(async (data: DelegationData) => {
    if (!selectedTask) return;
    
    setIsDelegating(true);
    try {
      // In production, this would call the API
      console.log('Delegating task:', selectedTask.id, 'to:', data.delegateUserId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close modal and refresh data
      setShowDelegateModal(false);
      setSelectedTask(null);
      fetchActionItems();
    } catch (err) {
      console.error('Failed to delegate task:', err);
    } finally {
      setIsDelegating(false);
    }
  }, [selectedTask, fetchActionItems]);
  
  // Handle revoke delegation
  const handleRevokeDelegation = useCallback(async (delegationId: string) => {
    console.log('Revoking delegation:', delegationId);
    // In production, this would call the API
  }, []);

  // Render loading state
  if (loading && actionItems.length === 0) {
    return (
      <Container>
        <Header>
          <Title>My Tasks</Title>
        </Header>
        <LoadingSpinner />
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title>My Tasks</Title>
          {actionItemCounts && (
            <CountBadge>{actionItemCounts.total}</CountBadge>
          )}
        </div>
        <ActionButton onClick={() => fetchActionItems()}>
          Refresh
        </ActionButton>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {/* In Progress Workflows Section */}
      <WorkflowsSection>
        <SectionHeader>
          <SectionTitle>In Progress Workflows</SectionTitle>
          <ActionButton onClick={fetchWorkflowExecutions} disabled={workflowsLoading}>
            Refresh
          </ActionButton>
        </SectionHeader>

        {workflowsError && <ErrorMessage>{workflowsError}</ErrorMessage>}

        {workflowsLoading ? (
          <LoadingSpinner />
        ) : workflowExecutions.length === 0 ? (
          <EmptyState>
            <EmptyIcon>🔄</EmptyIcon>
            <EmptyTitle>No workflows in progress</EmptyTitle>
            <EmptyText>Active workflows will appear here when you start them.</EmptyText>
          </EmptyState>
        ) : (
          <WorkflowGrid>
            {workflowExecutions.map((execution) => (
              <WorkflowCard key={execution.id}>
                <WorkflowHeader>
                  <WorkflowTitle>{execution.workflow_name}</WorkflowTitle>
                </WorkflowHeader>
                
                <WorkflowMeta>
                  📍 {execution.current_step_name} • Started {formatTimeAgo(execution.created_at)}
                </WorkflowMeta>
                
                <ProgressBar>
                  <ProgressFill $percent={execution.progress_percent} />
                </ProgressBar>
                <ProgressText>
                  <span>Step {execution.completed_nodes} of {execution.total_nodes}</span>
                  <span>{execution.progress_percent}% complete</span>
                </ProgressText>
                
                <WorkflowActions>
                  <ResumeButton
                    onClick={() => handleResumeWorkflow(execution)}
                    disabled={resumingId === execution.id}
                  >
                    {resumingId === execution.id ? 'Resuming...' : '▶ Resume'}
                  </ResumeButton>
                </WorkflowActions>
              </WorkflowCard>
            ))}
          </WorkflowGrid>
        )}
      </WorkflowsSection>

      {/* Stats Cards */}
      {actionItemCounts && (
        <StatsGrid>
          <StatCard $variant="danger">
            <StatValue>{actionItemCounts.overdue}</StatValue>
            <StatLabel>Overdue</StatLabel>
          </StatCard>
          <StatCard $variant="warning">
            <StatValue>{actionItemCounts.due_today}</StatValue>
            <StatLabel>Due Today</StatLabel>
          </StatCard>
          <StatCard $variant="info">
            <StatValue>{actionItemCounts.due_this_week}</StatValue>
            <StatLabel>Due This Week</StatLabel>
          </StatCard>
          <StatCard $variant="danger">
            <StatValue>{riskStats.count}</StatValue>
            <StatLabel>At Risk (≤2 days &gt;= $10k)</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>
              {riskStats.totalValue > 0 ? `$${riskStats.totalValue.toLocaleString()}` : '$0'}
            </StatValue>
            <StatLabel>At Risk Value</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{actionItemCounts.total}</StatValue>
            <StatLabel>Total Tasks</StatLabel>
          </StatCard>
        </StatsGrid>
      )}

      {/* Filters */}
      <FiltersBar>
        <FilterGroup>
          <FilterLabel>Priority:</FilterLabel>
          <FilterSelect
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </FilterSelect>
        </FilterGroup>

        <FilterGroup>
          <FilterLabel>Status:</FilterLabel>
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All Status</option>
            <option value="action_needed">Action Needed</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="overdue">Overdue Only</option>
          </FilterSelect>
        </FilterGroup>

        <FilterGroup>
          <FilterLabel>Sort By:</FilterLabel>
          <FilterSelect
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'smart' | 'due_date' | 'priority' | 'form')}
          >
            <option value="smart">Urgency × Value (Recommended)</option>
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
            <option value="form">Form Name</option>
          </FilterSelect>
        </FilterGroup>

        <SearchInput
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </FiltersBar>

      {/* Task List */}
      {filteredItems.length === 0 ? (
        <EmptyState>
          <EmptyIcon>✅</EmptyIcon>
          <EmptyTitle>
            {actionItems.length === 0 ? 'No tasks assigned' : 'No tasks match your filters'}
          </EmptyTitle>
          <EmptyText>
            {actionItems.length === 0
              ? 'You\'re all caught up! New tasks will appear here when assigned.'
              : 'Try adjusting your filters to see more tasks.'}
          </EmptyText>
        </EmptyState>
      ) : (
        <TaskList>
          {filteredItems.map((item) => {
            const itemIsAtRisk = isAtRisk(item);
            return (
              <TaskCard
                key={item.id}
                $priority={item.priority}
                $isOverdue={item.is_overdue}
                $isAtRisk={itemIsAtRisk}
                onClick={() => handleTaskClick(item)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && handleTaskClick(item)}
              >
                <TaskContent>
                  <TaskTitle>{item.title}</TaskTitle>
                  {item.description && (
                    <TaskDescription>{item.description}</TaskDescription>
                  )}
                  <TaskMeta>
                    {item.form_name && (
                      <TaskMetaItem>
                        📋 {item.form_name}
                        {item.step_name && ` → ${item.step_name}`}
                      </TaskMetaItem>
                    )}
                    <TaskMetaItem>
                      📅 {formatDueDate(item.due_date)}
                    </TaskMetaItem>
                    {typeof item.related_po_value === 'number' && (
                      <TaskMetaItem>
                        💰 {item.related_po_currency || 'USD'} {item.related_po_value.toLocaleString()}
                      </TaskMetaItem>
                    )}
                    <PriorityBadge $priority={item.priority}>
                      {item.priority}
                    </PriorityBadge>
                    {item.is_overdue && (
                      <OverdueBadge>Overdue</OverdueBadge>
                    )}
                    {itemIsAtRisk && (
                      <AtRiskBadge>⚠️ At Risk</AtRiskBadge>
                    )}
                  </TaskMeta>
                </TaskContent>
                <TaskActions onClick={(e) => e.stopPropagation()}>
                  <SecondaryButton onClick={(e) => handleDelegateClick(e, item)}>
                    Delegate
                  </SecondaryButton>
                  <ActionButton onClick={() => handleTaskClick(item)}>
                    Open
                  </ActionButton>
                </TaskActions>
              </TaskCard>
            );
          })}
        </TaskList>
      )}
      
      {/* Delegation History Toggle */}
      <HistoryToggle onClick={() => setShowDelegationHistory(!showDelegationHistory)}>
        {showDelegationHistory ? '▼' : '▶'} Delegation History ({delegationHistory.length})
      </HistoryToggle>
      
      {/* Delegation History Panel */}
      <HistoryContainer $isOpen={showDelegationHistory}>
        <DelegationHistory
          delegations={delegationHistory}
          onRevoke={handleRevokeDelegation}
          currentUserId="current"
        />
      </HistoryContainer>
      
      {/* Delegate Task Modal */}
      <DelegateTaskModal
        isOpen={showDelegateModal}
        onClose={() => {
          setShowDelegateModal(false);
          setSelectedTask(null);
        }}
        onDelegate={handleDelegate}
        taskName={selectedTask?.title || ''}
        availableUsers={availableUsers}
        isLoading={isDelegating}
      />
    </Container>
  );
};

export default MyTasks;
