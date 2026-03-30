import React, { useState, useEffect } from 'react';
import { Skeleton } from 'antd';
import { useLocation, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { apiService, PurchaseOrder, Supplier } from '../services/apiService';
import { LocationSelector } from '../components/Shared';
import PurchaseOrderWorkflow from '../components/Workflow/PurchaseOrderWorkflow';
import { SmartProductAutocomplete } from '../components/Inquiry/SmartProductAutocomplete';
import { getChoices, type ChoiceOption } from '@/services/choicesService';

// Styled Components
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
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

  &:hover {
    background: rgb(var(--color-primary-hover));
    transform: translateY(-1px);
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

const Table = styled.table`
  width: 100%;
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
`;

const FormContainer = styled.div`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-surface-foreground));
  border-radius: 12px;
  padding: 0;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid rgb(var(--color-border));
`;

const FormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
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
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const Form = styled.form`
  padding: 24px;
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
  const location = useLocation();

  type CockpitPrefill = {
    source?: string;
    query?: string;
    supplierId?: string;
    contextEntity?: { id?: string; type?: string; label?: string };
  };

  const cockpitPrefill = (location.state as any)?.prefill as CockpitPrefill | undefined;
  const [pendingCreatePrefill, setPendingCreatePrefill] = useState<CockpitPrefill | null>(null);

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

  // Auto-open form if ?action=create in URL (e.g., from Cockpit suggested actions)
  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;

    const supplierId =
      searchParams.get('supplier_id') ??
      cockpitPrefill?.supplierId ??
      undefined;

    const cockpitQuery =
      searchParams.get('cockpit_q') ??
      cockpitPrefill?.query ??
      undefined;

    setPendingCreatePrefill({
      source: 'cockpit',
      supplierId: supplierId || undefined,
      query: cockpitQuery || undefined,
      contextEntity: cockpitPrefill?.contextEntity,
    });

    setEditingPurchaseOrder(null);
    setShowForm(true);

    // Clear params so refresh doesn't keep reopening.
    ['action', 'supplier_id', 'cockpit_q'].forEach((key) => searchParams.delete(key));
    setSearchParams(searchParams);
  }, [searchParams, setSearchParams, cockpitPrefill]);

  // Apply prefill once we have loaded suppliers + existing orders (for next suggested order_number)
  useEffect(() => {
    if (!pendingCreatePrefill || !showForm) return;

    const supplierId = pendingCreatePrefill.supplierId ?? '';
    const noteParts: string[] = [];

    if (pendingCreatePrefill.query) {
      noteParts.push(`Cockpit search: "${pendingCreatePrefill.query}"`);
    }

    if (pendingCreatePrefill.contextEntity?.label) {
      noteParts.push(`Context: ${pendingCreatePrefill.contextEntity.label}`);
    }

    const suggestedNotes = noteParts.join('\n');

    setFormData((prev) => ({
      ...prev,
      order_number: prev.order_number || getNextOrderNumber(),
      supplier: supplierId || prev.supplier,
      order_date: prev.order_date || new Date().toISOString().split('T')[0],
      notes: prev.notes || suggestedNotes,
    }));

    setPendingCreatePrefill(null);
  }, [pendingCreatePrefill, showForm, suppliers.length, purchaseOrders.length]);

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
      )}

      {showForm && (
        <FormOverlay>
          <FormContainer>
            <FormHeader>
              <FormTitle>
                {editingPurchaseOrder ? 'Edit Purchase Order' : 'Add New Purchase Order'}
              </FormTitle>
              <CloseButton onClick={() => setShowForm(false)}>×</CloseButton>
            </FormHeader>
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label>Type of Pick Up</Label>
                <Select 
                  name="logistics_scenario" 
                  value={formData.logistics_scenario} 
                  onChange={handleInputChange}
                  required
                >
                  <option value="we_pickup">Tenant - Pickup (We Handle Logistics)</option>
                  <option value="supplier_delivery">Supplier - Delivering</option>
                  <option value="customer_pickup">Customer - Picking Up</option>
                </Select>
                <FieldHint>
                  {formData.logistics_scenario === 'customer_pickup' && '🚗 Customer picks up from supplier'}
                  {formData.logistics_scenario === 'supplier_delivery' && '🚚 Supplier delivers to us'}
                  {formData.logistics_scenario === 'we_pickup' && '🚛 Tenant pickup / our logistics'}
                </FieldHint>
              </FormGroup>

              <FormGroup>
                <Label>Purchase Order Number</Label>
                <Input
                  type="text"
                  name="order_number"
                  value={formData.order_number || getNextOrderNumber()}
                  onChange={handleInputChange}
                  disabled
                />
                <FieldHint>Auto-generated format: 2YYNNN (example: 226040)</FieldHint>
              </FormGroup>

              <FormGroup>
                <Label>Supplier</Label>
                <Select
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Product</Label>
                <SmartProductAutocomplete
                  value={formData.product}
                  onChange={(productId, product) => {
                    setFormData((prev) => ({
                      ...prev,
                      product: productId,
                      item_description:
                        prev.item_description
                        || product?.name
                        || product?.description
                        || product?.description_of_product_item
                        || '',
                      fresh_or_frozen: prev.fresh_or_frozen || product?.fresh_or_frozen || '',
                      package_type: prev.package_type || product?.package_type || '',
                    }));
                  }}
                />
              </FormGroup>

              <FormGroup>
                <Label>Description</Label>
                <TextArea
                  name="item_description"
                  value={formData.item_description}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Auto-filled from product name (editable)"
                />
              </FormGroup>

              <FormGroup>
                <Label>Fresh / Frozen</Label>
                <Select name="fresh_or_frozen" value={formData.fresh_or_frozen} onChange={handleInputChange} required>
                  <option value="">Select…</option>
                  {effectiveFreshFrozenOptions.map((o) => (
                    <option key={o.value} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Package Type</Label>
                <Select name="package_type" value={formData.package_type} onChange={handleInputChange} required>
                  <option value="">Select…</option>
                  {effectivePackageTypeOptions.map((o) => (
                    <option key={o.value} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Qty</Label>
                <Input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required />
              </FormGroup>

              <FormGroup>
                <Label>Weight per Unit</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="weight_per_unit"
                  value={formData.weight_per_unit}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>

              <FormGroup>
                <Label>Total Weight</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="total_weight"
                  value={formData.total_weight}
                  onChange={handleInputChange}
                  placeholder="Auto-calculated (qty * weight per unit)"
                />
              </FormGroup>

              <FormGroup>
                <Label>Weight Unit</Label>
                <Select name="weight_unit" value={formData.weight_unit} onChange={handleInputChange} required>
                  {effectiveWeightUnitOptions.map((o) => (
                    <option key={o.value} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Cost per lb</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="price_per_unit"
                  value={formData.price_per_unit}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>

              <FormGroup>
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="total_amount"
                  value={formData.total_amount}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Status</Label>
                <Select name="status" value={formData.status} onChange={handleInputChange} required>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>Order Date</Label>
                <Input
                  type="date"
                  name="order_date"
                  value={formData.order_date}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Delivery Date</Label>
                <Input
                  type="date"
                  name="delivery_date"
                  value={formData.delivery_date}
                  onChange={handleInputChange}
                />
              </FormGroup>
              <FormGroup>
                <Label>Notes</Label>
                <TextArea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                />
              </FormGroup>

              <FormGroup>
                <LocationSelector
                  value={formData.pick_up_location}
                  onChange={(id) => setFormData({ ...formData, pick_up_location: id })}
                  label="Pick-up Location"
                  placeholder="Select pick-up location"
                />
              </FormGroup>

              <FormGroup>
                <LocationSelector
                  value={formData.delivery_location}
                  onChange={(id) => setFormData({ ...formData, delivery_location: id })}
                  label="Delivery Location"
                  placeholder="Select delivery location"
                />
              </FormGroup>

              <FormActions>
                <CancelButton type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </CancelButton>
                <SubmitButton type="submit">
                  {editingPurchaseOrder ? 'Update' : 'Create'} Purchase Order
                </SubmitButton>
              </FormActions>
            </Form>
          </FormContainer>
        </FormOverlay>
      )}
    </>
  );
};

export default PurchaseOrders;
