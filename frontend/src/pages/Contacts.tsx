import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { useParams, useSearchParams } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { apiService, Contact } from '../services/apiService';
import EntityFormSurface from '../components/Shared/EntityFormSurface';
import { withTenantQueryKey } from '../utils/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { buildCsv, downloadCsv } from '@/utils/csv';

// Styled Components
const Container = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

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

const LoadingMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  font-size: 18px;
  color: rgb(var(--color-text-secondary));
`;

const ErrorMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: rgb(var(--color-text-secondary));
`;

const RetryButton = styled.button`
  margin-top: 12px;
  padding: 8px 20px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  &:hover {
    opacity: 0.85;
  }
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


const Contacts: React.FC = () => {
  useDocumentTitle('Contacts');
  const { supplierId, customerId } = useParams<{ supplierId?: string; customerId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const contactFilters = useMemo(
    () => ({
      supplier: supplierId ?? searchParams.get('supplier') ?? undefined,
      customer: customerId ?? searchParams.get('customer') ?? undefined,
      plant: searchParams.get('plant') ?? undefined,
      location: searchParams.get('location') ?? undefined,
    }),
    [customerId, searchParams, supplierId]
  );
  const contactInitialValues = useMemo(
    () => ({
      ...(contactFilters.supplier ? { supplier: String(contactFilters.supplier) } : {}),
      ...(contactFilters.customer ? { customer: String(contactFilters.customer) } : {}),
      ...(contactFilters.plant ? { plant: String(contactFilters.plant) } : {}),
      ...(contactFilters.location ? { location: String(contactFilters.location) } : {}),
    }),
    [
      contactFilters.customer,
      contactFilters.location,
      contactFilters.plant,
      contactFilters.supplier,
    ]
  );

  const contactsQuery = useQuery({
    queryKey: withTenantQueryKey(
      'contacts',
      contactFilters.supplier,
      contactFilters.customer,
      contactFilters.plant,
      contactFilters.location
    ),
    queryFn: () => apiService.getContacts(contactFilters),
  });

  const contacts = contactsQuery.data ?? [];
  const loading = contactsQuery.isLoading;

  useEffect(() => {
    if (contactsQuery.error) {
      logger.error('[Contacts] Error loading contacts:', contactsQuery.error);
    }
  }, [contactsQuery.error]);

  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;

    setEditingContact(null);
    setShowForm(true);
  }, [searchParams]);

  const clearCreateParam = useCallback(() => {
    if (searchParams.get('create') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);


  const handleEdit = useCallback((contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingContact(null);
    clearCreateParam();
  }, [clearCreateParam]);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    setEditingContact(null);
    clearCreateParam();
    void contactsQuery.refetch();
  }, [clearCreateParam, contactsQuery]);

  const handleDelete = useCallback(async (id: number) => {
    const contact = contacts.find((c) => c.id === id);
    const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : 'this contact';
    const confirmed = await confirmDialog({
      title: 'Delete Contact',
      content: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      okText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await apiService.deleteContact(id);
      await contactsQuery.refetch();
    } catch (error: unknown) {
      logger.error('[Contacts] Error deleting contact:', error);
      const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const errorMessage = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.message
        || 'Failed to delete contact';
      showAlert({ type: 'error', title: 'Error', content: errorMessage });
    }
  }, [contactsQuery, contacts]);

  const handleExportCsv = useCallback(() => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Position'];
    const rows = contacts.map((c) => [
      c.first_name ?? '', c.last_name ?? '', c.email ?? '',
      c.phone ?? '', c.company ?? '', c.position ?? '',
    ]);
    const csv = buildCsv({ headers, rows });
    downloadCsv(`contacts_${new Date().toISOString().split('T')[0]}.csv`, csv);
  }, [contacts]);

  if (loading) {
    return (
      <Container>
        <LoadingMessage>Loading contacts...</LoadingMessage>
      </Container>
    );
  }

  if (contactsQuery.isError) {
    return (
      <Container>
        <ErrorMessage>
          <p style={{ fontSize: 18 }}>Failed to load contacts</p>
          <p>Something went wrong. Please try again.</p>
          <RetryButton onClick={() => void contactsQuery.refetch()}>Retry</RetryButton>
        </ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>Contacts</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton onClick={handleExportCsv} disabled={!contacts.length}>Export CSV</ExportButton>
          <AddButton onClick={() => { setEditingContact(null); setShowForm(true); }}>+ Add Contact</AddButton>
        </div>
      </Header>

      <StatsCards>
        <StatCard>
          <StatNumber>{contacts.length}</StatNumber>
          <StatLabel>Total Contacts</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{contacts.filter((c) => c.company).length}</StatNumber>
          <StatLabel>With Company</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{contacts.filter((c) => c.email).length}</StatNumber>
          <StatLabel>With Email</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{contacts.filter((c) => c.phone).length}</StatNumber>
          <StatLabel>With Phone</StatLabel>
        </StatCard>
      </StatsCards>

      {contacts.length === 0 ? (
        <EmptyState>
          <EmptyIcon>👥</EmptyIcon>
          <EmptyTitle>No Contacts</EmptyTitle>
          <EmptyDescription>Get started by creating your first contact</EmptyDescription>
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Company</TableHeaderCell>
              <TableHeaderCell>Position</TableHeaderCell>
              <TableHeaderCell>Department</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Phone</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  {contact.first_name} {contact.last_name}
                </TableCell>
                <TableCell>{contact.company || '-'}</TableCell>
                <TableCell>{contact.position || '-'}</TableCell>
                <TableCell>{contact.department || '-'}</TableCell>
                <TableCell>{contact.email || '-'}</TableCell>
                <TableCell>{contact.phone || '-'}</TableCell>
                <TableCell>
                  <ActionButton onClick={() => handleEdit(contact)}>Edit</ActionButton>
                  <DeleteButton onClick={() => handleDelete(contact.id)}>Delete</DeleteButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showForm && (
        <EntityFormSurface
          entityType="contact"
          mode={editingContact ? 'edit' : 'create'}
          entityId={editingContact?.id}
          isOpen={showForm}
          onClose={handleFormClose}
          initialValues={contactInitialValues}
          onSuccess={handleFormSuccess}
        />
      )}
    </Container>
  );
};

export default Contacts;
