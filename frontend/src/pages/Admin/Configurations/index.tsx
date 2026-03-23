/**
 * Configurations Page
 *
 * Tenant configuration management with category tabs.
 */
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { apiClient } from '@/services/apiService';
import { AdminGuard, AdminPage, AdminSection, ConfirmDialog, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

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
  const toast = useToast();
  const { permissions } = useAdminPermissions();
  const canManage = permissions.can_manage_configurations;

  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    loadConfigurations();
  }, [canManage]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiClient.get('/configurations/');
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setConfigurations(data);
    } catch (error) {
      console.error('Failed to load configurations:', error);
      setLoadError('Failed to load configurations. Please refresh and try again.');
      toast.error('Failed to load configurations');
      setConfigurations([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizedSearch = useMemo(() => search.trim().toLowerCase(), [search]);

  const filteredConfigs = useMemo(() => {
    let list = configurations.filter((c) => c.category === activeCategory);

    if (normalizedSearch) {
      list = list.filter((c) => {
        const haystack = `${c.key} ${c.display_name} ${c.description || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    if (showModifiedOnly) {
      list = list.filter((c) => changes[c.id] !== undefined);
    }

    return list;
  }, [activeCategory, changes, configurations, normalizedSearch, showModifiedOnly]);

  const hasChanges = Object.keys(changes).length > 0;

  const configById = useMemo(() => {
    return configurations.reduce<Record<string, Configuration>>((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});
  }, [configurations]);

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    for (const [id, value] of Object.entries(changes)) {
      const config = configById[id];
      if (!config) continue;

      if (config.data_type === 'json') {
        try {
          JSON.parse(value);
        } catch {
          errors[id] = 'Invalid JSON. Please fix formatting before saving.';
        }
      }

      if (config.data_type === 'integer' && value !== '' && !/^-?\d+$/.test(value)) {
        errors[id] = 'Enter a whole number (integer).';
      }

      if (config.data_type === 'float' && value !== '' && Number.isNaN(Number(value))) {
        errors[id] = 'Enter a valid number.';
      }
    }

    return errors;
  }, [changes, configById]);

  const canSave = hasChanges && !saving && Object.keys(validationErrors).length === 0;

  const clearChange = (configId: string) => {
    setChanges((prev) => {
      if (prev[configId] === undefined) return prev;
      const next = { ...prev };
      delete next[configId];
      return next;
    });
  };

  const handleValueChange = (configId: string, newValue: string) => {
    setChanges((prev) => ({
      ...prev,
      [configId]: newValue,
    }));
  };

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }

    try {
      setSaving(true);
      const configurationsToUpdate = Object.entries(changes).map(([id, value]) => ({ id, value }));

      await apiClient.post('/configurations/bulk_update/', {
        configurations: configurationsToUpdate,
      });

      toast.success(`Saved ${configurationsToUpdate.length} configuration(s)`);
      setChanges({});
      await loadConfigurations();
    } catch (error) {
      console.error('Failed to save configurations:', error);
      toast.error('Failed to save configurations');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    try {
      setSaving(true);
      await apiClient.post('/configurations/reset_category/', {
        category: activeCategory,
      });

      toast.success(`Reset ${activeCategory} configurations to defaults`);
      setChanges({});
      await loadConfigurations();
    } catch (error) {
      console.error('Failed to reset configurations:', error);
      toast.error('Failed to reset configurations');
    } finally {
      setSaving(false);
      setShowResetConfirm(false);
    }
  };

  return (
    <AdminPage
      title="Configurations"
      description="Manage tenant-specific settings organized by category."
      icon="🔧"
      actions={
        canManage ? (
          <Actions>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChanges({})}
              disabled={saving || !hasChanges}
              title={!hasChanges ? 'No changes to discard' : undefined}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              title={
                !hasChanges
                  ? 'No changes to save'
                  : Object.keys(validationErrors).length > 0
                    ? 'Fix validation errors before saving'
                    : undefined
              }
            >
              {saving ? 'Saving…' : `Save ${Object.keys(changes).length}`}
            </Button>
          </Actions>
        ) : null
      }
      headerExtras={
        <HeaderExtras>
          <CategoryTabs role="tablist" aria-label="Configuration categories">
            {CATEGORIES.map((cat) => (
              <TabButton
                key={cat.key}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.key}
                $active={activeCategory === cat.key}
                onClick={() => setActiveCategory(cat.key)}
              >
                <span aria-hidden="true">{cat.icon}</span>
                <span>{cat.label}</span>
              </TabButton>
            ))}
          </CategoryTabs>

          <FiltersRow>
            <SearchInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings…"
              aria-label="Search configurations"
            />
            <Toggle>
              <ToggleInput
                type="checkbox"
                checked={showModifiedOnly}
                onChange={(e) => setShowModifiedOnly(e.target.checked)}
              />
              <span>Modified only</span>
            </Toggle>
          </FiltersRow>
        </HeaderExtras>
      }
    >
      <AdminGuard
        feature="configurations"
        allow={(p) => p.can_manage_configurations}
        loadingFallback={<LoadingSkeleton type="list" rows={6} />}
      >
        <>
          <AdminSection
            title={CATEGORIES.find((c) => c.key === activeCategory)?.label || 'Category'}
            description={
              hasChanges
                ? Object.keys(validationErrors).length > 0
                  ? `You have ${Object.keys(changes).length} unsaved change(s) and ${Object.keys(validationErrors).length} validation issue(s).`
                  : `You have ${Object.keys(changes).length} unsaved change(s).`
                : 'Edit values and save when ready.'
            }
            actions={
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                Reset Category
              </Button>
            }
          >
            {loading ? (
              <LoadingSkeleton type="list" rows={6} />
            ) : loadError ? (
              <InlineError role="alert">{loadError}</InlineError>
            ) : filteredConfigs.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No configurations"
                message={
                  normalizedSearch || showModifiedOnly
                    ? 'No configurations match your filters.'
                    : 'No configurations exist in this category.'
                }
              />
            ) : (
              <ConfigGrid>
                {filteredConfigs.map((config) => (
                  <ConfigField key={config.id}>
                    <FieldHeader>
                      <FieldLabel>
                        {config.display_name}
                        {config.is_required && <Required title="Required">*</Required>}
                      </FieldLabel>
                      <FieldBadges>
                        {changes[config.id] !== undefined && <ModifiedBadge>Modified</ModifiedBadge>}
                        {config.is_system && <SystemBadge>System</SystemBadge>}
                        {changes[config.id] !== undefined && (
                          <RevertButton type="button" onClick={() => clearChange(config.id)}>
                            Revert
                          </RevertButton>
                        )}
                      </FieldBadges>
                    </FieldHeader>

                    {config.description && <FieldDescription>{config.description}</FieldDescription>}

                    {config.data_type === 'boolean' ? (
                      <CheckboxRow>
                        <CheckboxInput
                          type="checkbox"
                          checked={
                            changes[config.id] !== undefined
                              ? changes[config.id] === 'true'
                              : Boolean(config.typed_value)
                          }
                          onChange={(e) =>
                            handleValueChange(config.id, e.target.checked ? 'true' : 'false')
                          }
                          aria-label={config.display_name}
                        />
                        <CheckboxLabel>{changes[config.id] !== undefined ? 'Modified' : 'Enabled'}</CheckboxLabel>
                      </CheckboxRow>
                    ) : config.data_type === 'json' ? (
                      <>
                        <TextArea
                          value={changes[config.id] !== undefined ? changes[config.id] : config.value}
                          onChange={(e) => handleValueChange(config.id, e.target.value)}
                          rows={4}
                          aria-invalid={Boolean(validationErrors[config.id])}
                        />
                        {validationErrors[config.id] && (
                          <FieldError role="alert">{validationErrors[config.id]}</FieldError>
                        )}
                      </>
                    ) : (
                      <>
                        <TextInput
                          type={config.data_type === 'integer' || config.data_type === 'float' ? 'number' : 'text'}
                          step={config.data_type === 'float' ? '0.01' : undefined}
                          value={changes[config.id] !== undefined ? changes[config.id] : config.value}
                          onChange={(e) => handleValueChange(config.id, e.target.value)}
                          aria-invalid={Boolean(validationErrors[config.id])}
                        />
                        {validationErrors[config.id] && (
                          <FieldError role="alert">{validationErrors[config.id]}</FieldError>
                        )}
                      </>
                    )}

                    {config.updated_by_name && (
                      <FieldMeta>
                        Updated by {config.updated_by_name} • {new Date(config.updated_at).toLocaleString()}
                      </FieldMeta>
                    )}
                  </ConfigField>
                ))}
              </ConfigGrid>
            )}
          </AdminSection>

          <ConfirmDialog
            isOpen={showResetConfirm}
            onClose={() => setShowResetConfirm(false)}
            onConfirm={confirmReset}
            title="Reset Category"
            message={`Reset all configurations in "${CATEGORIES.find((c) => c.key === activeCategory)?.label || activeCategory}" to defaults?`}
            confirmText="Reset"
            confirmVariant="danger"
          />
        </>
      </AdminGuard>
    </AdminPage>
  );
};

const InlineError = styled.div`
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-error) / 0.08);
  border: 1px solid rgb(var(--color-error) / 0.25);
  color: rgb(var(--color-error));
  font-size: 14px;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const HeaderExtras = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FiltersRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
`;

const SearchInput = styled.input`
  width: min(520px, 100%);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const Toggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  font-weight: 600;
`;

const ToggleInput = styled.input`
  width: 18px;
  height: 18px;
  accent-color: rgb(var(--color-primary));
`;

const CategoryTabs = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid
    ${(props) => (props.$active ? 'rgba(var(--color-primary), 0.45)' : 'rgb(var(--color-border))')};
  background: ${(props) => (props.$active ? 'rgba(var(--color-primary), 0.10)' : 'rgb(var(--color-surface))')};
  color: ${(props) => (props.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-primary))')};
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;

  &:hover {
    background: rgba(var(--color-primary), 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;

  @media (min-width: 1024px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
`;

const ConfigField = styled.div`
  padding: 14px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
`;

const FieldError = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: rgb(var(--color-error));
`;

const FieldHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const FieldLabel = styled.div`
  font-weight: 650;
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const FieldBadges = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
`;

const ModifiedBadge = styled.span`
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: rgba(var(--color-warning), 0.12);
  color: rgb(var(--color-warning));
  font-size: 11px;
  font-weight: 650;
`;

const RevertButton = styled.button`
  padding: 4px 8px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;

  &:hover {
    border-color: rgba(var(--color-primary), 0.55);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const Required = styled.span`
  color: rgb(var(--color-error));
`;

const SystemBadge = styled.span`
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: rgba(var(--color-info), 0.12);
  color: rgb(var(--color-info));
  font-size: 11px;
  font-weight: 650;
`;

const FieldDescription = styled.p`
  margin: 8px 0 10px;
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  line-height: 1.5;
`;

const FieldMeta = styled.div`
  margin-top: 10px;
  color: rgb(var(--color-text-secondary));
  font-size: 11px;
`;

const TextInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CheckboxInput = styled.input`
  width: 18px;
  height: 18px;
  accent-color: rgb(var(--color-primary));
`;

const CheckboxLabel = styled.span`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
`;

export default ConfigurationsPage;
