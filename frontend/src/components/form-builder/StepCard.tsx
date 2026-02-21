/**
 * Step Card Component
 * 
 * Draggable card for each form step with expand/collapse.
 * Shows step stats and provides quick actions.
 * 
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, GripVertical, Plus, Edit2, Trash2, Settings, Wand2 } from 'lucide-react';
import { FormStep } from './types';
import { useFormBuilderStore } from './store';

/**
 * Props for StepCard
 */
interface StepCardProps {
  step: FormStep;
}

/**
 * Styled Components
 */
const Card = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  overflow: hidden;
  transition: all 0.2s;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const CardHeader = styled.div`
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const DragHandle = styled.div`
  color: rgb(var(--color-text-tertiary));
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
`;

const ExpandButton = styled.button`
  background: transparent;
  border: none;
  padding: 4px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  
  &:hover {
    background: rgb(var(--color-surface-active));
  }
`;

const HeaderContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StepTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const StepStats = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  gap: 16px;
`;

const StatItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.button<{ variant?: 'danger' }>`
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${props => props.variant === 'danger' 
    ? 'rgb(239, 68, 68)' 
    : 'rgb(var(--color-text-secondary))'};
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: ${props => props.variant === 'danger'
      ? 'rgba(239, 68, 68, 0.1)'
      : 'rgb(var(--color-surface-active))'};
  }
`;

const CardBody = styled.div<{ expanded: boolean }>`
  display: ${props => props.expanded ? 'block' : 'none'};
  padding: 0 16px 16px 16px;
  border-top: 1px solid rgb(var(--color-border));
`;

const Section = styled.div`
  margin-top: 16px;
  
  &:first-child {
    margin-top: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const SectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const AddButton = styled.button`
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--color-primary));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    background: rgba(var(--color-primary), 0.1);
    border-color: rgb(var(--color-primary));
  }
`;

const FieldList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldItem = styled.div`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface-hover));
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  &:hover {
    background: rgb(var(--color-surface-active));
  }
`;

const FieldInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FieldLabel = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const FieldType = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const FieldActions = styled.div`
  display: flex;
  gap: 4px;
`;

const EmptyMessage = styled.div`
  padding: 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: 6px;
`;

/**
 * StepCard Component
 */
export const StepCard: React.FC<StepCardProps> = ({ step }) => {
  const [expanded, setExpanded] = useState(true);
  
  const {
    removeStep,
    openFieldModal,
    removeField,
    openRuleModal,
    openMappingModal
  } = useFormBuilderStore();
  
  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };
  
  const handleRemoveStep = () => {
    const confirmed = window.confirm(`Delete "${step.name}"? This cannot be undone.`);
    if (confirmed) {
      removeStep(step.id);
    }
  };
  
  const handleRemoveField = (fieldId: string) => {
    const field = step.fields.find(f => f.id === fieldId);
    const confirmed = window.confirm(`Delete field "${field?.label}"?`);
    if (confirmed) {
      removeField(step.id, fieldId);
    }
  };
  
  return (
    <Card>
      <CardHeader onClick={handleToggleExpand}>
        <DragHandle>
          <GripVertical size={20} />
        </DragHandle>
        
        <ExpandButton onClick={(e) => {
          e.stopPropagation();
          handleToggleExpand();
        }}>
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </ExpandButton>
        
        <HeaderContent>
          <StepTitle>{step.name}</StepTitle>
          <StepStats>
            <StatItem>{step.fields.length} fields</StatItem>
            <StatItem>{step.rules.length} rules</StatItem>
            <StatItem>{step.mappings.length} mappings</StatItem>
          </StepStats>
        </HeaderContent>
        
        <HeaderActions onClick={(e) => e.stopPropagation()}>
          <IconButton
            onClick={() => openFieldModal(step.id)}
            title="Add Field"
          >
            <Plus size={16} />
          </IconButton>
          <IconButton
            onClick={handleRemoveStep}
            variant="danger"
            title="Delete Step"
          >
            <Trash2 size={16} />
          </IconButton>
        </HeaderActions>
      </CardHeader>
      
      <CardBody expanded={expanded}>
        {/* Fields Section */}
        <Section>
          <SectionHeader>
            <SectionTitle>Fields</SectionTitle>
            <AddButton onClick={() => openFieldModal(step.id)}>
              <Plus size={14} />
              Add Field
            </AddButton>
          </SectionHeader>
          
          {step.fields.length > 0 ? (
            <FieldList>
              {step.fields.map(field => (
                <FieldItem key={field.id}>
                  <FieldInfo>
                    <FieldLabel>{field.label}</FieldLabel>
                    <FieldType>{field.type} {field.required && '• Required'}</FieldType>
                  </FieldInfo>
                  <FieldActions>
                    <IconButton
                      onClick={() => openFieldModal(step.id, field)}
                      title="Edit Field"
                    >
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton
                      onClick={() => handleRemoveField(field.id)}
                      variant="danger"
                      title="Delete Field"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </FieldActions>
                </FieldItem>
              ))}
            </FieldList>
          ) : (
            <EmptyMessage>
              No fields yet. Click "Add Field" to get started.
            </EmptyMessage>
          )}
        </Section>
        
        {/* Rules Section */}
        <Section>
          <SectionHeader>
            <SectionTitle>Conditional Rules</SectionTitle>
            <AddButton onClick={() => openRuleModal(step.id)}>
              <Wand2 size={14} />
              Add Rule
            </AddButton>
          </SectionHeader>
          
          {step.rules.length > 0 ? (
            <FieldList>
              {step.rules.map(rule => (
                <FieldItem key={rule.id}>
                  <FieldInfo>
                    <FieldLabel>{rule.name}</FieldLabel>
                    <FieldType>
                      {rule.conditions.length} conditions • {rule.actions.length} actions
                    </FieldType>
                  </FieldInfo>
                  <FieldActions>
                    <IconButton
                      onClick={() => openRuleModal(step.id, rule)}
                      title="Edit Rule"
                    >
                      <Edit2 size={14} />
                    </IconButton>
                  </FieldActions>
                </FieldItem>
              ))}
            </FieldList>
          ) : (
            <EmptyMessage>
              No rules defined. Add rules to create dynamic form behavior.
            </EmptyMessage>
          )}
        </Section>
        
        {/* Mappings Section */}
        <Section>
          <SectionHeader>
            <SectionTitle>Field Mappings</SectionTitle>
            <AddButton onClick={() => openMappingModal(step.id)}>
              <Settings size={14} />
              Manage Mappings
            </AddButton>
          </SectionHeader>
          
          {step.mappings.length > 0 ? (
            <FieldList>
              {step.mappings.map(mapping => (
                <FieldItem key={mapping.id}>
                  <FieldInfo>
                    <FieldLabel>
                      {mapping.sourceField} → {mapping.targetField}
                    </FieldLabel>
                    <FieldType>
                      {mapping.autoMapped && 'Auto-mapped • '}
                      {mapping.transformation ? 'With transformation' : 'Direct copy'}
                    </FieldType>
                  </FieldInfo>
                </FieldItem>
              ))}
            </FieldList>
          ) : (
            <EmptyMessage>
              No field mappings. Configure to inherit data from previous steps.
            </EmptyMessage>
          )}
        </Section>
      </CardBody>
    </Card>
  );
};
