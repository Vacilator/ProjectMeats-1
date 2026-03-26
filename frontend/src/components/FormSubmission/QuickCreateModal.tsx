/**
 * QuickCreateModal Component
 * 
 * Modal for quick-creating entity records from within forms.
 * Shows only the required/essential fields for fast creation.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { Select, Spin } from 'antd';
import debounce from 'lodash/debounce';
import {
  entityOptionsService,
  QuickCreateField,
} from '../../services/quickActionsService';
import { apiClient } from '../../services/apiService';
import { PROTEIN_TYPE_CHOICES } from '../../utils/constants/choices';

interface QuickCreateModalProps {
  entityType: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (entity: { value: string; label: string }) => void;
  /** Render as inline panel content (no fixed overlay). */
  inline?: boolean;
  /** Optional initial values for context-aware prefill (e.g., customer/supplier FK). */
  initialValues?: Record<string, any>;
  /** Context data used to pre-populate and hide fields (e.g., raw UUIDs from Cockpit). */
  contextData?: Record<string, any>;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Modal = styled.div`
  background: var(--bg-primary, #ffffff);
  border-radius: 0.75rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color, #dee2e6);
  background: var(--bg-secondary, #f8f9fa);
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #6c757d);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.15s ease;

  &:hover {
    color: var(--text-primary, #1a1a2e);
  }
`;

const ModalBody = styled.div`
  padding: 1.25rem;
  overflow-y: auto;
  max-height: calc(90vh - 140px);
`;

const FieldGroup = styled.div`
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label<{ required?: boolean }>`
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary, #1a1a2e);

  ${({ required }) => required && `
    &::after {
      content: ' *';
      color: var(--color-error, #dc3545);
    }
  `}
`;

const Input = styled.input`
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-primary, #1a1a2e);
  background-color: var(--input-bg, #ffffff);
  border: 1px solid var(--border-color, #dee2e6);
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:focus {
    outline: none;
    border-color: var(--color-primary, #0d6efd);
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
  }

  &:disabled {
    background-color: var(--input-disabled-bg, #e9ecef);
    cursor: not-allowed;
  }

  &.error {
    border-color: var(--color-error, #dc3545);
  }
`;

const ErrorText = styled.span`
  display: block;
  font-size: 0.75rem;
  color: var(--color-error, #dc3545);
  margin-top: 0.25rem;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color, #dee2e6);
  background: var(--bg-secondary, #f8f9fa);

  /* Keep the save action visible in embedded mode */
  position: sticky;
  bottom: 0;
  z-index: 5;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;

  ${({ variant }) => variant === 'primary' ? `
    background: var(--color-primary, #0d6efd);
    color: #fff;
    border: 1px solid var(--color-primary, #0d6efd);

    &:hover:not(:disabled) {
      background: var(--color-primary-hover, #0b5ed7);
      border-color: var(--color-primary-hover, #0b5ed7);
    }
  ` : `
    background: var(--bg-primary, #ffffff);
    color: var(--text-primary, #1a1a2e);
    border: 1px solid var(--border-color, #dee2e6);

    &:hover:not(:disabled) {
      background: var(--bg-secondary, #f8f9fa);
    }
  `}

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.span`
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
  color: var(--text-secondary, #6c757d);
`;

const InlineContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const InlineHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface-hover));
`;

const InlineTitle = styled.div`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  entityType,
  isOpen,
  onClose,
  onCreated,
  inline = false,
  initialValues,
  contextData,
}) => {
  const [fields, setFields] = useState<QuickCreateField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entityLabel, setEntityLabel] = useState('');

  const proteinTypeValue: string[] = useMemo(() => {
    const raw = formData?.preferred_protein_types;
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : [raw]).map((v) => String(v)).filter(Boolean);
  }, [formData]);

  const [productOptions, setProductOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const debouncedProductSearchRef = useRef<ReturnType<typeof debounce> | null>(null);

  const mergedContext = useMemo(
    () => ({ ...(initialValues || {}), ...(contextData || {}) }),
    [initialValues, contextData]
  );

  useEffect(() => {
    if (isOpen && entityType) {
      loadFields();
    }
  }, [isOpen, entityType, mergedContext]);

  const loadFields = async () => {
    setIsLoading(true);
    setErrors({});
    try {
      const response = await entityOptionsService.getQuickCreateFields(entityType);
      setFields(response.fields);
      setEntityLabel(response.entity_label);
      
      // Initialize form data with empty values (plus optional context prefill)
      // Use type-appropriate defaults to avoid sending invalid placeholders.
      const initialData: Record<string, any> = { ...(mergedContext || {}) };
      response.fields.forEach((f) => {
        if (initialData[f.key] !== undefined) return;
        if (f.type === 'checkbox') {
          initialData[f.key] = false;
        } else if (f.type === 'multiselect') {
          initialData[f.key] = [];
        } else {
          initialData[f.key] = '';
        }
      });
      setFormData(initialData);
    } catch (err) {
      console.error('Failed to load fields:', err);
      setErrors({ _general: 'Failed to load form fields' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  }, [errors]);

  const fetchMasterProducts = useCallback(async (search?: string) => {
    setIsLoadingProducts(true);
    try {
      const normalizedProteins = proteinTypeValue
        .map((t) => String(t).toLowerCase().trim())
        .filter(Boolean);

      const response = await apiClient.get('/system/products/', {
        params: {
          search: search || undefined,
          is_active: true,
          // Some environments allow client-set page sizing; some don't.
          // Include both params for maximum compatibility.
          page_size: 50,
          limit: 50,
          ...(normalizedProteins.length ? { protein: normalizedProteins.join(',') } : {}),
        },
      });

      const raw = response.data as any;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];

      setProductOptions(
        data.map((p: any) => ({
          value: String(p.id),
          label: `${p.product_code}${p.name ? ` - ${p.name}` : ''}`,
        }))
      );
    } catch (err) {
      // Silent fail: quick create should still work for basic fields.
      console.error('[QuickCreateModal] Failed to load master products:', err);
      setProductOptions([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [proteinTypeValue]);

  useEffect(() => {
    // Re-load product options whenever protein filters change.
    if (fields.some((f) => f.key === 'products')) {
      void fetchMasterProducts();
    }
  }, [fetchMasterProducts, fields, proteinTypeValue.join('|')]);

  useEffect(() => {
    // Setup debounced search handler
    debouncedProductSearchRef.current = debounce((q: string) => {
      void fetchMasterProducts(q);
    }, 300);
    return () => {
      debouncedProductSearchRef.current?.cancel();
      debouncedProductSearchRef.current = null;
    };
  }, [fetchMasterProducts]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      if (field.required && !formData[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Avoid sending empty-string placeholders; these can break numeric/FK/boolean fields
      // and cause "Save" to appear non-functional.
      const payload: Record<string, any> = {};

      // Include context values first (if any)
      Object.entries(mergedContext || {}).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === 'string' && v.trim() === '') return;
        if (Array.isArray(v) && v.length === 0) return;
        payload[k] = v;
      });

      fields.forEach((field) => {
        const raw = formData[field.key];

        // Skip empty values
        if (raw === undefined || raw === null) return;
        if (typeof raw === 'string' && raw.trim() === '') return;
        if (Array.isArray(raw) && raw.filter((x) => String(x).trim() !== '').length === 0) return;

        if (field.type === 'number') {
          const n = typeof raw === 'number' ? raw : Number(raw);
          if (!Number.isFinite(n)) return;
          payload[field.key] = n;
          return;
        }

        if (field.type === 'checkbox') {
          payload[field.key] = Boolean(raw);
          return;
        }

        if (field.type === 'multiselect') {
          payload[field.key] = Array.isArray(raw) ? raw : [raw];
          return;
        }

        payload[field.key] = raw;
      });

      const response = await entityOptionsService.quickCreate(entityType, payload);
      onCreated({ value: response.value, label: response.label });
      onClose();
    } catch (err: any) {
      console.error('Failed to create entity:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || 'Failed to create record';
      setErrors({ _general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !isSubmitting && !isLoading) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  if (inline) {
    return (
      <InlineContainer onKeyDown={handleKeyDown}>
        <InlineHeader>
          <InlineTitle>➕ Create New {entityLabel}</InlineTitle>
          <CloseButton onClick={onClose} aria-label="Close">×</CloseButton>
        </InlineHeader>

        <ModalBody>
          {isLoading ? (
            <LoadingContainer>
              <LoadingSpinner />
              <span>Loading fields...</span>
            </LoadingContainer>
          ) : fields.length === 0 ? (
            <LoadingContainer>
              <span>No fields configured for quick creation.</span>
              <span style={{ fontSize: '0.75rem' }}>
                Please contact an administrator to configure required fields.
              </span>
            </LoadingContainer>
          ) : (
            <>
              {errors._general && (
                <ErrorText style={{ marginBottom: '1rem', textAlign: 'center' }}>
                  {errors._general}
                </ErrorText>
              )}
              {fields.map((field) => {
                // Hide fields that are pre-populated from context
                if (contextData && contextData[field.key] !== undefined) {
                  return null;
                }

                return (
                  <FieldGroup key={field.key}>
                    <Label required={field.required} htmlFor={`quick-create-${field.key}`}>
                      {field.label}
                    </Label>
                    {field.key === 'preferred_protein_types' ? (
                      <Select
                        mode="multiple"
                        value={proteinTypeValue}
                        onChange={(vals) => handleInputChange(field.key, vals)}
                        options={PROTEIN_TYPE_CHOICES.map((o) => ({ value: o.value, label: o.label }))}
                        placeholder="Select protein types"
                        disabled={isSubmitting}
                        style={{ width: '100%' }}
                      />
                    ) : field.key === 'products' && (entityType === 'customer' || entityType === 'supplier') ? (
                      <Select
                        mode="multiple"
                        value={Array.isArray(formData[field.key]) ? formData[field.key] : []}
                        onChange={(vals) => handleInputChange(field.key, vals)}
                        options={productOptions}
                        placeholder={proteinTypeValue.length ? 'Search products (filtered by protein types)...' : 'Search products...'}
                        showSearch
                        filterOption={false}
                        onSearch={(q) => debouncedProductSearchRef.current?.(q)}
                        notFoundContent={isLoadingProducts ? <Spin size="small" /> : null}
                        disabled={isSubmitting}
                        style={{ width: '100%' }}
                      />
                    ) : field.type === 'checkbox' ? (
                      <input
                        id={`quick-create-${field.key}`}
                        type="checkbox"
                        checked={Boolean(formData[field.key])}
                        onChange={(e) => handleInputChange(field.key, e.target.checked)}
                        disabled={isSubmitting}
                      />
                    ) : (
                      <Input
                        id={`quick-create-${field.key}`}
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={errors[field.key] ? 'error' : ''}
                        disabled={isSubmitting}
                        autoFocus={fields.indexOf(field) === 0}
                      />
                    )}
                    {errors[field.key] && <ErrorText>{errors[field.key]}</ErrorText>}
                  </FieldGroup>
                );
              })}
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={isLoading || isSubmitting || fields.length === 0}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner />
                Creating...
              </>
            ) : (
              <>💾 Create {entityLabel}</>
            )}
          </Button>
        </ModalFooter>
      </InlineContainer>
    );
  }

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <ModalHeader>
          <ModalTitle>
            ➕ Create New {entityLabel}
          </ModalTitle>
          <CloseButton onClick={onClose} aria-label="Close">×</CloseButton>
        </ModalHeader>

        <ModalBody>
          {isLoading ? (
            <LoadingContainer>
              <LoadingSpinner />
              <span>Loading fields...</span>
            </LoadingContainer>
          ) : fields.length === 0 ? (
            <LoadingContainer>
              <span>No fields configured for quick creation.</span>
              <span style={{ fontSize: '0.75rem' }}>
                Please contact an administrator to configure required fields.
              </span>
            </LoadingContainer>
          ) : (
            <>
              {errors._general && (
                <ErrorText style={{ marginBottom: '1rem', textAlign: 'center' }}>
                  {errors._general}
                </ErrorText>
              )}
              {fields.map((field) => {
                // Hide fields that are pre-populated from context
                if (contextData && contextData[field.key] !== undefined) {
                  return null;
                }

                return (
                  <FieldGroup key={field.key}>
                    <Label required={field.required} htmlFor={`quick-create-${field.key}`}>
                      {field.label}
                    </Label>
                    {field.key === 'preferred_protein_types' ? (
                      <Select
                        mode="multiple"
                        value={proteinTypeValue}
                        onChange={(vals) => handleInputChange(field.key, vals)}
                        options={PROTEIN_TYPE_CHOICES.map((o) => ({ value: o.value, label: o.label }))}
                        placeholder="Select protein types"
                        disabled={isSubmitting}
                        style={{ width: '100%' }}
                      />
                    ) : field.key === 'products' && (entityType === 'customer' || entityType === 'supplier') ? (
                      <Select
                        mode="multiple"
                        value={Array.isArray(formData[field.key]) ? formData[field.key] : []}
                        onChange={(vals) => handleInputChange(field.key, vals)}
                        options={productOptions}
                        placeholder={proteinTypeValue.length ? 'Search products (filtered by protein types)...' : 'Search products...'}
                        showSearch
                        filterOption={false}
                        onSearch={(q) => debouncedProductSearchRef.current?.(q)}
                        notFoundContent={isLoadingProducts ? <Spin size="small" /> : null}
                        disabled={isSubmitting}
                        style={{ width: '100%' }}
                      />
                    ) : field.type === 'checkbox' ? (
                      <input
                        id={`quick-create-${field.key}`}
                        type="checkbox"
                        checked={Boolean(formData[field.key])}
                        onChange={(e) => handleInputChange(field.key, e.target.checked)}
                        disabled={isSubmitting}
                      />
                    ) : (
                      <Input
                        id={`quick-create-${field.key}`}
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={errors[field.key] ? 'error' : ''}
                        disabled={isSubmitting}
                        autoFocus={fields.indexOf(field) === 0}
                      />
                    )}
                    {errors[field.key] && <ErrorText>{errors[field.key]}</ErrorText>}
                  </FieldGroup>
                );
              })}
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting || fields.length === 0}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner />
                Creating...
              </>
            ) : (
              <>💾 Create {entityLabel}</>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default QuickCreateModal;
