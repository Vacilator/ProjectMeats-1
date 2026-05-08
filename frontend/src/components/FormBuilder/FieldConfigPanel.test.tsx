/**
 * Tests for FieldConfigPanel Component
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FieldConfigPanel from './FieldConfigPanel';
import type { FieldConfig } from './FieldConfigPanel';

// ============================================================================
// TEST DATA
// ============================================================================

const createDefaultField = (): FieldConfig => ({
  id: 'field-1',
  name: 'test_field',
  label: 'Test Field',
  type: 'text',
  placeholder: '',
  helpText: '',
  validation: [],
});

// ============================================================================
// TESTS
// ============================================================================

describe('FieldConfigPanel', () => {
  const defaultProps = {
    field: createDefaultField(),
    onChange: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders field type selector', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.getByText('Field Type')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Number')).toBeInTheDocument();
    });

    it('renders basic settings section', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.getByText('Basic Settings')).toBeInTheDocument();
      expect(screen.getByLabelText(/Field Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Label$/i)).toBeInTheDocument();
    });

    it('renders close button when onClose provided', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.getByLabelText(/close panel/i)).toBeInTheDocument();
    });

    it('does not render close button when onClose not provided', () => {
      render(<FieldConfigPanel {...defaultProps} onClose={undefined} />);

      expect(screen.queryByLabelText(/close panel/i)).not.toBeInTheDocument();
    });
  });

  describe('Field Type Selection', () => {
    it('highlights selected field type', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      const textButton = screen.getByRole('button', { name: /📝\s*Text/i });
      expect(textButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('updates field type on selection', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: /🔢\s*Number/i }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        type: 'number',
      }));
    });

    it('shows all field type options', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Dropdown')).toBeInTheDocument();
      expect(screen.getByText('Checkbox')).toBeInTheDocument();
      expect(screen.getByText('File Upload')).toBeInTheDocument();
    });
  });

  describe('Basic Settings', () => {
    it('updates field name', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const input = screen.getByLabelText(/Field Name/i);
      fireEvent.change(input, { target: { value: 'new_field_name' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        name: 'new_field_name',
      }));
    });

    it('updates field label', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const input = screen.getByLabelText(/^Label$/i);
      fireEvent.change(input, { target: { value: 'New Label' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        label: 'New Label',
      }));
    });

    it('updates placeholder', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const input = screen.getByLabelText(/Placeholder/i);
      fireEvent.change(input, { target: { value: 'Enter something...' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        placeholder: 'Enter something...',
      }));
    });

    it('updates help text', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByLabelText(/Help Text/i);
      fireEvent.change(textarea, { target: { value: 'This is help text' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        helpText: 'This is help text',
      }));
    });

    it('updates width', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const select = screen.getByLabelText(/Width/i);
      fireEvent.change(select, { target: { value: 'half' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        width: 'half',
      }));
    });
  });

  describe('Options (for select fields)', () => {
    it('shows options section for select type', () => {
      const field = { ...createDefaultField(), type: 'select' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} />);

      expect(screen.getByText('Options')).toBeInTheDocument();
    });

    it('shows options section for multiselect type', () => {
      const field = { ...createDefaultField(), type: 'multiselect' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} />);

      expect(screen.getByText('Options')).toBeInTheDocument();
    });

    it('shows options section for radio type', () => {
      const field = { ...createDefaultField(), type: 'radio' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} />);

      expect(screen.getByText('Options')).toBeInTheDocument();
    });

    it('does not show options section for text type', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.queryByText('Options')).not.toBeInTheDocument();
    });

    it('can add new option', () => {
      const onChange = vi.fn();
      const field = { ...createDefaultField(), type: 'select' as const, options: [] };
      render(<FieldConfigPanel {...defaultProps} field={field} onChange={onChange} />);

      fireEvent.click(screen.getByText('+ Add Option'));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        options: [{ value: '', label: '' }],
      }));
    });

    it('can remove option', () => {
      const onChange = vi.fn();
      const field = {
        ...createDefaultField(),
        type: 'select' as const,
        options: [{ value: 'opt1', label: 'Option 1' }]
      };
      render(<FieldConfigPanel {...defaultProps} field={field} onChange={onChange} />);

      fireEvent.click(screen.getAllByLabelText(/remove option/i)[0]);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        options: [],
      }));
    });
  });

  describe('Number Settings', () => {
    it('shows number settings for number type', () => {
      const field = { ...createDefaultField(), type: 'number' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} />);

      expect(screen.getByText('Number Settings')).toBeInTheDocument();
      expect(screen.getByLabelText(/Minimum/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Maximum/i)).toBeInTheDocument();
    });

    it('shows currency selector for currency type', () => {
      const field = { ...createDefaultField(), type: 'currency' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} />);

      expect(screen.getByLabelText(/Currency/i)).toBeInTheDocument();
    });

    it('updates min value', () => {
      const onChange = vi.fn();
      const field = { ...createDefaultField(), type: 'number' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} onChange={onChange} />);

      const input = screen.getByLabelText(/Minimum/i);
      fireEvent.change(input, { target: { value: '10' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        min: 10,
      }));
    });
  });

  describe('Text Settings', () => {
    it('shows text settings for text type', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.getByText('Text Settings')).toBeInTheDocument();
      expect(screen.getByLabelText(/Min Length/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Max Length/i)).toBeInTheDocument();
    });

    it('shows text settings for textarea type', () => {
      const field = { ...createDefaultField(), type: 'textarea' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} />);

      expect(screen.getByText('Text Settings')).toBeInTheDocument();
    });

    it('updates max length', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const input = screen.getByLabelText(/Max Length/i);
      fireEvent.change(input, { target: { value: '100' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        maxLength: 100,
      }));
    });
  });

  describe('File Settings', () => {
    it('shows file settings for file type', () => {
      const field = { ...createDefaultField(), type: 'file' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} />);

      expect(screen.getByText('File Settings')).toBeInTheDocument();
      expect(screen.getByLabelText(/Accepted File Types/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Max File Size/i)).toBeInTheDocument();
    });

    it('updates accepted file types', () => {
      const onChange = vi.fn();
      const field = { ...createDefaultField(), type: 'file' as const };
      render(<FieldConfigPanel {...defaultProps} field={field} onChange={onChange} />);

      const input = screen.getByLabelText(/Accepted File Types/i);
      fireEvent.change(input, { target: { value: '.pdf, .doc' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        acceptedTypes: ['.pdf', '.doc'],
      }));
    });
  });

  describe('Validation Rules', () => {
    it('renders validation section', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.getByText('Validation Rules')).toBeInTheDocument();
    });

    it('can add validation rule', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      fireEvent.click(screen.getByText('+ Add Validation Rule'));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: [{ type: 'required' }],
      }));
    });

    it('can remove validation rule', () => {
      const onChange = vi.fn();
      const field = {
        ...createDefaultField(),
        validation: [{ type: 'required' as const }]
      };
      render(<FieldConfigPanel {...defaultProps} field={field} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText(/remove validation rule/i));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: [],
      }));
    });
  });

  describe('Behavior Settings', () => {
    it('renders behavior section', () => {
      render(<FieldConfigPanel {...defaultProps} />);

      expect(screen.getByText('Behavior')).toBeInTheDocument();
    });

    it('can toggle readonly', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const checkbox = screen.getByLabelText(/read-only field/i);
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        readonly: true,
      }));
    });

    it('can toggle hidden', () => {
      const onChange = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onChange={onChange} />);

      const checkbox = screen.getByLabelText(/hidden by default/i);
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        hidden: true,
      }));
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<FieldConfigPanel {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText(/close panel/i));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
