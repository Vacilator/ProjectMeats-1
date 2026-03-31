import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../config/theme';
import { apiService, Customer, apiClient } from '../services/apiService';
import { PhoneInput, Select } from '../components/ui';
import { MultiSelect } from '../components/Shared';
import QuickCreateModal from '../components/FormSubmission/QuickCreateModal';
import { US_STATES } from '../utils/constants/states';
import { INDUSTRY_CHOICES, PROTEIN_TYPE_CHOICES } from '../utils/constants/choices';

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

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: '',
    location_type: 'warehouse',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    contact_name: '',
    email: '',
    phone: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    industry_array: [] as string[], // Phase 4: ArrayField integration
    preferred_protein_types: [] as string[], // Phase 4: ArrayField integration
    products: [] as string[], // Product IDs for M2M
  });

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

  // Auto-fetch products when preferred_protein_types changes
  useEffect(() => {
    if (formData.preferred_protein_types && formData.preferred_protein_types.length > 0) {
      fetchFilteredProducts(formData.preferred_protein_types);
    } else {
      // Reset to all products if no protein types selected
      fetchProducts();
    }
  }, [formData.preferred_protein_types]);

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

  const fetchFilteredProducts = async (proteinTypes: string[]) => {
    try {
      const response = await apiClient.get('/system/products/', {
        params: { protein: proteinTypes.join(','), limit: 500 },
      });
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setProducts(data);
      // Note: Auto-select logic intentionally removed to improve UX
    } catch (error) {
      logger.error('[Customers] Error fetching filtered products:', error);
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
    setLocationForm({
      name: '',
      location_type: 'warehouse',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'USA',
      contact_name: '',
      email: '',
      phone: '',
    });
    setShowLocationModal(true);
  };

  const submitLocation = async () => {
    if (!selectedCustomerId) return;

    if (!locationForm.name.trim()) {
      alert('Location name is required');
      return;
    }

    try {
      await apiClient.post('locations/', {
        customer: selectedCustomerId,
        name: locationForm.name.trim(),
        location_type: locationForm.location_type,
        address: locationForm.address,
        city: locationForm.city,
        state: locationForm.state,
        zip_code: locationForm.zip_code,
        country: locationForm.country,
        contact_name: locationForm.contact_name,
        email: locationForm.email,
        phone: locationForm.phone,
      });
      setShowLocationModal(false);
      await loadCustomerLocations(selectedCustomerId);
    } catch (error) {
      console.error('[Customers] Failed to create location:', error);
      alert('Failed to create location');
    }
  };

  const selectedLocation = selectedLocationId
    ? customerLocations.find((l) => l.id === selectedLocationId)
    : null;

  useEffect(() => {
    if (!selectedLocationId) {
      setLocationContacts([]);
      return;
    }

    void loadLocationContacts(selectedLocationId);
  }, [selectedLocationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await apiService.updateCustomer(editingCustomer.id, {
          ...formData,
          products: formData.products,
        });
      } else {
        await apiService.createCustomer({
          ...formData,
          products: formData.products,
        });
      }
      setShowEditForm(false);
      setEditingCustomer(null);
      resetForm();
      await customersQuery.refetch();
    } catch (error: unknown) {
      // Log detailed error information
      const err = error as Error & { response?: { status: number; data: unknown }; stack?: string };
      console.error('Error saving customer:', {
        message: err.message || 'Unknown error',
        stack: err.stack || 'No stack trace available',
        response: err.response ? {
          status: err.response.status,
          data: err.response.data
        } : 'No response data'
      });
      // Display user-friendly error to the UI
      alert(`Failed to save customer: ${err.message || 'Please try again later'}`);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      contact_person: customer.contact_person || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip_code: customer.zip_code || '',
      country: customer.country || '',
      industry_array: customer.industry_array || [], // Phase 4: Populate array
      preferred_protein_types: customer.preferred_protein_types || [], // Phase 4: Populate array
      products: (customer.products || []).map(String), // Populate product IDs
    });
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

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      industry_array: [], // Phase 4: Reset array
      preferred_protein_types: [], // Phase 4: Reset array
      products: [], // Reset products
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setShowEditForm(false);
    setEditingCustomer(null);
    resetForm();
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
        <QuickCreateModal
          entityType="customer"
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onCreated={() => { void customersQuery.refetch(); }}
        />
      )}

      {showEditForm && (
        <FormOverlay>
          <FormContainer $theme={theme}>
            <FormHeader $theme={theme}>
              <FormTitle $theme={theme}>{editingCustomer ? 'Edit Customer' : 'Edit Customer'}</FormTitle>
              <CloseButton $theme={theme} onClick={handleCancel}>×</CloseButton>
            </FormHeader>

            <Form onSubmit={handleSubmit}>
              <FormGrid>
                <FormGroup>
                  <Label $theme={theme}>Company Name *</Label>
                  <Input $theme={theme}
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Contact Person</Label>
                  <Input $theme={theme}
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact_person: e.target.value,
                      })
                    }
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Email</Label>
                  <Input $theme={theme}
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Phone</Label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    placeholder="(XXX)XXX-XXXX"
                    aria-label="Phone number"
                  />
                </FormGroup>

                <FormGroup $fullWidth>
                  <Label $theme={theme}>Address</Label>
                  <Input $theme={theme}
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>City</Label>
                  <Input $theme={theme}
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>State</Label>
                  <Select
                    value={formData.state}
                    onChange={(value) => setFormData({ ...formData, state: value })}
                    options={US_STATES}
                    placeholder="Select state"
                    aria-label="State"
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>ZIP Code</Label>
                  <Input $theme={theme}
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => {
                      // Only allow digits, max 5 characters
                      const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setFormData({ ...formData, zip_code: value });
                    }}
                    maxLength={5}
                    pattern="^\d{5}$"
                    placeholder="12345"
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Country</Label>
                  <Input $theme={theme}
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </FormGroup>

                <FormGroup $fullWidth>
                  <MultiSelect
                    value={formData.industry_array}
                    onChange={(values) => setFormData({ ...formData, industry_array: values })}
                    options={INDUSTRY_CHOICES}
                    label="Industries"
                    placeholder="Select industries (hold Ctrl/Cmd for multiple)"
                  />
                </FormGroup>

                <FormGroup $fullWidth>
                  <MultiSelect
                    value={formData.preferred_protein_types}
                    onChange={(values) => setFormData({ ...formData, preferred_protein_types: values })}
                    options={PROTEIN_TYPE_CHOICES}
                    label="Preferred Protein Types"
                    placeholder="Select protein types (hold Ctrl/Cmd for multiple)"
                  />
                </FormGroup>

                <FormGroup $fullWidth>
                  <MultiSelect
                    value={formData.products}
                    onChange={(values) => setFormData({ ...formData, products: values })}
                    options={products.map(p => ({ value: String(p.id), label: `${p.product_code}${p.name ? ' - ' + p.name : ''}` }))}
                    label="Preferred Products"
                    placeholder="Select preferred products (hold Ctrl/Cmd for multiple)"
                  />
                  {formData.preferred_protein_types.length > 0 && (
                    <HelperText $theme={theme}>
                      Showing {products.length} product(s) filtered by selected protein types
                    </HelperText>
                  )}
                </FormGroup>
              </FormGrid>

              <FormActions>
                <CancelButton type="button" onClick={handleCancel}>
                  Cancel
                </CancelButton>
                <SubmitButton type="submit">
                  {editingCustomer ? 'Update' : 'Update'} Customer
                </SubmitButton>
              </FormActions>
            </Form>
          </FormContainer>
        </FormOverlay>
      )}

      {showLocationModal && (
        <FormOverlay>
          <FormContainer $theme={theme}>
            <FormHeader $theme={theme}>
              <FormTitle $theme={theme}>Add New Location</FormTitle>
              <CloseButton $theme={theme} onClick={() => setShowLocationModal(false)}>×</CloseButton>
            </FormHeader>

            <Form onSubmit={(e) => { e.preventDefault(); void submitLocation(); }}>
              <FormGrid>
                <FormGroup>
                  <Label $theme={theme}>Location Name *</Label>
                  <Input
                    $theme={theme}
                    type="text"
                    value={locationForm.name}
                    onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Type</Label>
                  <Select
                    value={locationForm.location_type}
                    onChange={(value) => setLocationForm((p) => ({ ...p, location_type: value }))}
                    options={[
                      { value: 'warehouse', label: 'Warehouse' },
                      { value: 'store', label: 'Store' },
                      { value: 'distribution_center', label: 'Distribution Center' },
                      { value: 'office', label: 'Office' },
                      { value: 'other', label: 'Other' },
                    ]}
                    placeholder="Select type"
                    aria-label="Location type"
                  />
                </FormGroup>

                <FormGroup $fullWidth>
                  <Label $theme={theme}>Address</Label>
                  <Input
                    $theme={theme}
                    type="text"
                    value={locationForm.address}
                    onChange={(e) => setLocationForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>City</Label>
                  <Input
                    $theme={theme}
                    type="text"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm((p) => ({ ...p, city: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>State</Label>
                  <Select
                    value={locationForm.state}
                    onChange={(value) => setLocationForm((p) => ({ ...p, state: value }))}
                    options={US_STATES}
                    placeholder="Select state"
                    aria-label="State"
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>ZIP Code</Label>
                  <Input
                    $theme={theme}
                    type="text"
                    value={locationForm.zip_code}
                    onChange={(e) => setLocationForm((p) => ({ ...p, zip_code: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Country</Label>
                  <Input
                    $theme={theme}
                    type="text"
                    value={locationForm.country}
                    onChange={(e) => setLocationForm((p) => ({ ...p, country: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Contact Name</Label>
                  <Input
                    $theme={theme}
                    type="text"
                    value={locationForm.contact_name}
                    onChange={(e) => setLocationForm((p) => ({ ...p, contact_name: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Contact Email</Label>
                  <Input
                    $theme={theme}
                    type="email"
                    value={locationForm.email}
                    onChange={(e) => setLocationForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <Label $theme={theme}>Contact Phone</Label>
                  <PhoneInput
                    value={locationForm.phone}
                    onChange={(value) => setLocationForm((p) => ({ ...p, phone: value }))}
                    placeholder="(XXX)XXX-XXXX"
                    aria-label="Location phone"
                  />
                </FormGroup>
              </FormGrid>

              <FormActions>
                <CancelButton type="button" onClick={() => setShowLocationModal(false)}>
                  Cancel
                </CancelButton>
                <SubmitButton type="submit">Create Location</SubmitButton>
              </FormActions>
            </Form>
          </FormContainer>
        </FormOverlay>
      )}

      <TableContainer $theme={theme}>
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
                    <CompanyButton $theme={theme}>
                      <CompanyName $theme={theme}>{customer.name}</CompanyName>
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
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(customer);
                      }}
                    >
                      Edit
                    </ActionButton>
                    <DeleteButton
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(customer.id);
                      }}
                    >
                      Delete
                    </DeleteButton>
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
                                onClick={() => navigate('/customers/locations', { state: { customerId: customer.id } })}
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
                                  onClick={() => setSelectedLocationId(loc.id)}
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
                          </ExpandedHeader>

                          {selectedLocation ? (
                            <MetaCard>
                              <MetaRow>
                                <MetaKey>Contact</MetaKey>
                                <MetaValue>{selectedLocation.contact_name || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Email</MetaKey>
                                <MetaValue>{selectedLocation.email || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Phone</MetaKey>
                                <MetaValue>{selectedLocation.phone || '—'}</MetaValue>
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
                                      {c.position ? <span>{c.position}</span> : null}
                                      {c.email ? <span>{c.email}</span> : null}
                                      {c.phone ? <span>{c.phone}</span> : null}
                                    </ContactMeta>
                                  </ContactRow>
                                ))}
                              </ContactsList>
                            )
                          ) : contactsLoading ? (
                            <ExpandedHint>Loading contacts…</ExpandedHint>
                          ) : customerContacts.length === 0 ? (
                            <ExpandedHint>No contacts found for this customer.</ExpandedHint>
                          ) : (
                            <ContactsList>
                              {customerContacts.map((c) => (
                                <ContactRow key={c.id}>
                                  <ContactName>
                                    {c.first_name} {c.last_name}
                                  </ContactName>
                                  <ContactMeta>
                                    {c.position ? <span>{c.position}</span> : null}
                                    {c.email ? <span>{c.email}</span> : null}
                                    {c.phone ? <span>{c.phone}</span> : null}
                                  </ContactMeta>
                                </ContactRow>
                              ))}
                            </ContactsList>
                          )}
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

  &:hover {
    background: rgb(var(--color-surface));
    border-color: rgb(var(--color-primary) / 0.35);
  }
`;

const AddButton = styled.button`
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

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
`;

const SearchInput = styled.input`
  width: min(520px, 100%);
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

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
  color: white;
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
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
  }
`;

const TableContainer = styled.div<{ $theme: Theme }>`
  background: ${(props) => props.$theme.colors.surface};
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px ${(props) => props.$theme.colors.shadow};
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
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ $theme: Theme }>`
  border-bottom: 1px solid ${(props) => props.$theme.colors.border};
  cursor: pointer;

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
`;

const TableCell = styled.td<{ $theme: Theme }>`
  padding: 15px 20px;
`;

const CompanyButton = styled.div<{ $theme: Theme }>`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  pointer-events: none;
`;

const CompanyName = styled.div<{ $theme: Theme }>`
  font-weight: 600;
  color: ${(props) => props.$theme.colors.textPrimary};
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
`;

const ExpandedTitle = styled.div`
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const ExpandedActions = styled.div`
  display: inline-flex;
  gap: 8px;
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
  border: 1px solid ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.7)' : 'rgb(var(--color-border))')};
  background: ${(p) => (p.$active ? 'rgba(var(--color-primary), 0.08)' : 'rgb(var(--color-surface))')};
  padding: 10px 12px;
  cursor: pointer;

  &:hover {
    border-color: rgba(var(--color-primary), 0.55);
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
  align-items: center;
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
  background: rgb(59, 130, 246);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgb(var(--color-primary));
  }
`;

const DeleteButton = styled.button`
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgb(var(--color-primary));
  }
`;

const HelperText = styled.div<{ $theme: Theme }>`
  margin-top: 8px;
  font-size: 12px;
  color: ${(props) => props.$theme.colors.textSecondary};
  font-style: italic;
`;

export default Customers;
