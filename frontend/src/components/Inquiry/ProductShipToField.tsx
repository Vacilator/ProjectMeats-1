/**
 * ProductShipToField — Editable ship-to location selector at product row level.
 *
 * Features:
 * - Searchable dropdown of customer locations
 * - "Add New Location" option integrated INSIDE the dropdown via dropdownRender
 * - Inline quick-create form (name + address fields)
 * - Auto-selects newly created location
 */
import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Select, Input, message, Divider } from 'antd';
import { Plus, MapPin, Check, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { businessApi } from '@/services/businessApi';
import { inquiryService } from '@/services/inquiryService';
import type { InquiryProduct } from '../../types';

interface CustomerLocation {
  id: string;
  display_name?: string;
  name?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface ProductShipToFieldProps {
  product: InquiryProduct;
  customerId?: string;
  readOnly?: boolean;
}

export const ProductShipToField: React.FC<ProductShipToFieldProps> = ({
  product,
  customerId,
  readOnly = false,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newZip, setNewZip] = useState('');
  const queryClient = useQueryClient();

  // Fetch customer locations
  const { data: customerLocations, refetch: refetchLocations } = useQuery({
    queryKey: withTenantQueryKey('customer-locations', customerId ?? ''),
    queryFn: async () => {
      if (!customerId) return [];
      const res = await businessApi.get(`/locations/`, { params: { customer: customerId } });
      return (res.data?.results ?? res.data ?? []) as CustomerLocation[];
    },
    enabled: Boolean(customerId),
    staleTime: 60_000,
    retry: false,
  });

  const locationOptions = useMemo(() => {
    return (customerLocations ?? []).map((loc) => ({
      value: loc.id,
      label: loc.display_name || loc.name || 'Location',
      description: [loc.address_line_1, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', '),
      searchText: `${loc.display_name || loc.name || ''} ${loc.address_line_1 ?? ''} ${loc.city ?? ''} ${loc.state ?? ''} ${loc.zip_code ?? ''}`.toLowerCase(),
    }));
  }, [customerLocations]);

  const invalidateInquiry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('inquiry') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('inquiries') });
  }, [queryClient]);

  const updateProductMutation = useMutation({
    retry: false,
    mutationFn: (locationId: string | null) =>
      inquiryService.updateInquiryProduct(product.id, { ship_to_location: locationId } as Partial<InquiryProduct>),
    onSuccess: () => invalidateInquiry(),
    onError: () => message.error('Failed to update ship-to location'),
  });

  const createLocationMutation = useMutation({
    retry: false,
    mutationFn: async (values: Record<string, string>) => {
      const res = await businessApi.post('/locations/', {
        ...values,
        customer: customerId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      message.success('Location created');
      resetForm();
      void refetchLocations();
      if (data?.id) {
        updateProductMutation.mutate(data.id);
      }
    },
    onError: () => message.error('Failed to create location'),
  });

  const resetForm = useCallback(() => {
    setShowAddForm(false);
    setNewName('');
    setNewAddress('');
    setNewCity('');
    setNewState('');
    setNewZip('');
  }, []);

  const handleCreateLocation = useCallback(() => {
    if (!newName.trim()) {
      message.warning('Location name is required');
      return;
    }
    createLocationMutation.mutate({
      name: newName.trim(),
      address_line_1: newAddress.trim(),
      city: newCity.trim(),
      state: newState.trim(),
      zip_code: newZip.trim(),
    });
  }, [newName, newAddress, newCity, newState, newZip, createLocationMutation]);

  const handleShipToChange = useCallback(
    (value: string | undefined) => {
      updateProductMutation.mutate(value ?? null);
    },
    [updateProductMutation],
  );

  if (readOnly) {
    if (!product.ship_to_location_name) return null;
    return (
      <ShipToContainer>
        <ShipToLabel><MapPin size={11} /> Ship To</ShipToLabel>
        <ShipToValue>{product.ship_to_location_name}</ShipToValue>
      </ShipToContainer>
    );
  }

  if (!customerId) {
    return (
      <ShipToContainer>
        <ShipToLabel><MapPin size={11} /> Ship To</ShipToLabel>
        <ShipToHint>Assign a customer first</ShipToHint>
      </ShipToContainer>
    );
  }

  return (
    <ShipToContainer>
      <ShipToLabel><MapPin size={11} /> Ship To</ShipToLabel>
      <Select
        size="small"
        value={product.ship_to_location || undefined}
        onChange={handleShipToChange}
        placeholder="Select delivery location"
        style={{ flex: 1, minWidth: 180 }}
        allowClear
        showSearch
        filterOption={(input, option) => {
          const searchText = (option as { searchText?: string })?.searchText ?? '';
          return searchText.includes(input.toLowerCase());
        }}
        optionRender={(option) => (
          <div>
            <div style={{ fontWeight: 500 }}>{option.label}</div>
            {(option.data as { description?: string })?.description && (
              <div style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.45)' }}>
                {(option.data as { description?: string }).description}
              </div>
            )}
          </div>
        )}
        options={locationOptions}
        notFoundContent={
          locationOptions.length === 0
            ? 'No locations — add one below'
            : 'No matching locations'
        }
        getPopupContainer={(trigger) => trigger.parentElement || document.body}
        dropdownRender={(menu) => (
          <>
            {menu}
            <Divider style={{ margin: '4px 0' }} />
            {!showAddForm ? (
              <AddLocationTrigger
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowAddForm(true)}
              >
                <Plus size={12} /> Add New Location
              </AddLocationTrigger>
            ) : (
              <InlineAddForm onMouseDown={(e) => e.preventDefault()}>
                <Input
                  size="small"
                  placeholder="Location name *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <Input
                  size="small"
                  placeholder="Street address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
                <InlineRow>
                  <Input size="small" placeholder="City" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                  <Input size="small" placeholder="State" value={newState} onChange={(e) => setNewState(e.target.value)} style={{ width: 60 }} />
                  <Input size="small" placeholder="ZIP" value={newZip} onChange={(e) => setNewZip(e.target.value)} style={{ width: 70 }} />
                </InlineRow>
                <InlineRow>
                  <SmallBtn
                    $variant="success"
                    onClick={handleCreateLocation}
                    disabled={createLocationMutation.isPending || !newName.trim()}
                  >
                    <Check size={11} /> Save
                  </SmallBtn>
                  <SmallBtn $variant="cancel" onClick={resetForm}>
                    <X size={11} /> Cancel
                  </SmallBtn>
                </InlineRow>
              </InlineAddForm>
            )}
          </>
        )}
      />
    </ShipToContainer>
  );
};

// ── Styled Components ──

const ShipToContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
`;

const ShipToLabel = styled.span`
  font-size: 0.6875rem;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.03em;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
`;

const ShipToValue = styled.span`
  font-size: 0.8125rem;
  color: rgb(var(--color-text-primary));
`;

const ShipToHint = styled.span`
  font-size: 0.75rem;
  color: rgb(var(--color-text-tertiary));
  font-style: italic;
`;

const AddLocationTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  color: rgb(var(--color-primary));
  cursor: pointer;

  &:hover {
    background: rgba(var(--color-primary), 0.06);
  }
`;

const InlineAddForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
`;

const InlineRow = styled.div`
  display: flex;
  gap: 0.375rem;
  align-items: center;
`;

const SmallBtn = styled.button<{ $variant: 'success' | 'cancel' }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  background: ${({ $variant }) =>
    $variant === 'success'
      ? 'rgba(var(--color-success), 0.12)'
      : 'rgba(var(--color-border), 0.3)'};
  color: ${({ $variant }) =>
    $variant === 'success'
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-text-secondary))'};

  &:hover:not(:disabled) {
    opacity: 0.8;
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export default ProductShipToField;
