/**
 * Validation Warnings Drawer (Phase 7)
 * 
 * Displays validation issues in a collapsible drawer with:
 * - Grouped by severity (errors, warnings, info)
 * - Click to navigate to problematic node
 * - Live updates as workflow changes
 * - Disables Publish button when errors exist
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { ValidationIssue, ValidationResult } from '../utils/validationEngine';

interface ValidationDrawerProps {
  validation: ValidationResult;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
}

export const ValidationDrawer: React.FC<ValidationDrawerProps> = ({
  validation,
  isOpen,
  onClose,
  onNavigateToNode,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['errors']) // Errors expanded by default
  );
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };
  
  const errorIssues = validation.issues.filter(i => i.severity === 'error');
  const warningIssues = validation.issues.filter(i => i.severity === 'warning');
  const infoIssues = validation.issues.filter(i => i.severity === 'info');
  
  if (!isOpen) return null;
  
  return (
    <DrawerContainer data-testid="validation-drawer" role="region" aria-label="Workflow validation results">
      <DrawerHeader>
        <HeaderLeft>
          <Title id="validation-drawer-title">Workflow Validation</Title>
          <StatusBadge $isValid={validation.isValid}>
            {validation.isValid ? '✓ Valid' : `${validation.errorCount} Error${validation.errorCount !== 1 ? 's' : ''}`}
          </StatusBadge>
        </HeaderLeft>
        <CloseButton
          onClick={onClose}
          aria-label="Close validation drawer"
          data-testid="validation-drawer-close"
          type="button"
        >
          <X size={18} />
        </CloseButton>
      </DrawerHeader>
      
      <DrawerContent>
        {/* Errors Section */}
        {errorIssues.length > 0 && (
          <Section>
            <SectionHeader
              onClick={() => toggleSection('errors')}
              $isExpanded={expandedSections.has('errors')}
              role="button"
              tabIndex={0}
              aria-expanded={expandedSections.has('errors')}
              aria-controls="validation-errors-list"
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('errors'); } }}
              data-testid="validation-section-errors"
            >
              <SectionTitle>
                <AlertCircle size={18} color="rgb(var(--color-error))" />
                <span>Errors ({errorIssues.length})</span>
              </SectionTitle>
              {expandedSections.has('errors') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </SectionHeader>
            {expandedSections.has('errors') && (
              <IssueList id="validation-errors-list">
                {errorIssues.map(issue => (
                  <IssueCard
                    key={issue.id}
                    $severity="error"
                    onClick={() => issue.nodeId && onNavigateToNode(issue.nodeId)}
                    $isClickable={!!issue.nodeId}
                    role={issue.nodeId ? 'button' : undefined}
                    tabIndex={issue.nodeId ? 0 : undefined}
                    onKeyDown={issue.nodeId ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToNode(issue.nodeId!); } } : undefined}
                    data-testid={`validation-issue-${issue.id}`}
                  >
                    <IssueMessage>{issue.message}</IssueMessage>
                    {issue.suggestion && (
                      <IssueSuggestion>💡 {issue.suggestion}</IssueSuggestion>
                    )}
                    {issue.nodeId && (
                      <IssueCategory>Category: {issue.category}</IssueCategory>
                    )}
                  </IssueCard>
                ))}
              </IssueList>
            )}
          </Section>
        )}
        
        {/* Warnings Section */}
        {warningIssues.length > 0 && (
          <Section>
            <SectionHeader
              onClick={() => toggleSection('warnings')}
              $isExpanded={expandedSections.has('warnings')}
              role="button"
              tabIndex={0}
              aria-expanded={expandedSections.has('warnings')}
              aria-controls="validation-warnings-list"
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('warnings'); } }}
              data-testid="validation-section-warnings"
            >
              <SectionTitle>
                <AlertTriangle size={18} color="rgb(var(--color-warning))" />
                <span>Warnings ({warningIssues.length})</span>
              </SectionTitle>
              {expandedSections.has('warnings') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </SectionHeader>
            {expandedSections.has('warnings') && (
              <IssueList id="validation-warnings-list">
                {warningIssues.map(issue => (
                  <IssueCard
                    key={issue.id}
                    $severity="warning"
                    onClick={() => issue.nodeId && onNavigateToNode(issue.nodeId)}
                    $isClickable={!!issue.nodeId}
                    role={issue.nodeId ? 'button' : undefined}
                    tabIndex={issue.nodeId ? 0 : undefined}
                    onKeyDown={issue.nodeId ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToNode(issue.nodeId!); } } : undefined}
                    data-testid={`validation-issue-${issue.id}`}
                  >
                    <IssueMessage>{issue.message}</IssueMessage>
                    {issue.suggestion && (
                      <IssueSuggestion>💡 {issue.suggestion}</IssueSuggestion>
                    )}
                  </IssueCard>
                ))}
              </IssueList>
            )}
          </Section>
        )}
        
        {/* Info Section */}
        {infoIssues.length > 0 && (
          <Section>
            <SectionHeader
              onClick={() => toggleSection('info')}
              $isExpanded={expandedSections.has('info')}
              role="button"
              tabIndex={0}
              aria-expanded={expandedSections.has('info')}
              aria-controls="validation-info-list"
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('info'); } }}
              data-testid="validation-section-info"
            >
              <SectionTitle>
                <Info size={18} color="rgb(var(--color-info))" />
                <span>Info ({infoIssues.length})</span>
              </SectionTitle>
              {expandedSections.has('info') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </SectionHeader>
            {expandedSections.has('info') && (
              <IssueList id="validation-info-list">
                {infoIssues.map(issue => (
                  <IssueCard key={issue.id} $severity="info" $isClickable={false} data-testid={`validation-issue-${issue.id}`}>
                    <IssueMessage>{issue.message}</IssueMessage>
                    {issue.suggestion && (
                      <IssueSuggestion>💡 {issue.suggestion}</IssueSuggestion>
                    )}
                  </IssueCard>
                ))}
              </IssueList>
            )}
          </Section>
        )}
        
        {/* All Clear */}
        {validation.issues.length === 0 && (
          <AllClearMessage data-testid="validation-all-clear">
            <AlertCircle size={48} color="rgb(var(--color-success))" />
            <h3>All Clear!</h3>
            <p>No validation issues found. Your workflow is ready to publish.</p>
          </AllClearMessage>
        )}
      </DrawerContent>
    </DrawerContainer>
  );
};

// Styled Components

const DrawerContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgb(var(--color-surface));
  border-top: 1px solid rgb(var(--color-border));
  box-shadow: 0 -4px 12px rgba(var(--color-overlay), 0.1);
  z-index: 1000;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.2s ease-out;
  
  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const StatusBadge = styled.span<{ $isValid: boolean }>`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => props.$isValid 
    ? 'rgba(var(--color-success), 0.1)' 
    : 'rgba(var(--color-error), 0.1)'};
  color: ${props => props.$isValid 
    ? 'rgb(var(--color-success))' 
    : 'rgb(var(--color-error))'};
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-secondary));
  transition: color 0.2s;
  
  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const DrawerContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
`;

const Section = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div<{ $isExpanded: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
  }
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const IssueList = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const IssueCard = styled.div<{ $severity: 'error' | 'warning' | 'info'; $isClickable: boolean }>`
  padding: 12px;
  background: rgb(var(--color-surface));
  border-left: 3px solid ${props => {
    switch (props.$severity) {
      case 'error': return 'rgb(var(--color-error))';
      case 'warning': return 'rgb(var(--color-warning))';
      case 'info': return 'rgb(var(--color-info))';
    }
  }};
  border-radius: 4px;
  cursor: ${props => props.$isClickable ? 'pointer' : 'default'};
  transition: all 0.2s;
  
  ${props => props.$isClickable && `
    &:hover {
      background: rgba(var(--color-primary), 0.05);
      transform: translateX(4px);
    }
  `}
`;

const IssueMessage = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const IssueSuggestion = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  font-style: italic;
  margin-top: 4px;
`;

const IssueCategory = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const AllClearMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  
  h3 {
    margin: 16px 0 8px;
    font-size: 20px;
    font-weight: 600;
    color: rgb(var(--color-success));
  }
  
  p {
    margin: 0;
    font-size: 14px;
    color: rgb(var(--color-text-secondary));
  }
`;
