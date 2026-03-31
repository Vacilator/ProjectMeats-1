import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/utils/logger';

import { useSearchParams, useNavigate } from 'react-router-dom';
import { MultiSelect } from '../components/Shared';
import EntityFormSurface from '../components/Shared/EntityFormSurface';
import styled from 'styled-components';
import { apiService, apiClient, Supplier } from '../services/apiService';

interface SupplierPlant {
  id: number;
  name: string;
  code: string;
  plant_type?: string;
  plant_est_num?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  manager?: string;
  email?: string;
  phone?: string;
}

interface SupplierContact {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  company?: string;
}
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../config/theme';

const Suppliers: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: apiService.getSuppliers,
  });

  const suppliers = suppliersQuery.data ?? [];
  const loading = suppliersQuery.isLoading;

  useEffect(() => {
    if (suppliersQuery.error) {
      logger.error('[Suppliers] Error fetching suppliers:', suppliersQuery.error);
    }
  }, [suppliersQuery.error]);

  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; product_code: string; effective_name?: string; name?: string; product_name?: string }>>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [supplierPlants, setSupplierPlants] = useState<SupplierPlant[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);

  const [supplierContacts, setSupplierContacts] = useState<SupplierContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [plantContacts, setPlantContacts] = useState<SupplierContact[]>([]);
  const [plantContactsLoading, setPlantContactsLoading] = useState(false);

  const [showContactModal, setShowContactModal] = useState(false);

  const [showPlantModal, setShowPlantModal] = useState(false);
  const [plantProductIds, setPlantProductIds] = useState<string[]>([]);


  const [supplierRollupProducts, setSupplierRollupProducts] = useState<Array<{ id: string; product_code: string; name?: string }>>([]);
  const [supplierRollupLoading, setSupplierRollupLoading] = useState(false);

  // Auto-open form if ?action=create in URL
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowForm(true);
      // Remove the parameter so it doesn't persist
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!selectedSupplierId) {
      setSupplierRollupProducts([]);
      return;
    }

    void loadSupplierProductsAvailableRollup(selectedSupplierId);
  }, [selectedSupplierId]);

  // Debug: Log products state changes
  useEffect(() => {
    logger.debug('[Suppliers] Products state updated:', {
      count: Array.isArray(products) ? products.length : 0,
      products: products,
      multiSelectOptions: Array.isArray(products) ? products.map(p => ({ 
        value: String(p.id), 
        label: `${p.product_code} - ${p.effective_name || p.product_name || p.name || 'Unknown'}` 
      })) : []
    });
  }, [products]);

  const fetchProducts = async () => {
    try {
      logger.debug('[Suppliers] Fetching products from system catalog...');
      const response = await apiClient.get('/system/products/', { params: { limit: 500 } });
      const productsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setProducts(productsData);
    } catch (error) {
      logger.error('[Suppliers] Error fetching products:', error);
      setProducts([]);
    }
  };

  const loadSupplierPlants = async (supplierId: number) => {
    try {
      setPlantsLoading(true);
      const response = await apiClient.get('plants/', {
        params: { supplier: supplierId },
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setSupplierPlants(data);
    } catch (error) {
      logger.error('[Suppliers] Failed to load supplier plants:', error);
      setSupplierPlants([]);
    } finally {
      setPlantsLoading(false);
    }
  };

  const loadSupplierContacts = async (supplierId: number) => {
    try {
      setContactsLoading(true);
      const response = await apiClient.get('contacts/', {
        params: { supplier: supplierId },
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setSupplierContacts(data);
    } catch (error) {
      logger.error('[Suppliers] Failed to load supplier contacts:', error);
      setSupplierContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const loadPlantContacts = async (plantId: number) => {
    try {
      setPlantContactsLoading(true);
      const response = await apiClient.get('contacts/', {
        params: { plant: plantId },
      });
      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setPlantContacts(data);
    } catch (error) {
      logger.error('[Suppliers] Failed to load plant contacts:', error);
      setPlantContacts([]);
    } finally {
      setPlantContactsLoading(false);
    }
  };

  const loadSupplierProductsAvailableRollup = async (supplierId: number) => {
    try {
      setSupplierRollupLoading(true);
      const plantsResp = await apiClient.get('plants/', { params: { supplier: supplierId, is_active: true } });
      const rawPlants = plantsResp.data as any;
      const plants = Array.isArray(rawPlants) ? rawPlants : Array.isArray(rawPlants?.results) ? rawPlants.results : [];

      const lists = await Promise.allSettled(
        (plants || []).map((p: any) => apiClient.get(`/plants/${p.id}/available-products/`))
      );
      const merged = lists
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .flatMap((r) => (Array.isArray(r.value.data) ? r.value.data : []));

      const byId = new Map<string, any>();
      merged.forEach((p: any) => {
        if (p?.id && !byId.has(String(p.id))) byId.set(String(p.id), p);
      });
      setSupplierRollupProducts(Array.from(byId.values()));
    } catch (error) {
      logger.error('[Suppliers] Failed to load supplier products rollup:', error);
      setSupplierRollupProducts([]);
    } finally {
      setSupplierRollupLoading(false);
    }
  };

  const toggleSupplierDrilldown = async (supplier: Supplier) => {
    if (selectedSupplierId === supplier.id) {
      setSelectedSupplierId(null);
      setSupplierPlants([]);
      setSupplierContacts([]);
      setPlantContacts([]);
      setSelectedPlantId(null);
      return;
    }

    setSelectedSupplierId(supplier.id);
    setSelectedPlantId(null);
    setPlantContacts([]);

    await Promise.all([loadSupplierPlants(supplier.id), loadSupplierContacts(supplier.id)]);
  };

  const openCreatePlant = () => {
    if (!selectedSupplierId) return;
    setPlantProductIds([]);
    setShowPlantModal(true);
  };

  const assignPlantProducts = async (plantId: number, productIds: string[]) => {
    if (!productIds.length) return;

    await Promise.allSettled(
      productIds.map((productId) => apiClient.post(`/plants/${plantId}/available-products/`, { product: productId }))
    );
  };

  const openCreatePlantContact = () => {
    if (!selectedSupplierId || !selectedPlantId) return;
    setShowContactModal(true);
  };

  const selectedPlant = selectedPlantId
    ? supplierPlants.find((p) => p.id === selectedPlantId)
    : null;

  useEffect(() => {
    if (!selectedPlantId) {
      setPlantContacts([]);
      return;
    }

    void loadPlantContacts(selectedPlantId);
  }, [selectedPlantId]);

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowEditForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await apiService.deleteSupplier(id);
        alert('Supplier deleted successfully!');
        await suppliersQuery.refetch(); // Re-fetch to update the list
      } catch (error: unknown) {
        // Type-safe error handling: Use 'unknown' instead of 'any' and assert expected structure
        // This ensures we handle errors safely while maintaining type checking
        logger.error('Error deleting supplier:', error);
        const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
        const errorMessage = err?.response?.data?.detail 
          || err?.response?.data?.message 
          || err?.message 
          || 'Failed to delete supplier';
        alert(`Error: ${errorMessage}`);
      }
    }
  };


  if (loading) {
    return <LoadingContainer $theme={theme}>Loading suppliers...</LoadingContainer>;
  }

  const visibleSuppliers = suppliers.filter((s) => {
    if (!searchText.trim()) return true;
    const haystack = [s.name, s.contact_person, s.email, s.phone, s.city, s.state]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchText.trim().toLowerCase());
  });

  return (
    <PageContainer>
      <Header>
        <HeaderText>
          <Title $theme={theme}>Suppliers</Title>
          <Subtitle>Manage supplier companies, plants, contacts, and available products</Subtitle>
        </HeaderText>
        <HeaderActions>
          <SecondaryButton type="button" onClick={() => navigate('/suppliers/plants')}>
            Plants
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => navigate('/suppliers/contacts')}>
            Contacts
          </SecondaryButton>
          <AddButton onClick={() => { setEditingSupplier(null); setShowForm(true); }}>
            + New Supplier
          </AddButton>
        </HeaderActions>
      </Header>

      <TableControls>
        <SearchInput
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search suppliers by name, contact, email, phone, city, or state…"
          aria-label="Search suppliers"
        />
      </TableControls>

      {showForm && (
        <EntityFormSurface
          entityType="supplier"
          mode="create"
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            void suppliersQuery.refetch();
          }}
        />
      )}

      {showEditForm && editingSupplier && (
        <EntityFormSurface
          entityType="supplier"
          mode="edit"
          entityId={editingSupplier.id}
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            setEditingSupplier(null);
          }}
          onSuccess={() => {
            setShowEditForm(false);
            setEditingSupplier(null);
            void suppliersQuery.refetch();
          }}
        />
      )}

      {showPlantModal && selectedSupplierId && (
        <FormOverlay>
          <FormContainer $theme={theme} data-testid="plant-create-modal">
            <FormHeader $theme={theme}>
              <FormTitle $theme={theme}>Add New Plant</FormTitle>
              <CloseButton $theme={theme} onClick={() => setShowPlantModal(false)}>×</CloseButton>
            </FormHeader>

            <FormGrid>
              <FormGroup $fullWidth>
                <MultiSelect
                  value={plantProductIds}
                  onChange={(values) => setPlantProductIds(values.map(String))}
                  options={Array.isArray(products) ? products.map(p => ({
                    value: String(p.id),
                    label: `${p.product_code} - ${p.effective_name || p.product_name || p.name || 'Unknown'}`
                  })) : []}
                  label="Plant Products List"
                  placeholder="(Optional) Select products this plant handles"
                />
              </FormGroup>
            </FormGrid>

            <EntityFormSurface
              entityType="plant"
              mode="create"
              variant="inline"
              isOpen={showPlantModal}
              onClose={() => setShowPlantModal(false)}
              context={{ supplierId: selectedSupplierId }}
              initialValues={{
                plant_type: 'processing',
                country: 'USA',
              }}
              onSuccess={(created) => {
                const createdId = Number((created as { id?: unknown } | null)?.id);
                const productIds = [...plantProductIds];

                void (async () => {
                  if (Number.isFinite(createdId) && createdId > 0) {
                    try {
                      await assignPlantProducts(createdId, productIds);
                    } catch (error) {
                      logger.error('[Suppliers] Failed to assign plant products:', error);
                      alert('Plant created, but failed to assign products.');
                    }
                  }

                  setShowPlantModal(false);
                  setPlantProductIds([]);
                  await loadSupplierPlants(selectedSupplierId);
                })();
              }}
            />
          </FormContainer>
        </FormOverlay>
      )}

      {showContactModal && selectedSupplierId && selectedPlantId && (
        <EntityFormSurface
          entityType="contact"
          mode="create"
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          context={{ supplierId: selectedSupplierId }}
          initialValues={{
            plant: String(selectedPlantId),
            department: 'sales',
          }}
          onSuccess={() => {
            setShowContactModal(false);
            void loadPlantContacts(selectedPlantId);
          }}
        />
      )}

      <TableContainer $theme={theme}>
        {suppliers.length === 0 ? (
          <EmptyState>
            <EmptyIcon>🏭</EmptyIcon>
            <EmptyText $theme={theme}>No suppliers found</EmptyText>
            <EmptySubText $theme={theme}>Add your first supplier to get started</EmptySubText>
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
              {visibleSuppliers.map((supplier) => (
                <React.Fragment key={supplier.id}>
                <TableRow
                  key={supplier.id}
                  data-testid={`supplier-row-${supplier.id}`}
                  $theme={theme}
                  onClick={() => void toggleSupplierDrilldown(supplier)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={selectedSupplierId === supplier.id}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void toggleSupplierDrilldown(supplier);
                    }
                  }}
                >
                  <TableCell $theme={theme}>
                    <CompanyButton $theme={theme} $selected={selectedSupplierId === supplier.id}>
                      <CompanyName $theme={theme}>{supplier.name}</CompanyName>
                      <CompanyChevron aria-hidden="true">{selectedSupplierId === supplier.id ? '▾' : '▸'}</CompanyChevron>
                    </CompanyButton>
                  </TableCell>
                  <TableCell $theme={theme}>{supplier.contact_person || '-'}</TableCell>
                  <TableCell $theme={theme}>{supplier.email || '-'}</TableCell>
                  <TableCell $theme={theme}>{supplier.phone || '-'}</TableCell>
                  <TableCell $theme={theme}>
                    {supplier.city && supplier.state
                      ? `${supplier.city}, ${supplier.state}`
                      : supplier.city || supplier.state || '-'}
                  </TableCell>
                  <TableCell $theme={theme}>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(supplier);
                      }}
                    >
                      Edit
                    </ActionButton>
                    <DeleteButton
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(supplier.id);
                      }}
                    >
                      Delete
                    </DeleteButton>
                  </TableCell>
                </TableRow>
                {selectedSupplierId === supplier.id && (
                  <ExpandedTableRow $theme={theme}>
                    <ExpandedTableCell $theme={theme} colSpan={6}>
                      <ExpandedPanel>
                        <ExpandedColumn>
                          <ExpandedHeader>
                            <ExpandedTitle>Plants</ExpandedTitle>
                            <ExpandedActions>
                              <SmallButton
                                data-testid="supplier-create-plant"
                                type="button"
                                onClick={openCreatePlant}
                                disabled={!selectedSupplierId}
                              >
                                + New Plant
                              </SmallButton>
                              <SmallButton
                                type="button"
                                onClick={() => navigate(`/suppliers/${supplier.id}/plants`)}
                              >
                                Manage
                              </SmallButton>
                            </ExpandedActions>
                          </ExpandedHeader>

                          {plantsLoading ? (
                            <ExpandedHint>Loading plants…</ExpandedHint>
                          ) : supplierPlants.length === 0 ? (
                            <ExpandedHint>No plants found for this supplier.</ExpandedHint>
                          ) : (
                            <ChildList>
                              {supplierPlants.map((plant) => (
                                <ChildListItem
                                  key={plant.id}
                                  data-testid={`plant-row-${plant.id}`}
                                  type="button"
                                  $active={selectedPlantId === plant.id}
                                  onClick={() => setSelectedPlantId(plant.id)}
                                >
                                  <ChildListName>{plant.name}</ChildListName>
                                  <ChildListMeta>
                                    <span>{plant.code}</span>
                                    {plant.plant_type ? <span>• {plant.plant_type}</span> : null}
                                  </ChildListMeta>
                                </ChildListItem>
                              ))}
                            </ChildList>
                          )}

                          <MetaCard>
                            <MetaRow>
                              <MetaKey>Products Available</MetaKey>
                              <MetaValue>{supplierRollupLoading ? 'Loading…' : `${supplierRollupProducts.length}`}</MetaValue>
                            </MetaRow>
                            {!supplierRollupLoading && supplierRollupProducts.length ? (
                              <ChildListMeta>
                                {supplierRollupProducts.slice(0, 40).map((p) => (
                                  <span key={String(p.id)}>{p.product_code}</span>
                                ))}
                              </ChildListMeta>
                            ) : !supplierRollupLoading ? (
                              <ExpandedHint>No plant products found.</ExpandedHint>
                            ) : null}
                          </MetaCard>
                        </ExpandedColumn>

                        <ExpandedColumn>
                          <ExpandedHeader>
                            <ExpandedTitle>Plant Details & Contacts</ExpandedTitle>
                            <ExpandedActions>
                              <SmallButton
                                data-testid="plant-create-contact"
                                type="button"
                                onClick={openCreatePlantContact}
                                disabled={!selectedPlantId}
                              >
                                + New Contact
                              </SmallButton>
                            </ExpandedActions>
                          </ExpandedHeader>

                          {selectedPlant ? (
                            <MetaCard>
                              <MetaRow>
                                <MetaKey>Plant Est. #</MetaKey>
                                <MetaValue>{selectedPlant.plant_est_num || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Plant Type</MetaKey>
                                <MetaValue>{selectedPlant.plant_type || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Address</MetaKey>
                                <MetaValue>{selectedPlant.address || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>City/State/ZIP</MetaKey>
                                <MetaValue>
                                  {selectedPlant.city || selectedPlant.state || selectedPlant.zip_code
                                    ? `${selectedPlant.city || ''}${selectedPlant.city && selectedPlant.state ? ', ' : ''}${selectedPlant.state || ''}${(selectedPlant.city || selectedPlant.state) && selectedPlant.zip_code ? ' ' : ''}${selectedPlant.zip_code || ''}`.trim()
                                    : '—'}
                                </MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Manager</MetaKey>
                                <MetaValue>{selectedPlant.manager || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Email</MetaKey>
                                <MetaValue>{selectedPlant.email || '—'}</MetaValue>
                              </MetaRow>
                              <MetaRow>
                                <MetaKey>Phone</MetaKey>
                                <MetaValue>{selectedPlant.phone || '—'}</MetaValue>
                              </MetaRow>
                            </MetaCard>
                          ) : (
                            <ExpandedHint>Select a plant to view details.</ExpandedHint>
                          )}

                          {selectedPlantId ? (
                            plantContactsLoading ? (
                              <ExpandedHint>Loading plant contacts…</ExpandedHint>
                            ) : plantContacts.length === 0 ? (
                              <ExpandedHint>No contacts found for this plant.</ExpandedHint>
                            ) : (
                              <ContactsList>
                                {plantContacts.map((c) => (
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
                          ) : (
                            <ExpandedHint>Select a plant to view its contacts.</ExpandedHint>
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

// Styled Components
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
  background: ${(props) => props.$theme.colors.surface};
  color: ${(props) => props.$theme.colors.textPrimary};

  &:focus {
    outline: none;
    border-color: ${(props) => props.$theme.colors.primary};
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
  transition: filter 0.2s ease;

  &:hover {
    filter: brightness(0.95);
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
    box-shadow: 0 4px 15px rgba(var(--color-primary), 0.25);
    filter: brightness(0.98);
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
    background: ${(props) => props.$theme.colors.surfaceHover};
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
  color: ${(props) => props.$theme.colors.textPrimary};
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
  background: rgb(var(--color-info));
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  transition: filter 0.2s ease;

  &:hover {
    filter: brightness(0.95);
  }
`;

const DeleteButton = styled.button`
  background: rgb(var(--color-danger));
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: filter 0.2s ease;

  &:hover {
    filter: brightness(0.95);
  }
`;

export default Suppliers;
