/**
 * EntityListPage — Reusable entity list page component
 *
 * Provides a standardized list/table page with:
 * - Page header with title and create button
 * - Optional filter tabs
 * - Search/filter bar
 * - Ant Design Table with theme-compliant styling
 * - React Query data fetching via businessApi
 * - EntityFormSurface integration for record creation
 */

import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Button, message } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { businessApi } from '@/services/businessApi';
import { entityListPath, entityRecordPath } from '@/utils/entityTypeRegistry';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityFormSurface from './EntityFormSurface';
import { FormErrorBoundary } from './FormErrorBoundary';

// ============================================================================
// Types
// ============================================================================

export interface EntityListTab {
  key: string;
  label: string;
  filter?: Record<string, unknown>;
}

export interface EntityListPageProps {
  entityType: string;
  title: string;
  createLabel?: string;
  columns: ColumnsType<Record<string, unknown>>;
  tabs?: EntityListTab[];
  /** Override the API path (defaults to entityListPath from registry) */
  apiPath?: string;
  /** Additional query params */
  defaultParams?: Record<string, unknown>;
  /** Subtitle text below the title */
  subtitle?: string;
  /** Initial values to pass to create form */
  createInitialValues?: Record<string, unknown>;
  /** Page size for the table */
  pageSize?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem;
  background: rgb(var(--color-background));
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
`;

const TitleSection = styled.div`
  flex: 1;
`;

const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.25rem 0;
`;

const PageSubtitle = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const TabsBar = styled.div`
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgb(var(--color-border));
  padding-bottom: 0;
`;

const TabButton = styled.button<{ $active: boolean }>`
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: ${(p) =>
    p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  font-weight: ${(p) => (p.$active ? 600 : 400)};
  font-size: 0.875rem;
  cursor: pointer;
  border-bottom: 2px solid
    ${(p) => (p.$active ? 'rgb(var(--color-primary))' : 'transparent')};
  transition: all 0.15s ease;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const TableControls = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const StyledTable = styled(Table)`
  .ant-table {
    background: rgb(var(--color-surface));
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-lg);
  }

  .ant-table-thead > tr > th {
    background: rgb(var(--color-surface));
    color: rgb(var(--color-text-primary));
    font-weight: 600;
    border-bottom: 1px solid rgb(var(--color-border));
  }

  .ant-table-tbody > tr > td {
    color: rgb(var(--color-text-primary));
    border-bottom: 1px solid rgb(var(--color-border));
  }

  .ant-table-tbody > tr:hover > td {
    background: rgb(var(--color-surface-hover));
  }

  .ant-pagination {
    margin-top: 1rem;
  }

  .ant-pagination-item-active {
    border-color: rgb(var(--color-primary));

    a {
      color: rgb(var(--color-primary));
    }
  }
` as typeof Table;

// ============================================================================
// Component
// ============================================================================

export const EntityListPage: React.FC<EntityListPageProps> = ({
  entityType,
  title,
  createLabel,
  columns,
  tabs,
  apiPath,
  defaultParams,
  subtitle,
  createInitialValues,
  pageSize = 20,
}) => {
  useDocumentTitle(title);
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? 'all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const resolvedApiPath = useMemo(
    () => apiPath ?? entityListPath(entityType) ?? `/${entityType}s`,
    [apiPath, entityType],
  );

  // Build stable API path (strip leading slash for businessApi which uses baseURL)
  const apiEndpoint = useMemo(() => {
    const path = resolvedApiPath.startsWith('/') ? resolvedApiPath.slice(1) : resolvedApiPath;
    return `${path}/`;
  }, [resolvedApiPath]);

  // Build query params from active tab filter + search
  const activeTabFilter = useMemo(() => {
    if (!tabs) return {};
    const tab = tabs.find((t) => t.key === activeTab);
    return tab?.filter ?? {};
  }, [tabs, activeTab]);

  const queryParams = useMemo(
    () => ({
      ...defaultParams,
      ...activeTabFilter,
      ...(searchText ? { search: searchText } : {}),
    }),
    [defaultParams, activeTabFilter, searchText],
  );

  const stableQueryKey = useMemo(
    () => withTenantQueryKey('entity-list', entityType, activeTab, searchText),
    [entityType, activeTab, searchText],
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: stableQueryKey,
    queryFn: async () => {
      try {
        const response = await businessApi.get(apiEndpoint, { params: queryParams });
        const raw = response.data;
        return (raw?.results ?? raw) as Record<string, unknown>[];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });

  const dataSource = useMemo(() => data ?? [], [data]);

  const handleCreateOpen = useCallback(() => setShowCreateForm(true), []);
  const handleCreateClose = useCallback(() => setShowCreateForm(false), []);
  const handleCreateSuccess = useCallback(() => {
    setShowCreateForm(false);
    message.success(`${createLabel ?? entityType} created successfully`);
    void refetch();
  }, [createLabel, entityType, refetch]);

  const handleRowClick = useCallback(
    (record: Record<string, unknown>) => {
      const id = String(record.id ?? '');
      if (!id) return;
      navigate(entityRecordPath(entityType, id));
    },
    [entityType, navigate],
  );

  return (
    <PageContainer>
      <PageHeader>
        <TitleSection>
          <PageTitle>{title}</PageTitle>
          {subtitle && <PageSubtitle>{subtitle}</PageSubtitle>}
        </TitleSection>
        {createLabel && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={handleCreateOpen}
          >
            {createLabel}
          </Button>
        )}
      </PageHeader>

      {tabs && tabs.length > 0 && (
        <TabsBar>
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              $active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </TabButton>
          ))}
        </TabsBar>
      )}

      <TableControls>
        <Input
          placeholder={`Search ${title.toLowerCase()}...`}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </TableControls>

      <StyledTable
        columns={columns}
        dataSource={dataSource as Record<string, unknown>[]}
        rowKey="id"
        loading={isLoading}
        onRow={(record) => ({
          onClick: () => handleRowClick(record as Record<string, unknown>),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} records`,
        }}
        scroll={{ x: 'max-content' }}
      />

      {createLabel && (
        <FormErrorBoundary entityType={entityType} onClose={handleCreateClose}>
          <EntityFormSurface
            entityType={entityType}
            mode="create"
            variant="modal"
            isOpen={showCreateForm}
            onClose={handleCreateClose}
            initialValues={createInitialValues}
            onSuccess={handleCreateSuccess}
          />
        </FormErrorBoundary>
      )}
    </PageContainer>
  );
};

export default EntityListPage;
