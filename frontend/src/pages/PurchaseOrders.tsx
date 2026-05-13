import React, { useState, useEffect } from 'react';
import { Skeleton } from 'antd';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { apiService, PurchaseOrder, Supplier } from '../services/apiService';
import { businessApi } from '@/services/businessApi';
import { LocationSelector } from '../components/Shared';
import PurchaseOrderWorkflow from '../components/Workflow/PurchaseOrderWorkflow';
import { SmartProductAutocomplete } from '../components/Inquiry/SmartProductAutocomplete';
import { getChoices, type ChoiceOption } from '@/services/choicesService';
import SupplierPOForm from './PurchaseOrders/SupplierPOForm';

// Styled Components
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;

  @media (max-width: 520px) {
    flex-wrap: wrap;
    align-items: flex-start;
  }
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 520px) {
    width: 100%;
    flex-wrap: wrap;

    & > button {
      flex: 1 1 100%;
    }
  }
`;

const AddButton = styled.button`
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;

  @media (max-width: 520px) {
    padding: 12px 16px;
  }

  &:hover {
    background: rgb(var(--color-primary-hover));
    transform: translateY(-1px);
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  min-height: 44px;

  &:hover {
    background: rgb(var(--color-surface-hover));
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatsCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled.div`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-surface-foreground));
  padding: 24px;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  text-align: center;
  border: 1px solid rgb(var(--color-border));
  transition: box-shadow 0.2s ease, background-color 0.3s ease;
`;

const StatNumber = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--color-primary));
  margin-bottom: 8px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  font-weight: 500;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  font-size: 18px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
`;

const EmptyIcon = styled.div`
  font-size: 64px;
  margin-bottom: 20px;
`;

const EmptyTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 10px;
`;

const EmptyDescription = styled.p`
  color: rgb(var(--color-text-secondary));
  font-size: 16px;
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 12px;

  /* Prevent wide tables from causing page-level horizontal scrolling on mobile. */
  max-width: 100%;
`;

const Table = styled.table`
  width: 100%;
  min-width: 880px;
  background: rgb(var(--color-surface));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgb(var(--color-border));
`;

const TableHeader = styled.thead`
  background: rgb(var(--color-surface-hover));
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  border-bottom: 1px solid rgb(var(--color-border));

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: rgb(var(--color-surface-hover));
  }
`;

const TableHeaderCell = styled.th`
  text-align: left;
  padding: 16px 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
`;

const TableCell = styled.td`
  padding: 16px 20px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const StatusBadge = styled.span<{ $color: string }>`
  background: ${(props) => props.$color};
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
`;

const ActionButton = styled.button`
  background: rgb(34, 197, 94);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  transition: background 0.2s;

  &:hover {
    background: rgb(34, 197, 94);
  }
`;

const DeleteButton = styled.button`
  background: rgb(239, 68, 68);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgb(239, 68, 68);
  }
`;

const FormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  overflow-y: auto;

  @media (max-width: 520px) {
    align-items: flex-start;
  }
`;

const FormContainer = styled.div`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-surface-foreground));
  border-radius: 12px;
  padding: 0;
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  border: 1px solid rgb(var(--color-border));
`;

const FormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));

  @media (max-width: 520px) {
    padding: 16px;
  }
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const Form = styled.form`
  padding: 24px;

  @media (max-width: 520px) {
    padding: 16px;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  font-size: 14px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 2px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  min-height: 44px;

  @media (max-width: 520px) {
    /* Prevent iOS Safari zoom-on-focus */
    font-size: 16px;
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }

  /* Hide number input spinner buttons */
  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type='number'] {
    -moz-appearance: textfield;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 2px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  min-height: 44px;

  @media (max-width: 520px) {
    /* Prevent iOS Safari zoom-on-focus */
    font-size: 16px;
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 2px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  transition: border-color 0.2s;

  @media (max-width: 520px) {
    /* Prevent iOS Safari zoom-on-focus */
    font-size: 16px;
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const FieldHint = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-style: italic;
`;

const FormActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;

  @media (max-width: 520px) {
    flex-wrap: wrap;

    & > button {
      flex: 1 1 100%;
      min-height: 44px;
    }
  }
`;

const CancelButton = styled.button`
  background: rgb(var(--color-text-secondary));
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-text-secondary));
  }
`;

const SubmitButton = styled.button`
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-primary-hover));
  }
`;

const PurchaseOrders: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [freshFrozenOptions, setFreshFrozenOptions] = useState<ChoiceOption[]>([]);
  const [packageTypeOptions, setPackageTypeOptions] = useState<ChoiceOption[]>([]);
  const [weightUnitOptions, setWeightUnitOptions] = useState<ChoiceOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<PurchaseOrder | null>(null);

  type PurchaseOrderFormData = {
    order_number: string;
    supplier: string;

    product: string;
    item_description: string;
    fresh_or_frozen: string;
    package_type: string;
    quantity: string;
    weight_per_unit: string;
    price_per_unit: string;

    total_weight: string;
    weight_unit: string;

    total_amount: string;
    status: string;
    order_date: string;
    delivery_date: string;
    notes: string;
    logistics_scenario: string;
    pick_up_location: string | null;
    delivery_location: string | null;
  };

  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    order_number: '',
    supplier: '',

    product: '',
    item_description: '',
    fresh_or_frozen: '',
    package_type: '',
    quantity: '',
    weight_per_unit: '',
    price_per_unit: '',

    total_weight: '',
    weight_unit: 'LBS',

    total_amount: '',
    status: 'pending',
    order_date: '',
    delivery_date: '',
    notes: '',
    logistics_scenario: 'supplier_delivery',
    pick_up_location: null, // Phase 4: Location integration
    delivery_location: null, // Phase 4: Location integration
  });

  // Auto-open form if ?action=create in URL
  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;

    setEditingPurchaseOrder(null);
    setShowForm(true);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['action', 'supplier_id'].forEach((key) => next.delete(key));
      return next;
    });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [ff, pkg, wu] = await Promise.all([
          getChoices('fresh_or_frozen'),
          getChoices('package_type'),
          getChoices('weight_unit'),
        ]);
        setFreshFrozenOptions(ff);
        setPackageTypeOptions(pkg);
        setWeightUnitOptions(wu);
      } catch {
        setFreshFrozenOptions([]);
        setPackageTypeOptions([]);
        setWeightUnitOptions([]);
      }
    })();
  }, []);

  const effectiveFreshFrozenOptions: ChoiceOption[] = freshFrozenOptions.length
    ? freshFrozenOptions
    : [
        { value: 'Fresh', label: 'Fresh' },
        { value: 'Frozen', label: 'Frozen' },
      ];

  const effectivePackageTypeOptions: ChoiceOption[] = packageTypeOptions.length
    ? packageTypeOptions
    : [
        { value: 'Boxed wax lined', label: 'Boxed wax lined' },
        { value: 'Boxed CO2', label: 'Boxed CO2' },
        { value: 'Combo bins', label: 'Combo bins' },
        { value: 'Totes', label: 'Totes' },
        { value: 'Bags', label: 'Bags' },
        { value: 'Bulk', label: 'Bulk' },
        { value: 'Poly-Multiple', label: 'Poly-Multiple' },
        { value: 'Nude', label: 'Nude' },
      ];

  const effectiveWeightUnitOptions: ChoiceOption[] = weightUnitOptions.length
    ? weightUnitOptions
    : [
        { value: 'LBS', label: 'LBS' },
        { value: 'KG', label: 'KG' },
      ];

  const [exporting, setExporting] = useState(false);

  const exportToCsv = async () => {
    try {
      setExporting(true);

      // Use backend streaming export (tenant-safe via get_queryset + filter_queryset)
      const response = await businessApi.get('/purchase-orders/', {
        params: { format: 'csv' },
        responseType: 'blob',
      });

      const data = response.data as any;
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting purchase orders:', error);
      showAlert({
        title: 'Export Failed',
        content: 'Could not export purchase orders. Please try again.',
        type: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [posData, suppliersData] = await Promise.all([
        apiService.getPurchaseOrders(),
        apiService.getSuppliers(),
      ]);
      setPurchaseOrders(posData);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const data = await apiService.getPurchaseOrders();
      setPurchaseOrders(data);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
    }
  };

  // Calculate next suggested order number (display-only): 2YYNNN
  const getNextOrderNumber = () => {
    const year2 = String(new Date().getFullYear()).slice(-2);
    const prefix = `2${year2}`;

    let maxSeq = 0;
    purchaseOrders.forEach((po) => {
      const val = String(po.order_number || '');
      if (!val.startsWith(prefix)) return;
      const tail = val.slice(prefix.length);
      if (!/^[0-9]+$/.test(tail)) return;
      const seq = Number(tail);
      if (Number.isFinite(seq)) maxSeq = Math.max(maxSeq, seq);
    });

    const next = maxSeq + 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const purchaseOrderData: Partial<PurchaseOrder> & { supplier: number; total_amount: number } = {
        supplier: parseInt(formData.supplier),
        total_amount: parseFloat(formData.total_amount),
        status: formData.status,
        order_date: formData.order_date,
        delivery_date: formData.delivery_date || undefined,
        notes: formData.notes || undefined,
        logistics_scenario: formData.logistics_scenario,
        pick_up_location: formData.pick_up_location || undefined,
        delivery_location: formData.delivery_location || undefined,

        product: formData.product || undefined,
        item_description: formData.item_description || undefined,
        fresh_or_frozen: formData.fresh_or_frozen || undefined,
        package_type: formData.package_type || undefined,
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        total_weight: formData.total_weight ? parseFloat(formData.total_weight) : undefined,
        weight_unit: formData.weight_unit || undefined,
        price_per_unit: formData.price_per_unit ? parseFloat(formData.price_per_unit) : undefined,
      };

      // Always let backend auto-generate order_number (2YYNNN).
      // We intentionally omit order_number from the payload.

      if (editingPurchaseOrder) {
        await apiService.updatePurchaseOrder(editingPurchaseOrder.id, purchaseOrderData);
      } else {
        await apiService.createPurchaseOrder(purchaseOrderData);
      }

      await loadPurchaseOrders();
      setShowForm(false);
      setEditingPurchaseOrder(null);
      setFormData({
        order_number: '',
        supplier: '',

        product: '',
        item_description: '',
        fresh_or_frozen: '',
        package_type: '',
        quantity: '',
        weight_per_unit: '',
        price_per_unit: '',

        total_weight: '',
        weight_unit: 'LBS',

        total_amount: '',
        status: 'pending',
        order_date: '',
        delivery_date: '',
        notes: '',
        logistics_scenario: 'supplier_delivery',
        pick_up_location: null, // Phase 4: Reset location
        delivery_location: null, // Phase 4: Reset location
      });
    } catch (error: unknown) {
      // Log detailed error information
      const err = error as Error & { response?: { status: number; data: unknown }; stack?: string };
      console.error('Error saving purchase order:', {
        message: err.message || 'Unknown error',
        stack: err.stack || 'No stack trace available',
        response: err.response ? {
          status: err.response.status,
          data: err.response.data
        } : 'No response data'
      });
      // Display user-friendly error to the UI
      showAlert({
        type: 'error',
        title: 'Error',
        content: `Failed to save purchase order: ${err.message || 'Please try again later'}`,
      });
    }
  };

  const handleEdit = (purchaseOrder: PurchaseOrder) => {
    setEditingPurchaseOrder(purchaseOrder);
    setFormData({
      order_number: purchaseOrder.order_number,
      supplier: purchaseOrder.supplier.toString(),

      product: (purchaseOrder.product || '') as string,
      item_description: purchaseOrder.item_description || '',
      fresh_or_frozen: purchaseOrder.fresh_or_frozen || '',
      package_type: purchaseOrder.package_type || '',
      quantity: purchaseOrder.quantity != null ? String(purchaseOrder.quantity) : '',
      weight_per_unit: '',
      price_per_unit: purchaseOrder.price_per_unit != null ? String(purchaseOrder.price_per_unit) : '',

      total_weight: purchaseOrder.total_weight != null ? String(purchaseOrder.total_weight) : '',
      weight_unit: purchaseOrder.weight_unit || 'LBS',

      total_amount: purchaseOrder.total_amount.toString(),
      status: purchaseOrder.status,
      order_date: purchaseOrder.order_date,
      delivery_date: purchaseOrder.delivery_date || '',
      notes: purchaseOrder.notes || '',
      logistics_scenario: purchaseOrder.logistics_scenario || 'supplier_delivery',
      pick_up_location: purchaseOrder.pick_up_location || null, // Phase 4: Populate location
      delivery_location: purchaseOrder.delivery_location || null, // Phase 4: Populate location
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDialog({
      title: 'Delete purchase order?',
      content: 'Are you sure you want to delete this purchase order?',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiService.deletePurchaseOrder(id);
      showAlert({
        type: 'success',
        title: 'Deleted',
        content: 'Purchase order deleted successfully.',
      });
      await loadPurchaseOrders(); // Re-fetch to update the list
    } catch (error: unknown) {
      // Type-safe error handling: Use 'unknown' instead of 'any' and assert expected structure
      console.error('Error deleting purchase order:', error);
      const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const errorMessage = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.message
        || 'Failed to delete purchase order';
      showAlert({
        type: 'error',
        title: 'Error',
        content: `Error: ${errorMessage}`,
      });
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const key = name as keyof PurchaseOrderFormData;
      const next = { ...prev, [key]: value } as PurchaseOrderFormData;

      const qty = Number(next.quantity);
      const wpu = Number(next.weight_per_unit);
      if (key === 'quantity' || key === 'weight_per_unit') {
        if (Number.isFinite(qty) && qty > 0 && Number.isFinite(wpu) && wpu > 0) {
          next.total_weight = String(qty * wpu);
        } else if (!next.total_weight) {
          next.total_weight = '';
        }
      }

      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'rgb(234, 179, 8)';
      case 'approved':
        return 'rgb(34, 197, 94)';
      case 'delivered':
        return 'rgb(var(--color-primary))';
      case 'cancelled':
        return 'rgb(239, 68, 68)';
      default:
        return 'rgb(var(--color-text-secondary))';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <>
      <Header>
        <Title>Purchase Orders</Title>
        <HeaderActions>
          <SecondaryButton onClick={exportToCsv} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </SecondaryButton>
          <AddButton
          onClick={() => {
            setFormData({
              order_number: getNextOrderNumber(),
              supplier: '',

              product: '',
              item_description: '',
              fresh_or_frozen: '',
              package_type: '',
              quantity: '',
              weight_per_unit: '',
              price_per_unit: '',

              total_weight: '',
              weight_unit: 'LBS',

              total_amount: '',
              status: 'pending',
              order_date: '',
              delivery_date: '',
              notes: '',
              logistics_scenario: 'supplier_delivery',
              pick_up_location: null, // Phase 4: Reset location
              delivery_location: null, // Phase 4: Reset location
            });
            setShowForm(true);
          }}
        >
          + Add Purchase Order
          </AddButton>
        </HeaderActions>
      </Header>

      <StatsCards>
        <StatCard>
          <StatNumber>{purchaseOrders.length}</StatNumber>
          <StatLabel>Total Orders</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{purchaseOrders.filter((po) => po.status === 'pending').length}</StatNumber>
          <StatLabel>Pending</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{purchaseOrders.filter((po) => po.status === 'approved').length}</StatNumber>
          <StatLabel>Approved</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>
            $
            {Array.isArray(purchaseOrders)
              ? purchaseOrders
                  .reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0)
                  .toFixed(2)
              : '0.00'}
          </StatNumber>
          <StatLabel>Total Value</StatLabel>
        </StatCard>
      </StatsCards>

      {/* Sample Workflow Visualization */}
      <PurchaseOrderWorkflow
        stages={[
          {
            id: 'draft',
            label: 'Draft',
            status: 'completed',
            description: 'Order created',
          },
          {
            id: 'approval',
            label: 'Approval',
            status: 'completed',
            description: 'Management review',
          },
          {
            id: 'processing',
            label: 'Processing',
            status: 'active',
            description: 'Supplier processing',
          },
          {
            id: 'shipping',
            label: 'Shipping',
            status: 'pending',
            description: 'In transit',
          },
          {
            id: 'delivered',
            label: 'Delivered',
            status: 'pending',
            description: 'Order complete',
          },
        ]}
      />

      {purchaseOrders.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📋</EmptyIcon>
          <EmptyTitle>No Purchase Orders</EmptyTitle>
          <EmptyDescription>Get started by creating your first purchase order</EmptyDescription>
        </EmptyState>
      ) : (
        <TableWrapper>
          <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Order Number</TableHeaderCell>
              <TableHeaderCell>Supplier</TableHeaderCell>
              <TableHeaderCell>Amount</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Order Date</TableHeaderCell>
              <TableHeaderCell>Delivery Date</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((purchaseOrder) => {
              const supplier = suppliers.find((s) => s.id === purchaseOrder.supplier);
              return (
                <TableRow
                  key={purchaseOrder.id}
                  onClick={() => handleEdit(purchaseOrder)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEdit(purchaseOrder);
                    }
                  }}
                >
                  <TableCell>{purchaseOrder.order_number}</TableCell>
                  <TableCell>{supplier?.name || `ID: ${purchaseOrder.supplier}`}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(Number(purchaseOrder.total_amount) || 0)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge $color={getStatusColor(purchaseOrder.status)}>
                      {purchaseOrder.status.toUpperCase()}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{new Date(purchaseOrder.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {purchaseOrder.delivery_date
                      ? new Date(purchaseOrder.delivery_date).toLocaleDateString()
                      : 'Not set'}
                  </TableCell>
                  <TableCell>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(purchaseOrder);
                      }}
                    >
                      Edit
                    </ActionButton>
                    <DeleteButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(purchaseOrder.id);
                      }}
                    >
                      Delete
                    </DeleteButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          </Table>
        </TableWrapper>
      )}

      {showForm && (
        <SupplierPOForm
          mode={editingPurchaseOrder ? 'edit' : 'create'}
          entityId={editingPurchaseOrder?.id}
          initialValues={editingPurchaseOrder ? {
            logistics_scenario: (editingPurchaseOrder.logistics_scenario as 'customer_pickup' | 'supplier_delivery' | 'we_pickup') || 'supplier_delivery',
            supplier: String(editingPurchaseOrder.supplier || ''),
            product: (editingPurchaseOrder.product || '') as string,
            item_description: editingPurchaseOrder.item_description || '',
            fresh_or_frozen: editingPurchaseOrder.fresh_or_frozen || '',
            package_type: editingPurchaseOrder.package_type || '',
            quantity: editingPurchaseOrder.quantity != null ? String(editingPurchaseOrder.quantity) : '',
            total_weight: editingPurchaseOrder.total_weight != null ? String(editingPurchaseOrder.total_weight) : '',
            weight_unit: editingPurchaseOrder.weight_unit || 'LBS',
            price_per_unit: editingPurchaseOrder.price_per_unit != null ? String(editingPurchaseOrder.price_per_unit) : '',
            delivery_date: editingPurchaseOrder.delivery_date || '',
            notes: editingPurchaseOrder.notes || '',
            pick_up_location: editingPurchaseOrder.pick_up_location || null,
            delivery_location: editingPurchaseOrder.delivery_location || null,
          } : undefined}
          onSuccess={() => {
            setShowForm(false);
            setEditingPurchaseOrder(null);
            loadPurchaseOrders();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingPurchaseOrder(null);
          }}
        />
      )}
    </>
  );
};

export default PurchaseOrders;
