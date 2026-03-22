/**
 * ConfigPanel Components
 * 
 * Export all configuration panel components
 */
// NOTE: NodeConfigPanel is legacy and intentionally not exported to prevent regressions.
// Use TabbedConfigPanelWithShadow / NodeConfigPanelWithShadow (schema-driven) instead.
export { NodeConfigPanelWithShadow } from './NodeConfigPanelWithShadow'; // Phase 2
export { FormStepConfigPanel } from './FormStepConfigPanel';
export { FormFieldConfigPanel } from './FormFieldConfigPanel';
export { SectionConfigPanel } from './SectionConfigPanel';
export { DocumentConfigPanel } from './DocumentConfigPanel';
export { CreateRecordConfigPanel } from './CreateRecordConfigPanel';
export { FormReferenceConfigPanel } from './FormReferenceConfigPanel';
export { FieldMappingPanel } from './FieldMappingPanel';
export { ConditionBuilder } from './ConditionBuilder';
export { ValidationRuleBuilder } from './ValidationRuleBuilder';
export { FieldWithContext } from './FieldWithContext'; // Phase 5

// Phase 2: WorkForms Enhancement (WF-ENH-2026-Q1)
export { FormSelectionPanel } from './FormSelectionPanel';
export { EntityFieldPicker } from './EntityFieldPicker';
export { FieldConfigurationPanel } from './FieldConfigurationPanel';
export { FieldPropertiesEditor } from './FieldPropertiesEditor'; // Phase C.1.2

export type { NodeConfigPanelWithShadowProps } from './NodeConfigPanelWithShadow'; // Phase 2
export type { FormSelectionPanelProps } from './FormSelectionPanel';
export type { EntityFieldPickerProps, SelectedField } from './EntityFieldPicker';
export type { FieldConfigurationPanelProps, FieldConfig } from './FieldConfigurationPanel';
export type { FieldPropertiesEditorProps, FieldProperties } from './FieldPropertiesEditor'; // Phase C.1.2
export type { FieldWithContextProps } from './FieldWithContext'; // Phase 5
export { StepManagerPanel } from './StepManagerPanel';
export { FormProcessConfigPanel } from './FormProcessConfigPanel';

// Phase D.2: Dynamic Configuration Engine
export { DynamicConfigPanel } from './DynamicConfigPanel';
export type { DynamicConfigPanelProps } from './DynamicConfigPanel';

// Phase D.3: Tabbed Config Panel (2026-02-24)
export { TabbedConfigPanel } from './TabbedConfigPanel';
export type { TabbedConfigPanelProps } from './TabbedConfigPanel';
export { TabbedConfigPanelWithShadow } from './TabbedConfigPanelWithShadow';
export type { TabbedConfigPanelWithShadowProps } from './TabbedConfigPanelWithShadow';

// Phase D.4: Visual Form Builder (2026-02-24)
export { VisualFormBuilderPanel } from './VisualFormBuilderPanel';
export type { VisualFormBuilderPanelProps } from './VisualFormBuilderPanel';
export { LiveFormPreview } from './LiveFormPreview';
export type { LiveFormPreviewProps } from './LiveFormPreview';
