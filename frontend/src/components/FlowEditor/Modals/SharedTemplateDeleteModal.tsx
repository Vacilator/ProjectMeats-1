/**
 * SharedTemplateDeleteModal
 * 
 * Phase 6: Ghost Node Cleanup
 * Handles deletion of shared container templates with usage tracking.
 * 
 * Features:
 * - Shows usage count and list of workflows using template
 * - Two deletion modes:
 *   1. "Remove from this workflow" - Decrements usage, keeps template
 *   2. "Delete from library" - Deletes template (only if usage = 0)
 * - Prevents accidental deletion of shared templates
 * - RLS verification (tenant check)
 * 
 * Usage:
 * ```typescript
 * <SharedTemplateDeleteModal
 *   isOpen={showModal}
 *   template={containerNode}
 *   onClose={() => setShowModal(false)}
 *   onRemoveFromWorkflow={(nodeId) => removeNode(nodeId)}
 *   onDeleteFromLibrary={(formId) => deleteForm(formId)}
 * />
 * ```
 * 
 * Created: 2026-02-12 - Phase 6 Ghost Node Cleanup Implementation
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { AlertTriangle, Trash2, XCircle, Loader } from 'lucide-react';
import { notify } from '../../../utils/notify';
import { logger } from '@/utils/logger';
import {
  decrementTenantFormUsage,
  getTenantFormUsageInfo,
} from '../../../services/workformsApi';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ContainerTemplate {
  /** Node ID in workflow */
  nodeId: string;
  
  /** TenantForm ID */
  formId: string;
  
  /** Template/container name */
  name: string;
  
  /** Stored usage count (may be stale) */
  usageCount?: number;
}

export interface SharedTemplateDeleteModalProps {
  /** Modal open state */
  isOpen: boolean;
  
  /** Template to delete */
  template: ContainerTemplate | null;
  
  /** Close handler */
  onClose: () => void;
  
  /** Remove from workflow handler */
  onRemoveFromWorkflow: (nodeId: string) => void;
  
  /** Delete from library handler */
  onDeleteFromLibrary: (formId: string) => Promise<void>;
}

interface UsageInfo {
  form_id: string;
  usage_count: number;
  workflows: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

// ============================================================================
// Styled Components
// ============================================================================

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 60px rgba(var(--color-overlay), 0.3);
  max-width: 600px;
  width: 100%;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  gap: 16px;
`;

const WarningIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-warning) / 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-warning));

  svg {
    width: 24px;
    height: 24px;
  }
`;

const HeaderText = styled.div`
  flex: 1;

  h2 {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: 600;
    color: rgb(var(--color-text-primary));
  }

  p {
    margin: 0;
    font-size: 14px;
    color: rgb(var(--color-text-secondary));
  }
`;

const ModalBody = styled.div`
  padding: 24px;
`;

const InfoSection = styled.div`
  padding: 16px;
  background: rgb(var(--color-surface-hover));
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;

  &:not(:last-child) {
    border-bottom: 1px solid rgb(var(--color-border));
  }
`;

const InfoLabel = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const InfoValue = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const UsageCount = styled.span<{ $count: number }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  background: ${props => props.$count > 0 
    ? 'rgb(var(--color-warning) / 0.2)' 
    : 'rgb(var(--color-success) / 0.2)'};
  color: ${props => props.$count > 0 
    ? 'rgb(var(--color-warning))' 
    : 'rgb(var(--color-success))'};
`;

const WorkflowList = styled.ul`
  list-style: none;
  margin: 16px 0 0 0;
  padding: 0;
`;

const WorkflowItem = styled.li`
  padding: 12px;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .name {
    font-size: 14px;
    color: rgb(var(--color-text-primary));
  }

  .status {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    background: rgb(var(--color-primary) / 0.1);
    color: rgb(var(--color-primary));
    text-transform: uppercase;
  }
`;

const WarningBox = styled.div`
  padding: 16px;
  background: rgb(var(--color-error) / 0.1);
  border: 1px solid rgb(var(--color-error) / 0.3);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
  color: rgb(var(--color-error));

  svg {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 2px;
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
  }
`;

const LoadingState = styled.div`
  padding: 32px;
  text-align: center;
  color: rgb(var(--color-text-secondary));

  svg {
    width: 32px;
    height: 32px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  p {
    margin: 16px 0 0 0;
    font-size: 14px;
  }
`;

const ModalFooter = styled.div`
  padding: 20px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: rgb(var(--color-surface-hover));
`;

const Button = styled.button<{ $variant?: 'primary' | 'danger' | 'ghost' }>`
  height: 40px;
  padding: 0 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  border: none;

  ${props => props.$variant === 'primary' && `
    background: rgb(var(--color-primary));
    color: rgb(var(--color-text-inverse));

    &:hover:not(:disabled) {
      background: rgb(var(--color-primary-hover));
    }
  `}

  ${props => props.$variant === 'danger' && `
    background: rgb(var(--color-error));
    color: rgb(var(--color-text-inverse));

    &:hover:not(:disabled) {
      background: rgb(var(--color-error-hover));
    }
  `}

  ${props => props.$variant === 'ghost' && `
    background: transparent;
    color: rgb(var(--color-text-secondary));

    &:hover:not(:disabled) {
      background: rgb(var(--color-surface));
      color: rgb(var(--color-text-primary));
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

// ============================================================================
// Main Component
// ============================================================================

export const SharedTemplateDeleteModal: React.FC<SharedTemplateDeleteModalProps> = ({
  isOpen,
  template,
  onClose,
  onRemoveFromWorkflow,
  onDeleteFromLibrary,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch usage info when modal opens
  useEffect(() => {
    if (isOpen && template) {
      fetchUsageInfo();
    }
  }, [isOpen, template]);

  const fetchUsageInfo = async () => {
    if (!template) return;

    setIsLoading(true);
    try {
      const data = await getTenantFormUsageInfo(template.formId);
      setUsageInfo(data);
    } catch (error) {
      logger.error('[SharedTemplateDeleteModal] Failed to fetch usage info:', error);
      notify.error('Failed to load template usage information');
      setUsageInfo({
        form_id: template.formId,
        usage_count: template.usageCount || 0,
        workflows: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromWorkflow = async () => {
    if (!template) return;

    try {
      // Decrement usage count on backend
      await decrementTenantFormUsage(template.formId);
      
      // Remove node from workflow
      onRemoveFromWorkflow(template.nodeId);
      notify.success('Container removed from workflow');
      onClose();
    } catch (error) {
      logger.error('[SharedTemplateDeleteModal] Failed to remove container:', error);
      notify.error('Failed to remove container from workflow');
    }
  };

  const handleDeleteFromLibrary = async () => {
    if (!template || !usageInfo) return;

    if (usageInfo.usage_count > 0) {
      notify.error(`Cannot delete: Used by ${usageInfo.usage_count} workflow(s)`);
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteFromLibrary(template.formId);
      notify.success('Template deleted from library');
      onClose();
    } catch (error) {
      logger.error('[SharedTemplateDeleteModal] Failed to delete template:', error);
      notify.error('Failed to delete template from library');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !template) return null;

  const modalContent = (
    <ModalOverlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <WarningIcon>
            <AlertTriangle />
          </WarningIcon>
          <HeaderText>
            <h2>Delete Container Template?</h2>
            <p>{template.name}</p>
          </HeaderText>
        </ModalHeader>

        <ModalBody>
          {isLoading ? (
            <LoadingState>
              <Loader />
              <p>Loading usage information...</p>
            </LoadingState>
          ) : usageInfo ? (
            <>
              <InfoSection>
                <InfoRow>
                  <InfoLabel>Template Name</InfoLabel>
                  <InfoValue>{template.name}</InfoValue>
                </InfoRow>
                <InfoRow>
                  <InfoLabel>Used in workflows</InfoLabel>
                  <UsageCount $count={usageInfo.usage_count}>
                    {usageInfo.usage_count} workflow{usageInfo.usage_count !== 1 ? 's' : ''}
                  </UsageCount>
                </InfoRow>
              </InfoSection>

              {usageInfo.usage_count > 0 && (
                <>
                  <WarningBox>
                    <AlertTriangle />
                    <p>
                      This container is used in {usageInfo.usage_count} workflow{usageInfo.usage_count !== 1 ? 's' : ''}. 
                      You can remove it from this workflow, but cannot delete it from the library until all references are removed.
                    </p>
                  </WarningBox>

                  <WorkflowList>
                    {usageInfo.workflows.map(workflow => (
                      <WorkflowItem key={workflow.id}>
                        <span className="name">{workflow.name}</span>
                        <span className="status">{workflow.status}</span>
                      </WorkflowItem>
                    ))}
                  </WorkflowList>
                </>
              )}

              {usageInfo.usage_count === 0 && (
                <WarningBox>
                  <AlertTriangle />
                  <p>
                    This template is not used by any workflows and can be safely deleted from the library. 
                    This action cannot be undone.
                  </p>
                </WarningBox>
              )}
            </>
          ) : null}
        </ModalBody>

        <ModalFooter>
          <Button $variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          
          <Button 
            $variant="primary" 
            onClick={handleRemoveFromWorkflow}
            disabled={isLoading || isDeleting}
          >
            <XCircle />
            Remove from Workflow
          </Button>

          {usageInfo && usageInfo.usage_count === 0 && (
            <Button 
              $variant="danger" 
              onClick={handleDeleteFromLibrary}
              disabled={isLoading || isDeleting}
            >
              {isDeleting ? <Loader /> : <Trash2 />}
              Delete from Library
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );

  return createPortal(modalContent, document.body);
};

export default SharedTemplateDeleteModal;
