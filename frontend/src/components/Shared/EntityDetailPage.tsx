/**
 * EntityDetailPage — Reusable entity detail page component
 *
 * Provides a standardized detail view with:
 * - Overview card with key fields (read-only by default)
 * - Show/Hide Details toggle for all field sections
 * - Edit button that switches to inline EntityFormSurface
 * - Related entity tabs fetched via businessApi
 */

import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Button, Skeleton, Table, message } from 'antd';
import {
  EditOutlined,
  ArrowLeftOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { businessApi } from '@/services/businessApi';
import { entityListPath, entityTypeDisplayName } from '@/utils/entityTypeRegistry';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityFormSurface from './EntityFormSurface';

// ============================================================================
// Types
// ============================================================================

export interface OverviewField {
  key: string;
  label: string;
  render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
}

export interface DetailSection {
  title: string;
  fields: OverviewField[];
}

export interface RelatedEntityTab {
  key: string;
  label: string;
  entityType: string;
  apiPath: string;
  columns: ColumnsType<Record<string, unknown>>;
  /** Query param to filter related records (e.g. { supplier: entityId }) */
  filterParam?: string;
}

export interface EntityDetailPageProps {
  entityType: string;
  entityId: string;
  /** Override API path for fetching record (defaults to /{entityType}s/{entityId}/) */
  apiPath?: string;
  overviewFields: OverviewField[];
  detailSections?: DetailSection[];
  relatedEntities?: RelatedEntityTab[];
  /** Custom title (defaults to entity display name) */
  title?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background: rgb(var(--color-background));
`;

const BackButton = styled(Button)`
  align-self: flex-start;
  color: rgb(var(--color-text-secondary));
`;

const Card = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const CardTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CardBody = styled.div`
  padding: 1.5rem;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
`;

const FieldItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const FieldLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--color-text-tertiary));
`;

const FieldValue = styled.span`
  font-size: 0.9375rem;
  color: rgb(var(--color-text-primary));
`;

const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const SectionHeader = styled.div`
  padding: 0.75rem 1.5rem;
  background: rgb(var(--color-background));
  border-bottom: 1px solid rgb(var(--color-border));
  font-weight: 600;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
`;

const TabsBar = styled.div`
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid rgb(var(--color-border));
  padding: 0 1.5rem;
`;

const TabButton = styled.button<{ $active: boolean }>`
  padding: 0.75rem 1rem;
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

const StyledTable = styled(Table)`
  .ant-table {
    background: rgb(var(--color-surface));
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
` as typeof Table;

const ErrorState = styled.div`
  padding: 3rem;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Related Tab Table (sub-component)
// ============================================================================

interface RelatedTabContentProps {
  tab: RelatedEntityTab;
  entityId: string;
}

const RelatedTabContent: React.FC<RelatedTabContentProps> = React.memo(
  ({ tab, entityId }) => {
    const queryKey = useMemo(
      () =>
        withTenantQueryKey(
          'entity-detail-related',
          tab.entityType,
          entityId,
          tab.key,
        ),
      [tab.entityType, tab.key, entityId],
    );

    const { data, isLoading } = useQuery({
      queryKey,
      queryFn: async () => {
        const params = tab.filterParam
          ? { [tab.filterParam]: entityId }
          : {};
        const response = await businessApi.get(tab.apiPath, { params });
        const raw = response.data;
        return (raw?.results ?? raw) as Record<string, unknown>[];
      },
      staleTime: 30_000,
    });

    return (
      <StyledTable
        columns={tab.columns}
        dataSource={(data ?? []) as any}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
      />
    );
  },
);
RelatedTabContent.displayName = 'RelatedTabContent';

// ============================================================================
// Component
// ============================================================================

export const EntityDetailPage: React.FC<EntityDetailPageProps> = ({
  entityType,
  entityId,
  apiPath,
  overviewFields,
  detailSections,
  relatedEntities,
  title,
}) => {
  const displayName = title ?? entityTypeDisplayName(entityType);
  useDocumentTitle(`${displayName} Detail`);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [activeRelatedTab, setActiveRelatedTab] = useState(
    relatedEntities?.[0]?.key ?? '',
  );

  // Resolve API endpoint
  const endpoint = useMemo(() => {
    if (apiPath) return apiPath;
    const listPath = entityListPath(entityType) ?? `/${entityType}s`;
    const base = listPath.startsWith('/') ? listPath.slice(1) : listPath;
    return `${base}/${entityId}/`;
  }, [apiPath, entityType, entityId]);

  const recordQueryKey = useMemo(
    () => withTenantQueryKey('entity-detail', entityType, entityId),
    [entityType, entityId],
  );

  const {
    data: record,
    isLoading,
    error,
  } = useQuery({
    queryKey: recordQueryKey,
    queryFn: async () => {
      const response = await businessApi.get(endpoint);
      return response.data as Record<string, unknown>;
    },
    staleTime: 60_000,
  });

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleEdit = useCallback(() => setIsEditing(true), []);
  const handleEditClose = useCallback(() => setIsEditing(false), []);
  const handleEditSuccess = useCallback(() => {
    setIsEditing(false);
    message.success(`${displayName} updated successfully`);
    void queryClient.invalidateQueries({ queryKey: recordQueryKey });
  }, [displayName, queryClient, recordQueryKey]);

  const toggleDetails = useCallback(
    () => setShowDetails((prev) => !prev),
    [],
  );

  const renderFieldValue = useCallback(
    (field: OverviewField): React.ReactNode => {
      if (!record) return '—';
      const value = record[field.key];
      if (field.render) return field.render(value, record);
      if (value == null || value === '') return '—';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      return String(value);
    },
    [record],
  );

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton active paragraph={{ rows: 8 }} />
      </PageContainer>
    );
  }

  if (error || !record) {
    return (
      <PageContainer>
        <BackButton
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
        >
          Back
        </BackButton>
        <ErrorState>
          {error ? 'Failed to load record.' : 'Record not found.'}
        </ErrorState>
      </PageContainer>
    );
  }

  const recordTitle =
    (record.name as string) ??
    (record.title as string) ??
    (record.po_number as string) ??
    `${displayName} #${entityId}`;

  return (
    <PageContainer>
      <BackButton
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={handleBack}
      >
        Back
      </BackButton>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>{recordTitle}</CardTitle>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            Edit
          </Button>
        </CardHeader>
        <CardBody>
          <FieldGrid>
            {overviewFields.map((field) => (
              <FieldItem key={field.key}>
                <FieldLabel>{field.label}</FieldLabel>
                <FieldValue>{renderFieldValue(field)}</FieldValue>
              </FieldItem>
            ))}
          </FieldGrid>
        </CardBody>
      </Card>

      {/* Show/Hide Details Toggle */}
      {detailSections && detailSections.length > 0 && (
        <>
          <ToggleButton onClick={toggleDetails}>
            {showDetails ? (
              <>
                <UpOutlined /> Hide Details
              </>
            ) : (
              <>
                <DownOutlined /> Show Details
              </>
            )}
          </ToggleButton>

          {showDetails &&
            detailSections.map((section) => (
              <Card key={section.title}>
                <SectionHeader>{section.title}</SectionHeader>
                <CardBody>
                  <FieldGrid>
                    {section.fields.map((field) => (
                      <FieldItem key={field.key}>
                        <FieldLabel>{field.label}</FieldLabel>
                        <FieldValue>{renderFieldValue(field)}</FieldValue>
                      </FieldItem>
                    ))}
                  </FieldGrid>
                </CardBody>
              </Card>
            ))}
        </>
      )}

      {/* Related Entities Tabs */}
      {relatedEntities && relatedEntities.length > 0 && (
        <Card>
          <TabsBar>
            {relatedEntities.map((tab) => (
              <TabButton
                key={tab.key}
                $active={activeRelatedTab === tab.key}
                onClick={() => setActiveRelatedTab(tab.key)}
              >
                {tab.label}
              </TabButton>
            ))}
          </TabsBar>
          <CardBody>
            {relatedEntities.map((tab) =>
              tab.key === activeRelatedTab ? (
                <RelatedTabContent
                  key={tab.key}
                  tab={tab}
                  entityId={entityId}
                />
              ) : null,
            )}
          </CardBody>
        </Card>
      )}

      {/* Edit Form Surface */}
      <EntityFormSurface
        entityType={entityType}
        entityId={entityId}
        mode="edit"
        variant="modal"
        isOpen={isEditing}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
      />
    </PageContainer>
  );
};

export default EntityDetailPage;
