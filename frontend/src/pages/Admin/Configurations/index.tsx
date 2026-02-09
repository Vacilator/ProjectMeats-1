/**
 * Configurations Page
 * 
 * Tenant configuration management with category tabs
 * Admin Workspace - Phase 4
 * 
 * Created: 2026-02-09
 * Status: Complete
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

// Types
interface Configuration {
  id: string;
  category: string;
  key: string;
  display_name: string;
  description: string;
  value: string;
  typed_value: any;
  data_type: 'string' | 'integer' | 'float' | 'boolean' | 'json';
  default_value: string;
  is_system: boolean;
  is_required: boolean;
  updated_by_name?: string;
  updated_at: string;
}

type Category = 'general' | 'security' | 'notifications' | 'integrations' | 'appearance' | 'advanced';

const CATEGORIES: Array<{ key: Category; label: string; icon: string }> = [
  { key: 'general', label: 'General', icon: '⚙️' },
  { key: 'security', label: 'Security', icon: '🔒' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'integrations', label: 'Integrations', icon: '🔗' },
  { key: 'appearance', label: 'Appearance', icon: '🎨' },
  { key: 'advanced', label: 'Advanced', icon: '🔧' },
];

const ConfigurationsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load configurations
  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/configurations/');
      setConfigurations(response.data);
    } catch (error) {
      console.error('Failed to load configurations:', error);
      showMessage('error', 'Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (configId: string, newValue: string) => {
    setChanges(prev => ({
      ...prev,
      [configId]: newValue
    }));
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      showMessage('error', 'No changes to save');
      return;
    }

    try {
      setSaving(true);
      
      const configurationsToUpdate = Object.entries(changes).map(([id, value]) => ({
        id,
        value
      }));

      await axios.post('/api/v1/configurations/bulk_update/', {
        configurations: configurationsToUpdate
      });

      showMessage('success', `Saved ${configurationsToUpdate.length} configuration(s)`);
      setChanges({});
      await loadConfigurations();
    } catch (error) {
      console.error('Failed to save configurations:', error);
      showMessage('error', 'Failed to save configurations');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset all configurations in "${activeCategory}" category to defaults?`)) {
      return;
    }

    try {
      setSaving(true);
      await axios.post('/api/v1/configurations/reset_category/', {
        category: activeCategory
      });
      
      showMessage('success', `Reset ${activeCategory} configurations to defaults`);
      setChanges({});
      await loadConfigurations();
    } catch (error) {
      console.error('Failed to reset configurations:', error);
      showMessage('error', 'Failed to reset configurations');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const filteredConfigs = configurations.filter(c => c.category === activeCategory);
  const hasChanges = Object.keys(changes).length > 0;

  return (
    <PageContainer>
      <PageHeader>
        <TitleRow>
          <div>
            <PageTitle>⚙️ Configurations</PageTitle>
            <PageDescription>
              Manage tenant-specific settings organized by category
            </PageDescription>
          </div>
          <ActionButtons>
            {hasChanges && (
              <>
                <CancelButton onClick={() => setChanges({})}>
                  Cancel
                </CancelButton>
                <SaveButton onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : `Save ${Object.keys(changes).length} Change(s)`}
                </SaveButton>
              </>
            )}
          </ActionButtons>
        </TitleRow>
      </PageHeader>

      {message && (
        <Message type={message.type}>
          {message.type === 'success' ? '✓' : '✗'} {message.text}
        </Message>
      )}

      <CategoryTabs>
        {CATEGORIES.map(cat => (
          <Tab
            key={cat.key}
            active={activeCategory === cat.key}
            onClick={() => setActiveCategory(cat.key)}
          >
            <span className="icon">{cat.icon}</span>
            <span className="label">{cat.label}</span>
          </Tab>
        ))}
      </CategoryTabs>

      <ContentCard>
        {loading ? (
          <LoadingState>Loading configurations...</LoadingState>
        ) : filteredConfigs.length === 0 ? (
          <EmptyState>
            <EmptyIcon>📋</EmptyIcon>
            <EmptyText>No configurations in this category</EmptyText>
            <EmptyHint>Add configurations via the API or backend admin</EmptyHint>
          </EmptyState>
        ) : (
          <>
            <ConfigGrid>
              {filteredConfigs.map(config => (
                <ConfigField key={config.id}>
                  <FieldLabel>
                    {config.display_name}
                    {config.is_required && <Required>*</Required>}
                    {config.is_system && <SystemBadge>System</SystemBadge>}
                  </FieldLabel>
                  
                  {config.description && (
                    <FieldDescription>{config.description}</FieldDescription>
                  )}

                  {config.data_type === 'boolean' ? (
                    <CheckboxInput
                      type="checkbox"
                      checked={changes[config.id] !== undefined 
                        ? changes[config.id] === 'true' 
                        : config.typed_value}
                      onChange={(e) => handleValueChange(config.id, e.target.checked ? 'true' : 'false')}
                    />
                  ) : config.data_type === 'json' ? (
                    <TextArea
                      value={changes[config.id] !== undefined ? changes[config.id] : config.value}
                      onChange={(e) => handleValueChange(config.id, e.target.value)}
                      rows={4}
                    />
                  ) : (
                    <TextInput
                      type={config.data_type === 'integer' || config.data_type === 'float' ? 'number' : 'text'}
                      step={config.data_type === 'float' ? '0.01' : undefined}
                      value={changes[config.id] !== undefined ? changes[config.id] : config.value}
                      onChange={(e) => handleValueChange(config.id, e.target.value)}
                    />
                  )}

                  {config.updated_by_name && (
                    <FieldMeta>
                      Last updated by {config.updated_by_name} on{' '}
                      {new Date(config.updated_at).toLocaleString()}
                    </FieldMeta>
                  )}
                </ConfigField>
              ))}
            </ConfigGrid>

            <FooterActions>
              <ResetButton onClick={handleReset} disabled={saving}>
                Reset Category to Defaults
              </ResetButton>
            </FooterActions>
          </>
        )}
      </ContentCard>
    </PageContainer>
  );
};

// Styled Components
const PageContainer = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  margin-bottom: 24px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const PageDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
`;

const SaveButton = styled.button`
  padding: 10px 20px;
  background: linear-gradient(135deg, rgb(99, 102, 241), rgb(139, 92, 246));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled.button`
  padding: 10px 20px;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-text-secondary));
  }
`;

const Message = styled.div<{ type: 'success' | 'error' }>`
  padding: 12px 16px;
  background: ${props => props.type === 'success' 
    ? 'rgba(34, 197, 94, 0.1)' 
    : 'rgba(239, 68, 68, 0.1)'};
  border: 1px solid ${props => props.type === 'success'
    ? 'rgb(34, 197, 94)'
    : 'rgb(239, 68, 68)'};
  border-radius: var(--radius-md);
  color: ${props => props.type === 'success'
    ? 'rgb(34, 197, 94)'
    : 'rgb(239, 68, 68)'};
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 24px;
`;

const CategoryTabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid rgb(var(--color-border));
  overflow-x: auto;
`;

const Tab = styled.button<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: ${props => props.active ? 'rgb(var(--color-surface))' : 'transparent'};
  border: none;
  border-bottom: 3px solid ${props => props.active ? 'rgb(99, 102, 241)' : 'transparent'};
  color: ${props => props.active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 14px;
  font-weight: ${props => props.active ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  .icon {
    font-size: 16px;
  }

  &:hover {
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }
`;

const ContentCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 32px;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 48px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const EmptyHint = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;

const ConfigField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Required = styled.span`
  color: rgb(239, 68, 68);
  font-weight: 700;
`;

const SystemBadge = styled.span`
  padding: 2px 8px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgb(99, 102, 241);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: rgb(99, 102, 241);
`;

const FieldDescription = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.4;
`;

const TextInput = styled.input`
  padding: 10px 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(99, 102, 241);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const TextArea = styled.textarea`
  padding: 10px 12px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: rgb(var(--color-text-primary));
  resize: vertical;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: rgb(99, 102, 241);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const CheckboxInput = styled.input`
  width: 20px;
  height: 20px;
  cursor: pointer;
`;

const FieldMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const FooterActions = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: 24px;
  border-top: 1px solid rgb(var(--color-border));
`;

const ResetButton = styled.button`
  padding: 10px 20px;
  background: transparent;
  color: rgb(239, 68, 68);
  border: 1px solid rgb(239, 68, 68);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export default ConfigurationsPage;
