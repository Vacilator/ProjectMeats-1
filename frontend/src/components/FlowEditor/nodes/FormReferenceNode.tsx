/**
 * Form Reference Node Component
 *
 * References a reusable form created with the FormBuilder.
 * Allows embedding complete forms in workflows without rebuilding.
 *
 * Created: 2026-02-05 - Phase 3 Task 3.2
 * Part of: WORKFORMS_NAVIGATION_FIX_PLAN Phase 3
 */
import React from 'react';
import styled from 'styled-components';
import type { Node, NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { FileText, ExternalLink, Edit, Eye } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FormReferenceNodeData extends BaseNodeData {
  tenantFormId?: string;
  formId?: string; // legacy alias
  formName?: string;
  formDescription?: string;
  fieldCount?: number;
  sectionCount?: number;
  allowEdit?: boolean;
  prefillData?: Record<string, any>;
  onComplete?: {
    action: 'continue' | 'redirect' | 'save';
    target?: string;
  };
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  min-width: 300px;
`;

const FormInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgb(var(--color-surface));
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FormIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
`;

const FormDetails = styled.div`
  flex: 1;
`;

const FormName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const FormDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
`;

const FormStats = styled.div`
  display: flex;
  gap: 16px;
  padding: 12px;
  background: rgba(var(--color-primary), 0.05);
  border-radius: 6px;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatLabel = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
`;

const StatValue = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  background: rgba(var(--color-warning), 0.05);
  border: 1px dashed rgb(var(--color-warning));
  border-radius: 8px;
`;

const EmptyIcon = styled.div`
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 13px;
  line-height: 1.5;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgb(var(--color-border));
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const Badge = styled.span<{ $type?: 'warning' | 'info' }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  ${props => {
    if (props.$type === 'warning') {
      return `
        background: rgba(var(--color-warning), 0.1);
        color: rgb(var(--color-warning));
      `;
    } else {
      return `
        background: rgba(var(--color-info), 0.1);
        color: rgb(var(--color-info));
      `;
    }
  }}
`;

// ============================================================================
// Form Reference Node Component
// ============================================================================

export const FormReferenceNode = React.memo<NodeProps<Node<FormReferenceNodeData>>>(({ data, selected, id }) => {
  const resolvedFormId = data.tenantFormId ?? data.formId;
  const hasForm = Boolean(resolvedFormId);

  const handleEditForm = () => {
    // TODO: Open form in FormBuilder (needs a canonical route)
    // Keep as no-op for now.
  };

  const handlePreviewForm = () => {
    // TODO: Open form preview modal (needs a canonical surface)
    // Keep as no-op for now.
  };

  const handleChangeForm = () => {
    // Use the standard config-panel edit flow.
    if (typeof (data as any)?.onEdit === 'function') {
      (data as any).onEdit();
    }
  };

  const displayNode = hasForm ? (
    <>
      <FormInfo>
        <FormHeader>
          <FormIcon>
            <FileText size={20} />
          </FormIcon>
          <FormDetails>
            <FormName>{data.formName || resolvedFormId || 'Form'}</FormName>
            {data.formDescription && (
              <FormDescription>{data.formDescription}</FormDescription>
            )}
          </FormDetails>
        </FormHeader>

        <FormStats>
          <StatItem>
            <StatLabel>Sections</StatLabel>
            <StatValue>{data.sectionCount || 0}</StatValue>
          </StatItem>
          <StatItem>
            <StatLabel>Fields</StatLabel>
            <StatValue>{data.fieldCount || 0}</StatValue>
          </StatItem>
        </FormStats>

        {data.allowEdit && (
          <Badge $type="info">User can edit</Badge>
        )}

        {data.prefillData && Object.keys(data.prefillData).length > 0 && (
          <Badge $type="info">
            {Object.keys(data.prefillData).length} fields prefilled
          </Badge>
        )}
      </FormInfo>

      <ActionButtons>
        <ActionButton onClick={handlePreviewForm} title="Preview form" role="button">
          <Eye size={14} />
          Preview
        </ActionButton>
        <ActionButton onClick={handleEditForm} title="Edit form in builder" role="button">
          <Edit size={14} />
          Edit
        </ActionButton>
        <ActionButton onClick={handleChangeForm} title="Select different form" role="button">
          <ExternalLink size={14} />
          Change
        </ActionButton>
      </ActionButtons>
    </>
  ) : (
    <EmptyState>
      <EmptyIcon>📋</EmptyIcon>
      <EmptyText>
        No form selected.<br />
        Click to select a form from the library.
      </EmptyText>
    </EmptyState>
  );

  return (
    <BaseNode
      id={id}
      data={{
        ...data,
        label: data.formName || 'Form Reference',
      }}
      selected={selected}
      nodeType={{
        id: 'formReference',
        name: 'Form Reference',
        category: 'form',
        color: 'rgb(var(--color-primary))', // Indigo
        icon: '📋',
        description: 'Embed a reusable form inside the workflow',
        maxInputs: 1,
        maxOutputs: 1,
      }}
    >
      <Container>{displayNode}</Container>
    </BaseNode>
  );
});

export default FormReferenceNode;
