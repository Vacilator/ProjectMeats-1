/**
 * SectionConfigPanel Component
 * 
 * Configuration modal for Section nodes in WorkForms editor.
 * Allows setting title, description, icon, collapsible behavior, and conditional visibility.
 * 
 * Part of Phase 1 Task 1.2 - WORKFORMS_NAVIGATION_FIX_PLAN
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { ConditionBuilder, ConditionRule, ConditionLogic } from './ConditionBuilder';

import {
  Panel,
  PanelHeader,
  PanelTitle,
  CloseButton,
  PanelContent,
  FormField,
  Label,
  RequiredIndicator as RequiredMarker,
  Input,
  TextArea,
  HelpText,
  PanelFooter,
  PrimaryButton,
  SecondaryButton,
} from './shared/StyledComponents';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface SectionData {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
  conditionalVisibility?: {
    enabled: boolean;
    conditions?: ConditionRule[];
    logic?: ConditionLogic;
  };
}

interface SectionConfigPanelProps {
  section: SectionData;
  onChange: (section: SectionData) => void;
  onClose: () => void;
  availableFields?: Array<{ id: string; label: string; type: string }>;
}

// ============================================================================
// Icon Options
// ============================================================================

const SECTION_ICONS = [
  { value: '📋', label: 'Clipboard' },
  { value: '📝', label: 'Note' },
  { value: '👤', label: 'Person' },
  { value: '🏢', label: 'Building' },
  { value: '📧', label: 'Email' },
  { value: '📞', label: 'Phone' },
  { value: '🏠', label: 'Home' },
  { value: '💼', label: 'Briefcase' },
  { value: '💳', label: 'Card' },
  { value: '📦', label: 'Package' },
  { value: '🚚', label: 'Delivery' },
  { value: '⚙️', label: 'Settings' },
  { value: '🔒', label: 'Lock' },
  { value: '✅', label: 'Check' },
  { value: '📊', label: 'Chart' },
  { value: '📅', label: 'Calendar' },
];

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  width: 450px;
  height: 100vh;
  background: rgb(var(--color-surface));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  animation: slideIn 0.25s ease-out;

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
`;

const Divider = styled.div`
  height: 1px;
  background: rgb(var(--color-border));
  margin: 24px 0;
`;





















const IconGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  margin-top: 8px;
`;

const IconButton = styled.button<{ selected: boolean }>`
  background: ${props => props.selected 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-surface))'};
  border: 2px solid ${props => props.selected 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: 6px;
  padding: 8px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;

  &:hover {
    border-color: rgb(var(--color-primary));
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
`;

const ToggleSwitch = styled.label`
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
`;

const ToggleInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background-color: rgb(var(--color-primary));
  }

  &:checked + span:before {
    transform: translateX(20px);
  }
`;

const ToggleSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgb(var(--color-border));
  transition: 0.3s;
  border-radius: 24px;

  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
`;

const ToggleLabel = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  user-select: none;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
`;

const RadioOption = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const RadioInput = styled.input`
  margin-top: 2px;
  cursor: pointer;
`;

const RadioContent = styled.div`
  flex: 1;
`;

const RadioTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const RadioDescription = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

// NOTE: Use shared PrimaryButton/SecondaryButton for consistency across config panels.

// ============================================================================
// Main Component
// ============================================================================

export const SectionConfigPanel: React.FC<SectionConfigPanelProps> = ({
  section,
  onChange,
  onClose,
  availableFields = [],
}) => {
  const normalizeLogic = (logic: unknown): ConditionLogic => {
    const value = typeof logic === 'string' ? logic.toLowerCase() : '';
    return value === 'or' ? 'or' : 'and';
  };

  const conditionAvailableFields = availableFields.map(field => ({
    key: field.id,
    label: field.label,
    type: field.type,
  }));

  const [formData, setFormData] = useState<SectionData>({
    title: section.title || '',
    description: section.description || '',
    icon: section.icon || '📋',
    isCollapsible: section.isCollapsible ?? false,
    defaultCollapsed: section.defaultCollapsed ?? false,
    conditionalVisibility: section.conditionalVisibility
      ? {
          ...section.conditionalVisibility,
          logic: normalizeLogic(section.conditionalVisibility.logic),
        }
      : {
          enabled: false,
          conditions: [],
          logic: 'and',
        },
  });

  const [visibilityMode, setVisibilityMode] = useState<'always' | 'conditional'>(
    section.conditionalVisibility?.enabled ? 'conditional' : 'always'
  );

  const isValid = formData.title.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;

    onChange({
      ...formData,
      conditionalVisibility: {
        ...formData.conditionalVisibility!,
        enabled: visibilityMode === 'conditional',
      },
    });
    onClose();
  };

  const handleConditionsChange = (conditions: ConditionRule[], logic: ConditionLogic) => {
    setFormData(prev => ({
      ...prev,
      conditionalVisibility: {
        ...prev.conditionalVisibility!,
        conditions,
        logic,
      },
    }));
  };

  return (
    <Container>
      <PanelHeader>
        <PanelTitle>Configure Section</PanelTitle>
        <CloseButton onClick={onClose}>
          <X size={20} />
        </CloseButton>
      </PanelHeader>

      <PanelContent>
        {/* Title */}
        <FormField>
          <Label>
            Section Title
            <RequiredMarker>*</RequiredMarker>
          </Label>
          <Input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter section title"
          />
          <HelpText>
            <Info size={14} />
            <span>The title will be displayed at the top of the section</span>
          </HelpText>
        </FormField>

        {/* Description */}
        <FormField>
          <Label>Description (Optional)</Label>
          <TextArea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add a description to help users understand this section"
          />
        </FormField>

        {/* Icon Picker */}
        <FormField>
          <Label>Section Icon</Label>
          <IconGrid>
            {SECTION_ICONS.map((icon) => (
              <IconButton
                key={icon.value}
                selected={formData.icon === icon.value}
                onClick={() => setFormData(prev => ({ ...prev, icon: icon.value }))}
                title={icon.label}
                type="button"
              >
                {icon.value}
              </IconButton>
            ))}
          </IconGrid>
        </FormField>

        <Divider />

        {/* Collapsible Settings */}
        <FormField>
          <Label>Collapsible Behavior</Label>
          <ToggleContainer>
            <ToggleSwitch>
              <ToggleInput
                type="checkbox"
                checked={formData.isCollapsible}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  isCollapsible: e.target.checked,
                  defaultCollapsed: e.target.checked ? prev.defaultCollapsed : false,
                }))}
              />
              <ToggleSlider />
            </ToggleSwitch>
            <ToggleLabel>Allow users to collapse this section</ToggleLabel>
          </ToggleContainer>
          {formData.isCollapsible && (
            <ToggleContainer style={{ marginTop: '12px', marginLeft: '56px' }}>
              <ToggleSwitch>
                <ToggleInput
                  type="checkbox"
                  checked={formData.defaultCollapsed}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    defaultCollapsed: e.target.checked,
                  }))}
                />
                <ToggleSlider />
              </ToggleSwitch>
              <ToggleLabel>Start collapsed by default</ToggleLabel>
            </ToggleContainer>
          )}
          <HelpText>
            <Info size={14} />
            <span>
              {formData.isCollapsible 
                ? 'Users can expand/collapse this section to show or hide its contents'
                : 'Section will always be visible and cannot be collapsed'}
            </span>
          </HelpText>
        </FormField>

        <Divider />

        {/* Conditional Visibility */}
        <FormField>
          <Label>Section Visibility</Label>
          <RadioGroup>
            <RadioOption>
              <RadioInput
                type="radio"
                name="visibility"
                checked={visibilityMode === 'always'}
                onChange={() => setVisibilityMode('always')}
              />
              <RadioContent>
                <RadioTitle>Always show this section</RadioTitle>
                <RadioDescription>
                  Section will be visible to all users
                </RadioDescription>
              </RadioContent>
            </RadioOption>

            <RadioOption>
              <RadioInput
                type="radio"
                name="visibility"
                checked={visibilityMode === 'conditional'}
                onChange={() => setVisibilityMode('conditional')}
              />
              <RadioContent>
                <RadioTitle>Show conditionally</RadioTitle>
                <RadioDescription>
                  Only show section when certain conditions are met
                </RadioDescription>
              </RadioContent>
            </RadioOption>
          </RadioGroup>

          {visibilityMode === 'conditional' && (
            <div style={{ marginTop: '16px' }}>
              <ConditionBuilder
                conditions={formData.conditionalVisibility!.conditions || []}
                logic={normalizeLogic(formData.conditionalVisibility!.logic)}
                availableFields={conditionAvailableFields}
                onChange={handleConditionsChange}
              />
            </div>
          )}
        </FormField>
      </PanelContent>

      <PanelFooter>
        <SecondaryButton onClick={onClose}>
          Cancel
        </SecondaryButton>
        <PrimaryButton onClick={handleSave} disabled={!isValid}>
          Save Section
        </PrimaryButton>
      </PanelFooter>
    </Container>
  );
};
