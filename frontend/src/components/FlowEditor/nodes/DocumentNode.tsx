/**
 * DocumentNode Component
 * 
 * Node for document operations:
 * - Generate (PDF, Word from template)
 * - Merge (combine multiple documents)
 * - Sign (request e-signature)
 * - Store (save to storage)
 * 
 * Features:
 * - Template selection
 * - Data mapping preview
 * - Output format options
 * - Storage location
 * 
 * Created: 2026-02-04 - Phase 2.1 Batch 2
 */
import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import { FileText, FilePlus, FileCheck, FolderOpen, Layers } from 'lucide-react';
import { BaseNode, BaseNodeData } from './BaseNode';

// ============================================================================
// Types
// ============================================================================

type DocumentType = 'generate' | 'merge' | 'sign' | 'store';

interface DocumentNodeData extends BaseNodeData {
  documentType: DocumentType;
  template?: {
    id: string;
    name: string;
  };
  outputFormat?: 'pdf' | 'word' | 'excel';
  dataMapping?: Array<{
    field: string;
    source: string;
  }>;
  mergeDocuments?: Array<{
    id: string;
    name: string;
  }>;
  signatureRequired?: {
    party: 'internal' | 'external';
    email?: string;
  };
  storageLocation?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const DocumentInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const FormatBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
`;

const FieldCount = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getDocumentTypeInfo = (documentType: DocumentType) => {
  switch (documentType) {
    case 'generate':
      return {
        icon: FilePlus,
        label: 'Generate Document',
        color: 'rgb(34, 197, 94)', // Green
      };
    case 'merge':
      return {
        icon: Layers,
        label: 'Merge Documents',
        color: 'rgb(59, 130, 246)', // Blue
      };
    case 'sign':
      return {
        icon: FileCheck,
        label: 'Request Signature',
        color: 'rgb(147, 51, 234)', // Purple
      };
    case 'store':
      return {
        icon: FolderOpen,
        label: 'Store Document',
        color: 'rgb(234, 179, 8)', // Yellow
      };
    default:
      return {
        icon: FileText,
        label: 'Document',
        color: 'rgb(156, 163, 175)', // Gray
      };
  }
};

// ============================================================================
// Component
// ============================================================================

export const DocumentNode = React.memo<NodeProps<Node<DocumentNodeData>>>(({ data, id, selected }) => {
  const {
    documentType,
    template,
    outputFormat,
    dataMapping,
    mergeDocuments,
    signatureRequired,
    storageLocation,
  } = data;

  const typeInfo = getDocumentTypeInfo(documentType);
  const Icon = typeInfo.icon;

  // Prepare config preview
  const configPreview: React.ReactNode[] = [];

  if (template) {
    configPreview.push(
      <InfoRow key="template">
        <FileText size={14} />
        <span>Template: {template.name}</span>
      </InfoRow>
    );
  }

  if (outputFormat) {
    configPreview.push(
      <InfoRow key="format">
        <span>Format:</span>
        <FormatBadge>{outputFormat}</FormatBadge>
      </InfoRow>
    );
  }

  if (dataMapping && dataMapping.length > 0) {
    configPreview.push(
      <InfoRow key="mapping">
        <FieldCount>
          📋 {dataMapping.length} field{dataMapping.length !== 1 ? 's' : ''} mapped
        </FieldCount>
      </InfoRow>
    );
  }

  if (mergeDocuments && mergeDocuments.length > 0) {
    configPreview.push(
      <InfoRow key="merge">
        <Layers size={14} />
        <span>{mergeDocuments.length} document{mergeDocuments.length !== 1 ? 's' : ''}</span>
      </InfoRow>
    );
  }

  if (signatureRequired) {
    configPreview.push(
      <InfoRow key="signature">
        <FileCheck size={14} />
        <span>
          Signature: {signatureRequired.party}
          {signatureRequired.email && ` (${signatureRequired.email})`}
        </span>
      </InfoRow>
    );
  }

  if (storageLocation) {
    configPreview.push(
      <InfoRow key="storage">
        <FolderOpen size={14} />
        <span>{storageLocation}</span>
      </InfoRow>
    );
  }

  return (
    <BaseNode
      id={id}
      data={{
        ...data,
        label: typeInfo.label,
        icon: Icon,
        color: typeInfo.color,
        configPreview: configPreview.length > 0 ? (
          <DocumentInfo>{configPreview}</DocumentInfo>
        ) : undefined,
      }}
      selected={selected}
      nodeType={{
        id: 'document',
        name: typeInfo.label,
        category: 'document',
        color: typeInfo.color,
        icon: '📄',
        description: typeInfo.label,
        maxInputs: 1,
        maxOutputs: 1,
      }}
    />
  );
});

export default DocumentNode;
