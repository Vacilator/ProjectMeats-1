/**
 * Sub-Flow Template Library Dialog
 * 
 * UI for browsing, searching, and importing FormProcess templates.
 * 
 * Phase E.3: Schema + Config Integration + Reusability
 * 
 * Created: 2026-02-19
 */

import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Search, X, Download, Upload, Trash2, Copy, FileText, Tag } from 'lucide-react';
import { PanelFooter, PrimaryButton, SecondaryButton } from './shared/StyledComponents';
import {
  getAllTemplates,
  searchTemplates,
  deleteTemplate,
  duplicateTemplate,
  exportTemplateToFile,
  importTemplateFromFile,
  saveTemplate,
  SubFlowTemplate,
} from '../utils/subflowManager';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface SubFlowLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: SubFlowTemplate) => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
`;

const Dialog = styled.div`
  background: rgb(var(--color-background));
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 8px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }
`;

const SearchBar = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background-secondary));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const SearchIconWrapper = styled.div`
  position: absolute;
  left: 36px;
  top: 27px;
  color: rgb(var(--color-text-tertiary));
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
`;

const TemplateCard = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgb(var(--color-background-secondary));
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

const TemplateHeader = styled.div`
  display: flex;
  align-items: start;
  gap: 12px;
  margin-bottom: 12px;
`;

const TemplateIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgba(var(--color-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-primary));
  flex-shrink: 0;
`;

const TemplateInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const TemplateName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TemplateDescription = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const TemplateTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
`;

const TemplateTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
`;

const TemplateActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
`;

const ActionButton = styled.button`
  flex: 1;
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 24px;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyStateIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.3;
`;

const EmptyStateText = styled.div`
  font-size: 16px;
  margin-bottom: 8px;
`;

const EmptyStateHint = styled.div`
  font-size: 14px;
  opacity: 0.7;
`;


// ============================================================================
// Component
// ============================================================================

export const SubFlowLibraryDialog: React.FC<SubFlowLibraryDialogProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<SubFlowTemplate[]>(getAllTemplates());

  // Update templates when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setTemplates(getAllTemplates());
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return templates;
    }
    return searchTemplates(searchQuery);
  }, [searchQuery, templates]);

  // Handlers
  const handleSelect = useCallback((template: SubFlowTemplate) => {
    onSelectTemplate(template);
    onClose();
  }, [onSelectTemplate, onClose]);

  const handleDelete = useCallback((templateId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(templateId);
      setTemplates(getAllTemplates());
    }
  }, []);

  const handleDuplicate = useCallback((templateId: string, templateName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newName = prompt('Enter name for duplicate:', `${templateName} (Copy)`);
    if (newName) {
      duplicateTemplate(templateId, newName);
      setTemplates(getAllTemplates());
    }
  }, []);

  const handleExport = useCallback((template: SubFlowTemplate, event: React.MouseEvent) => {
    event.stopPropagation();
    const json = exportTemplateToFile(template);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const template = importTemplateFromFile(text);
        saveTemplate(template);
        setTemplates(getAllTemplates());
      } catch (error) {
        alert('Failed to import template: ' + (error as Error).message);
      }
    };
    input.click();
  }, []);

  return (
    <Overlay $isOpen={isOpen} onClick={onClose}>
      <Dialog onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Sub-Flow Template Library</Title>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </Header>

        <SearchBar>
          <div style={{ position: 'relative' }}>
            <SearchIconWrapper>
              <Search size={16} />
            </SearchIconWrapper>
            <SearchInput
              type="text"
              placeholder="Search templates by name, tags, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </SearchBar>

        <Content>
          {filteredTemplates.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon>📦</EmptyStateIcon>
              <EmptyStateText>
                {searchQuery ? 'No templates match your search' : 'No templates yet'}
              </EmptyStateText>
              <EmptyStateHint>
                {searchQuery 
                  ? 'Try a different search term'
                  : 'Export a FormProcess container to create your first template'
                }
              </EmptyStateHint>
            </EmptyState>
          ) : (
            <TemplateGrid>
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} onClick={() => handleSelect(template)}>
                  <TemplateHeader>
                    <TemplateIcon>
                      <FileText size={20} />
                    </TemplateIcon>
                    <TemplateInfo>
                      <TemplateName>{template.name}</TemplateName>
                      <TemplateDescription>
                        {template.description || 'No description'}
                      </TemplateDescription>
                    </TemplateInfo>
                  </TemplateHeader>

                  {template.tags.length > 0 && (
                    <TemplateTags>
                      {template.tags.map((tag, index) => (
                        <TemplateTag key={index}>
                          <Tag size={10} />
                          {tag}
                        </TemplateTag>
                      ))}
                    </TemplateTags>
                  )}

                  <TemplateActions>
                    <ActionButton onClick={(e) => handleDuplicate(template.id, template.name, e)}>
                      <Copy size={14} />
                      Duplicate
                    </ActionButton>
                    <ActionButton onClick={(e) => handleExport(template, e)}>
                      <Download size={14} />
                      Export
                    </ActionButton>
                    <ActionButton onClick={(e) => handleDelete(template.id, e)}>
                      <Trash2 size={14} />
                      Delete
                    </ActionButton>
                  </TemplateActions>
                </TemplateCard>
              ))}
            </TemplateGrid>
          )}
        </Content>

        <PanelFooter>
          <PrimaryButton type="button" onClick={handleImport}>
            <Upload size={16} />
            Import Template
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose}>
            Close
          </SecondaryButton>
        </PanelFooter>
      </Dialog>
    </Overlay>
  );
};
