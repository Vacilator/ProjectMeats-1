/**
 * WorkForms Editor Page
 *
 * NOTE (Phase 7 hardening): Saving and loading is now handled via TenantWorkForm
 * endpoints (/api/v1/tenant-workforms/). The legacy /api/v1/workflows/forms/ save
 * endpoint is deprecated and must not be used.
 */

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Node, Edge } from '@xyflow/react';
import { useQuery } from '@tanstack/react-query';
import { Wand2, Eye, Code2, Lock } from 'lucide-react';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { logger } from '@/utils/logger';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { toApiErrorText } from '@/services/apiErrorPresentation';
const UnifiedFlowEditor = lazy(() => import('../../components/FlowEditor/UnifiedFlowEditor').then(m => ({ default: m.UnifiedFlowEditor })));
import { FLOW_TEMPLATES } from '../../components/FlowEditor/templates/flowTemplates';
import {
  useWorkFormPermissions,
  canUseEditorMode,
  getUpgradeMessage,
} from '../../hooks/useWorkFormPermissions';
import {
  loadWorkflow,
  type LoadWorkflowResponse,
} from '../../components/FlowEditor/utils/workflowPersistence';

// ============================================================================
// Types
// ============================================================================

export type EditorMode = 'wizard' | 'visual' | 'expert';

type Viewport = { x: number; y: number; zoom: number };

const isViewport = (value: unknown): value is Viewport => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.x === 'number' && typeof v.y === 'number' && typeof v.zoom === 'number';
};

interface EditorModeConfig {
  id: EditorMode;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
}

const EDITOR_MODES: Record<EditorMode, EditorModeConfig> = {
  wizard: {
    id: 'wizard',
    label: 'Wizard',
    icon: Wand2,
    description: 'Guided form creation with smart defaults',
  },
  visual: {
    id: 'visual',
    label: 'Visual',
    icon: Eye,
    description: 'Drag-and-drop editor with full node palette',
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    icon: Code2,
    description: 'Advanced mode for power users and developers',
  },
};

type WorkFormStatus = 'draft' | 'active' | 'archived';

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  /* Use screen real-estate: header + editor fill the page */
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  height: calc(100vh - 60px);
  min-height: calc(100vh - 60px);
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  /* Keep core controls visible while editing */
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BackButton = styled.button`
  padding: 8px 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-background));
  }
`;

const PageTitle = styled.h1`
  font-size: 20px;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
  margin: 0;
  line-height: 1.2;
`;

const TitleButton = styled.button<{ $readonly?: boolean }>`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: ${(p) => (p.$readonly ? 'default' : 'text')};

  &:hover ${PageTitle} {
    ${(p) => (!p.$readonly ? 'text-decoration: underline; text-decoration-style: dotted;' : '')}
  }
`;

const TitleInput = styled.input`
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
  color: rgb(var(--color-text-primary));

  width: min(520px, 72vw);
  padding: 4px 8px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.16);
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const ModeSwitcher = styled.div`
  display: inline-flex;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
`;

const ModeButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  background: ${p => (p.$active ? 'rgb(var(--color-primary) / 0.12)' : 'rgb(var(--color-surface))')};
  color: ${p => (p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))')};

  &:not(:last-child) {
    border-right: 1px solid rgb(var(--color-border));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const StatusBadge = styled.span<{ $status: WorkFormStatus }>`
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgb(var(--color-border));
  background: ${p =>
    p.$status === 'active'
      ? 'rgba(var(--color-success), 0.10)'
      : p.$status === 'draft'
        ? 'rgba(var(--color-warning), 0.10)'
        : 'rgba(var(--color-text-secondary), 0.10)'};
  color: ${p =>
    p.$status === 'active'
      ? 'rgb(var(--color-success))'
      : p.$status === 'draft'
        ? 'rgb(var(--color-warning))'
        : 'rgb(var(--color-text-secondary))'};
`;

const EditorWrapper = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  border: 1px solid rgb(var(--color-border));

  /* Fill remaining height under sticky header */
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const CenteredNotice = styled.div`
  text-align: center;
  padding: 4rem;
  color: rgb(var(--color-text-secondary));
`;

const ErrorPanel = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
  padding: 18px;
  max-width: 760px;
  margin: 24px auto;
`;

const ErrorTitle = styled.h2`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 800;
  color: rgb(var(--color-text-primary));
`;

const ErrorDetail = styled.pre`
  margin: 0;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ErrorActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  padding: 8px 12px;
  background: rgb(var(--color-primary));
  border: 1px solid rgb(var(--color-primary));
  border-radius: var(--radius-md);
  font-size: 13px;
  color: rgb(var(--color-primary-foreground));
  cursor: pointer;

  &:hover {
    filter: brightness(0.98);
  }
`;

// ============================================================================
// Component
// ============================================================================

export const WorkFormsEditor: React.FC = () => {
  useDocumentTitle('WorkForm Editor');
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const templateId = searchParams.get('template');
  const cloneId = searchParams.get('clone');
  const previewMode = searchParams.get('mode') === 'preview';

  const { permissions, isLoading: permissionsLoading } = useWorkFormPermissions();

  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [flowName, setFlowName] = useState('New WorkForm');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(flowName);
  const [status, setStatus] = useState<WorkFormStatus>('draft');
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [initialWorkflowId, setInitialWorkflowId] = useState<string | undefined>(undefined);
  const [initialViewport, setInitialViewport] = useState<Viewport | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCloneMode, setIsCloneMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Reset initialization when route params change.
  useEffect(() => {
    setIsInitialized(false);
    setHasUnsavedChanges(false);
    setIsCloneMode(false);
  }, [id, templateId, cloneId]);

  const existingWorkFormQuery = useQuery<LoadWorkflowResponse>({
    queryKey: withTenantQueryKey('tenant-workform', id),
    queryFn: async () => {
      if (!id) throw new Error('Missing workflow id');
      return loadWorkflow(id);
    },
    enabled: !!id,
  });

  const cloneWorkFormQuery = useQuery<LoadWorkflowResponse>({
    queryKey: withTenantQueryKey('tenant-workform-clone', cloneId),
    queryFn: async () => {
      if (!cloneId) throw new Error('Missing clone id');
      return loadWorkflow(cloneId);
    },
    enabled: !!cloneId,
  });

  const isLoading = existingWorkFormQuery.isLoading || cloneWorkFormQuery.isLoading;

  const isLoadError = Boolean(
    (id && existingWorkFormQuery.isError) ||
    (cloneId && cloneWorkFormQuery.isError)
  );

  const activeLoadError = cloneId
    ? cloneWorkFormQuery.error
    : existingWorkFormQuery.error;

  const getLoadErrorDetail = useCallback(
    (error: unknown): string => toApiErrorText(error, { fallbackMessage: 'Unknown error' }),
    []
  );

  const handleRetryLoad = useCallback(async () => {
    setIsInitialized(false);
    if (cloneId) {
      await cloneWorkFormQuery.refetch();
      return;
    }
    if (id) {
      await existingWorkFormQuery.refetch();
    }
  }, [cloneId, id, cloneWorkFormQuery, existingWorkFormQuery]);

  // Initialize editor with: clone → existing → template → blank
  useEffect(() => {
    if (isInitialized) return;

    const clone = cloneWorkFormQuery.data;
    if (clone && cloneId) {
      setFlowName(`${clone.name} (Copy)`);
      setStatus('draft');
      setInitialNodes(clone.workflow_definition?.nodes || []);
      setInitialEdges(clone.workflow_definition?.edges || []);
      setInitialViewport(isViewport(clone.workflow_definition?.viewport) ? clone.workflow_definition?.viewport : undefined);
      setInitialWorkflowId(undefined);
      setIsCloneMode(true);
      setIsInitialized(true);
      return;
    }

    const existing = existingWorkFormQuery.data;
    if (existing && id) {
      setFlowName(existing.name);
      setStatus((existing.status as WorkFormStatus) || 'draft');
      setInitialNodes(existing.workflow_definition?.nodes || []);
      setInitialEdges(existing.workflow_definition?.edges || []);
      setInitialViewport(isViewport(existing.workflow_definition?.viewport) ? existing.workflow_definition?.viewport : undefined);
      setInitialWorkflowId(existing.id);
      setIsInitialized(true);
      return;
    }

    if (templateId && !id && !cloneId) {
      const template = FLOW_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        setFlowName(template.name);
        setStatus('draft');
        setInitialNodes(template.nodes);
        setInitialEdges(template.edges);
        setInitialWorkflowId(undefined);
        setIsInitialized(true);
        return;
      }
    }

    if (!id && !templateId && !cloneId) {
      // No forced defaults. Users can start blank or explicitly choose a template.
      setStatus('draft');
      setFlowName('New WorkForm');
      setInitialNodes([]);
      setInitialEdges([]);
      setInitialViewport(undefined);
      setInitialWorkflowId(undefined);
      setIsInitialized(true);
    }
  }, [
    cloneWorkFormQuery.data,
    existingWorkFormQuery.data,
    cloneId,
    id,
    templateId,
    isInitialized,
  ]);

  const handleBack = useCallback(() => {
    navigate('/workforms/catalog');
  }, [navigate]);

  const handleModeSwitch = useCallback((newMode: EditorMode) => {
    setEditorMode(newMode);
  }, []);

  const readOnly = useMemo(() => previewMode || !permissions.can_edit, [previewMode, permissions.can_edit]);

  // Keep draft title synced when flowName updates (load/clone/save).
  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(flowName);
    }
  }, [flowName, isEditingTitle]);

  const commitTitle = useCallback(() => {
    if (readOnly) return;

    const next = draftTitle.trim() || 'Untitled WorkForm';
    setIsEditingTitle(false);

    if (next !== flowName) {
      setFlowName(next);
      setHasUnsavedChanges(true);
    }
  }, [draftTitle, flowName, readOnly]);

  const handleWorkflowSaved = useCallback(
    (workflow: { id: string; name: string; status?: WorkFormStatus }) => {
      setHasUnsavedChanges(false);

      // After create/clone, move URL into edit mode so refresh works.
      if (!id || isCloneMode) {
        setIsCloneMode(false);
        setInitialWorkflowId(workflow.id);
        navigate(`/workforms/editor/${workflow.id}`, { replace: true });
      }

      // Keep header title stable if user saved under a different name inside the editor.
      setFlowName(workflow.name);

      if (workflow.status) {
        setStatus(workflow.status);
      }
    },
    [id, isCloneMode, navigate]
  );

  if ((id || cloneId) && isLoading) {
    return (
      <PageContainer>
        <CenteredNotice>Loading workform...</CenteredNotice>
      </PageContainer>
    );
  }

  if (isLoadError) {
    logger.error('[WorkFormsEditor] Failed to load workflow', activeLoadError);

    return (
      <PageContainer>
        <PageHeader>
          <HeaderLeft>
            <BackButton onClick={handleBack}>← Back</BackButton>
            <PageTitle>WorkForms Editor</PageTitle>
          </HeaderLeft>
        </PageHeader>

        <ErrorPanel role="alert">
          <ErrorTitle>Couldn't load workform</ErrorTitle>
          <ErrorDetail>{getLoadErrorDetail(activeLoadError)}</ErrorDetail>
          <ErrorActions>
            <PrimaryButton onClick={() => void handleRetryLoad()}>Try again</PrimaryButton>
            <BackButton onClick={handleBack}>Back to Catalog</BackButton>
          </ErrorActions>
        </ErrorPanel>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <HeaderLeft>
          <BackButton onClick={handleBack}>← Back</BackButton>
          <div>
            {isEditingTitle && !readOnly ? (
              <TitleInput
                aria-label="Workform title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitTitle();
                  }
                  if (e.key === 'Escape') {
                    setDraftTitle(flowName);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <TitleButton
                type="button"
                $readonly={readOnly}
                onClick={() => {
                  if (readOnly) return;
                  setIsEditingTitle(true);
                  setDraftTitle(flowName);
                }}
                title={readOnly ? undefined : 'Click to rename'}
                aria-label={readOnly ? 'Workform title' : 'Workform title (click to rename)'}
              >
                <PageTitle>{flowName}</PageTitle>
              </TitleButton>
            )}

            <div style={{ fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
              {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved via TenantWorkForms'}
            </div>
          </div>
        </HeaderLeft>

        <HeaderRight>
          <ModeSwitcher>
            {Object.values(EDITOR_MODES).map((mode) => {
              const Icon = mode.icon;
              const isAllowed = canUseEditorMode(permissions, mode.id);
              const isDisabled = !isAllowed || permissionsLoading;
              return (
                <ModeButton
                  key={mode.id}
                  $active={editorMode === mode.id}
                  onClick={() => isAllowed && handleModeSwitch(mode.id)}
                  title={isAllowed ? mode.description : getUpgradeMessage('expert_mode', permissions.role)}
                  disabled={isDisabled}
                >
                  {!isAllowed && <Lock style={{ width: 12, height: 12 }} />}
                  <Icon />
                  <span>{mode.label}</span>
                </ModeButton>
              );
            })}
          </ModeSwitcher>

          <StatusBadge $status={status}>{status}</StatusBadge>
        </HeaderRight>
      </PageHeader>

      <EditorWrapper>
        {isInitialized && !permissionsLoading && (
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: 'rgb(var(--color-text-secondary))' }}>Loading editor…</div>}>
            <UnifiedFlowEditor
              initialNodes={initialNodes}
              initialEdges={initialEdges}
              initialViewport={initialViewport}
              initialWorkflowId={initialWorkflowId}
              initialWorkflowName={flowName}
              initialWorkflowStatus={status}
              onWorkflowSaved={handleWorkflowSaved}
              onChange={() => setHasUnsavedChanges(true)}
              editorMode={editorMode}
              readOnly={readOnly}
              allowedNodeCategories={permissions.allowed_node_categories}
            />
          </Suspense>
        )}
        {permissionsLoading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '400px',
              color: 'rgb(var(--color-text-secondary))',
            }}
          >
            Loading permissions...
          </div>
        )}
      </EditorWrapper>
    </PageContainer>
  );
};

export default WorkFormsEditor;
