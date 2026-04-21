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

import { logger } from '@/utils/logger';

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
import {
  buildCronExpressionFromFriendlySchedule,
  buildScheduleSummary,
} from '../utils/scheduleCron';
import { evaluateCondition } from '../config/conditionalLogic';
import { validateField } from '../config/validationEngine';
import { toFormFieldsFromSelectedFields } from '../utils/formFieldsDualModel';

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
import { listTenantForms, getTenantForm } from '../../../services/workformsApi';

// Import shared styled components
import {
  Section,
  SectionHeader,
  SectionTitle,
  FormField,
  Label,
  Input,
  Select,
  HelpText,
} from './shared/StyledComponents';

const MemoNestedChildrenRenderer = React.memo(NestedChildrenRenderer);
MemoNestedChildrenRenderer.displayName = 'MemoNestedChildrenRenderer';

const MemoAutoMappingSuggestionsPanel = React.memo(AutoMappingSuggestionsPanel);
MemoAutoMappingSuggestionsPanel.displayName = 'MemoAutoMappingSuggestionsPanel';

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

  /** Read-only mode: prevent any edits/mutations */
  readOnly?: boolean;
  
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
  readOnly = false,
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
  const isReadOnly = Boolean(readOnly);
  const [keyValueDrafts, setKeyValueDrafts] = useState<
    Record<string, Array<{ key: string; value: string }>>
  >({});

  // Tenant forms cache for schema fields like `formReference`
  const [tenantForms, setTenantForms] = useState<any[]>([]);
  const [tenantFormsLoading, setTenantFormsLoading] = useState(false);
  const [tenantFormsError, setTenantFormsError] = useState<string | null>(null);

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
    logger.debug('Schema resolution', {
      component: 'DynamicConfigPanel',
      metadata: {
        nodeType: semanticNodeType,
        runtimeType: node.type,
        nodeId: node.id,
        schemaDisplayName: resolvedSchema?.displayName,
        isFallback,
        sectionCount: resolvedSchema?.sections?.length || 0,
      },
    });

    return resolvedSchema;
  }, [node?.type, node?.id, node?.data]);

  const schemaNeedsTenantForms = useMemo(() => {
    if (!schema) return false;
    return (schema.sections || []).some((s) => (s.fields || []).some((f) => f.type === 'formReference'));
  }, [schema]);

  useEffect(() => {
    if (!schemaNeedsTenantForms) return;
    if (tenantFormsLoading) return;

    // Fetch once per panel lifetime; if the current selection references a form
    // that isn't in the list (legacy/archived), we still display it.
    setTenantFormsLoading(true);
    setTenantFormsError(null);

    listTenantForms()
      .then((forms) => {
        setTenantForms(Array.isArray(forms) ? forms : []);
      })
      .catch((err: any) => {
        console.error('[DynamicConfigPanel] Failed to load tenant forms:', err);
        setTenantForms([]);
        setTenantFormsError('Failed to load forms');
      })
      .finally(() => {
        setTenantFormsLoading(false);
      });
  }, [schemaNeedsTenantForms]);

  // Keep local form state in sync with external node.data changes (e.g., Apply/Discard in shadow state).
  useEffect(() => {
    if (node?.data) {
      setFormData(node.data);
    }
  }, [node?.id, node?.data]);

  // Reset validation errors when the selected node changes.
  useEffect(() => {
    setErrors({});
  }, [node?.id]);

  // Clear key-value draft rows when the selected node changes.
  useEffect(() => {
    setKeyValueDrafts({});
  }, [node?.id]);

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

  const effectiveFormData = useMemo(() => {
    const next: any = { ...(formData as any) };

    // Additive aliasing for legacy/workflow-safe interoperability.
    if (next.entityType === undefined && next.entity !== undefined) next.entityType = next.entity;
    if (next.entity === undefined && next.entityType !== undefined) next.entity = next.entityType;

    if (next.fieldMappings === undefined && next.fields !== undefined) next.fieldMappings = next.fields;
    if (next.fields === undefined && next.fieldMappings !== undefined) next.fields = next.fieldMappings;

    // Materialize schema defaults for evaluation (visibility/validation).
    schema.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.defaultValue !== undefined && next[field.id] === undefined) {
          next[field.id] = field.defaultValue;
        }
      });
    });

    return next as Record<string, any>;
  }, [schema, formData]);

  // Calculate which fields should be visible based on conditional rules
  const visibleFields = useMemo(() => {
    const visible = new Set<string>();

    schema.sections.forEach((section) => {
      // Check section-level conditional (using robust helper)
      if (!checkIsVisible(section, effectiveFormData)) {
        return; // Hide entire section
      }

      section.fields.forEach((field) => {
        // Check field-level conditional (using robust helper)
        if (checkIsVisible(field, effectiveFormData)) {
          visible.add(field.id);
        }
      });
    });

    return visible;
  }, [schema, effectiveFormData]);

  const entityType = (effectiveFormData as any)?.entityType as string | undefined;

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
    const next = {
      ...(formData as any),
      fields: defaults,
      formFields: toFormFieldsFromSelectedFields(defaults as any),
    };
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
    if (isReadOnly) return;
    if (field?.readOnly) return;

    setFormData((prev) => {
      const semanticNodeType = (((node?.data as any)?.nodeType as string | undefined) || node.type) as string;

      // If entity type changes on form-like nodes, reset fields and trigger smart defaults.
      if (
        fieldId === 'entityType' &&
        (node.type === 'form' || node.type === 'formStep' || node.type === 'formStepSingle')
      ) {
        pendingAutoDefaultsRef.current = value as string;
        const next = { ...prev, entityType: value, fields: [], formFields: [] };
        onUpdateNode(node.id, next);
        return next;
      }

      // Legacy triggerEvent schema uses entityType; TriggerNode expects eventEntity for display.
      if (fieldId === 'entityType' && semanticNodeType === 'triggerEvent') {
        const next = { ...prev, entityType: value, eventEntity: value };
        onUpdateNode(node.id, next);
        return next;
      }

      // Schedule trigger: keep UI business-friendly but always persist an underlying cron string.
      if (semanticNodeType === 'triggerSchedule') {
        const draft = { ...prev, [fieldId]: value } as any;
        const mode = (draft.scheduleMode as string) || 'friendly';

        // If user edits cron directly, force cron mode.
        if (fieldId === 'cronExpression') {
          const cron = String(value || '').trim();
          const next = {
            ...draft,
            scheduleMode: 'cron',
            cronExpression: cron,
            schedule: cron,
            scheduleSummary: cron ? `Cron: ${cron}` : undefined,
          };
          onUpdateNode(node.id, next);
          return next;
        }

        // Switching modes: keep data consistent.
        if (fieldId === 'scheduleMode') {
          const nextMode = String(value || 'friendly');

          if (nextMode === 'cron') {
            const cron = String(draft.cronExpression || draft.schedule || '').trim();
            const next = {
              ...draft,
              scheduleMode: 'cron',
              cronExpression: cron,
              schedule: cron,
              scheduleSummary: cron ? `Cron: ${cron}` : draft.scheduleSummary,
            };
            onUpdateNode(node.id, next);
            return next;
          }

          // Switch to friendly: regenerate cron from selections.
          const cron = buildCronExpressionFromFriendlySchedule(draft);
          const summary = buildScheduleSummary(draft);
          const next = {
            ...draft,
            scheduleMode: 'friendly',
            cronExpression: cron,
            schedule: cron,
            scheduleSummary: summary,
          };
          onUpdateNode(node.id, next);
          return next;
        }

        // Friendly mode: regenerate cron + summary whenever the user changes schedule inputs.
        if (mode !== 'cron') {
          const cron = buildCronExpressionFromFriendlySchedule(draft);
          const summary = buildScheduleSummary(draft);
          const next = {
            ...draft,
            cronExpression: cron,
            schedule: cron,
            scheduleSummary: summary,
          };
          onUpdateNode(node.id, next);
          return next;
        }

        // Cron mode: just update the field.
        onUpdateNode(node.id, draft);
        return draft;
      }

      const isFormStep =
        semanticNodeType === 'formStep' ||
        semanticNodeType === 'formStepSingle' ||
        semanticNodeType === 'formStepSingleNode';

      // Form steps historically used `name`/`description` in schemas but nodes display `stepTitle/stepDescription`.
      // Keep these keys in sync so editing feels responsive and saved data remains backwards compatible.
      if (isFormStep && fieldId === 'name') {
        const next: any = {
          ...prev,
          name: value,
          title: value,
          label: value,
          stepTitle: value,
        };

        onUpdateNode(node.id, next);

        if (field) {
          const error = validateField(field, value, next);
          setErrors((errs) => ({
            ...errs,
            [fieldId]: error || '',
          }));
        }

        return next;
      }

      if (isFormStep && fieldId === 'description') {
        const next: any = {
          ...prev,
          description: value,
          stepDescription: value,
        };

        onUpdateNode(node.id, next);

        if (field) {
          const error = validateField(field, value, next);
          setErrors((errs) => ({
            ...errs,
            [fieldId]: error || '',
          }));
        }

        return next;
      }

      // Canonical node title: keep legacy keys in sync for backwards compatibility.
      if (fieldId === 'title') {
        const next: any = {
          ...prev,
          title: value,
          label: value,
        };

        if (typeof (prev as any).containerName === 'string') next.containerName = value;
        if (typeof (prev as any).name === 'string') next.name = value;

        onUpdateNode(node.id, next);

        if (field) {
          const error = validateField(field, value, next);
          setErrors((errs) => ({
            ...errs,
            [fieldId]: error || '',
          }));
        }

        return next;
      }

      if (fieldId === 'fields' && field?.type === 'entity-field-picker') {
        const next = {
          ...prev,
          fields: value,
          formFields: Array.isArray(value) ? toFormFieldsFromSelectedFields(value as any) : [],
        };
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
    if (isReadOnly) return;

    const updatedNode = AutoMappingService.applySuggestion(
      ({ ...node, data: formData } as any),
      suggestion
    );

    const nextData = (updatedNode.data || {}) as Record<string, unknown>;
    setFormData(nextData);

    // Stage only the relevant mapping patch into shadow state.
    // The shadow-state hook expects partial updates; passing the entire formData can
    // accidentally merge unrelated keys and make dirty detection flaky.
    onUpdateNode(node.id, { fieldMappings: (nextData as any).fieldMappings } as Record<string, any>);

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
    if (isReadOnly) return;

    const updatedNode = AutoMappingService.applyAutoSuggestions(
      ({ ...node, data: formData } as any),
      autoMap
    );

    const nextData = (updatedNode.data || {}) as Record<string, unknown>;
    setFormData(nextData);

    // Stage only the relevant mapping patch into shadow state.
    // The shadow-state hook expects partial updates; passing the entire formData can
    // accidentally merge unrelated keys and make dirty detection flaky.
    onUpdateNode(node.id, { fieldMappings: (nextData as any).fieldMappings } as Record<string, any>);

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
    const rawValue = (effectiveFormData as any)[field.id];

    // Additive aliasing for legacy/workflow-safe interoperability.
    // (Do not mutate formData here; just compute the displayed value.)
    const value =
      rawValue ??
      (field.id === 'entityType' ? (formData as any).entity : undefined) ??
      (field.id === 'fields' ? (formData as any).fieldMappings : undefined) ??
      (field.id === 'fieldMappings' ? (formData as any).fields : undefined) ??
      field.defaultValue;

    const error = errors[field.id];

    const commonProps = {
      field,
      value,
      onChange: (newValue: any) => handleFieldChange(field.id, newValue),
      onFieldChange: (fieldId: string, newValue: any) => handleFieldChange(fieldId, newValue),
      error,
      disabled: Boolean(isReadOnly || field.disabled || field.readOnly),
      allValues: formData
    };

    // Route to appropriate renderer based on field type
    let renderedField = null;
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'number':
      case 'time':
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
      
      case 'fieldMapping':
      case 'field-mapping':
        renderedField = renderFieldMapping({
          ...commonProps,
          data: { 
            ...formData, 
            _upstreamVariables: upstreamVariables  // Pass upstream variables for mapping
          }
        });
        break;
      
      case 'variablePicker':
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

      case 'formReference': {
        const selected = (value as string) || '';
        const title = typeof field.placeholder === 'string' ? field.placeholder : 'Select a form...';

        const forms = (tenantForms || []).slice().sort((a: any, b: any) => {
          const aT = new Date(a?.created_at || 0).getTime();
          const bT = new Date(b?.created_at || 0).getTime();
          return bT - aT;
        });

        renderedField = (
          <FormField key={field.id}>
            <Label>{field.label}</Label>
            <Select
              value={selected}
              onChange={async (e) => {
                const selectedFormId = e.target.value;
                commonProps.onChange(selectedFormId);

                if (!node?.id) return;
                if (!selectedFormId) return;

                const nodeId = node.id;
                const selectedFromList = forms.find((f: any) => String(f?.id) === String(selectedFormId));
                const friendlyName =
                  selectedFromList?.title ||
                  selectedFromList?.display_name ||
                  selectedFromList?.displayName ||
                  selectedFromList?.name ||
                  undefined;
                const friendlyDescription = selectedFromList?.description || selectedFromList?.helpText || undefined;

                try {
                  const form = await getTenantForm(String(selectedFormId));
                  const definition = (form as any).form_definition ?? (form as any).flow_data;

                  let fieldCount = 0;
                  let sectionCount = 0;

                  if (definition?.fields && Array.isArray(definition.fields)) {
                    fieldCount = definition.fields.length;
                    sectionCount = 1;
                  } else if (definition?.steps && Array.isArray(definition.steps)) {
                    sectionCount = definition.steps.length;
                    fieldCount = definition.steps.reduce((acc: number, step: any) => {
                      const count = Array.isArray(step?.fields) ? step.fields.length : 0;
                      return acc + count;
                    }, 0);
                  }

                  if (!node?.id || node.id !== nodeId) return;

                  onUpdateNode(nodeId, {
                    // Keep common legacy keys in sync.
                    formId: selectedFormId,
                    tenantFormId: selectedFormId,
                    formName: friendlyName ?? (form as any)?.name,
                    formDescription: friendlyDescription ?? (form as any)?.description,
                    fieldCount,
                    sectionCount,
                  });
                } catch (err) {
                  console.warn('[DynamicConfigPanel] Failed to load selected form metadata:', err);
                }
              }}
              disabled={field.disabled || commonProps.disabled || tenantFormsLoading}
              $hasError={Boolean(error)}
            >
              <option value="">
                {tenantFormsLoading ? 'Loading forms...' : title}
              </option>
              {selected && !forms.some((f: any) => String(f?.id) === String(selected)) && (
                <option value={selected}>{selected} (legacy)</option>
              )}
              {forms.map((f: any) => {
                const name = f?.title || f?.display_name || f?.displayName || f?.name || `Form ${f?.id}`;
                const createdLabel = f?.created_at
                  ? new Date(f.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                    })
                  : null;

                return (
                  <option key={f.id} value={f.id}>
                    {createdLabel ? `${name} — ${createdLabel}` : name}
                  </option>
                );
              })}
            </Select>
            {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
            {tenantFormsError && <ErrorMessage>{tenantFormsError}</ErrorMessage>}
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </FormField>
        );
        break;
      }

      case 'keyValue': {
        const mode = (field as any).keyValueMode === 'record' ? 'record' : 'array';

        const placeholderKey = (field.placeholder as any)?.key || 'Key';
        const placeholderValue = (field.placeholder as any)?.value || 'Value';
        const addText = (field as any).addButtonText || '+ Add';

        if (mode === 'record') {
          const coerceRecord = (input: unknown): Record<string, string> => {
            if (Array.isArray(input)) {
              const out: Record<string, string> = {};
              (input as any[]).forEach((p: any) => {
                const k = String(p?.key ?? '').trim();
                if (!k) return;
                out[k] = String(p?.value ?? '');
              });
              return out;
            }

            if (input && typeof input === 'object') {
              const out: Record<string, string> = {};
              Object.entries(input as Record<string, any>).forEach(([k, v]) => {
                const key = String(k).trim();
                if (!key) return;
                out[key] = v === undefined || v === null ? '' : String(v);
              });
              return out;
            }

            return {};
          };

          const record = coerceRecord(value ?? field.defaultValue);
          const persistedPairs = Object.entries(record).map(([k, v]) => ({ key: k, value: String(v ?? '') }));
          const draftPairs = keyValueDrafts[field.id] ?? [];
          const pairs = [...persistedPairs, ...draftPairs];

          const setDraftPairs = (nextDraft: Array<{ key: string; value: string }>) => {
            setKeyValueDrafts((prev) => ({
              ...prev,
              [field.id]: nextDraft,
            }));
          };

          const emitRecord = (nextRecord: Record<string, string>) => {
            commonProps.onChange(nextRecord);
          };

          const addPair = () => {
            setDraftPairs([...(draftPairs || []), { key: '', value: '' }]);
          };

          const removePair = (idx: number) => {
            if (idx < persistedPairs.length) {
              const keyToRemove = String(persistedPairs[idx]?.key ?? '').trim();
              if (!keyToRemove) return;
              const next = { ...record };
              delete next[keyToRemove];
              emitRecord(next);
              return;
            }

            const draftIdx = idx - persistedPairs.length;
            const nextDraft = (draftPairs || []).filter((_, i) => i !== draftIdx);
            setDraftPairs(nextDraft);
          };

          const updatePair = (idx: number, patch: Partial<{ key: string; value: string }>) => {
            if (idx < persistedPairs.length) {
              const prevKey = String(persistedPairs[idx]?.key ?? '').trim();
              const prevVal = String(persistedPairs[idx]?.value ?? '');

              const nextKeyRaw = patch.key !== undefined ? String(patch.key) : prevKey;
              const nextValRaw = patch.value !== undefined ? String(patch.value) : prevVal;

              const nextKey = String(nextKeyRaw ?? '').trim();
              const nextVal = String(nextValRaw ?? '');

              const nextRecord = { ...record };
              if (prevKey) delete nextRecord[prevKey];
              if (nextKey) nextRecord[nextKey] = nextVal;

              emitRecord(nextRecord);
              return;
            }

            const draftIdx = idx - persistedPairs.length;
            const current = (draftPairs || [])[draftIdx] ?? { key: '', value: '' };
            const nextRow = { ...current, ...patch };
            const nextDraft = (draftPairs || []).map((p, i) => (i === draftIdx ? nextRow : p));

            const promotedKey = String(nextRow.key ?? '').trim();
            if (promotedKey) {
              emitRecord({ ...record, [promotedKey]: String(nextRow.value ?? '') });
              setDraftPairs(nextDraft.filter((_, i) => i !== draftIdx));
              return;
            }

            setDraftPairs(nextDraft);
          };

          renderedField = (
            <FormField key={field.id}>
              <Label>{field.label}</Label>
              <KeyValueList>
                {pairs.length === 0 && <KeyValueEmpty>None configured yet.</KeyValueEmpty>}
                {pairs.map((p, idx) => (
                  <KeyValueRow key={`${field.id}-${idx}`}>
                    <Input
                      value={p?.key ?? ''}
                      placeholder={placeholderKey}
                      onChange={(e) => updatePair(idx, { key: e.target.value })}
                      disabled={field.disabled || commonProps.disabled}
                    />
                    <Input
                      value={p?.value ?? ''}
                      placeholder={placeholderValue}
                      onChange={(e) => updatePair(idx, { value: e.target.value })}
                      disabled={field.disabled || commonProps.disabled}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => removePair(idx)}
                      disabled={field.disabled || commonProps.disabled}
                      style={{ padding: '6px 10px' }}
                    >
                      Remove
                    </Button>
                  </KeyValueRow>
                ))}
                <Button
                  type="button"
                  variant="primary"
                  onClick={addPair}
                  disabled={field.disabled || commonProps.disabled}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {addText}
                </Button>
              </KeyValueList>
              {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
              {error && <ErrorMessage>{error}</ErrorMessage>}
            </FormField>
          );

          break;
        }

        // Array mode (persist pairs directly)
        const pairs: Array<{ key: string; value: string }> = Array.isArray(value)
          ? (value as any)
          : Array.isArray(field.defaultValue)
            ? (field.defaultValue as any)
            : [];

        const emit = (nextPairs: Array<{ key: string; value: string }>) => {
          commonProps.onChange(nextPairs);
        };

        const updatePair = (idx: number, patch: Partial<{ key: string; value: string }>) => {
          emit(pairs.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
        };

        const removePair = (idx: number) => {
          emit(pairs.filter((_, i) => i !== idx));
        };

        const addPair = () => {
          emit([...(pairs || []), { key: '', value: '' }]);
        };

        renderedField = (
          <FormField key={field.id}>
            <Label>{field.label}</Label>
            <KeyValueList>
              {pairs.length === 0 && <KeyValueEmpty>None configured yet.</KeyValueEmpty>}
              {pairs.map((p, idx) => (
                <KeyValueRow key={`${field.id}-${idx}`}>
                  <Input
                    value={p?.key ?? ''}
                    placeholder={placeholderKey}
                    onChange={(e) => updatePair(idx, { key: e.target.value })}
                    disabled={field.disabled || commonProps.disabled}
                  />
                  <Input
                    value={p?.value ?? ''}
                    placeholder={placeholderValue}
                    onChange={(e) => updatePair(idx, { value: e.target.value })}
                    disabled={field.disabled || commonProps.disabled}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => removePair(idx)}
                    disabled={field.disabled || commonProps.disabled}
                    style={{ padding: '6px 10px' }}
                  >
                    Remove
                  </Button>
                </KeyValueRow>
              ))}
              <Button
                type="button"
                variant="primary"
                onClick={addPair}
                disabled={field.disabled || commonProps.disabled}
                style={{ alignSelf: 'flex-start' }}
              >
                {addText}
              </Button>
            </KeyValueList>
            {field.helpText && !error && <HelpText>{field.helpText}</HelpText>}
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </FormField>
        );
        break;
      }

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
              disabled={commonProps.disabled}
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
              disabled={commonProps.disabled}
              onClick={() => {
                if (commonProps.disabled) return;
                if (!node) {
                  console.warn('[DynamicConfigPanel] Cannot execute button action: node is null');
                  return;
                }
                // Check if button has FormBuilder action metadata
                if (field.metadata?.action === 'openFormBuilder') {
                  logger.debug('Opening FormBuilder', {
                    component: 'DynamicConfigPanel',
                    metadata: { nodeId: node.id },
                  });
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
          <MemoNestedChildrenRenderer
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
            <PlaceholderHint>Configuration field type not supported yet.</PlaceholderHint>
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
    if (!checkIsVisible(section, effectiveFormData)) {
      return null;
    }

    // Check if any fields in this section are visible
    const visibleFieldsInSection = section.fields.filter(f => visibleFields.has(f.id));

    const isCollapsed = collapsedSections.has(section.id);
    const isCollapsible = section.collapsible ?? false;

    const sectionTitleId = `pm-config-section-${section.id}-title`;
    const sectionRegionId = `pm-config-section-${section.id}-region`;

    const headerContents = (
      <>
        {section.icon && (() => {
          const Icon = section.icon as any;
          return <Icon size={16} />;
        })()}
        <SectionTitle id={sectionTitleId}>{section.title}</SectionTitle>
        {isCollapsible && (isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />)}
      </>
    );

    return (
      <Section key={section.id}>
        {isCollapsible ? (
          <SectionHeaderButton
            type="button"
            onClick={() => toggleSection(section.id)}
            aria-expanded={!isCollapsed}
            aria-controls={sectionRegionId}
          >
            {headerContents}
          </SectionHeaderButton>
        ) : (
          <SectionHeader>{headerContents}</SectionHeader>
        )}

        <SectionContentWrapper
          id={sectionRegionId}
          role="region"
          aria-labelledby={sectionTitleId}
          hidden={isCollapsed}
        >
          {!isCollapsed && (
            <>
              {section.description && <SectionDescription>{section.description}</SectionDescription>}

              {visibleFieldsInSection.length === 0 ? (
                <SectionEmptyState>
                  No configuration fields are available yet. Adjust earlier selections to unlock additional options.
                </SectionEmptyState>
              ) : (
                section.fields.map(renderField)
              )}
            </>
          )}
        </SectionContentWrapper>
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
        {!isReadOnly && visibleAutoMapSuggestions.length > 0 && (
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

        {!isReadOnly && visibleAutoMapSuggestions.length > 0 && (
          <MemoAutoMappingSuggestionsPanel
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
          background: rgb(var(--color-error));
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

const SectionHeaderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid rgba(var(--color-primary), 0.5);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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

const KeyValueList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const KeyValueRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
`;

const KeyValueEmpty = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
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
