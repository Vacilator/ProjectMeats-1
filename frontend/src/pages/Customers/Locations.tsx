/**
 * Customer Locations Management Page - Table View
 *
 * Features:
 * - Table layout with sorting, pagination, and search
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Contextual customer selection (state-based navigation)
 * - Links to customer details
 * - Theme-compliant styling with antd Table
 * - Multi-tenancy support
 */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Table, Input, Button, message, Tag, Space } from 'antd';
import { confirmDialog } from '@/utils/uiDialogs';
import EntityFormSurface from '../../components/Shared/EntityFormSurface';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '../../services/apiService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface Location {
  id: number;
  name: string;
  code?: string;
  customer: number | null;
  customer_name?: string;
  location_type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  phone?: string;
  phone_type?: 'office' | 'mobile';
  email?: string;
  contact_name?: string;
  is_active?: boolean;
}

interface Customer {
  id: number;
  name: string;
}


// ============================================================================
// Styled Components (Theme-Compliant)
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

const ContextBanner = styled.div`
  background: rgb(var(--color-primary) / 0.1);
  border: 1px solid rgb(var(--color-primary) / 0.3);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;

  span {
    font-weight: 500;
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
`;

const CustomerLink = styled.a`
  color: rgb(var(--color-primary));
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

// ============================================================================
// Main Component
// ============================================================================

const CustomerLocations: React.FC = () => {
  useDocumentTitle('Customer Locations');
  const location = useLocation();
  const navigate = useNavigate();
  const { customerId } = useParams<{ customerId?: string }>();

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [contextCustomerId, setContextCustomerId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const locationInitialValues = useMemo(
    () => ({
      ...(contextCustomerId ? { customer: String(contextCustomerId) } : {}),
      location_type: 'warehouse',
      country: 'USA',
    }),
    [contextCustomerId]
  );

  // Detect context from URL (preferred) or navigation state (fallback)
  useEffect(() => {
    const state = location.state as any;
    const params = new URLSearchParams(location.search);

    const paramId = customerId ? Number(customerId) : NaN;
    const queryCustomer = params.get('customer');
    const queryId = queryCustomer ? Number(queryCustomer) : NaN;
    const stateId = state?.customerId ? Number(state.customerId) : NaN;

    const nextContext =
      (Number.isFinite(paramId) && paramId > 0 ? paramId : null) ??
      (Number.isFinite(queryId) && queryId > 0 ? queryId : null) ??
      (Number.isFinite(stateId) && stateId > 0 ? stateId : null);

    setContextCustomerId(nextContext);
  }, [location.search, location.state, customerId]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    loadLocations(contextCustomerId);
  }, [contextCustomerId]);

  useEffect(() => {
    filterLocations();
  }, [locations, searchText, contextCustomerId]);

  const loadLocations = async (customerFilterId: number | null) => {
    try {
      setLoading(true);
      const params = customerFilterId ? { customer: customerFilterId } : undefined;

      // Try multiple possible endpoints
      let response;
      try {
        response = await apiClient.get('locations/', { params });
      } catch (err: unknown) {
        const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
        const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
        if (resp.status === 404) {
          // Try alternative endpoint
          response = await apiClient.get('api/v1/locations/', { params });
        } else {
          throw err;
        }
      }
      setLocations(response.data.results || response.data);
    } catch (error) {
      logger.error('Error loading locations:', error);
      message.warning('Locations API not yet implemented. Using empty dataset.');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await apiClient.get('customers/');
      setCustomers(response.data.results || response.data);
    } catch (error) {
      logger.error('Error loading customers:', error);
    }
  };

  const filterLocations = () => {
    let filtered = [...locations];

    // Filter by context customer
    if (contextCustomerId) {
      filtered = filtered.filter(l => l.customer === contextCustomerId);
    }

    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(l =>
        l.name.toLowerCase().includes(search) ||
        l.code?.toLowerCase().includes(search) ||
        l.customer_name?.toLowerCase().includes(search) ||
        l.city?.toLowerCase().includes(search) ||
        l.state?.toLowerCase().includes(search)
      );
    }

    setFilteredLocations(filtered);
  };

  const handleAdd = () => {
    setEditingLocation(null);
    setShowModal(true);
  };

  const handleEdit = (loc: Location) => {
    setEditingLocation(loc);
    setShowModal(true);
  };

  const handleDelete = async (loc: Location) => {
    const confirmed = await confirmDialog({
      title: 'Delete Location',
      content: `Are you sure you want to delete ${loc.name}?`,
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`locations/${loc.id}/`);
      message.success('Location deleted successfully');
      loadLocations(contextCustomerId);
    } catch (error: unknown) {
      logger.error('Error deleting location:', error);
      message.error('Failed to delete location');
    }
  };



  const handleFormClose = useCallback(() => {
    setShowModal(false);
    setEditingLocation(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowModal(false);
    setEditingLocation(null);
    void loadLocations(contextCustomerId);
  }, [contextCustomerId]);

  const handleCustomerClick = (customerId: number) => {
    navigate(`/customers/${customerId}`);
  };

  // Table columns
  const columns: ColumnsType<Location> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      width: 200,
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      sorter: (a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''),
      render: (text, record) => (
        record.customer ? (
          <CustomerLink onClick={() => handleCustomerClick(record.customer!)}>
            {text || 'Unknown'}
          </CustomerLink>
        ) : '-'
      ),
      width: 180,
    },
    {
      title: 'Type',
      dataIndex: 'location_type',
      key: 'location_type',
      filters: [
        { text: 'Warehouse', value: 'warehouse' },
        { text: 'Store', value: 'store' },
        { text: 'Distribution Center', value: 'distribution_center' },
        { text: 'Office', value: 'office' },
      ],
      onFilter: (value, record) => record.location_type === value,
      render: (type) => {
        const colors: { [key: string]: string } = {
          warehouse: 'blue',
          store: 'green',
          distribution_center: 'orange',
          office: 'purple',
        };
        return type ? <Tag color={colors[type] || 'default'}>{type}</Tag> : '-';
      },
      width: 150,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      width: 200,
      render: (text) => text || '-',
    },
    {
      title: 'City/State',
      key: 'location',
      render: (_, record) => {
        if (record.city && record.state) {
          return `${record.city}, ${record.state}`;
        }
        return '-';
      },
      width: 160,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(record);
            }}
          >
            Edit
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(record);
            }}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader>
        <TitleSection>
          <PageTitle>Customer Locations</PageTitle>
          <PageSubtitle>Manage customer delivery addresses and facilities</PageSubtitle>
        </TitleSection>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={handleAdd}
        >
          Add Location
        </Button>
      </PageHeader>

      {contextCustomerId && (
        <ContextBanner>
          <span>📍 Context: Showing locations for selected customer</span>
        </ContextBanner>
      )}

      <TableControls>
        <Input
          placeholder="Search locations by name, customer, or address..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </TableControls>

      <StyledTable
        columns={columns as any}
        dataSource={filteredLocations as any}
        rowKey="id"
        loading={loading}
        onRow={(record) => {
          const rec = record as Location;
          return {
            onClick: () => {
              const cid = contextCustomerId ?? rec.customer ?? undefined;
              if (cid) {
                navigate(`/customers/${cid}/locations/${rec.id}`);
                return;
              }
              navigate(`/locations/${rec.id}`);
            },
            style: { cursor: 'pointer' },
          };
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} locations`,
        }}
        scroll={{ x: 'max-content' }}
      />

      {showModal && (
        <EntityFormSurface
          entityType="location"
          mode={editingLocation ? 'edit' : 'create'}
          entityId={editingLocation?.id}
          isOpen={showModal}
          onClose={handleFormClose}
          initialValues={locationInitialValues}
          onSuccess={handleFormSuccess}
        />
      )}
    </PageContainer>
  );
};

export default CustomerLocations;
