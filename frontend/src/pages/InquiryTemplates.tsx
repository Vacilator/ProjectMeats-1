/**
 * InquiryTemplates Page
 * 
 * Manage inquiry templates for quick inquiry creation
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { apiClient } from '../services/apiService';
import { InquiryTemplate, InquiryEntityType } from '../types';
import { InquiryTemplateModal } from '../components/Inquiry';

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
`;

const CreateButton = styled.button`
  padding: 10px 20px;
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    opacity: 0.9;
  }
`;

const TemplatesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
`;

const TemplateCard = styled.div<{ $isInactive?: boolean }>`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 20px;
  opacity: ${props => props.$isInactive ? 0.6 : 1};
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const TemplateName = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: rgb(var(--color-text-primary));
`;

const StatusBadge = styled.span<{ $active: boolean }>`
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.$active 
    ? 'rgba(34, 197, 94, 0.1)' 
    : 'rgba(var(--color-border), 0.5)'};
  color: ${props => props.$active 
    ? 'rgb(var(--color-success))' 
    : 'rgb(var(--color-text-secondary))'};
`;

const EntityTypeBadge = styled.span<{ $type: InquiryEntityType }>`
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.$type === 'customer' 
    ? 'rgba(59, 130, 246, 0.1)' 
    : 'rgba(245, 158, 11, 0.1)'};
  color: ${props => props.$type === 'customer' 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-warning))'};
`;

const CardDescription = styled.p`
  color: rgb(var(--color-text-secondary));
  font-size: 0.85rem;
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

const CardMeta = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ProductsList = styled.div`
  margin-bottom: 16px;
`;

const ProductsLabel = styled.div`
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 8px;
`;

const ProductTag = styled.span`
  display: inline-block;
  padding: 4px 8px;
  background: rgba(var(--color-primary), 0.05);
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  margin-right: 6px;
  margin-bottom: 6px;
  color: rgb(var(--color-text-primary));
`;

const MoreProducts = styled.span`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid rgb(var(--color-border));
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'danger' }>`
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;
    border: none;
    
    &:hover {
      opacity: 0.9;
    }
  ` : props.$variant === 'danger' ? `
    background: transparent;
    color: rgb(var(--color-error));
    border: 1px solid rgb(var(--color-error));
    
    &:hover {
      background: rgba(239, 68, 68, 0.1);
    }
  ` : `
    background: transparent;
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));
    
    &:hover {
      background: rgba(var(--color-primary), 0.05);
    }
  `}
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.h3`
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const EmptyText = styled.p`
  margin: 0 0 24px 0;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Component
// ============================================================================

const InquiryTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<InquiryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InquiryTemplate | null>(null);
  
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (entityFilter !== 'all') params.entity_type = entityFilter;
      if (statusFilter !== 'all') params.is_active = statusFilter;
      
      const response = await apiClient.get('/inquiry-templates/', { params });
      setTemplates(response.data.results || response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, statusFilter]);
  
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);
  
  const handleCreateClick = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };
  
  const handleEditClick = (template: InquiryTemplate) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };
  
  const handleDeleteClick = async (template: InquiryTemplate) => {
    const confirmed = await confirmDialog({
      title: 'Delete template?',
      content: `Delete template "${template.name}"? This cannot be undone.`,
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`/inquiry-templates/${template.id}/`);
      setTemplates(prev => prev.filter(t => t.id !== template.id));
    } catch (error) {
      console.error('Failed to delete template:', error);
      showAlert({ type: 'error', title: 'Error', content: 'Failed to delete template' });
    }
  };
  
  const handleToggleActive = async (template: InquiryTemplate) => {
    try {
      const response = await apiClient.patch(`/inquiry-templates/${template.id}/`, {
        is_active: !template.is_active,
      });
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? response.data : t
      ));
    } catch (error) {
      console.error('Failed to update template:', error);
      showAlert({ type: 'error', title: 'Error', content: 'Failed to update template' });
    }
  };
  
  const handleSaveTemplate = (template: InquiryTemplate) => {
    if (editingTemplate) {
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? template : t
      ));
    } else {
      setTemplates(prev => [template, ...prev]);
    }
  };
  
  return (
    <PageContainer>
      <Header>
        <Title>
          📋 Inquiry Templates
        </Title>
        <HeaderActions>
          <FilterSelect
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
          >
            <option value="all">All Entity Types</option>
            <option value="customer">Customer Only</option>
            <option value="supplier">Supplier Only</option>
          </FilterSelect>
          <FilterSelect
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </FilterSelect>
          <CreateButton onClick={handleCreateClick}>
            ➕ New Template
          </CreateButton>
        </HeaderActions>
      </Header>
      
      {loading ? (
        <LoadingState>Loading templates...</LoadingState>
      ) : templates.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📋</EmptyIcon>
          <EmptyTitle>No Templates Found</EmptyTitle>
          <EmptyText>
            {entityFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters or create a new template.'
              : 'Create your first inquiry template to speed up inquiry creation.'}
          </EmptyText>
          <CreateButton onClick={handleCreateClick}>
            ➕ Create Template
          </CreateButton>
        </EmptyState>
      ) : (
        <TemplatesGrid>
          {templates.map(template => (
            <TemplateCard key={template.id} $isInactive={!template.is_active}>
              <CardHeader>
                <div>
                  <TemplateName>{template.name}</TemplateName>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <EntityTypeBadge $type={template.entity_type}>
                      {template.entity_type === 'customer' ? '👤 Customer' : '🏭 Supplier'}
                    </EntityTypeBadge>
                    <StatusBadge $active={template.is_active}>
                      {template.is_active ? '✓ Active' : '○ Inactive'}
                    </StatusBadge>
                  </div>
                </div>
              </CardHeader>
              
              {template.description && (
                <CardDescription>{template.description}</CardDescription>
              )}
              
              <CardMeta>
                <MetaItem>
                  📅 {template.default_valid_days} day validity
                </MetaItem>
                <MetaItem>
                  📊 Used {template.use_count || 0} times
                </MetaItem>
              </CardMeta>
              
              {template.products && template.products.length > 0 && (
                <ProductsList>
                  <ProductsLabel>Default Products:</ProductsLabel>
                  {template.products.slice(0, 3).map((p, idx) => (
                    <ProductTag key={idx}>
                      {p.product_code || `Product ${idx + 1}`}
                    </ProductTag>
                  ))}
                  {template.products.length > 3 && (
                    <MoreProducts>+{template.products.length - 3} more</MoreProducts>
                  )}
                </ProductsList>
              )}
              
              <CardActions>
                <ActionButton onClick={() => handleEditClick(template)}>
                  ✏️ Edit
                </ActionButton>
                <ActionButton onClick={() => handleToggleActive(template)}>
                  {template.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                </ActionButton>
                <ActionButton 
                  $variant="danger" 
                  onClick={() => handleDeleteClick(template)}
                >
                  🗑️
                </ActionButton>
              </CardActions>
            </TemplateCard>
          ))}
        </TemplatesGrid>
      )}
      
      <InquiryTemplateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTemplate}
        template={editingTemplate}
      />
    </PageContainer>
  );
};

export default InquiryTemplates;
