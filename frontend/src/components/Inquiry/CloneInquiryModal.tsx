/**
 * CloneInquiryModal - Clone an existing inquiry
 * 
 * Allows users to quickly create a new inquiry based on an existing one,
 * optionally copying products and pricing to a different entity/contact.
 */
import React, { useEffect } from 'react';
import { z } from 'zod';
import styled from 'styled-components';

import { useZodForm } from '@/hooks/useZodForm';
import { showAlert } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';
import { businessApi } from '@/services/businessApi';
import {
  InquiryModalBody,
  InquiryModalFooter,
  InquiryModalFrame,
} from './InquiryModalFrame';
import { Inquiry } from '../../types';

function unwrapResults<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}

interface CloneInquiryPayload {
  include_products: boolean;
  include_pricing: boolean;
  new_entity_id?: string;
  new_contact_id?: string;
}

// ============================================================================
// Types
// ============================================================================

interface CloneInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloned: (inquiry: Inquiry) => void;
  inquiry: Inquiry;
}

interface Entity {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

const cloneInquirySchema = z
  .object({
    includeProducts: z.boolean().default(true),
    includePricing: z.boolean().default(false),
    newEntityId: z.string().optional().default(''),
    newContactId: z.string().optional().default(''),
  })
  .superRefine((values, ctx) => {
    if (values.includePricing && !values.includeProducts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['includePricing'],
        message: 'Pricing can only be cloned when products are included.',
      });
    }
  });

type CloneInquiryValues = z.infer<typeof cloneInquirySchema>;

const buildCloneInquiryDefaults = (): CloneInquiryValues => ({
  includeProducts: true,
  includePricing: false,
  newEntityId: '',
  newContactId: '',
});

// ============================================================================
// Styled Components
// ============================================================================


const SourceInfo = styled.div`
  background: rgba(var(--color-primary), 0.05);
  padding: 16px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
`;

const SourceLabel = styled.div`
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 4px;
`;

const SourceValue = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 8px;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(var(--color-primary), 0.05);
  border-radius: var(--radius-md);
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.span`
  font-size: 0.9rem;
  color: rgb(var(--color-text-primary));
`;

const CheckboxHint = styled.span`
  font-size: 0.8rem;
  color: rgb(var(--color-text-secondary));
  margin-left: 28px;
  display: block;
  margin-top: 2px;
`;

const InlineError = styled.div`
  margin-top: 10px;
  color: rgb(var(--color-error));
  font-size: 0.85rem;
`;


const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$variant === 'primary' ? `
    background: rgb(var(--color-primary));
    color: white;
    border: none;
    
    &:hover {
      opacity: 0.9;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  ` : `
    background: transparent;
    color: rgb(var(--color-text-primary));
    border: 1px solid rgb(var(--color-border));
    
    &:hover {
      background: rgba(var(--color-primary), 0.05);
    }
  `}
`;

// ============================================================================
// Component
// ============================================================================

export const CloneInquiryModal: React.FC<CloneInquiryModalProps> = ({
  isOpen,
  onClose,
  onCloned,
  inquiry,
}) => {
  const form = useZodForm<CloneInquiryValues>(cloneInquirySchema, {
    defaultValues: buildCloneInquiryDefaults(),
  });

  const includeProducts = form.watch('includeProducts');
  const includePricing = form.watch('includePricing');
  const newEntityId = form.watch('newEntityId');
  const newContactId = form.watch('newContactId');
  const cloning = form.formState.isSubmitting;

  // Data state
  const [entities, setEntities] = React.useState<Entity[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);

  useEffect(() => {
    if (!includeProducts && includePricing) {
      form.setValue('includePricing', false, { shouldDirty: true });
    }
  }, [form, includePricing, includeProducts]);

  // Load entities based on inquiry type
  useEffect(() => {
    if (isOpen && inquiry) {
      const endpoint = inquiry.entity_type === 'supplier'
        ? '/suppliers/'
        : '/customers/';
      
      businessApi.get<{ results?: Entity[] } | Entity[]>(endpoint, { params: { page_size: 500 } })
        .then((res) => {
          setEntities(unwrapResults<Entity>(res.data));
        })
        .catch((err) => logger.error('Failed to load entities', { component: 'CloneInquiryModal' }, err));
    }
  }, [isOpen, inquiry]);
  
  // Load contacts when entity changes
  useEffect(() => {
    if (newEntityId) {
      businessApi.get<{ results?: Contact[] } | Contact[]>('/contacts/', {
        params: {
          entity_type: inquiry.entity_type,
          entity_id: newEntityId,
          page_size: 100,
        },
      })
        .then((res) => {
          setContacts(unwrapResults<Contact>(res.data));
        })
        .catch(() => setContacts([]));
    } else {
      setContacts([]);
    }
  }, [newEntityId, inquiry?.entity_type]);
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      form.reset(buildCloneInquiryDefaults());
    }
  }, [form, isOpen]);

  const onSubmit = async (values: CloneInquiryValues) => {
    try {
      const payload: CloneInquiryPayload = {
        include_products: values.includeProducts,
        include_pricing: values.includePricing,
      };

      if (values.newEntityId) {
        payload.new_entity_id = values.newEntityId;
      }
      if (values.newContactId) {
        payload.new_contact_id = values.newContactId;
      }

      const response = await businessApi.post<Inquiry>(`/inquiries/${inquiry.id}/clone/`, payload);

      onCloned(response.data);
      onClose();
    } catch (error) {
      logger.error('Failed to clone inquiry', { component: 'CloneInquiryModal' }, error);
      showAlert({
        type: 'error',
        title: 'Error',
        content: 'Failed to clone inquiry',
      });
    }
  };
  
  const entityName = inquiry.entity_type === 'supplier' 
    ? inquiry.supplier_name 
    : inquiry.customer_name;
  
  return (
    <InquiryModalFrame isOpen={isOpen} onClose={onClose} title="📋 Clone Inquiry" maxWidth={500}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <InquiryModalBody>
          <SourceInfo>
            <SourceLabel>Cloning from:</SourceLabel>
            <SourceValue>
              {inquiry.inquiry_number} - {entityName}
            </SourceValue>
          </SourceInfo>

          <CheckboxGroup>
            <div>
              <CheckboxRow>
                <Checkbox
                  type="checkbox"
                  aria-label="Include Products"
                  checked={includeProducts}
                  onChange={(e) => form.setValue('includeProducts', e.target.checked, { shouldDirty: true })}
                  id="includeProducts"
                />
                <CheckboxLabel>Include Products</CheckboxLabel>
              </CheckboxRow>
              <CheckboxHint>Copy all products from the original inquiry</CheckboxHint>
            </div>

            <div>
              <CheckboxRow>
                <Checkbox
                  type="checkbox"
                  aria-label="Include Pricing"
                  checked={includePricing}
                  onChange={(e) => form.setValue('includePricing', e.target.checked, { shouldDirty: true })}
                  disabled={!includeProducts}
                  id="includePricing"
                />
                <CheckboxLabel>Include Pricing</CheckboxLabel>
              </CheckboxRow>
              <CheckboxHint>Copy desired prices and quantities (requires products)</CheckboxHint>
            </div>
          </CheckboxGroup>

          {form.formState.errors.includePricing?.message ? (
            <InlineError>{String(form.formState.errors.includePricing.message)}</InlineError>
          ) : null}

          <FormGroup>
            <Label>Clone to Different {inquiry.entity_type === 'supplier' ? 'Supplier' : 'Customer'} (Optional)</Label>
            <Select
              aria-label="Clone to entity"
              value={newEntityId}
              onChange={(e) => {
                form.setValue('newEntityId', e.target.value, { shouldDirty: true });
                form.setValue('newContactId', '', { shouldDirty: true });
              }}
            >
              <option value="">Same as original ({entityName})</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </Select>
          </FormGroup>

          {(newEntityId || contacts.length > 0) && (
            <FormGroup>
              <Label>Contact (Optional)</Label>
              <Select
                aria-label="Clone to contact"
                value={newContactId}
                onChange={(e) => form.setValue('newContactId', e.target.value, { shouldDirty: true })}
              >
                <option value="">
                  {newEntityId ? 'Select contact...' : `Same as original (${inquiry.contact_name || 'None'})`}
                </option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                    {contact.email && ` (${contact.email})`}
                  </option>
                ))}
              </Select>
            </FormGroup>
          )}
        </InquiryModalBody>

        <InquiryModalFooter>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button $variant="primary" type="submit" disabled={cloning}>
            {cloning ? 'Cloning...' : 'Clone Inquiry'}
          </Button>
        </InquiryModalFooter>
      </form>
    </InquiryModalFrame>
  );
};

export default CloneInquiryModal;
