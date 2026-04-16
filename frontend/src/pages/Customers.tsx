import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../config/theme';
import { apiService, Customer, apiClient } from '../services/apiService';
import { MultiSelect } from '../components/Shared';
import EntityFormSurface from '../components/Shared/EntityFormSurface';

interface CustomerLocation {
  id: number;
  name: string;
  code?: string;
  location_type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

interface CustomerContact {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  company?: string;
}

const Customers: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: apiService.getCustomers,
  });

  const customers = customersQuery.data ?? [];
  const loading = customersQuery.isLoading;

  useEffect(() => {
    if (customersQuery.error) {
      logger.error('[Customers] Error fetching customers:', customersQuery.error);
    }
  }, [customersQuery.error]);

  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { theme } = useTheme();
  const [products, setProducts] = useState<Array<{ id: string; product_code: string; name: string; protein_type: string }>>([]);
  const [searchText, setSearchText] = useState('');

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerLocations, setCustomerLocations] = useState<CustomerLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [locationContacts, setLocationContacts] = useState<CustomerContact[]>([]);
  const [locationContactsLoading, setLocationContactsLoading] = useState(false);

  const [locationProducts, setLocationProducts] = useState<Array<{ id: string; product_code: string; name?: string; protein_type?: string }>>([]);
  const [locationProductsLoading, setLocationProductsLoading] = useState(false);

  const [showContactModal, setShowContactModal] = useState(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationProductIds, setLocationProductIds] = useState<string[]>([]);

  const [productPanel, setProductPanel] = useState<'history' | 'preferences'>('history');
  const [historyProducts, setHistoryProducts] = useState<Array<{ id: string; product_code: string; name: string; protein_type?: string }>>([]);
  const [preferenceProducts, setPreferenceProducts] = useState<Array<{ id: string; product_code: string; name: string; protein_type?: string }>>([]);
  const [customerProductsLoading, setCustomerProductsLoading] = useState(false);


  // Auto-open form if ?action=create in URL
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowForm(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await apiClient.get('/system/products/', { params: { limit: 500 } });
      const productsData = Array.isArray(response.data)
        ? response.data
        : (response.data.results || []);
      setProducts(productsData);
    } catch (error) {
      logger.error('[Customers] Error fetching products:', error);
    }
  };

  const loadCustomerLocations = async (customerId: number) => {
    try {
      setLocationsLoading(true);
      const response = await apiClient.get('locations/', {
        params: { customer: customerId },
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setCustomerLocations(data);
    } catch (error) {
      console.error('[Customers] Failed to load locations:', error);
      setCustomerLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  };

  const loadCustomerContacts = async (customerId: number) => {
    try {
      setContactsLoading(true);
      const response = await apiClient.get('contacts/', {
        params: { customer: customerId },
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setCustomerContacts(data);
    } catch (error) {
      console.error('[Customers] Failed to load contacts:', error);
      setCustomerContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const loadLocationContacts = async (locationId: number) => {
    try {
      setLocationContactsLoading(true);
      const response = await apiClient.get('contacts/', {
        params: { location: locationId },
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setLocationContacts(data);
    } catch (error) {
      console.error('[Customers] Failed to load location contacts:', error);
      setLocationContacts([]);
    } finally {
      setLocationContactsLoading(false);
    }
  };

  const loadLocationProducts = async (locationId: number) => {
    try {
      setLocationProductsLoading(true);
      const resp = await apiClient.get(`/locations/${locationId}/available-products/`);
      const raw = resp.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setLocationProducts(data);
    } catch (error) {
      console.error('[Customers] Failed to load location products:', error);
      setLocationProducts([]);
    } finally {
      setLocationProductsLoading(false);
    }
  };

  const loadCustomerProductPanels = async (customerId: number) => {
    try {
      setCustomerProductsLoading(true);

      const historyResp = await apiClient.get(`/customers/${customerId}/product-history/`);
      const history = Array.isArray(historyResp.data) ? historyResp.data : (historyResp.data?.results || []);
      setHistoryProducts(history);

      const prefResp = await apiClient.get(`/customers/${customerId}/products/`);
      const basePrefs = Array.isArray(prefResp.data) ? prefResp.data : (prefResp.data?.results || []);

      const locResp = await apiClient.get('locations/', { params: { customer: customerId } });
      const locsRaw = locResp.data as any;
      const locs = Array.isArray(locsRaw) ? locsRaw : Array.isArray(locsRaw?.results) ? locsRaw.results : [];

      const locProductsLists = await Promise.allSettled(
        (locs || []).map((loc: any) => apiClient.get(`/locations/${loc.id}/available-products/`))
      );
      const locProducts = locProductsLists
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .flatMap((r) => (Array.isArray(r.value.data) ? r.value.data : []));

      const merged = [...basePrefs, ...locProducts];
      const byId = new Map<string, any>();
      merged.forEach((p: any) => {
        if (p?.id && !byId.has(String(p.id))) byId.set(String(p.id), p);
      });
      setPreferenceProducts(Array.from(byId.values()));
    } catch (error) {
      console.error('[Customers] Failed to load product panels:', error);
      setHistoryProducts([]);
      setPreferenceProducts([]);
    } finally {
      setCustomerProductsLoading(false);
    }
  };

  const toggleCustomerDrilldown = async (customer: Customer) => {
    if (selectedCustomerId === customer.id) {
      setSelectedCustomerId(null);
      setCustomerLocations([]);
      setCustomerContacts([]);
      setLocationContacts([]);
      setSelectedLocationId(null);
      return;
    }

    setSelectedCustomerId(customer.id);
    setSelectedLocationId(null);
    setLocationContacts([]);

    await Promise.all([loadCustomerLocations(customer.id), loadCustomerContacts(customer.id)]);
  };

  const openCreateLocation = () => {
    if (!selectedCustomerId) return;
    setLocationProductIds([]);
    setShowLocationModal(true);
  };

  const assignLocationProducts = async (locationId: number, productIds: string[]) => {
    if (!productIds.length) return;

    await Promise.allSettled(
      productIds.map((productId) => apiClient.post(`/locations/${locationId}/available-products/`, { product: productId }))
    );
  };

  const openCreateLocationContact = () => {
    if (!selectedCustomerId || !selectedLocationId) return;
    setShowContactModal(true);
  };

  const selectedLocation = selectedLocationId
    ? customerLocations.find((l) => l.id === selectedLocationId)
    : null;

  useEffect(() => {
    if (!selectedLocationId) {
      setLocationContacts([]);
      setLocationProducts([]);
      return;
    }

    void loadLocationContacts(selectedLocationId);
    void loadLocationProducts(selectedLocationId);
  }, [selectedLocationId]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setHistoryProducts([]);
      setPreferenceProducts([]);
      return;
    }

    void loadCustomerProductPanels(selectedCustomerId);
  }, [selectedCustomerId]);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowEditForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await apiService.deleteCustomer(id);
        alert('Customer deleted successfully!');
        await customersQuery.refetch(); // Re-fetch to update the list
      } catch (error: unknown) {
        // Type-safe error handling: Use 'unknown' instead of 'any' and assert expected structure
        console.error('Error deleting customer:', error);
        const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
        const errorMessage = err?.response?.data?.detail 
          || err?.response?.data?.message 
          || err?.message 
          || 'Failed to delete customer';
        alert(`Error: ${errorMessage}`);
      }
    }
  };


  if (loading) {
    return <LoadingContainer $theme={theme}>Loading customers...</LoadingContainer>;
  }

  const visibleCustomers = customers.filter((c) => {
    if (!searchText.trim()) return true;
    const haystack = [c.name, c.contact_person, c.email, c.phone, c.city, c.state]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchText.trim().toLowerCase());
  });

  return (
    <PageContainer>
      <Header>
        <HeaderText>
          <Title $theme={theme}>Customers</Title>
          <Subtitle>Manage customer companies, locations, contacts, and preferred products</Subtitle>
        </HeaderText>
        <HeaderActions>
          <SecondaryButton type="button" onClick={() => navigate('/customers/locations')}>
            Locations
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => navigate('/customers/contacts')}>
            Contacts
          </SecondaryButton>
          <AddButton onClick={() => { setEditingCustomer(null); setShowForm(true); }}>
            + New Customer
          </AddButton>
        </HeaderActions>
      </Header>

      <TableControls>
        <SearchInput
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search customers by name, contact, email, phone, city, or state…"
          aria-label="Search customers"
        />
      </TableControls>

      {showForm && (
        <EntityFormSurface
          entityType="customer"
          mode="create"
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            void customersQuery.refetch();
          }}
        />
      )}

      {showEditForm && editingCustomer && (
        <EntityFormSurface
          entityType="customer"
          mode="edit"
          entityId={editingCustomer.id}
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            setEditingCustomer(null);
          }}
          onSuccess={() => {
            setShowEditForm(false);
            setEditingCustomer(null);
            void customersQuery.refetch();
          }}
        />
      )}

      {showLocationModal && selectedCustomerId && (
        <FormOverlay>
          <FormContainer $theme={theme} data-testid="location-create-modal">
            <FormHeader $theme={theme}>
              <FormTitle $theme={theme}>Add New Location</FormTitle>
              <CloseButton
                $theme={theme}
                onClick={() => setShowLocationModal(false)}
                aria-label="Close location create modal"
              >
                ×
              </CloseButton>
            </FormHeader>

            <FormGrid>
              <FormGroup $fullWidth>
                <MultiSelect
                  value={locationProductIds}
                  onChange={(values) => setLocationProductIds(values.map(String))}
                  options={products.map((p) => ({
                    value: String(p.id),
                    label: `${p.product_code}${p.name ? ' - ' + p.name : ''}`,
                  }))}
                  label="Location Products List"
                  placeholder="(Optional) Select products this location handles"
                />
              </FormGroup>
            </FormGrid>

            <EntityFormSurface
              entityType="location"
              mode="create"
              variant="inline"
              isOpen={showLocationModal}
              onClose={() => setShowLocationModal(false)}
              context={{ customerId: selectedCustomerId }}
              initialValues={{
                location_type: 'warehouse',
                country: 'USA',
              }}
              onSuccess={(created) => {
                const createdId = Number((created as { id?: unknown } | null)?.id);
                const productIds = [...locationProductIds];

                void (async () => {
                  if (Number.isFinite(createdId) && createdId > 0) {
                    try {
                      await assignLocationProducts(createdId, productIds);
                    } catch (error) {
                      console.error('[Customers] Failed to assign location products:', error);
                      alert('Location created, but failed to assign products.');
                    }
                  }

                  setShowLocationModal(false);
                  setLocationProductIds([]);
                  await loadCustomerLocations(selectedCustomerId);
                })();
              }}
            />
          </FormContainer>
        </FormOverlay>
      )}

      {showContactModal && selectedCustomerId && selectedLocationId && (
        <EntityFormSurface
          entityType="contact"
          mode="create"
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          context={{ customerId: selectedCustomerId }}
          initialValues={{
            location: String(selectedLocationId),
            department: 'sales',
          }}
          onSuccess={() => {
            setShowContactModal(false);
            void loadLocationContacts(selectedLocationId);
          }}
        />
      )}

      <TableContainer $theme={theme} data-testid="customers-table-container">
        {customers.length === 0 ? (
          <EmptyState>
            <EmptyIcon>👥</EmptyIcon>
            <EmptyText $theme={theme}>No customers found</EmptyText>
            <EmptySubText $theme={theme}>Add your first customer to get started</EmptySubText>
          </EmptyState>
        ) : (
          <Table>
            <TableHeader $theme={theme}>
              <TableRow $theme={theme}>
                <TableHeaderCell $theme={theme}>Company Name</TableHeaderCell>
                <TableHeaderCell $theme={theme}>Contact Person</TableHeaderCell>
                <TableHeaderCell $theme={theme}>Email</TableHeaderCell>
                <TableHeaderCell $theme={theme}>Phone</TableHeaderCell>
                <TableHeaderCell $theme={theme}>Location</TableHeaderCell>
                <TableHeaderCell $theme={theme}>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCustomers.map((customer) => (
                <React.Fragment key={customer.id}>
                <TableRow
                  $theme={theme}
                  key={customer.id}
                  onClick={() => void toggleCustomerDrilldown(customer)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={selectedCustomerId === customer.id}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void toggleCustomerDrilldown(customer);
                    }
                  }}
                >
                  <TableCell $theme={theme}>
                    <CompanyButton $theme={theme} $selected={selectedCustomerId === customer.id}>
                      <div>
                        <CompanyName $theme={theme}>{customer.name}</CompanyName>
                        <CompanyMeta>
                          {[
                            customer.contact_person,
                            customer.email,
                            customer.phone,
                            [customer.city, customer.state].filter(Boolean).join(', '),
                          ]
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(' · ') || '—'}
                        </CompanyMeta>
                      </div>
                      <CompanyChevron aria-hidden="true">{selectedCustomerId === customer.id ? '▾' : '▸'}</CompanyChevron>
                    </CompanyButton>
                  </TableCell>
                  <TableCell $theme={theme}>{customer.contact_person || '-'}</TableCell>
                  <TableCell $theme={theme}>{customer.email || '-'}</TableCell>
                  <TableCell $theme={theme}>{customer.phone || '-'}</TableCell>
                  <TableCell $theme={theme}>
                    {customer.city && customer.state
                      ? `${customer.city}, ${customer.state}`
                      : customer.city || customer.state || '-'}
                  </TableCell>
                  <TableCell $theme={theme}>
                    <RowActions>
                      <ActionButton
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(customer);
                        }}
                      >
                        Edit
                      </ActionButton>
                      <DeleteButton
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(customer.id);
                        }}
                      >
                        Delete
                      </DeleteButton>
                    </RowActions>
                  </TableCell>
                </TableRow>
                {selectedCustomerId === customer.id && (
                  <ExpandedTableRow $theme={theme}>
                    <ExpandedTableCell $theme={theme} colSpan={6}>
                      <ExpandedPanel>
                        <ExpandedColumn>
                          <ExpandedHeader>
                            <ExpandedTitle>Locations</ExpandedTitle>
                            <ExpandedActions>
                              <SmallButton type="button" onClick={openCreateLocation} disabled={!selectedCustomerId}>
                                + New Location
                              </SmallButton>
                              <SmallButton
                                type="button"
                                onClick={() => navigate(`/customers/${customer.id}/locations`)}
                              >
                                Manage
                              </SmallButton>
                            </ExpandedActions>
                          </ExpandedHeader>

                          {locationsLoading ? (
                            <ExpandedHint>Loading locations…</ExpandedHint>
                          ) : customerLocations.length === 0 ? (
                            <ExpandedHint>No locations found for this customer.</ExpandedHint>
                          ) : (
                            <ChildList>
                              {customerLocations.map((loc) => (
                                <ChildListItem
                                  key={loc.id}
                                  type="button"
                                  $active={selectedLocationId === loc.id}
                                  onClick={() => {
                                    setSelectedLocationId(loc.id);
                                    if (selectedCustomerId) {
                                      navigate(`/customers/${selectedCustomerId}/locations/${loc.id}`);
                                    }
                                  }}
                                >
                                  <ChildListName>{loc.name}</ChildListName>
                                  <ChildListMeta>
                                    {loc.location_type ? <span>{loc.location_type}</span> : null}
                                    {loc.city || loc.state ? <span>• {`${loc.city || ''}${loc.city && loc.state ? ', ' : ''}${loc.state || ''}`}</span> : null}
                                  </ChildListMeta>
                                </ChildListItem>
                              ))}
                            </ChildList>
                          )}
                        </ExpandedColumn>

                        <ExpandedColumn>
                          <ExpandedHeader>
                            <ExpandedTitle>Location Details & Contacts</ExpandedTitle>
                            <ExpandedActions>
                              <SmallButton type="button" onClick={openCreateLocationContact} disabled={!selectedLocationId}>
                                + New Contact
                              </SmallButton>
                            </ExpandedActions>
                          </ExpandedHeader>

                          {selectedLocation ? (
                            <MetaCard>
                              <MetaRow>
                                <MetaKey>Location Type</MetaKey>
                                <MetaValue>{selectedLocation.location_type || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Address</MetaKey>
                                <MetaValue>{selectedLocation.address || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>City/State/ZIP</MetaKey>
                                <MetaValue>
                                  {selectedLocation.city || selectedLocation.state || selectedLocation.zip_code
                                    ? `${selectedLocation.city || ''}${selectedLocation.city && selectedLocation.state ? ', ' : ''}${selectedLocation.state || ''}${(selectedLocation.city || selectedLocation.state) && selectedLocation.zip_code ? ' ' : ''}${selectedLocation.zip_code || ''}`.trim()
                                    : '—'}
                                </MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Products List</MetaKey>
                                <MetaValue>
                                  {locationProductsLoading ? (
                                    'Loading…'
                                  ) : locationProducts.length ? (
                                    <ChildListMeta>
                                      {locationProducts.slice(0, 20).map((p) => (
                                        <span key={String(p.id)}>{p.product_code}</span>
                                      ))}
                                    </ChildListMeta>
                                  ) : (
                                    '—'
                                  )}
                                </MetaValue>
                              </MetaRow>
                            </MetaCard>
                          ) : (
                            <ExpandedHint>Select a location to view details.</ExpandedHint>
                          )}

                          {selectedLocationId ? (
                            locationContactsLoading ? (
                              <ExpandedHint>Loading location contacts…</ExpandedHint>
                            ) : locationContacts.length === 0 ? (
                              <ExpandedHint>No contacts found for this location.</ExpandedHint>
                            ) : (
                              <ContactsList>
                                {locationContacts.map((c) => (
                                  <ContactRow key={c.id}>
                                    <ContactName>
                                      {c.first_name} {c.last_name}
                                    </ContactName>
                                    <ContactMeta>
                                      {(c as any).department ? <span>{(c as any).department}</span> : null}
                                      {c.position ? <span>{c.position}</span> : null}
                                      {c.email ? <span>{c.email}</span> : null}
                                      {c.phone ? <span>{c.phone}</span> : null}
                                    </ContactMeta>
                                  </ContactRow>
                                ))}
                              </ContactsList>
                            )
                          ) : (
                            <ExpandedHint>Select a location to view its contacts.</ExpandedHint>
                          )}

                          <MetaCard>
                            <MetaRow>
                              <MetaKey>Product History / Preference</MetaKey>
                              <MetaValue>
                                <SmallButton type="button" onClick={() => setProductPanel('history')} disabled={productPanel === 'history'}>
                                  History
                                </SmallButton>
                                <SmallButton type="button" onClick={() => setProductPanel('preferences')} disabled={productPanel === 'preferences'}>
                                  Preferences
                                </SmallButton>
                              </MetaValue>
                            </MetaRow>

                            {customerProductsLoading ? (
                              <ExpandedHint>Loading products…</ExpandedHint>
                            ) : productPanel === 'history' ? (
                              historyProducts.length ? (
                                <ChildListMeta>
                                  {historyProducts.slice(0, 40).map((p) => (
                                    <span key={String(p.id)}>{p.product_code}</span>
                                  ))}
                                </ChildListMeta>
                              ) : (
                                <ExpandedHint>No product history found.</ExpandedHint>
                              )
                            ) : preferenceProducts.length ? (
                              <ChildListMeta>
                                {preferenceProducts.slice(0, 40).map((p) => (
                                  <span key={String(p.id)}>{p.product_code}</span>
                                ))}
                              </ChildListMeta>
                            ) : (
                              <ExpandedHint>No preferences found.</ExpandedHint>
                            )}
                          </MetaCard>
                        </ExpandedColumn>
                      </ExpandedPanel>
                    </ExpandedTableCell>
                  </ExpandedTableRow>
                )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </PageContainer>
  );
};

// Styled Components (reusing from Suppliers with customer theme colors)
const LoadingContainer = styled.div<{ $theme: Theme }>`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  color: ${(props) => props.$theme.colors.textSecondary};
`;

const PageContainer = styled.div`
  padding: 1.5rem;
  background: rgb(var(--color-background));
  min-height: 100%;
  min-width: 0;

  @media (max-width: 420px) {
    padding: 1rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1<{ $theme: Theme }>`
  font-size: 32px;
  font-weight: 700;
  color: ${(props) => props.$theme.colors.textPrimary};
  margin: 0;

  @media (max-width: 420px) {
    font-size: 24px;
  }
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: 420px) {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  min-height: 44px;

  @media (max-width: 420px) {
    width: 100%;
  }

  &:hover {
    background: rgb(var(--color-surface));
    border-color: rgb(var(--color-primary) / 0.35);
  }
`;

const AddButton = styled.button`
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;

  @media (max-width: 420px) {
    width: 100%;
    justify-content: center;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgb(var(--color-primary) / 0.25);
    filter: brightness(0.98);
  }
`;

const TableControls = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  min-width: 0;
`;

const SearchInput = styled.input`
  width: min(520px, 100%);
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  min-height: 44px;

  @media (max-width: 520px) {
    width: 100%;
    font-size: 16px; /* iOS Safari zoom-on-focus prevention */
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.12);
  }
`;

const FormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const FormContainer = styled.div<{ $theme: Theme }>`
  background: ${(props) => props.$theme.colors.surface};
  border-radius: 12px;
  padding: 0;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const FormHeader = styled.div<{ $theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  border-bottom: 1px solid ${(props) => props.$theme.colors.border};

  @media (max-width: 420px) {
    padding: 14px 16px;
  }
`;

const FormTitle = styled.h2<{ $theme: Theme }>`
  margin: 0;
  color: ${(props) => props.$theme.colors.textPrimary};
`;

const CloseButton = styled.button<{ $theme: Theme }>`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: ${(props) => props.$theme.colors.textSecondary};
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${(props) => props.$theme.colors.textPrimary};
  }
`;

const Form = styled.form`
  padding: 30px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
`;

const FormGroup = styled.div<{ $fullWidth?: boolean }>`
  grid-column: ${(props) => (props.$fullWidth ? '1 / -1' : 'auto')};
`;

const Label = styled.label<{ $theme: Theme }>`
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: ${(props) => props.$theme.colors.textPrimary};
`;

const Input = styled.input<{ $theme: Theme }>`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${(props) => props.$theme.colors.border};
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const CancelButton = styled.button`
  background: rgb(var(--color-text-secondary));
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgb(var(--color-text-secondary));
  }
`;

const SubmitButton = styled.button`
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgb(var(--color-primary) / 0.3);
  }
`;

const TableContainer = styled.div<{ $theme: Theme }>`
  background: ${(props) => props.$theme.colors.surface};
  border-radius: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  box-shadow: 0 2px 10px ${(props) => props.$theme.colors.shadow};
  max-width: 100%;
  min-width: 0;
`;

const EmptyState = styled.div`
  padding: 60px 20px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const EmptyText = styled.div<{ $theme: Theme }>`
  font-size: 18px;
  color: ${(props) => props.$theme.colors.textPrimary};
  margin-bottom: 8px;
`;

const EmptySubText = styled.div<{ $theme: Theme }>`
  color: ${(props) => props.$theme.colors.textSecondary};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHeader = styled.thead<{ $theme: Theme }>`
  background: ${(props) => props.$theme.colors.background};

  @media (max-width: 420px) {
    th:nth-child(2),
    th:nth-child(3),
    th:nth-child(4),
    th:nth-child(5) {
      display: none;
    }
  }
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ $theme: Theme }>`
  border-bottom: 1px solid ${(props) => props.$theme.colors.border};
  cursor: pointer;

  @media (max-width: 420px) {
    td:nth-child(2),
    td:nth-child(3),
    td:nth-child(4),
    td:nth-child(5) {
      display: none;
    }
  }

  &:hover {
    background: ${(props) => props.$theme.colors.background};
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--color-primary), 0.5);
    outline-offset: -2px;
  }
`;

const TableHeaderCell = styled.th<{ $theme: Theme }>`
  padding: 15px 20px;
  text-align: left;
  font-weight: 600;
  color: ${(props) => props.$theme.colors.textPrimary};

  @media (max-width: 420px) {
    padding: 12px 14px;
  }
`;

const TableCell = styled.td<{ $theme: Theme }>`
  padding: 15px 20px;

  @media (max-width: 420px) {
    padding: 12px 14px;
  }
`;

const CompanyButton = styled.div<{ $theme: Theme; $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 1px solid ${(p) => (p.$selected ? 'rgba(var(--color-primary), 0.6)' : 'transparent')};
  border-radius: 8px;
  background: ${(p) => (p.$selected ? 'rgba(var(--color-primary), 0.08)' : 'transparent')};
  pointer-events: none;
`;

const CompanyName = styled.div<{ $theme: Theme }>`
  font-weight: 600;
  color: ${(props) => props.$theme.colors.textPrimary};
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const CompanyMeta = styled.div`
  display: none;
  margin-top: 2px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.2;
  word-break: break-word;

  @media (max-width: 420px) {
    display: block;
  }
`;

const RowActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;

  @media (max-width: 420px) {
    justify-content: flex-start;
  }
`;

const CompanyChevron = styled.span`
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

const ExpandedTableRow = styled.tr<{ $theme: Theme }>`
  background: ${(props) => props.$theme.colors.surface};
`;

const ExpandedTableCell = styled.td<{ $theme: Theme }>`
  padding: 14px 18px;
  border-bottom: 1px solid ${(props) => props.$theme.colors.border};
`;

const ExpandedPanel = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const ExpandedColumn = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  background: rgb(var(--color-surface));
  padding: 12px;
`;

const ExpandedHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;

  @media (max-width: 420px) {
    flex-wrap: wrap;
  }
`;

const ExpandedTitle = styled.div`
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const ExpandedActions = styled.div`
  display: inline-flex;
  gap: 8px;

  @media (max-width: 420px) {
    flex-wrap: wrap;
    width: 100%;
  }
`;

const SmallButton = styled.button`
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: rgba(var(--color-primary), 0.6);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ExpandedHint = styled.div`
  padding: 12px;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
`;

const ChildList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ChildListItem = styled.button<{ $active: boolean }>`
  text-align: left;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.7)' : 'transparent')};
  background: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.08)' : 'transparent')};
  padding: 10px 12px;
  cursor: pointer;

  &:hover {
    border-color: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.55)' : 'rgb(var(--color-border))')};
    background: rgb(var(--color-surface-hover));
  }
`;

const ChildListName = styled.div`
  font-weight: 650;
  color: rgb(var(--color-text-primary));
`;

const ChildListMeta = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const MetaCard = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
  background: rgba(var(--color-surface), 0.6);
  padding: 10px 12px;
  margin-bottom: 10px;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
`;

const MetaKey = styled.div`
  font-size: 12px;
  font-weight: 650;
  color: rgb(var(--color-text-secondary));
`;

const MetaValue = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const ContactsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ContactRow = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
  padding: 10px 12px;
  background: rgb(var(--color-surface));
`;

const ContactName = styled.div`
  font-weight: 650;
  color: rgb(var(--color-text-primary));
`;

const ContactMeta = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(var(--color-primary), 0.9);
  }

  @media (max-width: 420px) {
    min-height: 44px;
  }
`;

const DeleteButton = styled.button`
  background: rgb(var(--color-danger));
  color: rgb(var(--color-primary-foreground));
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(var(--color-danger), 0.9);
  }

  @media (max-width: 420px) {
    min-height: 44px;
  }
`;

const HelperText = styled.div<{ $theme: Theme }>`
  margin-top: 8px;
  font-size: 12px;
  color: ${(props) => props.$theme.colors.textSecondary};
  font-style: italic;
`;

export default Customers;
