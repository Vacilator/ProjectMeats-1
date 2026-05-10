/**
 * Mapping Section Component
 *
 * Manages field mappings for data inheritance.
 * Provides Auto-Map functionality with smart matching.
 *
 * Created: 2026-02-21
 * Phase: 4 - FormBuilder Suite
 * Updated: Phase 5 - Auto-Map Integration
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Zap, Check, TrendingUp, Settings } from 'lucide-react';
import { useFormBuilderStore } from './store';
import { autoMapFields } from '../FlowEditor/utils/autoPopulateEngine';
import { Variable } from '../FlowEditor/components/VariablePicker';
import {
  getAvailableTransformations,
  getTransformationName,
  type TransformationType,
} from '../FlowEditor/utils/transformations';

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 90vw;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const AutoMapButton = styled.button`
  width: 100%;
  padding: 12px 16px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MappingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MappingItem = styled.div`
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface-hover));
`;

const MappingHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const MappingPath = styled.div`
  font-size: 13px;
  font-family: 'Courier New', monospace;
  color: rgb(var(--color-text-primary));
`;

const ConfidenceBadge = styled.span<{ confidence: string }>`
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: ${props => {
    if (props.confidence === 'high') return 'rgba(var(--color-success), 0.15)';
    if (props.confidence === 'medium') return 'rgba(var(--color-warning), 0.15)';
    return 'rgba(var(--color-primary), 0.15)';
  }};
  color: ${props => {
    if (props.confidence === 'high') return 'rgb(var(--color-success))';
    if (props.confidence === 'medium') return 'rgb(var(--color-warning))';
    return 'rgb(var(--color-primary))';
  }};
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MappingScore = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const TransformSection = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
`;

const TransformLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const TransformSelect = styled.select`
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const ApplyButton = styled.button`
  padding: 8px 12px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    opacity: 0.9;
  }
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button`
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  border: none;
  cursor: pointer;
  background: rgb(var(--color-surface-hover));
  color: rgb(var(--color-text-primary));
`;

export const MappingSection: React.FC = () => {
  const { isMappingModalOpen, activeStepId, steps, closeMappingModal, saveMapping } = useFormBuilderStore();
  const [mappingSuggestions, setMappingSuggestions] = useState<Array<{
    sourceVariable: Variable;
    targetField: any;
    score: number;
    confidence: 'high' | 'medium' | 'low';
  }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTransformations, setSelectedTransformations] = useState<Record<string, TransformationType>>({});

  const handleAutoMap = () => {
    if (!activeStepId) return;

    setIsProcessing(true);

    // Mock available variables (in real implementation, get from upstream nodes)
    const mockVariables: Variable[] = [
      {
        id: 'var1',
        name: 'customerName',
        displayName: 'Customer Name',
        type: 'text',
        nodeId: 'node1',
        nodeName: 'Customer Info',
        nodeType: 'form',
        path: 'step1.customerName',
        sampleValue: 'John Doe'
      },
      {
        id: 'var2',
        name: 'email',
        displayName: 'Email Address',
        type: 'email',
        nodeId: 'node1',
        nodeName: 'Customer Info',
        nodeType: 'form',
        path: 'step1.email',
        sampleValue: 'john@example.com'
      },
      {
        id: 'var3',
        name: 'phone',
        displayName: 'Phone Number',
        type: 'phone',
        nodeId: 'node1',
        nodeName: 'Customer Info',
        nodeType: 'form',
        path: 'step1.phone',
        sampleValue: '+1234567890'
      },
      {
        id: 'var4',
        name: 'companyName',
        displayName: 'Company Name',
        type: 'text',
        nodeId: 'node1',
        nodeName: 'Customer Info',
        nodeType: 'form',
        path: 'step1.companyName',
        sampleValue: 'Acme Corp'
      }
    ];

    // Get current step fields
    const currentStep = steps.find(s => s.id === activeStepId);
    if (!currentStep) {
      setIsProcessing(false);
      return;
    }

    // Run auto-map algorithm
    const suggestions = autoMapFields(mockVariables, currentStep.fields, 60);
    setMappingSuggestions(suggestions);
    setIsProcessing(false);
  };

  const handleApplyMapping = (mapping: any) => {
    if (!activeStepId) return;

    saveMapping(activeStepId, {
      id: `mapping-${Date.now()}`,
      sourceStep: mapping.sourceVariable.nodeId,
      sourceField: mapping.sourceVariable.path,
      targetField: mapping.targetField.id,
      autoMapped: true
    });

    // Remove from suggestions
    setMappingSuggestions(prev =>
      prev.filter(s => s.targetField.id !== mapping.targetField.id)
    );
  };

  return (
    <Overlay isOpen={isMappingModalOpen} onClick={closeMappingModal}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Field Mappings</Title>
          <button type="button" onClick={closeMappingModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </Header>

        <Content>
          <AutoMapButton onClick={handleAutoMap} disabled={isProcessing}>
            <Zap size={16} />
            {isProcessing ? 'Analyzing...' : 'Auto-Map Fields'}
          </AutoMapButton>

          {mappingSuggestions.length > 0 ? (
            <MappingList>
              {mappingSuggestions.map((mapping, index) => (
                <MappingItem key={index}>
                  <MappingHeader>
                    <MappingPath>
                      {mapping.sourceVariable.path} → {mapping.targetField.label}
                    </MappingPath>
                    <ConfidenceBadge confidence={mapping.confidence}>
                      {mapping.confidence === 'high' && <Check size={10} />}
                      {mapping.confidence === 'medium' && <TrendingUp size={10} />}
                      {mapping.confidence}
                    </ConfidenceBadge>
                  </MappingHeader>

                  <MappingScore>
                    Match score: {mapping.score}%
                  </MappingScore>

                  <TransformSection>
                    <TransformLabel>
                      <Settings size={10} />
                      Transformation (Optional)
                    </TransformLabel>
                    <TransformSelect
                      value={selectedTransformations[`${mapping.sourceVariable.id}-${mapping.targetField.id}`] || ''}
                      onChange={(e) => {
                        const key = `${mapping.sourceVariable.id}-${mapping.targetField.id}`;
                        setSelectedTransformations({
                          ...selectedTransformations,
                          [key]: e.target.value as TransformationType
                        });
                      }}
                    >
                      <option value="">No transformation</option>
                      {getAvailableTransformations(mapping.targetField.type).map((transform) => (
                        <option key={transform} value={transform}>
                          {getTransformationName(transform)}
                        </option>
                      ))}
                    </TransformSelect>
                  </TransformSection>

                  <ApplyButton onClick={() => handleApplyMapping(mapping)}>
                    <Check size={14} />
                    Apply Mapping
                  </ApplyButton>
                </MappingItem>
              ))}
            </MappingList>
          ) : (
            <EmptyMessage>
              {isProcessing
                ? 'Analyzing field relationships...'
                : 'Click "Auto-Map Fields" to find intelligent field mappings based on name similarity and type compatibility.'}
            </EmptyMessage>
          )}
        </Content>

        <Footer>
          <Button onClick={closeMappingModal}>Close</Button>
        </Footer>
      </Modal>
    </Overlay>
  );
};
