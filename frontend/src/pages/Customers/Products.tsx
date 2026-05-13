/**
 * Customer Preferred Products Management Page
 * 
 * Features:
 * - Display products associated with a specific customer
 * - Table layout with sorting, pagination, and search
 * - Add/remove product associations via system product catalog
 * - Theme-compliant styling with antd Table
 * - Multi-tenancy support
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Table, Input, Button, Modal, message, Tag, Space, Skeleton, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';
import { PROTEIN_TYPE_CHOICES } from '../../utils/constants/choices';
import { confirmDialog } from '@/utils/uiDialogs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { logger } from '@/utils/logger';

interface Product {
  id: string;
  product_code: string;
  name: string;
  description?: string;
  protein_type?: string;
  category?: string;
  is_active?: boolean;
}

interface SystemProduct {
  id: string;
  product_code: string;
  name: string;
  protein_type?: string;
  category?: string;
  is_active?: boolean;
}

interface Customer {
  id: number;
  name: string;
}

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

const SearchSection = styled.div`
  margin-bottom: 1rem;
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const ContentCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  flex: 1;
  overflow: auto;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: rgb(var(--color-text-secondary));
  
  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: rgb(var(--color-text-primary));
  }
  
  p {
    margin-bottom: 1.5rem;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
`;

const CustomerProducts: React.FC = () => {
  useDocumentTitle('Customer Products');
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Add modal state
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [systemProducts, setSystemProducts] = useState<SystemProduct[]>([]);
  const [productSearchText, setProductSearchText] = useState<string>('');
  const [loadingSystemProducts, setLoadingSystemProducts] = useState<boolean>(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [addingProducts, setAddingProducts] = useState<boolean>(false);

  useEffect(() => {
    if (location.state?.customer) {
      setCustomer(location.state.customer);
    } else if (id) {
      fetchCustomer();
    }
  }, [id, location.state]);

  useEffect(() => {
    if (id) fetchProducts();
  }, [id]);

  const fetchCustomer = async () => {
    if (!id) return;
    try {
      const response = await businessApi.get(`/customers/${id}/`);
      setCustomer(response.data);
    } catch (error) {
      logger.error('Error fetching customer:', error);
      message.error('Failed to load customer details');
    }
  };

  const fetchProducts = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await businessApi.get(`/customers/${id}/products/`);
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      logger.error('Error fetching products:', error);
      message.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // system.Product is a shared tenant-agnostic catalog — no tenant filter needed
  const [proteinFilter, setProteinFilter] = useState<string[]>([]);

  const fetchSystemProducts = useCallback(async (search?: string) => {
    setLoadingSystemProducts(true);
    try {
      const params: Record<string, any> = { page_size: '500', is_active: true };
      if (search) params.search = search;
      if (proteinFilter.length) params.protein = proteinFilter.map((t) => String(t).toLowerCase());
      const response = await businessApi.get('/system/products/', { params });
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setSystemProducts(data);
    } catch (error) {
      logger.error('Error fetching system products:', error);
      message.error('Failed to load product catalog');
    } finally {
      setLoadingSystemProducts(false);
    }
  }, [proteinFilter]);

  const debouncedFetchSystemProducts = useCallback((search: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchSystemProducts(search), 350);
  }, [fetchSystemProducts]);

  useEffect(() => {
    if (addModalVisible) {
      void fetchSystemProducts(productSearchText);
    }
  }, [addModalVisible, fetchSystemProducts]);

  const handleAddProducts = async () => {
    if (!selectedProductIds.length) {
      message.warning('Please select at least one product');
      return;
    }
    setAddingProducts(true);
    try {
      const currentIds = products.map(p => p.id);
      const mergedIds = [...new Set([...currentIds, ...selectedProductIds])];
      await businessApi.patch(`/customers/${id}/`, { products: mergedIds });
      message.success(`Added ${selectedProductIds.length} product(s) successfully`);
      setAddModalVisible(false);
      setSelectedProductIds([]);
      fetchProducts();
    } catch (error) {
      logger.error('Error adding products:', error);
      message.error('Failed to add products');
    } finally {
      setAddingProducts(false);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    const confirmed = await confirmDialog({
      title: 'Remove Product Association',
      content: 'Are you sure you want to remove this product from this customer?',
      okText: 'Remove',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await businessApi.patch(`/customers/${id}/`, {
        products: products.filter(p => p.id !== productId).map(p => p.id),
      });
      message.success('Product association removed successfully');
      fetchProducts();
    } catch (error) {
      logger.error('Error removing product:', error);
      message.error('Failed to remove product association');
    }
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'Product Code',
      dataIndex: 'product_code',
      key: 'product_code',
      sorter: (a, b) => a.product_code.localeCompare(b.product_code),
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => {
        const search = value.toString().toLowerCase();
        return (
          record.product_code.toLowerCase().includes(search) ||
          (record.name || '').toLowerCase().includes(search) ||
          (record.description || '').toLowerCase().includes(search)
        );
      },
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Protein Type',
      dataIndex: 'protein_type',
      key: 'protein_type',
      render: (val: string) => val ? <Tag>{val}</Tag> : '-',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (val: string) => val || '-',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveProduct(record.id)}
            size="small"
          >
            Remove
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader>
        <TitleSection>
          <PageTitle>Preferred Products</PageTitle>
          <PageSubtitle>
            Preferred products for {customer?.name || 'this customer'}
          </PageSubtitle>
        </TitleSection>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
      </PageHeader>

      {customer && (
        <ContextBanner>
          Viewing products for: <span>{customer.name}</span>
        </ContextBanner>
      )}

      <SearchSection>
        <Input
          placeholder="Search by product code, name, or description..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setAddModalVisible(true); fetchSystemProducts(); }}
        >
          Add Products
        </Button>
      </SearchSection>

      <ContentCard>
        {loading ? (
          <LoadingContainer>
            <Skeleton active paragraph={{ rows: 8 }} />
          </LoadingContainer>
        ) : products.length === 0 ? (
          <EmptyState>
            <h3>No Products Associated</h3>
            <p>This customer doesn't have any products associated yet.</p>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setAddModalVisible(true); fetchSystemProducts(); }}
            >
              Add Products
            </Button>
          </EmptyState>
        ) : (
          <Table
            aria-label="Customer products"
            columns={columns}
            dataSource={products}
            rowKey="id"
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} products` }}
            scroll={{ x: 900 }}
          />
        )}
      </ContentCard>

      <Modal
        title="Add Products to Customer"
        open={addModalVisible}
        onOk={handleAddProducts}
        onCancel={() => { setAddModalVisible(false); setSelectedProductIds([]); setProductSearchText(''); setProteinFilter([]); }}
        okText="Add Selected"
        confirmLoading={addingProducts}
        width={700}
        destroyOnHidden
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <Input
            placeholder="Search products..."
            prefix={<SearchOutlined />}
            value={productSearchText}
            onChange={(e) => {
              setProductSearchText(e.target.value);
              debouncedFetchSystemProducts(e.target.value);
            }}
            style={{ flex: 1 }}
            allowClear
          />
          <div style={{ width: 260 }}>
            <span style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'rgb(var(--color-text-secondary))' }}>
              Protein filter
            </span>
            <Select
              mode="multiple"
              value={proteinFilter}
              onChange={(vals) => setProteinFilter(vals)}
              options={PROTEIN_TYPE_CHOICES.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="Search protein types"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label || '')
                  .toLowerCase()
                  .includes(String(input || '').toLowerCase())
              }
            />
          </div>
        </div>

        <Table
          aria-label="Available system products for customer"
          size="small"
          loading={loadingSystemProducts}
          dataSource={systemProducts.filter(p => !products.find(existing => existing.id === p.id))}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedProductIds,
            onChange: (keys) => setSelectedProductIds(keys as string[]),
          }}
          columns={[
            { title: 'Code', dataIndex: 'product_code', key: 'product_code', width: 150 },
            { title: 'Name', dataIndex: 'name', key: 'name' },
            { title: 'Protein Type', dataIndex: 'protein_type', key: 'protein_type', width: 120 },
            { title: 'Category', dataIndex: 'category', key: 'category', width: 140 },
          ]}
          pagination={{ pageSize: 10 }}
          scroll={{ y: 300 }}
        />
      </Modal>
    </PageContainer>
  );
};

export default CustomerProducts;
