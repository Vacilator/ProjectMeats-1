/**
 * DocumentConfigPanel Component
 * 
 * Configuration modal for Document/File Upload nodes in WorkForms editor.
 * Allows setting file types, size limits, upload destination, OCR, and validation rules.
 * 
 * Part of Phase 1 Task 1.3 - WORKFORMS_NAVIGATION_FIX_PLAN
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { X, FileUp, Info, AlertCircle } from 'lucide-react';
import { ConditionBuilder, ConditionRule, ConditionLogic } from './ConditionBuilder';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface DocumentData {
  id?: string;
  label: string;
  description?: string;
  allowedFileTypes?: string[];
  maxFileSize?: number; // in MB
  minFiles?: number;
  maxFiles?: number;
  uploadFolder?: string;
  enableOCR?: boolean;
  required?: boolean;
  conditionalVisibility?: {
    enabled: boolean;
    conditions?: ConditionRule[];
    logic?: ConditionLogic;
  };
}

import {
  Panel,
  PanelHeader,
  PanelTitle,
  CloseButton,
  PanelContent,
  Section,
  SectionHeader,
  SectionTitle,
  FormField,
  Label,
  RequiredIndicator,
  Input,
  Select,
  TextArea,
  Checkbox,
  HelpText,
  PanelFooter,
  PrimaryButton,
  SecondaryButton,
  SettingRow,
  SettingLabel,
  SettingDescription,
} from './shared/StyledComponents';

interface DocumentConfigPanelProps {
  document: DocumentData;
  onChange: (document: DocumentData) => void;
  onClose: () => void;
  availableFields?: Array<{ id: string; label: string; type: string }>;
}

// ============================================================================
// File Type Presets
// ============================================================================

const FILE_TYPE_PRESETS = [
  { id: 'documents', label: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] },
  { id: 'images', label: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg'] },
  { id: 'spreadsheets', label: 'Spreadsheets', extensions: ['xls', 'xlsx', 'csv'] },
  { id: 'archives', label: 'Archives', extensions: ['zip', 'rar', '7z'] },
  { id: 'all', label: 'All Files', extensions: ['*'] },
];

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  width: 500px;
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



const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;



const IconBadge = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgb(var(--color-primary) / 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-primary));
`;

















const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
`;

const PresetButton = styled.button<{ selected: boolean }>`
  padding: 10px 14px;
  border: 2px solid ${props => props.selected 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: 6px;
  background: ${props => props.selected 
    ? 'rgb(var(--color-primary) / 0.1)' 
    : 'rgb(var(--color-surface))'};
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    border-color: rgb(var(--color-primary));
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ChipContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const Chip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
`;

const InputGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const InputWithUnit = styled.div`
  position: relative;
  flex: 1;
`;

const UnitLabel = styled.span`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  pointer-events: none;
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

const Divider = styled.div`
  height: 1px;
  background: rgb(var(--color-border));
  margin: 24px 0;
`;



const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${props => props.variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;

    &:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  ` : `
    background: rgb(var(--color-surface));
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));

    &:hover {
      background: rgb(var(--color-surface-hover));
    }
  `}
`;

const WarningBox = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgb(var(--color-warning) / 0.1);
  border: 1px solid rgb(var(--color-warning));
  border-radius: 6px;
  margin-top: 12px;

  svg {
    flex-shrink: 0;
    color: rgb(var(--color-warning));
  }
`;

const WarningText = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
`;

// ============================================================================
// Main Component
// ============================================================================

export const DocumentConfigPanel: React.FC<DocumentConfigPanelProps> = ({
  document,
  onChange,
  onClose,
  availableFields = [],
}) => {
  const [formData, setFormData] = useState<DocumentData>({
    label: document.label || '',
    description: document.description || '',
    allowedFileTypes: document.allowedFileTypes || [],
    maxFileSize: document.maxFileSize || 10,
    minFiles: document.minFiles || 1,
    maxFiles: document.maxFiles || 1,
    uploadFolder: document.uploadFolder || 'uploads',
    enableOCR: document.enableOCR ?? false,
    required: document.required ?? true,
    conditionalVisibility: document.conditionalVisibility || {
      enabled: false,
      conditions: [],
      logic: 'AND' as ConditionLogic,
    },
  });

  const [visibilityMode, setVisibilityMode] = useState<'always' | 'conditional'>(
    document.conditionalVisibility?.enabled ? 'conditional' : 'always'
  );

  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const isValid = formData.label.trim().length > 0;

  const handlePresetSelect = (presetId: string) => {
    const preset = FILE_TYPE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setSelectedPreset(presetId);
    setFormData(prev => ({
      ...prev,
      allowedFileTypes: preset.extensions,
    }));
  };

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
        <PanelHeaderTitle>
          <IconBadge>
            <FileUp size={20} />
          </IconBadge>
          <PanelTitle>Configure File Upload</PanelTitle>
        </PanelHeaderTitle>
        <CloseButton onClick={onClose}>
          <X size={20} />
        </CloseButton>
      </PanelHeader>

      <PanelContent>
        {/* Label */}
        <FormField>
          <Label>
            Field Label
            <RequiredIndicator>*</RequiredIndicator>
          </Label>
          <Input
            type="text"
            value={formData.label}
            onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
            placeholder="e.g., Upload Contract Document"
          />
          <HelpText>
            <Info size={14} />
            <span>The label shown to users above the upload field</span>
          </HelpText>
        </FormField>

        {/* Description */}
        <FormField>
          <Label>Description (Optional)</Label>
          <TextArea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add instructions or requirements for the file upload"
          />
        </FormField>

        <Divider />

        {/* File Type Restrictions */}
        <FormField>
          <Label>Allowed File Types</Label>
          <PresetGrid>
            {FILE_TYPE_PRESETS.map((preset) => (
              <PresetButton
                key={preset.id}
                selected={selectedPreset === preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                type="button"
              >
                {preset.label}
              </PresetButton>
            ))}
          </PresetGrid>
          {formData.allowedFileTypes && formData.allowedFileTypes.length > 0 && (
            <ChipContainer>
              {formData.allowedFileTypes.map((type) => (
                <Chip key={type}>.{type}</Chip>
              ))}
            </ChipContainer>
          )}
          <HelpText>
            <Info size={14} />
            <span>Select which file types users can upload</span>
          </HelpText>
        </FormField>

        {/* File Size Limit */}
        <FormField>
          <Label>Maximum File Size</Label>
          <InputWithUnit>
            <Input
              type="number"
              min="1"
              max="100"
              value={formData.maxFileSize}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                maxFileSize: parseInt(e.target.value) || 1,
              }))}
            />
            <UnitLabel>MB</UnitLabel>
          </InputWithUnit>
          <HelpText>
            <Info size={14} />
            <span>Maximum size per file (1-100 MB)</span>
          </HelpText>
        </FormField>

        {/* File Count Limits */}
        <FormField>
          <Label>Number of Files</Label>
          <InputGroup>
            <InputWithUnit>
              <Input
                type="number"
                min="1"
                value={formData.minFiles}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  minFiles: parseInt(e.target.value) || 1,
                }))}
              />
              <UnitLabel>Min</UnitLabel>
            </InputWithUnit>
            <InputWithUnit>
              <Input
                type="number"
                min="1"
                value={formData.maxFiles}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  maxFiles: parseInt(e.target.value) || 1,
                }))}
              />
              <UnitLabel>Max</UnitLabel>
            </InputWithUnit>
          </InputGroup>
          <HelpText>
            <Info size={14} />
            <span>Minimum and maximum number of files users can upload</span>
          </HelpText>
        </FormField>

        <Divider />

        {/* Upload Folder */}
        <FormField>
          <Label>Upload Destination Folder</Label>
          <Input
            type="text"
            value={formData.uploadFolder}
            onChange={(e) => setFormData(prev => ({ ...prev, uploadFolder: e.target.value }))}
            placeholder="uploads"
          />
          <HelpText>
            <Info size={14} />
            <span>Server folder where files will be stored</span>
          </HelpText>
        </FormField>

        {/* OCR Toggle */}
        <FormField>
          <Label>OCR Processing</Label>
          <ToggleContainer>
            <ToggleSwitch>
              <ToggleInput
                type="checkbox"
                checked={formData.enableOCR}
                onChange={(e) => setFormData(prev => ({ ...prev, enableOCR: e.target.checked }))}
              />
              <ToggleSlider />
            </ToggleSwitch>
            <ToggleLabel>Enable OCR (Optical Character Recognition)</ToggleLabel>
          </ToggleContainer>
          <HelpText>
            <Info size={14} />
            <span>Extract text from uploaded images and PDFs for searching</span>
          </HelpText>
          {formData.enableOCR && (
            <WarningBox>
              <AlertCircle size={16} />
              <WarningText>
                OCR processing may increase upload time. Only enable if text extraction is required.
              </WarningText>
            </WarningBox>
          )}
        </FormField>

        {/* Required Toggle */}
        <FormField>
          <ToggleContainer>
            <ToggleSwitch>
              <ToggleInput
                type="checkbox"
                checked={formData.required}
                onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.checked }))}
              />
              <ToggleSlider />
            </ToggleSwitch>
            <ToggleLabel>Required Field</ToggleLabel>
          </ToggleContainer>
          <HelpText>
            <Info size={14} />
            <span>Users must upload at least {formData.minFiles} file(s) to submit</span>
          </HelpText>
        </FormField>

        <Divider />

        {/* Conditional Visibility */}
        <FormField>
          <Label>Field Visibility</Label>
          <RadioGroup>
            <RadioOption>
              <RadioInput
                type="radio"
                name="visibility"
                checked={visibilityMode === 'always'}
                onChange={() => setVisibilityMode('always')}
              />
              <RadioContent>
                <RadioTitle>Always show this field</RadioTitle>
                <RadioDescription>
                  Upload field will be visible to all users
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
                  Only show upload field when certain conditions are met
                </RadioDescription>
              </RadioContent>
            </RadioOption>
          </RadioGroup>

          {visibilityMode === 'conditional' && (
            <div style={{ marginTop: '16px' }}>
              <ConditionBuilder
                conditions={formData.conditionalVisibility!.conditions || []}
                logic={formData.conditionalVisibility!.logic || 'AND'}
                availableFields={availableFields}
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
          Save Upload Field
        </PrimaryButton>
      </PanelFooter>
    </Container>
  );
};
