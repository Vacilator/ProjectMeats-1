/**
 * FieldPropertiesEditor Component
 * 
 * Allows users to edit properties of a field when adding from an entity.
 * Supports:
 * - Custom label override
 * - Required status toggle
 * - Help text override
 * - Validation rules
 * - Default value
 * 
 * Phase C.1.2 of WF-ENH-2026-Q1
 * Created: 2026-02-18
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Check, X, AlertCircle } from 'lucide-react';
import { ValidationRule, ValidationRuleBuilder } from './ValidationRuleBuilder';
import { EntityField } from '../../../services/schemaService';
import {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelContent,
  PanelFooter,
  Section,
  SectionTitle,
  FormField,
  Label,
  Input,
  TextArea,
  HelpText,
  PrimaryButton,
  SecondaryButton,
  ErrorMessage,
} from './shared/StyledComponents';

// ============================================================================
// Types
// ============================================================================

export interface FieldProperties {
  /** Original field from entity */
  entityField: EntityField;
  
  /** Custom label (overrides entity field label) */
  customLabel?: string;
  
  /** Required status (overrides entity field required) */
  customRequired?: boolean;
  
  /** Custom help text (overrides entity help_text) */
  customHelpText?: string;
  
  /** Validation rules */
  validationRules?: ValidationRule[];
  
  /** Default value */
  defaultValue?: any;
}

export interface FieldPropertiesEditorProps {
  /** Field to edit properties for */
  field: EntityField;
  
  /** Initial properties (if editing existing) */
  initialProperties?: Partial<FieldProperties>;
  
  /** Callback when properties are saved */
  onSave: (properties: FieldProperties) => void;
  
  /** Callback when editor is cancelled */
  onCancel: () => void;
  
  /** Show as modal overlay (default: true) */
  modal?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
`;

const EditorPanel = styled(Panel)`
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
`;

const ScrollableContent = styled(PanelContent)`
  overflow-y: auto;
  flex: 1;
`;

const FieldPreview = styled.div`
  padding: 12px;
  background: rgba(var(--color-primary), 0.05);
  border: 1px solid rgba(var(--color-primary), 0.2);
  border-radius: 6px;
  margin-bottom: 16px;
`;

const FieldName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const FieldMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Badge = styled.span<{ $variant?: 'type' | 'required' }>`
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 3px;
  background: ${props => {
    if (props.$variant === 'required') return 'rgba(239, 68, 68, 0.1)';
    return 'rgba(var(--color-primary), 0.1)';
  }};
  color: ${props => {
    if (props.$variant === 'required') return 'rgb(239, 68, 68)';
    return 'rgb(var(--color-primary))';
  }};
`;

const CheckboxField = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  user-select: none;
`;

const OverrideNote = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  font-size: 12px;
  color: rgb(59, 130, 246);
  margin-top: 8px;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const FieldPropertiesEditor: React.FC<FieldPropertiesEditorProps> = ({
  field,
  initialProperties,
  onSave,
  onCancel,
  modal = true,
}) => {
  const [customLabel, setCustomLabel] = useState(initialProperties?.customLabel || '');
  const [customRequired, setCustomRequired] = useState(
    initialProperties?.customRequired !== undefined 
      ? initialProperties.customRequired 
      : field.required
  );
  const [customHelpText, setCustomHelpText] = useState(initialProperties?.customHelpText || '');
  const [defaultValue, setDefaultValue] = useState(initialProperties?.defaultValue || '');
  const [validationRules, setValidationRules] = useState<ValidationRule[]>(
    initialProperties?.validationRules || []
  );
  const [showValidationBuilder, setShowValidationBuilder] = useState(false);

  const hasCustomLabel = customLabel && customLabel !== field.label;
  const hasCustomRequired = customRequired !== field.required;
  const hasCustomHelpText = customHelpText && customHelpText !== field.help_text;
  const hasOverrides = hasCustomLabel || hasCustomRequired || hasCustomHelpText;

  const handleSave = () => {
    const properties: FieldProperties = {
      entityField: field,
      customLabel: hasCustomLabel ? customLabel : undefined,
      customRequired: hasCustomRequired ? customRequired : undefined,
      customHelpText: hasCustomHelpText ? customHelpText : undefined,
      validationRules: validationRules.length > 0 ? validationRules : undefined,
      defaultValue: defaultValue || undefined,
    };

    onSave(properties);
  };

  const handleReset = () => {
    setCustomLabel('');
    setCustomRequired(field.required);
    setCustomHelpText('');
    setDefaultValue('');
    setValidationRules([]);
  };

  const editorContent = (
    <EditorPanel>
      <PanelHeader>
        <PanelTitle>Edit Field Properties</PanelTitle>
      </PanelHeader>

      <ScrollableContent>
        {/* Original Field Info */}
        <FieldPreview>
          <FieldName>{field.label}</FieldName>
          <FieldMeta>
            <Badge $variant="type">{field.type}</Badge>
            {field.required && <Badge $variant="required">required</Badge>}
            <span>• {field.name}</span>
          </FieldMeta>
          {field.help_text && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgb(var(--color-text-secondary))' }}>
              {field.help_text}
            </div>
          )}
        </FieldPreview>

        {/* Custom Label */}
        <Section>
          <SectionTitle>Display Settings</SectionTitle>
          <FormField>
            <Label htmlFor="custom-label">
              Custom Label
              {hasCustomLabel && (
                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'rgb(var(--color-primary))' }}>
                  (overridden)
                </span>
              )}
            </Label>
            <Input
              id="custom-label"
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={`Default: ${field.label}`}
            />
            <HelpText>
              Override the default field label. Leave empty to use "{field.label}".
            </HelpText>
          </FormField>

          <FormField>
            <Label htmlFor="custom-help-text">Custom Help Text</Label>
            <TextArea
              id="custom-help-text"
              value={customHelpText}
              onChange={(e) => setCustomHelpText(e.target.value)}
              placeholder={field.help_text || 'Add helpful instructions for users...'}
              rows={2}
            />
            <HelpText>
              Override or add help text displayed below the field.
            </HelpText>
          </FormField>
        </Section>

        {/* Required Status */}
        <Section>
          <SectionTitle>Validation Settings</SectionTitle>
          <CheckboxField>
            <Checkbox
              id="custom-required"
              checked={customRequired}
              onChange={(e) => setCustomRequired(e.target.checked)}
            />
            <CheckboxLabel htmlFor="custom-required">
              Required field
              {hasCustomRequired && (
                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'rgb(var(--color-primary))' }}>
                  (overridden from {field.required ? 'required' : 'optional'})
                </span>
              )}
            </CheckboxLabel>
          </CheckboxField>
          <HelpText style={{ marginLeft: '26px' }}>
            Users must provide a value for this field to submit the form.
          </HelpText>

          {/* Validation Rules Builder */}
          <div style={{ marginTop: '16px' }}>
            <SecondaryButton
              onClick={() => setShowValidationBuilder(!showValidationBuilder)}
              style={{ width: '100%' }}
            >
              {showValidationBuilder ? 'Hide' : 'Add'} Validation Rules ({validationRules.length})
            </SecondaryButton>

            {showValidationBuilder && (
              <div style={{ marginTop: '12px' }}>
                <ValidationRuleBuilder
                  fieldType={field.type as any}
                  rules={validationRules}
                  onChange={setValidationRules}
                />
              </div>
            )}
          </div>
        </Section>

        {/* Default Value */}
        <Section>
          <SectionTitle>Default Value</SectionTitle>
          <FormField>
            <Label htmlFor="default-value">Default Value</Label>
            {field.type === 'textarea' ? (
              <TextArea
                id="default-value"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="Enter default value..."
                rows={2}
              />
            ) : (
              <Input
                id="default-value"
                type={field.type === 'number' ? 'number' : 'text'}
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="Enter default value..."
              />
            )}
            <HelpText>
              Pre-fill this field with a default value. Users can change it.
            </HelpText>
          </FormField>
        </Section>

        {/* Override Summary */}
        {hasOverrides && (
          <OverrideNote>
            <AlertCircle size={16} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Customizations Applied</div>
              <div>
                {hasCustomLabel && `• Label: "${customLabel}"`}
                {hasCustomLabel && (hasCustomRequired || hasCustomHelpText) && <br />}
                {hasCustomRequired && `• Required: ${customRequired ? 'Yes' : 'No'}`}
                {hasCustomRequired && hasCustomHelpText && <br />}
                {hasCustomHelpText && `• Help text customized`}
              </div>
            </div>
          </OverrideNote>
        )}
      </ScrollableContent>

      <PanelFooter>
        <SecondaryButton onClick={handleReset} disabled={!hasOverrides && validationRules.length === 0 && !defaultValue}>
          Reset
        </SecondaryButton>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SecondaryButton onClick={onCancel}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave}>
            <Check size={16} style={{ marginRight: '4px' }} />
            Apply
          </PrimaryButton>
        </div>
      </PanelFooter>
    </EditorPanel>
  );

  if (modal) {
    return (
      <ModalOverlay onClick={(e) => e.target === e.currentTarget && onCancel()}>
        {editorContent}
      </ModalOverlay>
    );
  }

  return editorContent;
};

export default FieldPropertiesEditor;
