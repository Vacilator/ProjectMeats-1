import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MissingDependencyQuickCreate, type DependencyType } from './MissingDependencyQuickCreate';

// Mock businessApi
const mockPost = vi.fn();
vi.mock('@/services/businessApi', () => ({
  businessApi: { post: (...args: unknown[]) => mockPost(...args) },
}));

vi.mock('@/utils/tenantId', () => ({
  getValidTenantId: () => 'tenant-123',
}));

// Suppress antd message
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
  };
});

function renderQuickCreate(
  overrides: Partial<React.ComponentProps<typeof MissingDependencyQuickCreate>> = {},
) {
  const defaultProps = {
    entityType: 'supplier' as DependencyType,
    open: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    ...overrides,
  };
  return { ...render(<MissingDependencyQuickCreate {...defaultProps} />), props: defaultProps };
}

describe('MissingDependencyQuickCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { id: 'new-1' } });
  });

  // ---- Rendering ----

  it('renders modal with correct title for supplier', () => {
    renderQuickCreate({ entityType: 'supplier' });
    expect(screen.getByText(/Quick Create Supplier/i)).toBeInTheDocument();
  });

  it('renders modal with correct title for customer', () => {
    renderQuickCreate({ entityType: 'customer' });
    expect(screen.getByText(/Quick Create Customer/i)).toBeInTheDocument();
  });

  it('renders modal with correct title for contact', () => {
    renderQuickCreate({ entityType: 'contact' });
    expect(screen.getByText(/Quick Create Contact/i)).toBeInTheDocument();
  });

  it('renders modal with correct title for plant', () => {
    renderQuickCreate({ entityType: 'plant' });
    expect(screen.getByText(/Quick Create Plant/i)).toBeInTheDocument();
  });

  it('shows entity type badge', () => {
    renderQuickCreate({ entityType: 'supplier' });
    expect(screen.getByText('Supplier')).toBeInTheDocument();
  });

  it('pre-fills name from suggestedName prop', () => {
    renderQuickCreate({ suggestedName: 'Acme Corp' });
    const input = screen.getByDisplayValue('Acme Corp');
    expect(input).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderQuickCreate({ open: false });
    expect(screen.queryByText(/Quick Create/i)).not.toBeInTheDocument();
  });

  // ---- Entity-specific fields ----

  it('shows email field for contacts', () => {
    renderQuickCreate({ entityType: 'contact' });
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Contact Type')).toBeInTheDocument();
  });

  it('shows email field for suppliers', () => {
    renderQuickCreate({ entityType: 'supplier' });
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('does not show email for customers', () => {
    renderQuickCreate({ entityType: 'customer' });
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
  });

  it('shows location field for plants', () => {
    renderQuickCreate({ entityType: 'plant' });
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('does not show location for suppliers', () => {
    renderQuickCreate({ entityType: 'supplier' });
    expect(screen.queryByText('Location')).not.toBeInTheDocument();
  });

  // ---- Creation ----

  it('creates supplier with correct endpoint and payload', async () => {
    const user = userEvent.setup();
    const { props } = renderQuickCreate({ entityType: 'supplier', suggestedName: 'Acme' });

    await user.click(screen.getByRole('button', { name: /Create Supplier/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/tenants/tenant-123/suppliers/',
        expect.objectContaining({ company_name: 'Acme', status: 'active' }),
      );
    });
    expect(props.onCreated).toHaveBeenCalledWith('new-1', 'Acme');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('creates customer with correct endpoint', async () => {
    const user = userEvent.setup();
    renderQuickCreate({ entityType: 'customer', suggestedName: 'BigBuyer' });

    await user.click(screen.getByRole('button', { name: /Create Customer/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/tenants/tenant-123/customers/',
        expect.objectContaining({ company_name: 'BigBuyer' }),
      );
    });
  });

  it('creates contact splitting first/last name', async () => {
    const user = userEvent.setup();
    renderQuickCreate({ entityType: 'contact', suggestedName: 'John Smith' });

    await user.click(screen.getByRole('button', { name: /Create Contact/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/tenants/tenant-123/contacts/',
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Smith',
          contact_type: 'Sales',
          status: 'active',
        }),
      );
    });
  });

  it('creates plant with location', async () => {
    const user = userEvent.setup();
    const { props } = renderQuickCreate({ entityType: 'plant', suggestedName: 'Plant A' });

    // Type a location
    const locationInput = screen.getByPlaceholderText('City, State');
    await user.type(locationInput, 'Dallas, TX');

    await user.click(screen.getByRole('button', { name: /Create Plant/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/tenants/tenant-123/plants/',
        expect.objectContaining({ name: 'Plant A', location: 'Dallas, TX', status: 'active' }),
      );
    });
    expect(props.onCreated).toHaveBeenCalled();
  });

  it('attaches parent supplier to contact when parentId/parentType provided', async () => {
    const user = userEvent.setup();
    renderQuickCreate({
      entityType: 'contact',
      suggestedName: 'Jane',
      parentId: 'sup-99',
      parentType: 'supplier',
    });

    await user.click(screen.getByRole('button', { name: /Create Contact/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ supplier: 'sup-99' }),
      );
    });
  });

  // ---- Validation ----

  it('shows warning when name is empty', async () => {
    const user = userEvent.setup();
    const { props } = renderQuickCreate({ entityType: 'supplier', suggestedName: '' });

    await user.click(screen.getByRole('button', { name: /Create Supplier/i }));

    const { message: antdMessage } = await import('antd');
    expect(antdMessage.warning).toHaveBeenCalledWith('Name is required');
    expect(mockPost).not.toHaveBeenCalled();
    expect(props.onCreated).not.toHaveBeenCalled();
  });

  // ---- Error handling ----

  it('shows error message when API call fails', async () => {
    mockPost.mockRejectedValue({ response: { data: { detail: 'Duplicate name' } } });
    const user = userEvent.setup();
    renderQuickCreate({ entityType: 'supplier', suggestedName: 'DupeCorp' });

    await user.click(screen.getByRole('button', { name: /Create Supplier/i }));

    const { message: antdMessage } = await import('antd');
    await waitFor(() => {
      expect(antdMessage.error).toHaveBeenCalledWith('Duplicate name');
    });
  });

  // ---- Close ----

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderQuickCreate();

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    expect(props.onClose).toHaveBeenCalled();
  });
});
