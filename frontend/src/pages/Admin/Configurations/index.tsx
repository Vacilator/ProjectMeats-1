/**
 * Configurations Page
 *
 * Tenant configuration management with category tabs.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';

import { Modal as AntModal } from 'antd';
import { businessApi } from '@/services/businessApi';
import { AdminGuard, AdminPage, AdminSection, ConfirmDialog, EmptyState, LoadingSkeleton } from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { captureSentryException } from '@/utils/sentry';
import { confirmDialog } from '@/utils/uiDialogs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { logger } from '@/utils/logger';

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

interface TenantCurrent {
  id: string;
  name: string;
}

const ConfigurationsPage: React.FC = () => {
  useDocumentTitle('Configurations');
  const toast = useToast();
  const { permissions } = useAdminPermissions();
  const canManage = permissions.can_manage_configurations;

  const currentTenantQuery = useQuery<TenantCurrent>({
    queryKey: withTenantQueryKey('tenants', 'current', 'configurations'),
    queryFn: async () => {
      const res = await businessApi.get('/tenants/current/');
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const tenantId = currentTenantQuery.data?.id;

  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    category: activeCategory,
    key: '',
    display_name: '',
    description: '',
    data_type: 'string' as Configuration['data_type'],
    value: '',
    default_value: '',
    is_required: false,
  });

  const handleResetConfirmClose = useCallback(() => setShowResetConfirm(false), []);

  useEffect(() => {
    if (!canManage) return;
    if (currentTenantQuery.isLoading) return;
    loadConfigurations();
  }, [canManage, currentTenantQuery.isLoading, tenantId]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await businessApi.get('/configurations/', {
        params: tenantId ? { tenant: tenantId } : undefined,
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setConfigurations(data);
    } catch (error) {
      logger.error('Failed to load configurations:', error);
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

  const handleSentryTest = () => {
    const timestamp = new Date().toISOString();

    try {
      throw new Error('Sentry Orchestration Handshake Verified');
    } catch (caught) {
      captureSentryException(caught as Error, {
        component: 'Admin/Configurations',
        metadata: { timestamp },
      });
      toast.success('Sent test error to Sentry');
    }
  };

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }

    try {
      setSaving(true);
      const configurationsToUpdate = Object.entries(changes).map(([id, value]) => ({ id, value }));

      const response = await businessApi.post('/configurations/bulk_update/', {
        configurations: configurationsToUpdate,
      });

      const errors = Array.isArray((response.data as any)?.errors) ? (response.data as any).errors : [];
      if (errors.length > 0) {
        const first = errors[0];
        toast.error(
          `Saved ${configurationsToUpdate.length - errors.length}/${configurationsToUpdate.length}, with ${errors.length} error(s): ${first?.error || 'Update failed'}`
        );
      } else {
        toast.success(`Saved ${configurationsToUpdate.length} configuration(s)`);
      }

      setChanges({});
      await loadConfigurations();
    } catch (error) {
      logger.error('Failed to save configurations:', error);
      toast.error('Failed to save configurations');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const openCreateModal = () => {
    setCreateForm({
      category: activeCategory,
      key: '',
      display_name: '',
      description: '',
      data_type: 'string',
      value: '',
      default_value: '',
      is_required: false,
    });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    const payload = {
      category: createForm.category,
      key: createForm.key.trim(),
      display_name: createForm.display_name.trim() || createForm.key.trim(),
      description: createForm.description.trim(),
      data_type: createForm.data_type,
      value: createForm.value,
      default_value: createForm.default_value,
      is_required: createForm.is_required,
      is_system: false,
    };

    if (!payload.key || !payload.display_name) {
      toast.error('Key and display name are required');
      return;
    }

    if (payload.data_type === 'json') {
      try {
        JSON.parse(payload.value || '');
      } catch {
        toast.error('Value must be valid JSON');
        return;
      }
    }

    if (payload.data_type === 'boolean') {
      const v = String(payload.value || '').toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(v)) {
        toast.error("Boolean value must be 'true' or 'false'");
        return;
      }
    }

    setIsCreating(true);
    try {
      await businessApi.post('/configurations/', payload);
      toast.success('Configuration created');
      setShowCreateModal(false);
      await loadConfigurations();
    } catch (error: unknown) {
      logger.error('Failed to create configuration:', error);
      const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      toast.error((typeof data.error === 'string' ? data.error : '') || 'Failed to create configuration');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetOne = async (configId: string) => {
    try {
      await businessApi.post(`/configurations/${configId}/reset/`);
      toast.success('Reset to default');
      await loadConfigurations();
    } catch (error: unknown) {
      logger.error('Failed to reset configuration:', error);
      const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      toast.error((typeof data.error === 'string' ? data.error : '') || 'Failed to reset configuration');
    }
  };

  const handleDeleteOne = async (config: Configuration) => {
    if (config.is_system) {
      toast.error('System configurations cannot be deleted');
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Delete configuration?',
      content: `Delete configuration "${config.display_name}"?`,
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await businessApi.delete(`/configurations/${config.id}/`);
      toast.success('Configuration deleted');
      await loadConfigurations();
    } catch (error: unknown) {
      logger.error('Failed to delete configuration:', error);
      const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      toast.error((typeof data.error === 'string' ? data.error : '') || 'Failed to delete configuration');
    }
  };

  const confirmReset = async () => {
    try {
      setSaving(true);
      const response = await businessApi.post('/configurations/reset_category/', {
        category: activeCategory,
      });

      const resetCount = (response.data as any)?.reset_count;
      toast.success(
        typeof resetCount === 'number'
          ? `Reset ${resetCount} configuration(s) in ${activeCategory}`
          : `Reset ${activeCategory} configurations to defaults`
      );

      setChanges({});
      await loadConfigurations();
    } catch (error) {
      logger.error('Failed to reset configurations:', error);
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
              onClick={handleSentryTest}
              disabled={saving || currentTenantQuery.isLoading}
              title="Send a manual test error to Sentry"
            >
              Sentry Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openCreateModal}
              disabled={saving || currentTenantQuery.isLoading}
            >
              Add
            </Button>
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
                    : 'No configurations exist in this category yet.'
                }
                action={
                  canManage && !normalizedSearch && !showModifiedOnly
                    ? { label: 'Add configuration', onClick: openCreateModal }
                    : undefined
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
                        <RowActions>
                          <RowActionButton
                            type="button"
                            onClick={() => handleResetOne(config.id)}
                            disabled={saving || isCreating || !config.default_value}
                            title={!config.default_value ? 'No default value available' : 'Reset to default'}
                          >
                            Reset
                          </RowActionButton>
                          <RowActionButton
                            type="button"
                            onClick={() => handleDeleteOne(config)}
                            disabled={saving || isCreating || config.is_system}
                            title={config.is_system ? 'System config' : 'Delete'}
                            $danger
                          >
                            Delete
                          </RowActionButton>
                          {changes[config.id] !== undefined && (
                            <RevertButton type="button" onClick={() => clearChange(config.id)}>
                              Revert
                            </RevertButton>
                          )}
                        </RowActions>
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
            onClose={handleResetConfirmClose}
            onConfirm={confirmReset}
            title="Reset Category"
            message={`Reset all configurations in "${CATEGORIES.find((c) => c.key === activeCategory)?.label || activeCategory}" to defaults?`}
            confirmText="Reset"
            confirmVariant="danger"
          />

          <AntModal
            open={showCreateModal}
            onCancel={() => setShowCreateModal(false)}
            title={null}
            footer={null}
            width={720}
            destroyOnHidden
            styles={{ body: { padding: 0 } }}
          >
            <CreateModalContent>
              <CreateHeader>
                <CreateTitle>Add Configuration</CreateTitle>
                <CreateSubtitle>
                  Creating a configuration adds a tenant-specific setting. This is safe and reversible.
                </CreateSubtitle>
              </CreateHeader>

              <CreateGrid>
                <CreateField>
                  <CreateLabel>Category</CreateLabel>
                  <Select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value as Category }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </CreateField>

                <CreateField>
                  <CreateLabel>Key</CreateLabel>
                  <TextInput
                    value={createForm.key}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        key: e.target.value,
                        display_name: p.display_name || e.target.value,
                      }))
                    }
                    placeholder="e.g. session_timeout"
                  />
                </CreateField>

                <CreateField>
                  <CreateLabel>Display name</CreateLabel>
                  <TextInput
                    value={createForm.display_name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, display_name: e.target.value }))}
                    placeholder="e.g. Session Timeout"
                  />
                </CreateField>

                <CreateField>
                  <CreateLabel>Type</CreateLabel>
                  <Select
                    value={createForm.data_type}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, data_type: e.target.value as Configuration['data_type'] }))
                    }
                  >
                    <option value="string">String</option>
                    <option value="integer">Integer</option>
                    <option value="float">Float</option>
                    <option value="boolean">Boolean</option>
                    <option value="json">JSON</option>
                  </Select>
                </CreateField>

                <CreateField style={{ gridColumn: '1 / -1' }}>
                  <CreateLabel>Description</CreateLabel>
                  <TextArea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    placeholder="What does this setting control?"
                  />
                </CreateField>

                <CreateField style={{ gridColumn: '1 / -1' }}>
                  <CreateLabel>Value</CreateLabel>
                  <TextArea
                    value={createForm.value}
                    onChange={(e) => setCreateForm((p) => ({ ...p, value: e.target.value }))}
                    rows={createForm.data_type === 'json' ? 6 : 3}
                    placeholder={
                      createForm.data_type === 'json'
                        ? '{"enabled": true}'
                        : createForm.data_type === 'boolean'
                          ? 'true'
                          : 'Enter a value'
                    }
                  />
                </CreateField>

                <CreateField style={{ gridColumn: '1 / -1' }}>
                  <CreateLabel>Default value (optional)</CreateLabel>
                  <TextArea
                    value={createForm.default_value}
                    onChange={(e) => setCreateForm((p) => ({ ...p, default_value: e.target.value }))}
                    rows={2}
                    placeholder="Used by Reset"
                  />
                </CreateField>

                <CreateField style={{ gridColumn: '1 / -1' }}>
                  <Toggle>
                    <ToggleInput
                      type="checkbox"
                      checked={createForm.is_required}
                      onChange={(e) => setCreateForm((p) => ({ ...p, is_required: e.target.checked }))}
                    />
                    <span>Required</span>
                  </Toggle>
                </CreateField>
              </CreateGrid>

              <CreateActions>
                <Button variant="outline" size="sm" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create'}
                </Button>
              </CreateActions>
            </CreateModalContent>
          </AntModal>
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

const RowActions = styled.div`
  display: inline-flex;
  gap: 6px;
  align-items: center;
`;

const RowActionButton = styled.button<{ $danger?: boolean }>`
  padding: 4px 8px;
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: ${(p) => (p.$danger ? 'rgb(var(--color-error))' : 'rgb(var(--color-text-primary))')};
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${(p) => (p.$danger ? 'rgba(var(--color-error), 0.55)' : 'rgba(var(--color-primary), 0.55)')};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
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

const CreateModalContent = styled.div`
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const CreateHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CreateTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const CreateSubtitle = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const CreateGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const CreateField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CreateLabel = styled.div`
  font-size: 12px;
  font-weight: 650;
  color: rgb(var(--color-text-primary));
`;

const Select = styled.select`
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

const CreateActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

export default ConfigurationsPage;
