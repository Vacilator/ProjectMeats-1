/**
 * Forms & Flows Catalog Page
 * 
 * Browse, create, and manage form flows.
 * Phase 4.1.1: Enhanced Catalog with "Create New" flow
 * 
 * Created: 2026-02-03
 * Updated: 2026-02-04 - Phase 4.1.1 Enhanced Catalog
 * 
 * Features:
 * - Browse existing forms/workflows
 * - Create new from template OR blank canvas
 * - Search and filter
 * - Category organization
 * - Edit, clone, delete actions
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { Plus, Search, Grid, List, Filter, Sparkles, FileText, Workflow, Clock, Star, Lock } from 'lucide-react';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TemplateSelector } from '../../components/FlowEditor/templates/TemplateSelector';
import { FlowTemplate } from '../../components/FlowEditor/templates/flowTemplates';
import { FormPreviewModal } from '../../components/WorkForms/FormPreviewModal';
import { apiClient } from '../../services/apiService';
import { useWorkFormPermissions, getUpgradeMessage } from '../../hooks/useWorkFormPermissions';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface TenantForm {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'inactive';
  icon: string;
  entity_count: number;
  is_multi_entity: boolean;
  created_at: string;
  updated_at: string;
}

type ViewMode = 'grid' | 'list';
type FilterOption = 'all' | 'active' | 'draft' | 'recent' | 'favorites';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled(PageContainer)`
  /* Additional catalog-specific styling */
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`;

const SearchBar = styled.div`
  position: relative;
  flex: 1;
  max-width: 400px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.625rem 1rem 0.625rem 2.5rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-muted));
  }
`;

const SearchIconWrapper = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-text-muted));
  pointer-events: none;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const FilterChip = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: 1px solid ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgba(var(--color-primary), 0.05);
  }
  
  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const ViewToggle = styled.div`
  display: flex;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
`;

const ViewButton = styled.button<{ $active?: boolean }>`
  padding: 0.5rem 0.75rem;
  background: ${props => props.$active ? 'rgba(var(--color-primary), 0.1)' : 'transparent'};
  color: ${props => props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  
  &:not(:last-child) {
    border-right: 1px solid rgb(var(--color-border));
  }
  
  &:hover {
    background: rgba(var(--color-primary), 0.05);
  }
  
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const FormCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
`;

const FormIcon = styled.div`
  font-size: 2rem;
`;

const FormInfo = styled.div`
  flex: 1;
`;

const FormTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.25rem 0;
`;

const FormDescription = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
`;

const FormMeta = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: rgb(var(--color-text-muted));
  margin-top: 1rem;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  
  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.$status) {
      case 'active':
        return 'rgba(34, 197, 94, 0.1)';
      case 'draft':
        return 'rgba(234, 179, 8, 0.1)';
      case 'inactive':
        return 'rgba(107, 114, 128, 0.1)';
      default:
        return 'rgba(var(--color-text-muted), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'active':
        return 'rgb(34, 197, 94)';
      case 'draft':
        return 'rgb(234, 179, 8)';
      case 'inactive':
        return 'rgb(107, 114, 128)';
      default:
        return 'rgb(var(--color-text-muted))';
    }
  }};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: rgb(var(--color-text-secondary));
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.3;
`;

const EmptyStateTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: rgb(var(--color-text-primary));
`;

const EmptyStateDescription = styled.p`
  font-size: 1rem;
  max-width: 500px;
  margin: 0 auto 1.5rem auto;
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem;
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Component
// ============================================================================

const FormsFlowsCatalog: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [previewForm, setPreviewForm] = useState<TenantForm | null>(null);
  
  // Phase 4.2: Get user permissions
  const { permissions, isLoading: permissionsLoading } = useWorkFormPermissions();

  // Debug: Log when previewForm changes
  React.useEffect(() => {
    console.log('[Catalog] previewForm state changed:', previewForm);
    if (previewForm) {
      console.log('[Catalog] Modal should now be visible for form:', previewForm.name);
    }
  }, [previewForm]);

  // Fetch existing forms
  const { data: forms = [], isLoading, error } = useQuery<TenantForm[]>({
    queryKey: ['tenant-forms'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/workflows/forms/');
        console.log('[Catalog] API Response:', response.data);
        
        // Handle both paginated and non-paginated responses
        const data = response.data;
        
        // If paginated response with results array
        if (data && typeof data === 'object' && 'results' in data) {
          console.log('[Catalog] Returning paginated results:', data.results?.length || 0);
          return Array.isArray(data.results) ? data.results : [];
        }
        
        // If direct array response
        if (Array.isArray(data)) {
          console.log('[Catalog] Returning direct array:', data.length);
          return data;
        }
        
        // Fallback to empty array
        console.warn('[Catalog] Unexpected API response format:', data);
        return [];
      } catch (error) {
        console.error('[Catalog] Error fetching forms:', error);
        return [];
      }
    },
  });

  // Log error if query failed
  React.useEffect(() => {
    if (error) {
      console.error('[Catalog] Query error:', error);
    }
  }, [error]);

  // Filter forms based on search and filter
  const filteredForms = React.useMemo(() => {
    // Safety check: ensure forms is an array
    if (!forms || !Array.isArray(forms)) {
      console.warn('[Catalog] Forms is not an array:', forms, 'isLoading:', isLoading);
      return [];
    }
    
    let filtered = forms;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(form =>
        form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply status filter
    if (filter !== 'all') {
      if (filter === 'active') {
        filtered = filtered.filter(form => form.status === 'active');
      } else if (filter === 'draft') {
        filtered = filtered.filter(form => form.status === 'draft');
      } else if (filter === 'recent') {
        // Sort by updated_at and take top 10
        filtered = [...filtered].sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ).slice(0, 10);
      }
      // TODO: Implement favorites when backend supports it
    }
    
    return filtered;
  }, [forms, searchQuery, filter]);

  // Handle template selection
  const handleTemplateSelect = (template: FlowTemplate) => {
    // Navigate to editor with template ID
    navigate(`/workforms/editor?template=${template.id}`);
    setShowTemplateSelector(false);
  };

  // Handle blank canvas
  const handleCreateBlank = () => {
    navigate('/workforms/editor');
  };

  // Handle edit form (now opens preview modal)
  const handleEditForm = (formId: string) => {
    console.log('[Catalog] handleEditForm called with formId:', formId);
    console.log('[Catalog] Current forms array:', forms);
    console.log('[Catalog] Looking for form with id:', formId);
    
    const form = forms?.find(f => f.id === formId);
    console.log('[Catalog] Found form:', form);
    
    if (form) {
      console.log('[Catalog] Setting previewForm state to:', form);
      setPreviewForm(form);
    } else {
      console.error('[Catalog] Form not found for id:', formId);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Container>
      <Header>
        <Title>Forms & Flows</Title>
        <HeaderActions>
          <SearchBar>
            <SearchIconWrapper>
              <Search size={16} />
            </SearchIconWrapper>
            <SearchInput
              type="text"
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchBar>
          <Button
            variant="primary"
            onClick={() => setShowTemplateSelector(true)}
            disabled={!permissions.can_create || permissionsLoading}
            title={!permissions.can_create ? getUpgradeMessage(permissions.role, 'create') : 'Create a new form or workflow'}
          >
            {!permissions.can_create && <Lock size={16} style={{ marginRight: '0.5rem' }} />}
            <Plus size={18} />
            Create New
          </Button>
        </HeaderActions>
      </Header>

      <FilterBar>
        <FilterChip
          $active={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All Forms
        </FilterChip>
        <FilterChip
          $active={filter === 'active'}
          onClick={() => setFilter('active')}
        >
          <Sparkles size={14} />
          Active
        </FilterChip>
        <FilterChip
          $active={filter === 'draft'}
          onClick={() => setFilter('draft')}
        >
          <FileText size={14} />
          Drafts
        </FilterChip>
        <FilterChip
          $active={filter === 'recent'}
          onClick={() => setFilter('recent')}
        >
          <Clock size={14} />
          Recent
        </FilterChip>
        
        <div style={{ marginLeft: 'auto' }}>
          <ViewToggle>
            <ViewButton
              $active={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <Grid />
            </ViewButton>
            <ViewButton
              $active={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List />
            </ViewButton>
          </ViewToggle>
        </div>
      </FilterBar>

      {isLoading ? (
        <LoadingState>Loading forms...</LoadingState>
      ) : filteredForms.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon>📋</EmptyStateIcon>
          <EmptyStateTitle>
            {searchQuery || filter !== 'all' ? 'No forms found' : 'No forms yet'}
          </EmptyStateTitle>
          <EmptyStateDescription>
            {searchQuery || filter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first form or workflow'}
          </EmptyStateDescription>
          {!searchQuery && filter === 'all' && (
            <Button
              variant="primary"
              onClick={() => setShowTemplateSelector(true)}
            >
              <Plus size={18} />
              Create Your First Form
            </Button>
          )}
        </EmptyState>
      ) : viewMode === 'grid' ? (
        <GridContainer>
          {filteredForms.map((form) => (
            <FormCard key={form.id}>
              <CardContent
                onClick={(e) => {
                  console.log('[Catalog] CardContent CLICKED!', form.id, e);
                  handleEditForm(form.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <FormCardHeader>
                  <FormIcon>{form.icon || '📋'}</FormIcon>
                  <FormInfo>
                    <FormTitle>{form.name}</FormTitle>
                    <FormDescription>
                      {form.description || 'No description'}
                    </FormDescription>
                  </FormInfo>
                </FormCardHeader>
                <FormMeta>
                  <MetaItem>
                    <Workflow size={14} />
                    {form.entity_count} {form.entity_count === 1 ? 'step' : 'steps'}
                  </MetaItem>
                  <MetaItem>
                    <Clock size={14} />
                    {formatDate(form.updated_at)}
                  </MetaItem>
                  <StatusBadge $status={form.status}>
                    {form.status}
                  </StatusBadge>
                </FormMeta>
              </CardContent>
            </FormCard>
          ))}
        </GridContainer>
      ) : (
        <ListContainer>
          {filteredForms.map((form) => (
            <FormCard key={form.id}>
              <CardContent
                onClick={(e) => {
                  console.log('[Catalog] CardContent (List) CLICKED!', form.id, e);
                  handleEditForm(form.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <FormCardHeader>
                  <FormIcon>{form.icon || '📋'}</FormIcon>
                  <FormInfo>
                    <FormTitle>{form.name}</FormTitle>
                    <FormDescription>
                      {form.description || 'No description'}
                    </FormDescription>
                  </FormInfo>
                  <FormMeta>
                    <MetaItem>
                      <Workflow size={14} />
                      {form.entity_count} {form.entity_count === 1 ? 'step' : 'steps'}
                    </MetaItem>
                    <MetaItem>
                      <Clock size={14} />
                      {formatDate(form.updated_at)}
                    </MetaItem>
                    <StatusBadge $status={form.status}>
                      {form.status}
                    </StatusBadge>
                  </FormMeta>
                </FormCardHeader>
              </CardContent>
            </FormCard>
          ))}
        </ListContainer>
      )}

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={handleTemplateSelect}
        onStartBlank={handleCreateBlank}
      />
      
      {/* Form Preview Modal */}
      {previewForm && (
        <FormPreviewModal
          form={previewForm}
          onClose={() => {
            console.log('[Catalog] Closing preview modal');
            setPreviewForm(null);
          }}
        />
      )}
      
      {/* Debug: Show preview state */}
      {console.log('[Catalog] Current previewForm state:', previewForm)}
    </Container>
  );
};

export default FormsFlowsCatalog;
