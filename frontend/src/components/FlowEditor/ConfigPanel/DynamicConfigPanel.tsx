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

// Smart Auto-Map (Phase 7 stabilization)
import { AutoMappingService, FieldMappingSuggestion } from '../utils/autoMappingService';
import { AutoMappingSuggestionsPanel } from '../components/AutoMappingSuggestionsPanel';

// Phase E.3: Data inheritance hook
import { useUpstreamVariables } from '../hooks/useUpstreamVariables';
import type { SelectedField } from './EntityFieldPicker';
import ConditionBuilder, { type ConditionRule } from './ConditionBuilder';
import { useEntityFields, EntityField } from '../../../services/schemaService';

// FormBuilder Context (2026-02-21 Comprehensive Enhancements)
import { useFormBuilderContext } from '../../../contexts/FormBuilderContext';

// Configuration engine imports
import { schemaRegistry } from '../config';
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
// Helper Functions
// ============================================================================

/**
 * Helper to aggressively check all known condition aliases and support functions
 * 
 * Checks for: conditional, visibilityCondition, showIf
 * Supports: function conditions and standard condition objects
 * 
 * @param item - Section or field to check
 * @param data - Current form data
 * @returns true if item should be visible, false otherwise
 */
const checkIsVisible = (item: any, data: any): boolean => {
  // Check all known aliases for condition properties
  const cond = item.conditional || item.visibilityCondition || item.showIf;
  
  // No condition = always visible
  if (!cond) return true;
  
  // Support functional conditions
  if (typeof cond === 'function') {
    try {
      return cond(data);
    } catch (error) {
      console.warn('[DynamicConfigPanel] Functional condition error:', error);
      return true; // Default to visible on error
    }
  }
  
  // Use standard evaluator for object conditions
  return evaluateCondition(cond, data);
};

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

  // FIX: Fetch entity fields if an entity is selected in the node's config (e.g., for Database Event triggers)
  const configuredEntity = formData.entityType || formData.eventEntity || formData.entity || '';
  const { data: entityFieldsData } = useEntityFields(configuredEntity, { enabled: !!configuredEntity });

  // FormBuilder Context (2026-02-21 Comprehensive Enhancements)
  const { openFormBuilder } = useFormBuilderContext();

  // Get schema for this node type (now always returns a schema via fallback)
  const schema = useMemo(() => {
    const semanticNodeType = ((node?.data as any)?.nodeType as string | undefined) || node?.type;
    if (!semanticNodeType) return null;

    const resolvedSchema = schemaRegistry.getSchema(semanticNodeType);

    // Debug logging for schema resolution
    const isFallback = resolvedSchema?.version?.includes('fallback');
    console.log('[DynamicConfigPanel] Schema resolution:', {
      nodeType: semanticNodeType,
      runtimeType: node.type,
      nodeId: node.id,
      schemaDisplayName: resolvedSchema?.displayName,
      isFallback,
      sectionCount: resolvedSchema?.sections?.length || 0,
    });
    
    return resolvedSchema;
  }, [node?.type, node?.id, node?.data]);

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
          Node type: {(((node?.data as any)?.nodeType as string | undefined) || node?.type || 'unknown')}
        </EmptyStateMessage>
      </EmptyStateContainer>
    );
  }

  // Calculate which fields should be visible based on conditional rules
  const visibleFields = useMemo(() => {
    const visible = new Set<string>();
    
    schema.sections.forEach(section => {
      // Check section-level conditional (using robust helper)
      if (!checkIsVisible(section, formData)) {
        return; // Hide entire section
      }

      section.fields.forEach(field => {
        // Check field-level conditional (using robust helper)
        if (checkIsVisible(field, formData)) {
          visible.add(field.id);
        }
      });
    });
    
    return visible;
  }, [schema, formData]);

  const entityType = (formData as any)?.entityType as string | undefined;

  const { data: entityFieldsResp } = useEntityFields(entityType, {
    enabled: Boolean(entityType) && (node?.type === 'form' || node?.type === 'formStep' || node?.type === 'formStepSingle'),
  });

  const pendingAutoDefaultsRef = React.useRef<string | null>(null);

  const buildSmartDefaults = (entityFields: EntityField[]): SelectedField[] => {
    const blocked = new Set([
      'id',
      'pk',
      'tenant',
      'tenant_id',
      'created_at',
      'updated_at',
      'custom_data',
    ]);

    const scalarFields = entityFields.filter((f) => {
      const n = (f.name || '').toLowerCase();
      if (blocked.has(n)) return false;
      // avoid selecting relations by default; they tend to be heavy/noisy
      const t = (f.type || f.field_type || '').toLowerCase();
      if (t.includes('foreign') || t.includes('many')) return false;
      return true;
    });

    const preferredNames = [
      'name',
      'title',
      'description',
      'email',
      'phone',
      'status',
      'notes',
    ];

    const byNameScore = (f: EntityField) => {
      const n = (f.name || '').toLowerCase();
      const idx = preferredNames.indexOf(n);
      return idx === -1 ? 999 : idx;
    };

    const required = scalarFields.filter((f) => Boolean(f.required || f.is_required));
    const optional = scalarFields.filter((f) => !(f.required || f.is_required));

    optional.sort((a, b) => byNameScore(a) - byNameScore(b) || a.label.localeCompare(b.label));

    const picked = [...required, ...optional].slice(0, 10);

    return picked.map((f) => ({
      ...f,
      fieldId: `auto:${entityType ?? 'entity'}:${f.name}`,
    }));
  };

  // Smart defaults: when the user changes entityType for a Form node, preselect a sensible
  // set of fields instead of forcing "Select all".
  React.useEffect(() => {
    if (!node?.id) return;
    if (!pendingAutoDefaultsRef.current) return;

    const targetEntityType = pendingAutoDefaultsRef.current;
    if (!entityFieldsResp?.fields || entityFieldsResp.fields.length === 0) return;

    // Only apply for the matching entityType and when fields are empty.
    const currentEntityType = (formData as any)?.entityType as string | undefined;
    const currentFields = ((formData as any)?.fields as SelectedField[] | undefined) ?? [];

    if (currentEntityType !== targetEntityType) return;
    if (currentFields.length > 0) {
      pendingAutoDefaultsRef.current = null;
      return;
    }

    const defaults = buildSmartDefaults(entityFieldsResp.fields);
    const next = { ...(formData as any), fields: defaults };
    setFormData(next);
    onUpdateNode(node.id, next);
    pendingAutoDefaultsRef.current = null;
  }, [entityFieldsResp?.fields, formData, node?.id, onUpdateNode]);

  // Handle field value change
  // NOTE: This panel runs inside a shadow-state wrapper (TabbedConfigPanelWithShadow).
  // We stage changes immediately into the wrapper via onUpdateNode and rely on the
  // wrapper's single Apply/Discard bar to commit/revert.
  const handleFieldChange = (fieldId: string, value: any) => {
    if (!node?.id) return;

    const field = findFieldById(schema, fieldId);

    setFormData((prev) => {
      // If entity type changes on form-like nodes, reset fields and trigger smart defaults.
      if (
        fieldId === 'entityType' &&
        (node.type === 'form' || node.type === 'formStep' || node.type === 'formStepSingle')
      ) {
        pendingAutoDefaultsRef.current = value as string;
        const next = { ...prev, entityType: value, fields: [] };
        onUpdateNode(node.id, next);
        return next;
      }

      const next = { ...prev, [fieldId]: value };
      onUpdateNode(node.id, next);

      if (field) {
        const error = validateField(field, value, next);
        setErrors((errs) => ({
          ...errs,
          [fieldId]: error || '',
        }));
      }

      return next;
    });
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

  // Smart Auto-Map suggestions (based on upstream nodes)
  const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState<Set<string>>(new Set());

  const nodesForAutoMap = useMemo(() => {
    // Use the local (possibly edited) formData for the target node when generating suggestions
    return nodes.map(n => (n.id === node.id ? { ...n, data: formData } : n));
  }, [nodes, node.id, formData]);

  const autoMap = useMemo(() => {
    try {
      return AutoMappingService.suggestMappings(
        nodesForAutoMap as any,
        edges as any,
        node.id
      );
    } catch (e) {
      console.warn('[DynamicConfigPanel] Auto-mapping suggestion generation failed:', e);
      return { targetNodeId: node.id, suggestions: [], timestamp: Date.now() };
    }
  }, [nodesForAutoMap, edges, node.id]);

  const visibleAutoMapSuggestions = useMemo(() => {
    return (autoMap.suggestions || []).filter(s => !rejectedSuggestionIds.has(s.id));
  }, [autoMap.suggestions, rejectedSuggestionIds]);

  const handleAcceptAutoMap = (suggestion: FieldMappingSuggestion) => {
    if (!node?.id) return;

    const updatedNode = AutoMappingService.applySuggestion(
      ({ ...node, data: formData } as any),
      suggestion
    );

    const nextData = (updatedNode.data || {}) as Record<string, unknown>;
    setFormData(nextData);

    // updateShadow expects a patch; keep this minimal so we reliably mark the panel dirty.
    onUpdateNode(node.id, { fieldMappings: nextData.fieldMappings || [] });

    // UX: hide applied suggestions so the user gets immediate feedback.
    setRejectedSuggestionIds((prev) => {
      const next = new Set(prev);
      next.add(suggestion.id);
      return next;
    });
  };

  const handleRejectAutoMap = (suggestionId: string) => {
    setRejectedSuggestionIds(prev => {
      const next = new Set(prev);
      next.add(suggestionId);
      return next;
    });
  };

  const handleApplyAllAutoMap = () => {
    if (!node?.id) return;

    const updatedNode = AutoMappingService.applyAutoSuggestions(
      ({ ...node, data: formData } as any),
      autoMap
    );

    const nextData = (updatedNode.data || {}) as Record<string, unknown>;
    setFormData(nextData);

    // updateShadow expects a patch; keep this minimal so we reliably mark the panel dirty.
    onUpdateNode(node.id, { fieldMappings: nextData.fieldMappings || [] });

    // UX: hide the auto-applied suggestions from the list.
    const autoAppliedIds = (autoMap.suggestions || []).filter((s) => s.autoApply).map((s) => s.id);
    if (autoAppliedIds.length > 0) {
      setRejectedSuggestionIds((prev) => {
        const next = new Set(prev);
        autoAppliedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Apply/Discard are handled by the outer shadow-state wrapper.

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
      onFieldChange: (fieldId: string, newValue: any) => handleFieldChange(fieldId, newValue),
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
      case 'email':
      case 'password':
      case 'codeEditor':
      case 'code-editor':
        renderedField = renderTextField(commonProps as any);
        break;
      
      case 'select':
      case 'multiselect':
      case 'multiSelect': // FIX: Added exact match for schema
        renderedField = renderSelectField(commonProps);
        break;
      
      case 'toggle':
        renderedField = renderToggleField(commonProps);
        break;
      
      // Phase E: Dynamic entity type select (replaces old entity-selector usage)
      case 'entityType': // FIX: Added entityType field
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

      case 'info':
        renderedField = (
          <InfoBox key={field.id}>
            {(field as any).content || field.helpText || ''}
          </InfoBox>
        );
        break;

      case 'checkbox':
      case 'boolean':
        renderedField = renderToggleField(commonProps as any);
        break;

      case 'ruleBuilder':
      case 'conditionBuilder': {
        const rules = (value as ConditionRule[]) || [];
        const logicRaw = (formData as any).logic as string | undefined;
        const logic = logicRaw?.toLowerCase() === 'or' ? 'or' : 'and';

        // Include upstream variables
        const availableFields = (upstreamVariables || []).map(v => ({
          key: v.template,
          label: `${v.nodeName}: ${v.fieldLabel}`,
          type: v.fieldType,
        }));

        // FIX: Also include fields from the selected entity (crucial for trigger nodes)
        if (entityFieldsData?.fields) {
          entityFieldsData.fields.forEach(f => {
            const rawType = (f.type || f.field_type || '').toString().toLowerCase();
            const mappedType = rawType.includes('number') || rawType.includes('int') || rawType.includes('float') || rawType.includes('decimal')
              ? 'number'
              : rawType.includes('date')
                ? 'date'
                : rawType.includes('bool')
                  ? 'boolean'
                  : 'string';

            availableFields.push({
              key: f.name,
              label: `${configuredEntity} Context: ${f.label}`,
              type: mappedType,
            });
          });
        }

        renderedField = (
          <div key={field.id}>
            <ConditionBuilder
              conditions={rules}
              logic={logic}
              onChange={(newRules, newLogic) => {
                handleFieldChange(field.id, newRules);
                // Keep the schema's separate logic field in sync if present
                if ((schema.sections || []).some(s => s.fields?.some(f => f.id === 'logic'))) {
                  handleFieldChange('logic', newLogic.toUpperCase());
                }
              }}
              availableFields={availableFields}
            />
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </div>
        );
        break;
      }
      
      // Button fields (2026-02-21 Comprehensive Enhancements)
      case 'button':
        renderedField = (
          <ButtonFieldContainer key={field.id}>
            <Button
              variant={(field as any).metadata?.variant || 'secondary'}
              fullWidth
              onClick={() => {
                if (!node) {
                  console.warn('[DynamicConfigPanel] Cannot execute button action: node is null');
                  return;
                }
                // Check if button has FormBuilder action metadata
                if (field.metadata?.action === 'openFormBuilder') {
                  console.log('[DynamicConfigPanel] Opening FormBuilder for node:', node.id);
                  openFormBuilder({
                    nodeId: node.id,
                    nodeData: node.data,
                    nodeType: node.type || 'form',
                    formId: (node.data as any)?.formId,
                  });
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
    // Check section-level conditional (using robust helper)
    if (!checkIsVisible(section, formData)) {
      return null;
    }

    // Check if any fields in this section are visible
    const visibleFieldsInSection = section.fields.filter(f => visibleFields.has(f.id));

    const isCollapsed = collapsedSections.has(section.id);
    const isCollapsible = section.collapsible ?? false;

    return (
      <Section key={section.id}>
        <SectionHeader 
          onClick={isCollapsible ? () => toggleSection(section.id) : undefined}
          style={{ cursor: isCollapsible ? 'pointer' : 'default' }}
        >
          {section.icon && (() => {
            const Icon = section.icon as any;
            return <Icon size={16} />;
          })()}
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
            {visibleFieldsInSection.length === 0 ? (
              <SectionEmptyState>
                No configuration fields are available yet. Adjust earlier selections to unlock additional options.
              </SectionEmptyState>
            ) : (
              section.fields.map(renderField)
            )}
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
        {visibleAutoMapSuggestions.length > 0 && (
          <AutoMapBanner>
            <AutoMapBannerText>
              <AutoMapBannerTitle>Smart suggestions available</AutoMapBannerTitle>
              <AutoMapBannerSubtitle>{visibleAutoMapSuggestions.length} suggested mapping(s) detected from upstream variables</AutoMapBannerSubtitle>
            </AutoMapBannerText>
            <Button variant="primary" onClick={handleApplyAllAutoMap}>
              Apply suggested mappings
            </Button>
          </AutoMapBanner>
        )}

        {visibleAutoMapSuggestions.length > 0 && (
          <AutoMappingSuggestionsPanel
            suggestions={visibleAutoMapSuggestions}
            onAccept={handleAcceptAutoMap}
            onReject={handleRejectAutoMap}
            onApplyAll={handleApplyAllAutoMap}
          />
        )}

        {schema.sections
          .filter(section => !sectionFilter || sectionFilter(section))
          .map(renderSection)}
      </Content>
      
      <Footer>
        <FooterInfo>
          {!isValid && <ErrorBadge>{Object.keys(errors).filter((k) => errors[k]).length} errors</ErrorBadge>}
        </FooterInfo>
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
  min-height: 52px;
`;

const SectionEmptyState = styled.div`
  padding: 12px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: 8px;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  line-height: 1.5;
  background: rgb(var(--color-surface));
`;

const PlaceholderField = styled.div`
  padding: 12px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: 6px;
  margin-bottom: 12px;
`;


const InfoBox = styled.div`
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgba(var(--color-primary), 0.06);
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  line-height: 1.5;
`;

const AutoMapBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--color-primary), 0.35);
  border-radius: var(--radius-md);
  background: rgba(var(--color-primary), 0.08);
  margin-bottom: 12px;
`;

const AutoMapBannerTitle = styled.div`
  font-weight: 700;
  font-size: 13px;
`;

const AutoMapBannerSubtitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
`;

const AutoMapBannerText = styled.div`
  min-width: 0;
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
