import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Skeleton } from 'antd';
import { toast } from 'react-hot-toast';

import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { formatCurrency } from '../shared/utils';
import { apiService, Invoice } from '../services/apiService';
import { logger } from '@/utils/logger';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { buildCsv, downloadCsv } from '@/utils/csv';

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
  color: rgb(var(--color-text-inverse));
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

const ExportButton = styled.button`
  background: rgb(var(--color-bg-secondary));
  color: rgb(var(--color-text-secondary));
  border: 1px solid rgb(var(--color-border));
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgb(var(--color-bg-tertiary));
    color: rgb(var(--color-text-primary));
  }

  &:disabled {
    opacity: 0.5;
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
  box-shadow: 0 2px 4px rgba(var(--color-overlay), 0.1);
  text-align: center;
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
  color: rgb(var(--color-surface-foreground));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(var(--color-overlay), 0.1);
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
  color: rgb(var(--color-text-inverse));
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
`;

const ActionButton = styled.button`
  background: rgb(var(--color-success));
  color: rgb(var(--color-text-inverse));
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-success));
  }
`;

const DeleteButton = styled.button`
  background: rgb(var(--color-error));
  color: rgb(var(--color-text-inverse));
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgb(var(--color-error));
  }
`;

const FormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--color-overlay), 0.5);
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

const FormActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
`;

const CancelButton = styled.button`
  background: rgb(var(--color-text-secondary));
  color: rgb(var(--color-text-inverse));
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
  color: rgb(var(--color-text-inverse));
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

const AccountsReceivables: React.FC = () => {
  useDocumentTitle('Accounts Receivable');
  const [receivables, setReceivables] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    invoice_number: '',
    customer: '',
    total: '',
    due_date: '',
    status: 'draft',
  });

  useEffect(() => {
    loadReceivables();
  }, []);

  const loadReceivables = async () => {
    try {
      setLoading(true);
      const data = await apiService.getInvoices();
      setReceivables(data);
    } catch (error) {
      logger.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.invoice_number.trim()) {
      toast.error('Invoice number is required.');
      return;
    }
    if (!formData.customer) {
      toast.error('Please select a customer.');
      return;
    }
    if (!formData.total || isNaN(parseFloat(formData.total)) || parseFloat(formData.total) <= 0) {
      toast.error('Please enter a valid total amount.');
      return;
    }
    if (!formData.due_date) {
      toast.error('Due date is required.');
      return;
    }

    try {
      const receivableData = {
        ...formData,
        total: parseFloat(formData.total),
        customer: parseInt(formData.customer),
      };

      if (editingReceivable) {
        await apiService.updateInvoice(editingReceivable.id, receivableData);
      } else {
        await apiService.createInvoice(receivableData);
      }

      await loadReceivables();
      setShowForm(false);
      setEditingReceivable(null);
      setFormData({
        invoice_number: '',
        customer: '',
        total: '',
        due_date: '',
        status: 'draft',
      });
    } catch (error: unknown) {
      // Log detailed error information
      const err = error as Error & { response?: { status: number; data: unknown }; stack?: string };
      logger.error('Error saving invoice:', {
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
        content: `Failed to save invoice: ${err.message || 'Please try again later'}`,
      });
    }
  };

  const handleEdit = (receivable: Invoice) => {
    setEditingReceivable(receivable);
    setFormData({
      invoice_number: receivable.invoice_number,
      customer: receivable.customer.toString(),
      total: receivable.total?.toString() || '',
      due_date: receivable.due_date || '',
      status: receivable.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const invoice = receivables.find((r) => r.id === id);
    const label = invoice?.invoice_number ? `Invoice #${invoice.invoice_number}` : 'this invoice';
    const confirmed = await confirmDialog({
      title: 'Delete Invoice',
      content: `Are you sure you want to delete "${label}"? This action cannot be undone.`,
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiService.deleteInvoice(id);
      showAlert({
        type: 'success',
        title: 'Deleted',
        content: 'Invoice deleted successfully.',
      });
      await loadReceivables(); // Re-fetch to update the list
    } catch (error: unknown) {
      // Type-safe error handling: Use 'unknown' instead of 'any' and assert expected structure
      logger.error('Error deleting accounts receivable:', error);
      const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const errorMessage = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.message
        || 'Failed to delete accounts receivable';
      showAlert({
        type: 'error',
        title: 'Error',
        content: `Error: ${errorMessage}`,
      });
    }
  };

  const handleExportCsv = () => {
    const headers = ['Invoice #', 'Customer', 'Total', 'Due Date', 'Status'];
    const rows = receivables.map((r) => [
      r.invoice_number, String(r.customer), String(r.total ?? ''),
      r.due_date ?? '', r.status,
    ]);
    const csv = buildCsv({ headers, rows });
    downloadCsv(`accounts_receivable_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'rgb(var(--color-warning))';
      case 'paid':
        return 'rgb(var(--color-success))';
      case 'overdue':
        return 'rgb(var(--color-error))';
      case 'disputed':
        return 'rgb(var(--color-primary))';
      default:
        return 'rgb(var(--color-text-secondary))';
    }
  };

  const invoiceAmount = (r: Invoice): number => Number(r.total ?? r.subtotal ?? 0) || 0;

  const getTotalAmount = () =>
    Array.isArray(receivables)
      ? receivables.reduce((sum, r) => sum + invoiceAmount(r), 0)
      : 0;
  const getPendingAmount = () =>
    Array.isArray(receivables)
      ? receivables
          .filter((r) => r.status === 'pending')
          .reduce((sum, r) => sum + invoiceAmount(r), 0)
      : 0;
  const getOverdueAmount = () =>
    Array.isArray(receivables)
      ? receivables
          .filter((r) => r.status === 'overdue')
          .reduce((sum, r) => sum + invoiceAmount(r), 0)
      : 0;

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
        <Title>Accounts Receivables</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton onClick={handleExportCsv} disabled={!receivables.length}>Export CSV</ExportButton>
          <AddButton onClick={() => setShowForm(true)}>+ Add Receivable</AddButton>
        </div>
      </Header>

      <StatsCards>
        <StatCard>
          <StatNumber>{receivables.length}</StatNumber>
          <StatLabel>Total Invoices</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{formatCurrency(getTotalAmount())}</StatNumber>
          <StatLabel>Total Amount</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{formatCurrency(getPendingAmount())}</StatNumber>
          <StatLabel>Pending</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{formatCurrency(getOverdueAmount())}</StatNumber>
          <StatLabel>Overdue</StatLabel>
        </StatCard>
      </StatsCards>

      {receivables.length === 0 ? (
        <EmptyState>
          <EmptyIcon>💰</EmptyIcon>
          <EmptyTitle>No Accounts Receivables</EmptyTitle>
          <EmptyDescription>Get started by creating your first receivable</EmptyDescription>
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Invoice #</TableHeaderCell>
              <TableHeaderCell>Customer ID</TableHeaderCell>
              <TableHeaderCell>Amount</TableHeaderCell>
              <TableHeaderCell>Due Date</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receivables.map((receivable) => (
              <TableRow
                key={receivable.id}
                onClick={() => handleEdit(receivable)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleEdit(receivable);
                  }
                }}
              >
                <TableCell>{receivable.invoice_number}</TableCell>
                <TableCell>{receivable.customer_name || receivable.customer}</TableCell>
                <TableCell>{formatCurrency(receivable.total)}</TableCell>
                <TableCell>{receivable.due_date ? new Date(receivable.due_date).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell>
                  <StatusBadge $color={getStatusColor(receivable.status)}>
                    {receivable.status.toUpperCase()}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(receivable);
                    }}
                  >
                    Edit
                  </ActionButton>
                  <DeleteButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(receivable.id);
                    }}
                  >
                    Delete
                  </DeleteButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showForm && (
        <FormOverlay>
          <FormContainer>
            <FormHeader>
              <FormTitle>{editingReceivable ? 'Edit Receivable' : 'Add New Receivable'}</FormTitle>
              <CloseButton onClick={() => setShowForm(false)}>×</CloseButton>
            </FormHeader>
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label>Invoice Number</Label>
                <Input
                  type="text"
                  name="invoice_number"
                  value={formData.invoice_number}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Customer ID</Label>
                <Input
                  type="number"
                  name="customer"
                  value={formData.customer}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="total"
                  value={formData.total}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Status</Label>
                <Select name="status" value={formData.status} onChange={handleInputChange} required>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="disputed">Disputed</option>
                </Select>
              </FormGroup>
              <FormActions>
                <CancelButton type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </CancelButton>
                <SubmitButton type="submit">
                  {editingReceivable ? 'Update' : 'Create'} Receivable
                </SubmitButton>
              </FormActions>
            </Form>
          </FormContainer>
        </FormOverlay>
      )}
    </>
  );
};

export default AccountsReceivables;
