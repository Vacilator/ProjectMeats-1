/**
 * Form Selector Modal
 * 
 * Modal for selecting a form from the library to reference in workflows.
 * Used by FormReference nodes.
 * 
 * Created: 2026-02-05 - Phase 3 Task 3.3
 * Part of: WORKFORMS_NAVIGATION_FIX_PLAN Phase 3
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Check, FileText, Calendar, Users } from 'lucide-react';
import { adminClient } from '../../services/apiService';
import type { FormDefinition } from '../form-builder';
import { useTranslation } from '../../i18n';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FormSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (form: FormDefinition) => void;
  currentFormId?: string;
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
  z-index: 1000;
  animation: fadeIn 0.2s;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.3s;
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-error), 0.1);
    color: rgb(var(--color-error));
  }
`;

const SearchContainer = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchWrapper = styled.div`
  position: relative;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-text-tertiary));
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
`;

const FormList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FormCard = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 2px solid ${props => props.$selected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 8px;
  background: ${props => props.$selected ? 'rgba(var(--color-primary), 0.05)' : 'rgb(var(--color-background))'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.03);
  }
`;

const FormIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(var(--color-primary), 0.1);
  color: rgb(var(--color-primary));
  flex-shrink: 0;
`;

const FormInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FormName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const FormDescription = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const FormMeta = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const SelectIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgb(var(--color-primary));
  color: white;
  flex-shrink: 0;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
  gap: 12px;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  opacity: 0.5;
`;

const EmptyText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: rgb(var(--color-text-secondary));
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => {
    if (props.$variant === 'primary') {
      return `
        background: rgb(var(--color-primary));
        color: white;
        &:hover { opacity: 0.9; }
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `;
    } else {
      return `
        background: transparent;
        color: rgb(var(--color-text-secondary));
        border: 1px solid rgb(var(--color-border));
        &:hover {
          background: rgb(var(--color-background));
        }
      `;
    }
  }}
`;

// ============================================================================
// Form Selector Modal Component
// ============================================================================

export const FormSelectorModal: React.FC<FormSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentFormId,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string | undefined>(currentFormId);
  
  // Fetch forms from API
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['forms', 'library'],
    queryFn: async () => {
      const response = await adminClient.get('/workforms/');
      return response.data.results || response.data || [];
    },
    enabled: isOpen,
  });
  
  // Filter forms based on search
  const filteredForms = React.useMemo(() => {
    if (!searchQuery) return forms;
    
    const query = searchQuery.toLowerCase();
    return forms.filter((form: any) =>
      form.name?.toLowerCase().includes(query) ||
      form.description?.toLowerCase().includes(query)
    );
  }, [forms, searchQuery]);
  
  const handleSelect = () => {
    const selectedForm = forms.find((f: any) => f.id === selectedFormId);
    if (selectedForm) {
      // Convert to FormDefinition format
      const formDef: FormDefinition = {
        id: selectedForm.id,
        name: selectedForm.name,
        description: selectedForm.description,
        sections: [], // Will be loaded from workflow definition
        settings: {
          submitButtonText: 'Submit',
          theme: 'light',
        },
      };
      onSelect(formDef);
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Overlay $isOpen={isOpen} onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>{t('forms.selectAForm')}</Title>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </Header>
        
        <SearchContainer>
          <SearchWrapper>
            <SearchIcon>
              <Search size={16} />
            </SearchIcon>
            <SearchInput
              type="text"
              placeholder={t('forms.searchForms')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </SearchWrapper>
        </SearchContainer>
        
        <Content>
          {isLoading ? (
            <LoadingState>{t('forms.loadingForms')}</LoadingState>
          ) : filteredForms.length === 0 ? (
            <EmptyState>
              <EmptyIcon>📋</EmptyIcon>
              <EmptyText>
                {searchQuery ? t('forms.noFormsMatch') : t('forms.noForms')}
              </EmptyText>
            </EmptyState>
          ) : (
            <FormList>
              {filteredForms.map((form: any) => (
                <FormCard
                  key={form.id}
                  $selected={selectedFormId === form.id}
                  onClick={() => setSelectedFormId(form.id)}
                >
                  <FormIcon>
                    <FileText size={24} />
                  </FormIcon>
                  <FormInfo>
                    <FormName>{form.name}</FormName>
                    {form.description && (
                      <FormDescription>{form.description}</FormDescription>
                    )}
                    <FormMeta>
                      <MetaItem>
                        <Calendar size={12} />
                        {new Date(form.updated_at || form.created_at).toLocaleDateString()}
                      </MetaItem>
                      {form.entity_count > 0 && (
                        <MetaItem>
                          <Users size={12} />
                          {t('forms.submissions', { count: form.entity_count })}
                        </MetaItem>
                      )}
                    </FormMeta>
                  </FormInfo>
                  {selectedFormId === form.id && (
                    <SelectIndicator>
                      <Check size={14} />
                    </SelectIndicator>
                  )}
                </FormCard>
              ))}
            </FormList>
          )}
        </Content>
        
        <Footer>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            $variant="primary"
            onClick={handleSelect}
            disabled={!selectedFormId}
          >
            {t('forms.selectForm')}
          </Button>
        </Footer>
      </Modal>
    </Overlay>
  );
};

export default FormSelectorModal;
