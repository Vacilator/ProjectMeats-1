/**
 * Forms & Flows Catalog Page
 *
 * Browse, create, and manage form flows.
 * Phase 4.1.1: Enhanced Catalog with "Create New" flow
 * Phase 5: Tabbed View ("Logic" vs "Data")
 *
 * Created: 2026-02-03
 * Updated: 2026-02-25 - Phase 5 Management UI
 *
 * Features:
 * - Browse existing forms/workflows
 * - Tabbed view: "Workflows" (Logic) and "Forms" (Data Capture)
 * - Create new from template OR blank canvas
 * - Search and filter
 * - Category organization
 * - Edit, clone, delete actions
 */
import React, { useCallback, useState } from 'react';
import { logger } from '@/utils/logger';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { showAlert } from '@/utils/uiDialogs';
import { getWorkformsErrorUi } from '@/features/workforms/workformsErrors';
import { ApiErrorContent } from '@/components/errors/ApiErrorContent';
import { formatDateLocal } from '@/utils/formatters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import {
  Plus,
  Search,
  Grid,
  List,
  Sparkles,
  FileText,
  Workflow,
  Clock,
  Star,
  Lock,
  Boxes,
  Database,
  Play,
  Loader,
  Trash2,
} from 'lucide-react';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TemplateSelector } from '../../components/FlowEditor/templates/TemplateSelector';
import { FLOW_TEMPLATES, FlowTemplate } from '../../components/FlowEditor/templates/flowTemplates';
import { createFormSubmission, getAvailableWorkForms } from '../../services/workformsApi';
import { deleteWorkflow } from '../../components/FlowEditor/utils/workflowPersistence';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import { Popconfirm } from 'antd';
import { quickActionsService } from '@/services/quickActionsService';
import { useWorkFormPermissions, getUpgradeMessage } from '../../hooks/useWorkFormPermissions';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface CatalogItem {
  id: string;
  kind?: 'form' | 'workform';
  name: string;
  description: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';

  // Legacy form fields (may be absent for TenantWorkForm list items)
  icon?: string;
  entity_count?: number;
  is_multi_entity?: boolean;
  is_system_template?: boolean;
  created_at: string;
  updated_at: string;
  flow_data?: any;

  // TenantWorkForm list fields
  node_count?: number;
  edge_count?: number;
  execution_count?: number;
  last_executed_at?: string;
  version?: number;

  // Experimental UI filters (not available on TenantWorkForm list response yet)
  protein_type?: string;
  department?: string;
  can_quick_run?: boolean;
}

type ViewMode = 'grid' | 'list';
type FilterOption = 'all' | 'active' | 'draft' | 'recent' | 'favorites';
type TabOption = 'workflows' | 'forms' | 'templates';
type ProteinType = 'all' | 'beef' | 'pork' | 'poultry' | 'seafood' | 'lamb' | 'other';
type Department = 'all' | 'receiving' | 'processing' | 'packaging' | 'quality_control' | 'shipping';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled(PageContainer)`
  /* Additional catalog-specific styling */
`;

const ActionRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
`;

const IconActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  cursor: pointer;

  &:hover {
    border-color: rgb(var(--color-primary));
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`;

const SearchBar = styled.div`
  position: relative;
  flex: 1;
  max-width: 400px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.625rem 1rem 0.625rem 2.5rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-muted));
  }
`;

const SearchIconWrapper = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-text-muted));
  pointer-events: none;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid rgb(var(--color-border));
  margin-bottom: 1.5rem;
`;

const Tab = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  background: transparent;
  color: ${(props) =>
    props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;

  ${(props) =>
    props.$active &&
    `
    border-bottom-color: rgb(var(--color-primary));
  `}

  &:hover {
    color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.05);
  }

  svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`;

const TabBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.375rem;
  height: 1.375rem;
  padding: 0 0.375rem;
  border-radius: var(--radius-full);
  background: rgb(var(--color-primary) / 0.15);
  color: rgb(var(--color-primary));
  font-size: 0.6875rem;
  font-weight: 600;
`;

const FilterChip = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: 1px solid
    ${(props) => (props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))')};
  background: ${(props) => (props.$active ? 'rgb(var(--color-primary) / 0.10)' : 'transparent')};
  color: ${(props) =>
    props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.05);
  }

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const ViewToggle = styled.div`
  display: flex;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
`;

const ViewButton = styled.button<{ $active?: boolean }>`
  padding: 0.5rem 0.75rem;
  background: ${(props) => (props.$active ? 'rgb(var(--color-primary) / 0.10)' : 'transparent')};
  color: ${(props) =>
    props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:not(:last-child) {
    border-right: 1px solid rgb(var(--color-border));
  }

  &:hover {
    background: rgb(var(--color-primary) / 0.05);
  }

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

// NEW: Category filter bar for protein type and department
const CategoryBar = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
`;

const CategoryLabel = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  min-width: 80px;
`;

const CategorySelect = styled.select`
  padding: 0.5rem 1rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
`;

// NEW: Quick Run button for instant workflow execution
const QuickRunButton = styled.button<{ $isRunning?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${(props) =>
    props.$isRunning ? 'rgba(var(--color-warning), 0.10)' : 'rgba(var(--color-success), 0.12)'};
  color: ${(props) => (props.$isRunning ? 'rgb(var(--color-warning))' : 'rgb(var(--color-success))')};
  border: 1px solid
    ${(props) =>
      props.$isRunning ? 'rgba(var(--color-warning), 0.35)' : 'rgba(var(--color-success), 0.35)'};
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: ${(props) => (props.$isRunning ? 'wait' : 'pointer')};
  transition: all 0.2s;
  opacity: ${(props) => (props.$isRunning ? 0.7 : 1)};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgb(var(--color-success) / 0.18);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 1rem;
    height: 1rem;
    ${(props) =>
      props.$isRunning &&
      `
      animation: spin 1s linear infinite;
    `}
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgb(var(--color-text-primary) / 0.1);
  }
`;

const FormCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
`;

const FormIcon = styled.div`
  font-size: 2rem;
`;

const FormInfo = styled.div`
  flex: 1;
`;

const FormTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.25rem 0;
`;

const FormDescription = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
`;

const FormMeta = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: rgb(var(--color-text-muted));
  margin-top: 1rem;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${(props) => {
    switch (props.$status) {
      case 'active':
        return 'rgba(var(--color-success), 0.10)';
      case 'draft':
        return 'rgba(var(--color-warning), 0.10)';
      case 'archived':
      case 'inactive':
        return 'rgb(var(--color-text-muted) / 0.10)';
      default:
        return 'rgb(var(--color-text-muted) / 0.10)';
    }
  }};
  color: ${(props) => {
    switch (props.$status) {
      case 'active':
        return 'rgb(var(--color-success))';
      case 'draft':
        return 'rgb(var(--color-warning))';
      case 'archived':
      case 'inactive':
        return 'rgb(var(--color-text-muted))';
      default:
        return 'rgb(var(--color-text-muted))';
    }
  }};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: rgb(var(--color-text-secondary));
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.3;
`;

const EmptyStateTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: rgb(var(--color-text-primary));
`;

const EmptyStateDescription = styled.p`
  font-size: 1rem;
  max-width: 500px;
  margin: 0 auto 1.5rem auto;
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem;
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Component
// ============================================================================

const FormsFlowsCatalog: React.FC = () => {
  useDocumentTitle('WorkForms');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [activeTab, setActiveTab] = useState<TabOption>('workflows');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  // (Preview modal removed)
  const [proteinTypeFilter, setProteinTypeFilter] = useState<ProteinType>('all'); // NEW
  const [departmentFilter, setDepartmentFilter] = useState<Department>('all'); // NEW
  const [isQuickRunning, setIsQuickRunning] = useState<string | null>(null); // NEW: Track running workflow ID

  const handleTemplateSelectorClose = useCallback(() => {
    setShowTemplateSelector(false);
  }, []);

  // Phase 4.2: Get user permissions
  const { permissions, isLoading: permissionsLoading } = useWorkFormPermissions();
  const queryClient = useQueryClient();
  const { refreshQuickActions } = useQuickActions();

  const deleteWorkFormMutation = useMutation({
    mutationFn: async (workformId: string) => {
      await deleteWorkflow(workformId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: withTenantQueryKey('workforms-catalog-items') });
      await refreshQuickActions();
      showAlert({ type: 'success', title: 'Deleted', content: 'WorkForm deleted successfully.' });
    },
    onError: (error: any) => {
      const ui = getWorkformsErrorUi(error, 'catalog.delete');
      showAlert({
        type: 'error',
        title: ui.title,
        content: <ApiErrorContent error={error} fallbackMessage={ui.message} />,
      });
    },
  });

  // Fetch existing items:
  // - WorkForms: TenantWorkForm (new editor)
  // - Forms: legacy TenantForm (data-capture forms)
  const {
    data: forms = [],
    isLoading,
    error,
    refetch,
  } = useQuery<CatalogItem[]>({
    queryKey: withTenantQueryKey('workforms-catalog-items'),
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      const [workformsResult, targetsResult] = await Promise.allSettled([
        getAvailableWorkForms(),
        quickActionsService.getAvailableForms(),
      ]);

      const bothFailed = workformsResult.status === 'rejected' && targetsResult.status === 'rejected';

      const workforms = workformsResult.status === 'fulfilled' ? workformsResult.value : [];
      if (workformsResult.status === 'rejected') {
        logger.error('[Catalog] Error fetching workforms:', workformsResult.reason);
      }

      const targets = targetsResult.status === 'fulfilled' ? targetsResult.value : [];
      if (targetsResult.status === 'rejected') {
        logger.error('[Catalog] Error fetching available targets:', targetsResult.reason);
      }

      if (bothFailed) {
        throw (targetsResult.status === 'rejected' ? targetsResult.reason : workformsResult.reason) ?? new Error('Failed to load catalog');
      }

      const mappedWorkforms: CatalogItem[] = (workforms || []).map((wf) => {
        const anyWf = wf as any;
        const updated = String(anyWf.updated_at ?? nowIso);
        const created = String(anyWf.created_at ?? updated);

        return {
          id: String(anyWf.id),
          kind: 'workform',
          name: String(anyWf.name ?? 'Untitled WorkForm'),
          description: String(anyWf.description ?? ''),
          status: (anyWf.status as CatalogItem['status']) ?? 'draft',
          icon: '🧩',
          node_count: typeof anyWf.node_count === 'number' ? anyWf.node_count : undefined,
          edge_count: typeof anyWf.edge_count === 'number' ? anyWf.edge_count : undefined,
          execution_count: typeof anyWf.execution_count === 'number' ? anyWf.execution_count : undefined,
          last_executed_at: anyWf.last_executed_at ? String(anyWf.last_executed_at) : undefined,
          version: typeof anyWf.version === 'number' ? anyWf.version : undefined,
          entity_count: typeof anyWf.node_count === 'number' ? anyWf.node_count : 0,
          is_multi_entity: true,
          is_system_template: false,
          created_at: created,
          updated_at: updated,
        };
      });

      const mappedTargets: CatalogItem[] = (Array.isArray(targets) ? targets : []).map((t: any) => {
        const updated = String(t.updated_at ?? nowIso);
        const created = String(t.created_at ?? updated);
        const isWorkform = t.type === 'workflow';

        return {
          id: String(t.id),
          kind: isWorkform ? 'workform' : 'form',
          name: String(t.name ?? (isWorkform ? 'Untitled WorkForm' : 'Untitled Form')),
          description: String(t.description ?? ''),
          status: (t.status as CatalogItem['status']) ?? 'draft',
          icon: t.icon || (isWorkform ? '🧩' : '📋'),
          entity_count: typeof t.entity_count === 'number' ? t.entity_count : 1,
          is_multi_entity: Boolean(t.is_multi_entity),
          is_system_template: Boolean(t.is_system_template),
          node_count: typeof t.node_count === 'number' ? t.node_count : undefined,
          created_at: created,
          updated_at: updated,
          flow_data: t.flow_data,
        };
      });

      // De-dupe by kind:id and prefer the richer /tenant-workforms/ payload when available.
      const byKey = new Map<string, CatalogItem>();
      for (const item of mappedTargets) {
        byKey.set(`${item.kind}:${item.id}`, item);
      }
      for (const wf of mappedWorkforms) {
        byKey.set(`workform:${wf.id}`, { ...byKey.get(`workform:${wf.id}`), ...wf });
      }

      const combined = Array.from(byKey.values());
      combined.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return combined;
    },
  });

  // Log error if query failed
  React.useEffect(() => {
    if (error) {
      logger.error('[Catalog] Query error:', error);
    }
  }, [error]);

  // Helper to determine if an item should be classified as a Workflow (Logic)
  const isWorkflow = React.useCallback((form: CatalogItem) => {
    // Explicit kind overrides (Catalog merges legacy forms + WorkForms).
    if (form.kind === 'workform') return true;
    if (form.kind === 'form') return false;

    // Legacy heuristics (kept for backward compatibility).
    if (form.is_multi_entity) return true;
    if (form.entity_count && form.entity_count > 1) return true;

    if (form.flow_data?.nodes && Array.isArray(form.flow_data.nodes)) {
      const hasAdvancedNodes = form.flow_data.nodes.some(
        (n: any) =>
          n.type === 'formProcessGroup' ||
          n.type === 'formProcess' ||
          n.type === 'formMultiStepContainer' ||
          n.type === 'conditionIf' ||
          n.type === 'conditionSwitch' ||
          (n.type && n.type.startsWith('action')) ||
          (n.type && n.type.startsWith('trigger') && n.type !== 'triggerManual') ||
          (n.type && n.type.startsWith('document'))
      );
      if (hasAdvancedNodes) return true;
    }

    return false;
  }, []);

  // Filter forms based on search, filter, and tab
  const filteredForms = React.useMemo(() => {
    // Safety check: ensure forms is an array
    if (!forms || !Array.isArray(forms)) {
      logger.warn('[Catalog] Forms is not an array', { component: 'Catalog', metadata: { forms, isLoading } });
      return [];
    }

    let filtered = forms;

    // Apply tab filter first
    if (activeTab === 'workflows') {
      // Workflows: Forms with logic/automation nodes or multi-step containers
      filtered = filtered.filter((form) => !form.is_system_template && isWorkflow(form));
    } else if (activeTab === 'forms') {
      // Forms: Simple single-step data capture forms
      filtered = filtered.filter((form) => !form.is_system_template && !isWorkflow(form));
    } else if (activeTab === 'templates') {
      return [];
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (form) =>
          form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          form.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // NEW: Apply protein type filter
    if (proteinTypeFilter !== 'all') {
      filtered = filtered.filter((form) => form.protein_type === proteinTypeFilter);
    }

    // NEW: Apply department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter((form) => form.department === departmentFilter);
    }

    // Apply status filter
    if (filter !== 'all') {
      if (filter === 'active') {
        filtered = filtered.filter((form) => form.status === 'active');
      } else if (filter === 'draft') {
        filtered = filtered.filter((form) => form.status === 'draft');
      } else if (filter === 'recent') {
        // Sort by updated_at and take top 10
        filtered = [...filtered]
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 10);
      }
      // TODO: Implement favorites when backend supports it
    }

    return filtered;
  }, [forms, searchQuery, filter, activeTab, proteinTypeFilter, departmentFilter, isWorkflow]);

  // Count forms by type for tab badges
  const workflowsCount = React.useMemo(() => {
    if (!forms || !Array.isArray(forms)) return 0;
    return forms.filter((f) => !f.is_system_template && isWorkflow(f)).length;
  }, [forms, isWorkflow]);

  const formsCount = React.useMemo(() => {
    if (!forms || !Array.isArray(forms)) return 0;
    return forms.filter((f) => !f.is_system_template && !isWorkflow(f)).length;
  }, [forms, isWorkflow]);

  // Handle template selection
  const handleTemplateSelect = (template: FlowTemplate) => {
    // Navigate to editor with template ID
    navigate(`/workforms/editor?template=${template.id}`);
    setShowTemplateSelector(false);
  };

  // Handle blank canvas
  const handleCreateBlank = () => {
    navigate('/workforms/editor');
  };

  const tabOrder: TabOption[] = ['workflows', 'forms', 'templates'];

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: TabOption) => {
    const idx = tabOrder.indexOf(current);
    if (idx === -1) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveTab(tabOrder[(idx + 1) % tabOrder.length]);
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveTab(tabOrder[(idx - 1 + tabOrder.length) % tabOrder.length]);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveTab(tabOrder[0]);
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveTab(tabOrder[tabOrder.length - 1]);
    }
  };

  // NEW: Handle Quick Run (one-click execution)
  const handleQuickRun = async (item: CatalogItem, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click from triggering
    setIsQuickRunning(item.id);
    try {
      logger.info('[Catalog] Quick Run initiated:', { id: item.id, kind: item.kind });

      // WorkForms: execute via runtime engine
      if (item.kind === 'workform') {
        navigate(`/workforms/execute/${item.id}`);
        return;
      }

      // Legacy forms: create submission + open runner
      const submission = await createFormSubmission(item.id);
      navigate(`/workforms/in-progress/${submission.id}`);
    } catch (error) {
      logger.error('[Catalog] Quick Run failed:', error);
      const ui = getWorkformsErrorUi(error, 'catalog.start');
      showAlert({
        type: 'error',
        title: ui.title,
        content: <ApiErrorContent error={error} fallbackMessage={ui.message} />,
      });
    } finally {
      setIsQuickRunning(null);
    }
  };

  // Open a workform in the editor
  const handleEditForm = async (form: CatalogItem) => {
    // WorkForms: open in editor
    if (form.kind === 'workform') {
      navigate(`/workforms/editor/${form.id}`);
      return;
    }

    // Legacy forms: start a submission and take user to the in-progress runner
    if (form.status === 'inactive' || form.status === 'archived') {
      showAlert({
        type: 'warning',
        title: 'Form unavailable',
        content: 'This form is not active and cannot be started.',
      });
      return;
    }

    try {
      const submission = await createFormSubmission(form.id);
      navigate(`/workforms/in-progress/${submission.id}`);
    } catch (error) {
      logger.error('[Catalog] Failed to start form submission', error);
      const ui = getWorkformsErrorUi(error, 'catalog.start');
      showAlert({
        type: 'error',
        title: ui.title,
        content: <ApiErrorContent error={error} fallbackMessage={ui.message} />,
      });
    }
  };

  const catalogErrorUi = error ? getWorkformsErrorUi(error, 'catalog.load') : null;

  return (
    <Container data-testid="workforms-catalog-page">
      <Header>
        <Title>WorkForms Catalog</Title>
        <HeaderActions>
          <SearchBar>
            <SearchIconWrapper>
              <Search size={16} />
            </SearchIconWrapper>
            <SearchInput
              data-testid="workforms-catalog-search"
              type="text"
              placeholder="Search WorkForms and forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchBar>
          <Button
            variant="primary"
            onClick={() => setShowTemplateSelector(true)}
            disabled={!permissions.can_create || permissionsLoading}
            title={
              !permissions.can_create
                ? getUpgradeMessage('create', permissions.role)
                : 'Create a new form or WorkForm'
            }
          >
            {!permissions.can_create && <Lock size={16} style={{ marginRight: '0.5rem' }} />}
            <Plus size={18} />
            Create New
          </Button>
        </HeaderActions>
      </Header>

      {/* Phase 5: Tabbed View - Logic vs Data + Templates (Phase 2.2) */}
      <TabsContainer role="tablist" aria-label="Catalog tabs">
        <Tab
          type="button"
          role="tab"
          data-testid="workforms-catalog-tab-workflows"
          $active={activeTab === 'workflows'}
          aria-selected={activeTab === 'workflows'}
          tabIndex={activeTab === 'workflows' ? 0 : -1}
          onClick={() => setActiveTab('workflows')}
          onKeyDown={(e) => handleTabKeyDown(e, 'workflows')}
        >
          <Workflow size={18} />
          WorkForms (Automation)
          {workflowsCount > 0 && <TabBadge>{workflowsCount}</TabBadge>}
        </Tab>
        <Tab
          type="button"
          role="tab"
          data-testid="workforms-catalog-tab-forms"
          $active={activeTab === 'forms'}
          aria-selected={activeTab === 'forms'}
          tabIndex={activeTab === 'forms' ? 0 : -1}
          onClick={() => setActiveTab('forms')}
          onKeyDown={(e) => handleTabKeyDown(e, 'forms')}
        >
          <Database size={18} />
          Forms (Data)
          {formsCount > 0 && <TabBadge>{formsCount}</TabBadge>}
        </Tab>
        <Tab
          type="button"
          role="tab"
          data-testid="workforms-catalog-tab-templates"
          $active={activeTab === 'templates'}
          aria-selected={activeTab === 'templates'}
          tabIndex={activeTab === 'templates' ? 0 : -1}
          onClick={() => setActiveTab('templates')}
          onKeyDown={(e) => handleTabKeyDown(e, 'templates')}
        >
          <Boxes size={18} />
          Industry Templates
          <TabBadge style={{ background: 'rgb(var(--color-success))' }}>{FLOW_TEMPLATES.length}</TabBadge>
        </Tab>
      </TabsContainer>

      {catalogErrorUi && !isLoading && forms.length === 0 ? (
        <EmptyState role="status" aria-live="polite">
          <EmptyStateIcon aria-hidden="true">⚠️</EmptyStateIcon>
          <EmptyStateTitle>{catalogErrorUi.title}</EmptyStateTitle>
          <EmptyStateDescription>
            <ApiErrorContent error={error} fallbackMessage={catalogErrorUi.message} variant="inline" />
          </EmptyStateDescription>
          <Button variant="primary" onClick={() => void refetch()}>
            Try again
          </Button>
        </EmptyState>
      ) : activeTab !== 'templates' && (
        <>
          {/* NEW: Category Filters for Protein Type and Department */}
          <CategoryBar>
            <CategoryLabel>Protein Type:</CategoryLabel>
            <CategorySelect
              value={proteinTypeFilter}
              onChange={(e) => setProteinTypeFilter(e.target.value as ProteinType)}
            >
              <option value="all">All Types</option>
              <option value="beef">🥩 Beef</option>
              <option value="pork">🐖 Pork</option>
              <option value="poultry">🐔 Poultry</option>
              <option value="seafood">🐟 Seafood</option>
              <option value="lamb">🐑 Lamb</option>
              <option value="other">🥓 Other</option>
            </CategorySelect>

            <CategoryLabel>Department:</CategoryLabel>
            <CategorySelect
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value as Department)}
            >
              <option value="all">All Departments</option>
              <option value="receiving">📦 Receiving</option>
              <option value="processing">⚙️ Processing</option>
              <option value="packaging">📦 Packaging</option>
              <option value="quality_control">✅ Quality Control</option>
              <option value="shipping">🚚 Shipping</option>
            </CategorySelect>
          </CategoryBar>

          <FilterBar>
            <FilterChip $active={filter === 'all'} onClick={() => setFilter('all')}>
              All Forms
            </FilterChip>
            <FilterChip $active={filter === 'active'} onClick={() => setFilter('active')}>
              <Sparkles size={14} />
              Active
            </FilterChip>
            <FilterChip $active={filter === 'draft'} onClick={() => setFilter('draft')}>
              <FileText size={14} />
              Drafts
            </FilterChip>
            <FilterChip $active={filter === 'recent'} onClick={() => setFilter('recent')}>
              <Clock size={14} />
              Recent
            </FilterChip>

            <div style={{ marginLeft: 'auto' }}>
              <ViewToggle>
                <ViewButton
                  $active={viewMode === 'grid'}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  <Grid />
                </ViewButton>
                <ViewButton
                  $active={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  <List />
                </ViewButton>
              </ViewToggle>
            </div>
          </FilterBar>
        </>
      )}

      {activeTab === 'templates' ? (
        (() => {
          const filteredTemplates = FLOW_TEMPLATES.filter((t) => {
            const q = searchQuery.trim().toLowerCase();
            if (!q) return true;
            return (
              t.name.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q) ||
              t.tags.some((tag) => tag.toLowerCase().includes(q))
            );
          });

          if (filteredTemplates.length === 0) {
            return (
              <EmptyState>
                <EmptyStateIcon>📦</EmptyStateIcon>
                <EmptyStateTitle>No templates found</EmptyStateTitle>
                <EmptyStateDescription>Try adjusting your search</EmptyStateDescription>
              </EmptyState>
            );
          }

          return (
            <GridContainer>
              {filteredTemplates.map((template) => (
                <FormCard key={template.id}>
                  <CardContent
                    role="button"
                    tabIndex={0}
                    onClick={() => handleTemplateSelect(template)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTemplateSelect(template);
                      }
                    }}
                    aria-label={`Use template: ${template.name}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <FormCardHeader>
                      <FormIcon>{template.thumbnail || '📋'}</FormIcon>
                      <FormInfo>
                        <FormTitle>{template.name}</FormTitle>
                        <FormDescription>{template.description || 'No description'}</FormDescription>
                      </FormInfo>
                    </FormCardHeader>
                    <FormMeta>
                      <MetaItem>
                        <Boxes size={14} />
                        {template.category}
                      </MetaItem>
                      <MetaItem>
                        <Star size={14} />
                        {template.difficulty}
                      </MetaItem>
                    </FormMeta>
                  </CardContent>
                </FormCard>
              ))}
            </GridContainer>
          );
        })()
      ) : isLoading ? (
        <LoadingState>Loading forms...</LoadingState>
      ) : filteredForms.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon>📋</EmptyStateIcon>
          <EmptyStateTitle>
            {searchQuery || filter !== 'all' ? 'No forms found' : 'No forms yet'}
          </EmptyStateTitle>
          <EmptyStateDescription>
            {searchQuery || filter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first form or workflow'}
          </EmptyStateDescription>
          {!searchQuery && filter === 'all' && (
            <Button variant="primary" onClick={() => setShowTemplateSelector(true)}>
              <Plus size={18} />
              Create Your First Form
            </Button>
          )}
        </EmptyState>
      ) : viewMode === 'grid' ? (
        <GridContainer>
          {filteredForms.map((form) => {
            const isWorkform = form.kind === 'workform';

            return (
              <FormCard
                key={form.id}
                data-testid="workforms-catalog-item"
                data-item-id={form.id}
                data-kind={form.kind ?? (isWorkform ? 'workform' : 'form')}
              >
                <CardContent
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleEditForm(form)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleEditForm(form);
                    }
                  }}
                  aria-label={`Open ${form.name}`}
                  style={{ cursor: 'pointer' }}
                >
                  <FormCardHeader>
                    <FormIcon>{form.icon || '📋'}</FormIcon>
                    <FormInfo>
                      <FormTitle data-testid="workforms-catalog-item-name">{form.name}</FormTitle>
                      <FormDescription>{form.description || 'No description'}</FormDescription>
                    </FormInfo>
                  </FormCardHeader>
                  <FormMeta>
                    <MetaItem>
                      <Workflow size={14} />
                      {typeof form.node_count === 'number' ? form.node_count : form.entity_count || 0}{' '}
                      {typeof form.node_count === 'number'
                        ? form.node_count === 1
                          ? 'node'
                          : 'nodes'
                        : (form.entity_count || 0) === 1
                          ? 'step'
                          : 'steps'}
                    </MetaItem>
                    <MetaItem>
                      <Clock size={14} />
                      {formatDateLocal(form.updated_at)}
                    </MetaItem>
                    <StatusBadge $status={form.status}>{form.status}</StatusBadge>
                  </FormMeta>

                  {/* Execute / Quick Run (WorkForms always show Execute when active; legacy forms gate on can_quick_run) */}
                  {form.status === 'active' && (form.can_quick_run || isWorkform) && (
                    <div style={{ marginTop: '1rem' }}>
                      <QuickRunButton
                        data-testid="workforms-catalog-item-execute"
                        $isRunning={isQuickRunning === form.id}
                        onClick={(e) => handleQuickRun(form, e)}
                        disabled={isQuickRunning === form.id}
                        title={isWorkform ? 'Run this WorkForm' : 'Start this form'}
                      >
                        {isQuickRunning === form.id ? (
                          <>
                            <Loader size={16} />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play size={16} />
                            {isWorkform ? 'Run' : 'Start'}
                          </>
                        )}
                      </QuickRunButton>
                    </div>
                  )}

                  {/* Delete (WorkForms only) */}
                  {isWorkform && permissions.can_delete && form.status !== 'active' && (
                    <ActionRow>
                      <Popconfirm
                        title="Delete this WorkForm?"
                        description="This will permanently delete the WorkForm and any extracted forms."
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteWorkFormMutation.mutate(form.id)}
                      >
                        <IconActionButton
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          disabled={deleteWorkFormMutation.isPending}
                          aria-label={`Delete ${form.name}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Delete
                        </IconActionButton>
                      </Popconfirm>
                    </ActionRow>
                  )}
                </CardContent>
              </FormCard>
            );
          })}
        </GridContainer>
      ) : (
        <ListContainer>
          {filteredForms.map((form) => {
            const isWorkform = form.kind === 'workform';

            return (
              <FormCard
                key={form.id}
                data-testid="workforms-catalog-item"
                data-item-id={form.id}
                data-kind={form.kind ?? (isWorkform ? 'workform' : 'form')}
              >
                <CardContent
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    void handleEditForm(form);
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleEditForm(form);
                    }
                  }}
                  aria-label={`Open ${form.name}`}
                  style={{ cursor: 'pointer' }}
                >
                  <FormCardHeader>
                    <FormIcon>{form.icon || '📋'}</FormIcon>
                    <FormInfo>
                      <FormTitle data-testid="workforms-catalog-item-name">{form.name}</FormTitle>
                      <FormDescription>{form.description || 'No description'}</FormDescription>
                    </FormInfo>
                    <FormMeta>
                      <MetaItem>
                        <Workflow size={14} />
                        {typeof form.node_count === 'number' ? form.node_count : form.entity_count || 0}{' '}
                        {typeof form.node_count === 'number'
                          ? form.node_count === 1
                            ? 'node'
                            : 'nodes'
                          : (form.entity_count || 0) === 1
                            ? 'step'
                            : 'steps'}
                      </MetaItem>
                      <MetaItem>
                        <Clock size={14} />
                        {formatDateLocal(form.updated_at)}
                      </MetaItem>
                      <StatusBadge $status={form.status}>{form.status}</StatusBadge>
                    </FormMeta>
                  </FormCardHeader>

                  {/* Execute / Quick Run (WorkForms always show Execute when active; legacy forms gate on can_quick_run) */}
                  {form.status === 'active' && (form.can_quick_run || isWorkform) && (
                    <div style={{ marginTop: '1rem', marginLeft: '4rem' }}>
                      <QuickRunButton
                        data-testid="workforms-catalog-item-execute"
                        $isRunning={isQuickRunning === form.id}
                        onClick={(e) => handleQuickRun(form, e)}
                        disabled={isQuickRunning === form.id}
                        title={isWorkform ? 'Run this WorkForm' : 'Start this form'}
                      >
                        {isQuickRunning === form.id ? (
                          <>
                            <Loader size={16} />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play size={16} />
                            {isWorkform ? 'Run' : 'Start'}
                          </>
                        )}
                      </QuickRunButton>
                    </div>
                  )}

                  {/* Delete (WorkForms only) */}
                  {isWorkform && permissions.can_delete && form.status !== 'active' && (
                    <ActionRow style={{ marginLeft: '4rem' }}>
                      <Popconfirm
                        title="Delete this WorkForm?"
                        description="This will permanently delete the WorkForm and any extracted forms."
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteWorkFormMutation.mutate(form.id)}
                      >
                        <IconActionButton
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          disabled={deleteWorkFormMutation.isPending}
                          aria-label={`Delete ${form.name}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Delete
                        </IconActionButton>
                      </Popconfirm>
                    </ActionRow>
                  )}
                </CardContent>
              </FormCard>
            );
          })}
        </ListContainer>
      )}

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={handleTemplateSelectorClose}
        onSelectTemplate={handleTemplateSelect}
        onStartBlank={handleCreateBlank}
      />
    </Container>
  );
};

export default FormsFlowsCatalog;
