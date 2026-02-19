/**
 * DynamicConfigPanel - Schema-Driven Configuration Panel
 * 
 * Renders node configuration UI dynamically from schemas instead of hardcoded components.
 * Supports conditional fields, validation, and context-aware configuration.
 * 
 * This is the core of the Dynamic Configuration Engine (Phase D).
 * 
 * Created: 2026-02-18
 * Phase: D.2 - Dynamic Panel
 */

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Configuration engine imports
import { schemaRegistry } from '../config/schemaRegistry';
import { NodeConfigSchema, ConfigSection, ConfigField } from '../config/types';
import { evaluateCondition } from '../config/conditionalLogic';
import { validateField } from '../config/validationEngine';

// Field renderers
import { 
  renderTextField, 
  renderSelectField, 
  renderToggleField 
} from '../config/fieldRenderers/basicRenderers';
import {
  renderEntitySelector,
  renderFieldMapping,
  renderVariablePicker,
  renderValidationBuilder,
} from '../config/fieldRenderers/complexRenderers';

// Import shared styled components
import {
  Section,
  SectionHeader,
  SectionTitle,
} from './shared/StyledComponents';

// ============================================================================
// Component Props
// ============================================================================

export interface DynamicConfigPanelProps {
  /** Current node being configured */
  node: Node;
  
  /** All nodes in the flow (for context) */
  nodes: Node[];
  
  /** All edges in the flow (for context) */
  edges: Edge[];
  
  /** Callback to update node data */
  onUpdateNode: (nodeId: string, data: Partial<Node['data']>) => void;
  
  /** Callback when Apply is clicked */
  onApply?: () => void;
  
  /** Callback when Discard is clicked */
  onDiscard?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Dynamic configuration panel that renders UI from node type schema
 */
export const DynamicConfigPanel: React.FC<DynamicConfigPanelProps> = ({
  node,
  nodes,
  edges,
  onUpdateNode,
  onApply,
  onDiscard
}) => {
  // Local form state (shadow state - changes not applied until user clicks Apply)
  const [formData, setFormData] = useState<Record<string, any>>(node.data || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Get schema for this node type
  const schema = useMemo(() => {
    return schemaRegistry.getSchema(node.type!);
  }, [node.type]);

  // Reset form data when node changes
  useEffect(() => {
    setFormData(node.data || {});
    setErrors({});
  }, [node.id, node.data]);

  // Show error if no schema found
  if (!schema) {
    return (
      <ErrorPanel>
        <ErrorTitle>Configuration Error</ErrorTitle>
        <ErrorMessage>
          No configuration schema found for node type: <code>{node.type}</code>
        </ErrorMessage>
        <ErrorHint>
          This node type has not been migrated to the dynamic configuration system yet.
        </ErrorHint>
      </ErrorPanel>
    );
  }

  // Calculate which fields should be visible based on conditional rules
  const visibleFields = useMemo(() => {
    const visible = new Set<string>();
    
    schema.sections.forEach(section => {
      // Check section-level conditional
      if (section.conditional && !evaluateCondition(section.conditional, formData)) {
        return; // Hide entire section
      }

      section.fields.forEach(field => {
        // Check field-level conditional
        if (!field.conditional || evaluateCondition(field.conditional, formData)) {
          visible.add(field.id);
        }
      });
    });
    
    return visible;
  }, [schema, formData]);

  // Handle field value change
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    
    // Validate field immediately
    const field = findFieldById(schema, fieldId);
    if (field) {
      const error = validateField(field, value, formData);
      setErrors(prev => ({
        ...prev,
        [fieldId]: error || ''
      }));
    }
  };

  // Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Handle Apply button
  const handleApply = () => {
    // Update node with form data
    onUpdateNode(node.id, formData);
    if (onApply) {
      onApply();
    }
  };

  // Handle Discard button
  const handleDiscard = () => {
    // Reset form data to node data
    setFormData(node.data || {});
    setErrors({});
    if (onDiscard) {
      onDiscard();
    }
  };

  // Check if form has changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(node.data);
  }, [formData, node.data]);

  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.values(errors).every(error => !error);
  }, [errors]);

  // Render a single field
  const renderField = (field: ConfigField) => {
    if (!visibleFields.has(field.id)) return null;

    const value = formData[field.id] ?? field.defaultValue;
    const error = errors[field.id];

    const commonProps = {
      field,
      value,
      onChange: (newValue: any) => handleFieldChange(field.id, newValue),
      error,
      disabled: field.disabled || false,
      allValues: formData
    };

    // Route to appropriate renderer based on field type
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'number':
        return renderTextField(commonProps);
      
      case 'select':
      case 'multiselect':
        return renderSelectField(commonProps);
      
      case 'toggle':
        return renderToggleField(commonProps);
      
      // Complex renderers (Phase D.3)
      case 'entity-selector':
        return renderEntitySelector({
          ...commonProps,
          data: { ...formData, _upstreamVariables: [] } // Add upstream variables
        });
      
      case 'field-mapping':
        return renderFieldMapping({
          ...commonProps,
          data: { ...formData, _upstreamVariables: [] } // Add upstream variables
        });
      
      case 'variable-picker':
        return renderVariablePicker({
          ...commonProps,
          data: { ...formData, _upstreamVariables: [] } // Add upstream variables
        });
      
      case 'validation-builder':
        return renderValidationBuilder(commonProps);
      
      default:
        return (
          <PlaceholderField key={field.id}>
            <PlaceholderLabel>{field.label}</PlaceholderLabel>
            <PlaceholderHint>Unknown field type: {field.type}</PlaceholderHint>
          </PlaceholderField>
        );
    }
  };

  // Render a section
  const renderSection = (section: ConfigSection) => {
    // Check section-level conditional
    if (section.conditional && !evaluateCondition(section.conditional, formData)) {
      return null;
    }

    // Check if any fields in this section are visible
    const visibleFieldsInSection = section.fields.filter(f => visibleFields.has(f.id));
    if (visibleFieldsInSection.length === 0) return null;

    const isCollapsed = collapsedSections.has(section.id);
    const isCollapsible = section.collapsible ?? false;

    return (
      <Section key={section.id}>
        <SectionHeader 
          onClick={isCollapsible ? () => toggleSection(section.id) : undefined}
          style={{ cursor: isCollapsible ? 'pointer' : 'default' }}
        >
          {section.icon && <section.icon size={16} />}
          <SectionTitle>{section.title}</SectionTitle>
          {isCollapsible && (
            isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />
          )}
        </SectionHeader>
        {!isCollapsed && (
          <SectionContentWrapper>
            {section.description && (
              <SectionDescription>{section.description}</SectionDescription>
            )}
            {section.fields.map(renderField)}
          </SectionContentWrapper>
        )}
      </Section>
    );
  };

  return (
    <Container>
      <Header>
        <Title>{schema.displayName} Configuration</Title>
        {schema.description && <Subtitle>{schema.description}</Subtitle>}
      </Header>
      
      <Content>
        {schema.sections.map(renderSection)}
      </Content>
      
      <Footer>
        <FooterInfo>
          {hasChanges && <UnsavedBadge>Unsaved changes</UnsavedBadge>}
          {!isValid && <ErrorBadge>{Object.keys(errors).filter(k => errors[k]).length} errors</ErrorBadge>}
        </FooterInfo>
        <FooterActions>
          <Button variant="secondary" onClick={handleDiscard} disabled={!hasChanges}>
            Discard
          </Button>
          <Button variant="primary" onClick={handleApply} disabled={!hasChanges || !isValid}>
            Apply
          </Button>
        </FooterActions>
      </Footer>
    </Container>
  );
};

// Helper: Find field by ID across all sections
function findFieldById(schema: NodeConfigSchema, fieldId: string): ConfigField | undefined {
  for (const section of schema.sections) {
    const field = section.fields.find(f => f.id === fieldId);
    if (field) return field;
  }
  return undefined;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--color-background));
`;

const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.p`
  margin: 4px 0 0 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background-secondary));
`;

const FooterInfo = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const FooterActions = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button<{ variant: 'primary' | 'secondary' }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${({ variant }) =>
    variant === 'primary'
      ? `
    background: rgb(var(--color-primary));
    color: white;
    &:hover:not(:disabled) {
      background: rgb(var(--color-primary-hover));
    }
  `
      : `
    background: transparent;
    color: rgb(var(--color-text-secondary));
    border: 1px solid rgb(var(--color-border));
    &:hover:not(:disabled) {
      background: rgb(var(--color-background-hover));
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const UnsavedBadge = styled.span`
  font-size: 12px;
  color: rgb(var(--color-warning));
  font-weight: 500;
`;

const ErrorBadge = styled.span`
  font-size: 12px;
  color: rgb(var(--color-error));
  font-weight: 500;
`;

const SectionDescription = styled.p`
  margin: 0 0 12px 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const SectionContentWrapper = styled.div`
  padding-top: 12px;
`;

const PlaceholderField = styled.div`
  padding: 12px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: 6px;
  margin-bottom: 12px;
`;

const PlaceholderLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const PlaceholderHint = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  font-style: italic;
`;

const ErrorPanel = styled.div`
  padding: 24px;
  text-align: center;
`;

const ErrorTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-error));
`;

const ErrorMessage = styled.p`
  margin: 0 0 8px 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));

  code {
    background: rgb(var(--color-background-secondary));
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
  }
`;

const ErrorHint = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgb(var(--color-text-tertiary));
  font-style: italic;
`;
