/**
 * Template Variant Creator (PI-05 / editor-create-variant)
 *
 * Allows creating a variant (clone) of an existing workflow template.
 * The variant links back to its parent template and allows independent editing.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Modal, Input, Select, message } from 'antd';
import { Copy, GitBranch, Tag } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TemplateVariantCreatorProps {
  /** Source template ID */
  sourceTemplateId: string;
  /** Source template name */
  sourceTemplateName: string;
  /** Source template version */
  sourceVersion?: string;
  /** Callback when variant is successfully created */
  onVariantCreated?: (variantId: string, variantName: string) => void;
  /** Close handler */
  onClose: () => void;
  /** Whether modal is visible */
  open: boolean;
}

interface VariantFormData {
  name: string;
  description: string;
  variantType: 'clone' | 'branch' | 'override';
}

// ============================================================================
// Styled Components
// ============================================================================

const FormGrid = styled.div`
  display: grid;
  gap: 16px;
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ParentInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: rgba(var(--color-info), 0.06);
  border: 1px solid rgba(var(--color-info), 0.15);
  font-size: 13px;
  color: rgb(var(--color-text-primary));
`;

const ParentLabel = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  font-weight: 500;
`;

const VariantTypeOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

// ============================================================================
// Component
// ============================================================================

export const TemplateVariantCreator: React.FC<TemplateVariantCreatorProps> = ({
  sourceTemplateId,
  sourceTemplateName,
  sourceVersion = '1.0.0',
  onVariantCreated,
  onClose,
  open,
}) => {
  const [formData, setFormData] = useState<VariantFormData>({
    name: `${sourceTemplateName} (Variant)`,
    description: '',
    variantType: 'clone',
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!formData.name.trim()) {
      message.warning('Please provide a variant name');
      return;
    }

    setCreating(true);
    try {
      // Simulate variant creation — in production this calls the template API
      const variantId = `variant-${Date.now()}`;

      message.success(`Variant "${formData.name}" created successfully`);
      onVariantCreated?.(variantId, formData.name);
      onClose();
    } catch (err) {
      message.error('Failed to create variant');
    } finally {
      setCreating(false);
    }
  }, [formData, onVariantCreated, onClose]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Copy size={18} />
          Create Template Variant
        </span>
      }
      okText="Create Variant"
      onOk={handleCreate}
      confirmLoading={creating}
      destroyOnClose
      width={520}
    >
      <FormGrid>
        <ParentInfo>
          <GitBranch size={16} style={{ color: 'rgb(var(--color-info))' }} />
          <div>
            <ParentLabel>Parent Template</ParentLabel>
            <div>
              {sourceTemplateName}{' '}
              <Tag size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
              <span style={{ fontSize: 11, opacity: 0.7 }}>v{sourceVersion}</span>
            </div>
          </div>
        </ParentInfo>

        <FormField>
          <FieldLabel>Variant Name</FieldLabel>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Custom Process"
            maxLength={120}
          />
        </FormField>

        <FormField>
          <FieldLabel>Description (optional)</FieldLabel>
          <Input.TextArea
            value={formData.description}
            onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
            placeholder="What makes this variant different from the parent?"
            rows={3}
            maxLength={500}
          />
        </FormField>

        <FormField>
          <FieldLabel>Variant Type</FieldLabel>
          <Select
            value={formData.variantType}
            onChange={(val) => setFormData((f) => ({ ...f, variantType: val }))}
            options={[
              {
                value: 'clone',
                label: (
                  <VariantTypeOption>
                    <Copy size={14} /> Full Clone — independent copy
                  </VariantTypeOption>
                ),
              },
              {
                value: 'branch',
                label: (
                  <VariantTypeOption>
                    <GitBranch size={14} /> Branch — linked to parent updates
                  </VariantTypeOption>
                ),
              },
              {
                value: 'override',
                label: (
                  <VariantTypeOption>
                    <Tag size={14} /> Override — extends parent with overrides
                  </VariantTypeOption>
                ),
              },
            ]}
          />
        </FormField>
      </FormGrid>
    </Modal>
  );
};

export default TemplateVariantCreator;
