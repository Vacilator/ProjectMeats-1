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
 * Updated: 2026-02-23 - Added auto-save functionality (Phase 4: Advanced Config)
 */

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { debounce } from 'lodash';

// Phase E.3: Data inheritance hook
import { useUpstreamVariables } from '../hooks/useUpstreamVariables';

// FormBuilder Context (2026-02-21 Comprehensive Enhancements)
import { useFormBuilderContext } from '../../../contexts/FormBuilderContext';

// Configuration engine imports
import { schemaRegistry } from '../config/schemaRegistry';
import { NodeConfigSchema, ConfigSection, ConfigField } from '../config/types';
import { evaluateCondition } from '../config/conditionalLogic';
import { validateField } from '../config/validationEngine';

// Field renderers
import { 
  renderTextField, 
  renderSelectField, 
  renderToggleField,
  renderEntityTypeSelect  // Phase E: Dynamic entity type dropdown
} from '../config/fieldRenderers/basicRenderers';
import {
  renderEntitySelector,
  renderEntityFieldPicker,  // Phase E.3: Cascade field picker
  renderFieldMapping,
  renderVariablePicker,
  renderValidationBuilder,
} from '../config/fieldRenderers/complexRenderers';
import { NestedChildrenRenderer } from './NestedChildrenRenderer';

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
  /** Current node being configured (nullable when no node selected) */
  node: Node | null;
  
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
  
  /** Optional filter to show only specific sections (for tabbed interface) */
  sectionFilter?: (section: ConfigSection) => boolean;
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
  onDiscard,
  sectionFilter
}) => {
  // ============================================================================
  // NULL SAFETY GUARD - Return early if no node selected
  // ============================================================================
  if (!node || !node.data) {
    return (
      <EmptyStateContainer>
        <EmptyStateIcon>📝</EmptyStateIcon>
        <EmptyStateTitle>No Node Selected</EmptyStateTitle>
        <EmptyStateMessage>
          Select a node in the canvas to configure its properties.
        </EmptyStateMessage>
      </EmptyStateContainer>
    );
  }

  // Local form state (shadow state - changes not applied until user clicks Apply)
  const [formData, setFormData] = useState<Record<string, any>>(node?.data || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Phase E.3: Compute upstream variables for data inheritance
  const { variables: upstreamVariables } = useUpstreamVariables({
    currentNodeId: node?.id || '',
    nodes,
    edges,
  });

  // FormBuilder Context (2026-02-21 Comprehensive Enhancements)
  const { openFormBuilder } = useFormBuilderContext();

  // Get schema for this node type (now always returns a schema via fallback)
  const schema = useMemo(() => {
    if (!node?.type) return null;
    
    const resolvedSchema = schemaRegistry.getSchema(node.type);
    
    // Debug logging for schema resolution
    const isFallback = resolvedSchema?.version?.includes('fallback');
    console.log('[DynamicConfigPanel] Schema resolution:', {
      nodeType: node.type,
      nodeId: node.id,
      schemaDisplayName: resolvedSchema?.displayName,
      isFallback,
      sectionCount: resolvedSchema?.sections?.length || 0,
    });
    
    return resolvedSchema;
  }, [node?.type, node?.id]);

  // Reset form data when node changes
  useEffect(() => {
    if (node?.data) {
      setFormData(node.data);
      setErrors({});
    }
  }, [node?.id, node?.data]);

  // REMOVED: Error panel no longer needed - schemaRegistry always returns a schema
  // Fallback schemas are automatically generated for nodes without explicit schemas

  // REMOVED: Error panel no longer needed - schemaRegistry always returns a schema
  // Fallback schemas are automatically generated for nodes without explicit schemas

  // Safety check - if no schema (shouldn't happen), return empty state
  if (!schema) {
    return (
      <EmptyStateContainer>
        <EmptyStateIcon>⚙️</EmptyStateIcon>
        <EmptyStateTitle>Unable to Load Configuration</EmptyStateTitle>
        <EmptyStateMessage>
          Node type: {node?.type || 'unknown'}
        </EmptyStateMessage>
      </EmptyStateContainer>
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
    
    // AUTO-SAVE: Debounced auto-save after field change (Phase 4: Advanced Config)
    debouncedAutoSave(fieldId, value);
  };

  // Auto-save functionality (debounced to avoid excessive updates)
  const debouncedAutoSave = useMemo(
    () =>
      debounce((fieldId: string, value: any) => {
        if (!node?.id) return;
        
        // Only auto-save if no errors
        const hasErrors = Object.values(errors).some(error => error);
        if (!hasErrors) {
          console.log(`[DynamicConfigPanel] Auto-saving field: ${fieldId}`);
          onUpdateNode(node.id, { ...formData, [fieldId]: value });
        }
      }, 1000), // 1 second debounce
    [node?.id, formData, errors, onUpdateNode]
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedAutoSave.cancel();
    };
  }, [debouncedAutoSave]);

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
    if (!node?.id) {
      console.warn('[DynamicConfigPanel] Cannot apply changes: node ID is missing');
      return;
    }
    // Update node with form data
    onUpdateNode(node.id, formData);
    if (onApply) {
      onApply();
    }
  };

  // Handle Discard button
  const handleDiscard = () => {
    // Reset form data to node data
    if (node?.data) {
      setFormData(node.data);
      setErrors({});
    }
    if (onDiscard) {
      onDiscard();
    }
  };

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!node?.data) return false;
    return JSON.stringify(formData) !== JSON.stringify(node.data);
  }, [formData, node?.data]);

  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.values(errors).every(error => !error);
  }, [errors]);

  // Render a single field with smooth visibility transitions (Agent C Phase 2)
  const renderField = (field: ConfigField) => {
    const isVisible = visibleFields.has(field.id);
    
    // Always render but with conditional visibility for smooth transitions
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
    let renderedField = null;
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'number':
        renderedField = renderTextField(commonProps);
        break;
      
      case 'select':
      case 'multiselect':
        renderedField = renderSelectField(commonProps);
        break;
      
      case 'toggle':
        renderedField = renderToggleField(commonProps);
        break;
      
      // Phase E: Dynamic entity type select (replaces old entity-selector usage)
      case 'entity-selector':
        // Use simple select dropdown for entity TYPE selection
        renderedField = renderEntityTypeSelect(commonProps);
        break;
      
      // Complex renderers (Phase D.3) - kept for field-level operations
      case 'entity-field-picker':
        // Phase E.3: Cascade field picker - dynamically loads fields based on entityType
        renderedField = renderEntityFieldPicker({
          ...commonProps,
          data: { 
            ...formData, 
            _upstreamVariables: upstreamVariables  // Pass upstream variables for inheritance
          }
        });
        break;
      
      case 'field-mapping':
        renderedField = renderFieldMapping({
          ...commonProps,
          data: { 
            ...formData, 
            _upstreamVariables: upstreamVariables  // Pass upstream variables for mapping
          }
        });
        break;
      
      case 'variable-picker':
        renderedField = renderVariablePicker({
          ...commonProps,
          data: { 
            ...formData, 
            _upstreamVariables: upstreamVariables  // Pass upstream variables for suggestions
          }
        });
        break;
      
      case 'validation-builder':
        renderedField = renderValidationBuilder(commonProps);
        break;
      
      // Button fields (2026-02-21 Comprehensive Enhancements)
      case 'button':
        renderedField = (
          <ButtonFieldContainer key={field.id}>
            <Button
              variant={field.metadata?.variant || 'secondary'}
              fullWidth
              onClick={() => {
                if (!node) {
                  console.warn('[DynamicConfigPanel] Cannot execute button action: node is null');
                  return;
                }
                // Check if button has FormBuilder action metadata
                if (field.metadata?.action === 'openFormBuilder') {
                  console.log('[DynamicConfigPanel] Opening FormBuilder for node:', node.id);
                  openFormBuilder(node);
                } else if (field.metadata?.onClick) {
                  // Custom onClick handler from schema
                  field.metadata.onClick(node, formData);
                } else {
                  console.warn('[DynamicConfigPanel] Button has no action:', field.id);
                }
              }}
            >
              {field.label}
            </Button>
          </ButtonFieldContainer>
        );
        break;
      
      // Phase E.3: Nested children
      case 'nested-children':
        renderedField = (
          <NestedChildrenRenderer
            key={field.id}
            field={field}
            value={value || []}
            onChange={commonProps.onChange}
            error={error}
          />
        );
        break;
      
      default:
        renderedField = (
          <PlaceholderField key={field.id}>
            <PlaceholderLabel>{field.label}</PlaceholderLabel>
            <PlaceholderHint>Unknown field type: {field.type}</PlaceholderHint>
          </PlaceholderField>
        );
    }
    
    // Agent C Phase 2: Wrap in transition container for smooth show/hide
    return (
      <FieldTransitionWrapper 
        key={field.id} 
        $isVisible={isVisible}
        style={{
          maxHeight: isVisible ? '1000px' : '0',
          marginBottom: isVisible ? '12px' : '0',
          opacity: isVisible ? 1 : 0
        }}
      >
        {renderedField}
      </FieldTransitionWrapper>
    );
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
        {schema.sections
          .filter(section => !sectionFilter || sectionFilter(section))
          .map(renderSection)}
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

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger'; fullWidth?: boolean }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  width: ${props => props.fullWidth ? '100%' : 'auto'};

  ${({ variant = 'secondary' }) => {
    if (variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        &:hover:not(:disabled) {
          background: rgb(var(--color-primary-hover));
        }
      `;
    } else if (variant === 'danger') {
      return `
        background: rgb(var(--color-error));
        color: white;
        &:hover:not(:disabled) {
          background: rgb(239, 68, 68);
        }
      `;
    } else {
      return `
        background: transparent;
        color: rgb(var(--color-text-secondary));
        border: 1px solid rgb(var(--color-border));
        &:hover:not(:disabled) {
          background: rgb(var(--color-background-hover));
        }
      `;
    }
  }}

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

// Agent C Phase 2: Smooth field visibility transitions
const FieldTransitionWrapper = styled.div<{ $isVisible: boolean }>`
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transition-property: max-height, opacity, margin-bottom;
  
  /* Smooth collapse/expand animation */
  will-change: max-height, opacity;
  
  /* Hide content when collapsed to prevent interaction */
  ${props => !props.$isVisible && `
    pointer-events: none;
    user-select: none;
  `}
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

// Empty State Components (2026-02-21 Null Safety Fix)
const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  min-height: 200px;
`;

const EmptyStateIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyStateTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const EmptyStateMessage = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  max-width: 300px;
`;

// Button Field Container (2026-02-21 Comprehensive Enhancements)
const ButtonFieldContainer = styled.div`
  margin-bottom: 16px;
`;
