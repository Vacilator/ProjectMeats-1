/**
 * InquiryTemplateModal - Create/Edit inquiry templates
 * 
 * Allows users to create reusable templates with pre-configured products
 * and default settings for quick inquiry creation.
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Select as AntSelect } from 'antd';
import { showAlert } from '@/utils/uiDialogs';
import { businessApi } from '../../services/businessApi';
import { InquiryTemplate, InquiryEntityType } from '../../types';
import { PROTEIN_TYPE_CHOICES } from '../../utils/constants/choices';

// ============================================================================
// Types
// ============================================================================

interface InquiryTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: InquiryTemplate) => void;
  template?: InquiryTemplate | null;
  entityType?: InquiryEntityType;
}

interface ProductOption {
  id: string;
  product_code: string;
  description_of_product_item: string;
}

interface TemplateProductLine {
  product: string;
  product_code?: string;
  product_description?: string;
  default_quantity: number;
  default_uom: string;
  default_price_per_unit?: number;
  notes: string;
  sort_order: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  color: rgb(var(--color-text-primary));
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 4px 8px;
  
  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const FormSection = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h3`
  font-size: 0.95rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 0.85rem;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
`;

const Input = styled.input`
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

const Select = styled.select`
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

const TextArea = styled.textarea`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const ProductsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 10px 12px;
  background: rgba(var(--color-primary), 0.05);
  color: rgb(var(--color-text-secondary));
  font-weight: 600;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const TableCell = styled.td`
  padding: 10px 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  vertical-align: middle;
`;


const SmallInput = styled(Input)`
  width: 80px;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-error));
  cursor: pointer;
  padding: 4px 8px;
  font-size: 1.1rem;
  
  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
  }
`;

const AddProductButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(var(--color-primary), 0.05);
  border: 1px dashed rgb(var(--color-border));
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  margin-top: 12px;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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

const EmptyText = styled.p`
  color: rgb(var(--color-text-secondary));
  font-style: italic;
`;

const UOM_OPTIONS = [
  { value: 'LBS', label: 'Pounds (LBS)' },
  { value: 'KG', label: 'Kilograms (KG)' },
  { value: 'CS', label: 'Cases (CS)' },
  { value: 'EA', label: 'Each (EA)' },
  { value: 'PLT', label: 'Pallets (PLT)' },
  { value: 'BOX', label: 'Boxes (BOX)' },
];

// ============================================================================
// Component
// ============================================================================

export const InquiryTemplateModal: React.FC<InquiryTemplateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  template,
  entityType: defaultEntityType,
}) => {
  const isEditing = !!template;
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<InquiryEntityType>('customer');
  const [isActive, setIsActive] = useState(true);
  const [defaultValidDays, setDefaultValidDays] = useState(7);
  const [defaultNotes, setDefaultNotes] = useState('');
  const [products, setProducts] = useState<TemplateProductLine[]>([]);

  const [proteinFilter, setProteinFilter] = useState<string[]>([]);
  
  // Data state
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Load products list
  useEffect(() => {
    if (!isOpen) return;

    businessApi
      .get('system/products/', {
        params: {
          page_size: 500,
          is_active: true,
          ...(proteinFilter.length
            ? { protein: proteinFilter.map((t) => String(t).toLowerCase()) }
            : {}),
        },
      })
      .then((res) => {
        const data = res.data.results || res.data;
        setAvailableProducts(data);
      })
      .catch(console.error);
  }, [isOpen, proteinFilter.join('|')]);
  
  // Initialize form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setEntityType(template.entity_type);
      setIsActive(template.is_active);
      setDefaultValidDays(template.default_valid_days);
      setDefaultNotes(template.default_notes || '');
      setProducts(template.products.map(p => ({
        product: p.product,
        product_code: p.product_code,
        product_description: p.product_description,
        default_quantity: p.default_quantity,
        default_uom: p.default_uom,
        default_price_per_unit: p.default_price_per_unit,
        notes: p.notes || '',
        sort_order: p.sort_order,
      })));
    } else {
      // Reset form
      setName('');
      setDescription('');
      setEntityType(defaultEntityType || 'customer');
      setIsActive(true);
      setDefaultValidDays(7);
      setDefaultNotes('');
      setProducts([]);
    }
  }, [template, defaultEntityType, isOpen]);
  
  const handleAddProduct = useCallback(() => {
    setProducts(prev => [...prev, {
      product: '',
      default_quantity: 0,
      default_uom: 'LBS',
      notes: '',
      sort_order: prev.length,
    }]);
  }, []);
  
  const handleRemoveProduct = useCallback((index: number) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const handleProductChange = useCallback((index: number, field: keyof TemplateProductLine, value: any) => {
    setProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // If product changed, update product details
      if (field === 'product' && value) {
        const product = availableProducts.find(p => p.id === value);
        if (product) {
          updated[index].product_code = product.product_code;
          updated[index].product_description = product.description_of_product_item;
        }
      }
      
      return updated;
    });
  }, [availableProducts]);
  
  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({
        type: 'warning',
        title: 'Validation',
        content: 'Template name is required',
      });
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        entity_type: entityType,
        is_active: isActive,
        default_valid_days: defaultValidDays,
        default_notes: defaultNotes.trim(),
        products: products.filter(p => p.product).map((p, idx) => ({
          product: p.product,
          default_quantity: p.default_quantity || 0,
          default_uom: p.default_uom || 'LBS',
          default_price_per_unit: p.default_price_per_unit || null,
          notes: p.notes || '',
          sort_order: idx,
        })),
      };
      
      let response;
      if (isEditing && template) {
        response = await businessApi.put(`inquiry-templates/${template.id}/`, payload);
      } else {
        response = await businessApi.post('inquiry-templates/', payload);
      }
      
      onSave(response.data);
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        content: 'Failed to save template',
      });
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Overlay $isOpen={isOpen} onClick={onClose}>
      <ModalContainer onClick={e => e.stopPropagation()}>
        <Header>
          <Title>
            {isEditing ? '✏️ Edit Template' : '📋 Create Inquiry Template'}
          </Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>
        
        <Content>
          {/* Basic Info */}
          <FormSection>
            <SectionTitle>📝 Template Info</SectionTitle>
            <FormRow>
              <FormGroup>
                <Label>Template Name *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Weekly Beef Order"
                />
              </FormGroup>
              <FormGroup>
                <Label>Entity Type *</Label>
                <Select
                  value={entityType}
                  onChange={e => setEntityType(e.target.value as InquiryEntityType)}
                  disabled={isEditing}
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>Quote Valid Days</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={defaultValidDays}
                  onChange={e => setDefaultValidDays(parseInt(e.target.value) || 7)}
                />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup style={{ gridColumn: '1 / -1' }}>
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of this template's purpose"
                />
              </FormGroup>
            </FormRow>
            <CheckboxRow>
              <Checkbox
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                id="isActive"
              />
              <Label htmlFor="isActive" style={{ cursor: 'pointer' }}>
                Active (available for use)
              </Label>
            </CheckboxRow>
          </FormSection>
          
          {/* Products */}
          <FormSection>
            <SectionTitle>📦 Default Products</SectionTitle>

            <FormRow>
              <FormGroup>
                <Label>Protein Types Filter</Label>
                <AntSelect
                  mode="multiple"
                  value={proteinFilter}
                  onChange={(vals) => setProteinFilter(vals as string[])}
                  options={PROTEIN_TYPE_CHOICES.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder="Search protein types"
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    String(option?.label || '')
                      .toLowerCase()
                      .includes(String(input || '').toLowerCase())
                  }
                  style={{ width: '100%' }}
                />
              </FormGroup>
            </FormRow>

            {products.length > 0 ? (
              <ProductsTable>
                <thead>
                  <tr>
                    <TableHeader>Product</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>UOM</TableHeader>
                    <TableHeader>Price/Unit</TableHeader>
                    <TableHeader>Notes</TableHeader>
                    <TableHeader></TableHeader>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, index) => (
                    <tr key={index}>
                      <TableCell>
                        <AntSelect
                          value={p.product || undefined}
                          onChange={(val) => handleProductChange(index, 'product', String(val || ''))}
                          placeholder="Search products..."
                          showSearch
                          allowClear
                          optionFilterProp="label"
                          options={availableProducts.map((prod) => ({
                            value: prod.id,
                            label: `${prod.product_code} - ${String(prod.description_of_product_item || '').slice(0, 60)}`,
                          }))}
                          filterOption={(input, option) =>
                            String(option?.label || '')
                              .toLowerCase()
                              .includes(String(input || '').toLowerCase())
                          }
                          style={{ minWidth: 240, width: '100%' }}
                        />
                      </TableCell>
                      <TableCell>
                        <SmallInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.default_quantity || ''}
                          onChange={e => handleProductChange(index, 'default_quantity', parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.default_uom}
                          onChange={e => handleProductChange(index, 'default_uom', e.target.value)}
                          style={{ width: '90px' }}
                        >
                          {UOM_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.value}</option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <SmallInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.default_price_per_unit || ''}
                          onChange={e => handleProductChange(index, 'default_price_per_unit', parseFloat(e.target.value) || undefined)}
                          placeholder="$"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={p.notes}
                          onChange={e => handleProductChange(index, 'notes', e.target.value)}
                          placeholder="Notes..."
                          style={{ width: '120px' }}
                        />
                      </TableCell>
                      <TableCell>
                        <RemoveButton onClick={() => handleRemoveProduct(index)}>
                          🗑️
                        </RemoveButton>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </ProductsTable>
            ) : (
              <EmptyText>
                No products added yet. Add products to include them by default in inquiries created from this template.
              </EmptyText>
            )}
            <AddProductButton onClick={handleAddProduct}>
              ➕ Add Product
            </AddProductButton>
          </FormSection>
          
          {/* Default Notes */}
          <FormSection>
            <SectionTitle>📋 Default Notes</SectionTitle>
            <TextArea
              value={defaultNotes}
              onChange={e => setDefaultNotes(e.target.value)}
              placeholder="Default notes to include in inquiries created from this template..."
            />
          </FormSection>
        </Content>
        
        <Footer>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            $variant="primary" 
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Template')}
          </Button>
        </Footer>
      </ModalContainer>
    </Overlay>
  );
};

export default InquiryTemplateModal;
