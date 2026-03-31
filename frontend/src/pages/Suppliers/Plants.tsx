/**
 * Plants Management Page - Table View
 * 
 * Features:
 * - Table layout with sorting, pagination, and search
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Contextual supplier selection (state-based navigation)
 * - Links to supplier details
 * - Theme-compliant styling with antd Table
 * - Multi-tenancy support
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Table, Input, Button, message, Tag, Space } from 'antd';
import EntityFormSurface from '../../components/Shared/EntityFormSurface';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import { apiClient } from '../../services/apiService';
import { confirmDialog } from '@/utils/uiDialogs';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface Plant {
  id: number;
  name: string;
  code: string;
  supplier: number | null;
  supplier_name?: string;
  plant_type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  phone?: string;
  phone_type?: 'office' | 'mobile';
  email?: string;
  booking_contact_email?: string;
  booking_contact_phone?: string;
  booking_contact_phone_type?: 'office' | 'mobile';
  fcfs?: boolean;
  manager?: string;
  capacity?: number;
  is_active?: boolean;
}

interface Supplier {
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

const SupplierLink = styled.a`
  color: rgb(var(--color-primary));
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const RequiredMark = styled.span`
  color: rgb(239, 68, 68);
  margin-left: 4px;
`;

const ErrorMessage = styled.div`
  color: rgb(239, 68, 68);
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

// ============================================================================
// Main Component
// ============================================================================

const Plants: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { supplierId } = useParams<{ supplierId?: string }>();
  const [searchParams] = useSearchParams();
  
  // State
  const [plants, setPlants] = useState<Plant[]>([]);
  const [filteredPlants, setFilteredPlants] = useState<Plant[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [contextSupplierId, setContextSupplierId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');

  // Detect context from URL (preferred) or navigation state (fallback)
  useEffect(() => {
    const state = location.state as any;

    const paramId = supplierId ? Number(supplierId) : NaN;
    const querySupplier = searchParams.get('supplier');
    const queryId = querySupplier ? Number(querySupplier) : NaN;
    const stateId = state?.supplierId ? Number(state.supplierId) : NaN;

    const nextContext =
      (Number.isFinite(paramId) && paramId > 0 ? paramId : null) ??
      (Number.isFinite(queryId) && queryId > 0 ? queryId : null) ??
      (Number.isFinite(stateId) && stateId > 0 ? stateId : null);

    setContextSupplierId(nextContext);
  }, [location.state, supplierId, searchParams]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadPlants(contextSupplierId);
  }, [contextSupplierId]);

  useEffect(() => {
    filterPlants();
  }, [plants, searchText, contextSupplierId]);

  const loadPlants = async (supplierFilterId: number | null) => {
    try {
      setLoading(true);
      const response = await apiClient.get('plants/', {
        params: supplierFilterId ? { supplier: supplierFilterId } : undefined,
      });
      setPlants(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading plants:', error);
      message.error('Failed to load plants');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await apiClient.get('suppliers/');
      setSuppliers(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const filterPlants = () => {
    let filtered = [...plants];
    
    // Filter by context supplier
    if (contextSupplierId) {
      filtered = filtered.filter(p => p.supplier === contextSupplierId);
    }
    
    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search) ||
        p.supplier_name?.toLowerCase().includes(search) ||
        p.city?.toLowerCase().includes(search) ||
        p.state?.toLowerCase().includes(search)
      );
    }
    
    setFilteredPlants(filtered);
  };

  const handleAdd = () => {
    setEditingPlant(null);
    setShowModal(true);
  };

  const handleEdit = (plant: Plant) => {
    setEditingPlant(plant);
    setShowModal(true);
  };

  const handleDelete = async (plant: Plant) => {
    const confirmed = await confirmDialog({
      title: 'Delete Plant',
      content: `Are you sure you want to delete ${plant.name}?`,
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`plants/${plant.id}/`);
      message.success('Plant deleted successfully');
      loadPlants(contextSupplierId);
    } catch (error: any) {
      console.error('Error deleting plant:', error);
      message.error('Failed to delete plant');
    }
  };



  const handleSupplierClick = (supplierId: number) => {
    navigate(`/suppliers/${supplierId}`);
  };

  // Table columns
  const columns: ColumnsType<Plant> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      width: 200,
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      sorter: (a, b) => a.code.localeCompare(b.code),
      width: 120,
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      sorter: (a, b) => (a.supplier_name || '').localeCompare(b.supplier_name || ''),
      render: (text, record) => (
        record.supplier ? (
          <SupplierLink
            onClick={(e) => {
              e.stopPropagation();
              handleSupplierClick(record.supplier!);
            }}
          >
            {text || 'Unknown'}
          </SupplierLink>
        ) : '-'
      ),
      width: 180,
    },
    {
      title: 'Type',
      dataIndex: 'plant_type',
      key: 'plant_type',
      filters: [
        { text: 'Processing', value: 'processing' },
        { text: 'Distribution', value: 'distribution' },
        { text: 'Storage', value: 'storage' },
        { text: 'Mixed', value: 'mixed' },
      ],
      onFilter: (value, record) => record.plant_type === value,
      render: (type) => {
        const colors: { [key: string]: string } = {
          processing: 'blue',
          distribution: 'green',
          storage: 'orange',
          mixed: 'purple',
        };
        return type ? <Tag color={colors[type] || 'default'}>{type}</Tag> : '-';
      },
      width: 130,
    },
    {
      title: 'Location',
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
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div>
          {record.phone && <div>📞 {record.phone}</div>}
          {record.manager && <div>👤 {record.manager}</div>}
          {!record.phone && !record.manager && '-'}
        </div>
      ),
      width: 180,
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
            icon={<AppstoreOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/plants/${record.id}/products`, { state: { plant: record } });
            }}
            size="small"
          >
            Products
          </Button>
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
          <PageTitle>Plants & Facilities</PageTitle>
          <PageSubtitle>Manage supplier processing facilities and locations</PageSubtitle>
        </TitleSection>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={handleAdd}
        >
          Add Plant
        </Button>
      </PageHeader>

      {contextSupplierId && (
        <ContextBanner>
          <span>📍 Context: Showing plants for selected supplier</span>
        </ContextBanner>
      )}

      <TableControls>
        <Input
          placeholder="Search plants by name, code, supplier, or location..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </TableControls>

      <StyledTable
        columns={columns as any}
        dataSource={filteredPlants as any}
        rowKey="id"
        loading={loading}
        onRow={(record) => {
          const rec = record as Plant;
          return {
            onClick: () => {
              const sid = contextSupplierId ?? rec.supplier ?? undefined;
              const base = sid ? `/suppliers/${sid}/contacts` : '/suppliers/contacts';
              navigate(`${base}?plant=${rec.id}`);
            },
            style: { cursor: 'pointer' },
          };
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} plants`,
        }}
        scroll={{ x: 'max-content' }}
      />

      {showModal && (
        <EntityFormSurface
          entityType="plant"
          mode={editingPlant ? 'edit' : 'create'}
          entityId={editingPlant?.id}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingPlant(null);
          }}
          initialValues={{
            ...(contextSupplierId ? { supplier: String(contextSupplierId) } : {}),
            plant_type: 'processing',
            country: 'USA',
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingPlant(null);
            void loadPlants(contextSupplierId);
          }}
        />
      )}
    </PageContainer>
  );
};

export default Plants;
