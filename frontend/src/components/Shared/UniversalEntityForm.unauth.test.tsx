import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => {
  return {
    get: vi.fn(),
    options: vi.fn(),
  };
});

vi.mock('../../services/businessApi', () => {
  return {
    businessApi: businessApiMock,
  };
});

vi.mock('@/contexts/AuthContext', () => {
  return {
    useAuthState: () => ({ isAuthenticated: false, loading: false }),
  };
});

vi.mock('../../features/system/DynamicFormEngine', () => {
  return {
    default: () => <div data-testid="dynamic-form-engine" />,
  };
});

import { UniversalEntityForm } from './UniversalEntityForm';

describe('UniversalEntityForm (unauthenticated)', () => {
  beforeEach(() => {
    localStorage.clear();
    businessApiMock.get.mockReset();
    businessApiMock.options.mockReset();
  });

  it('does not call businessApi when unauthenticated', async () => {
    render(
      <UniversalEntityForm
        entityType="plant"
        entityId="2769"
        mode="edit"
        variant="inline"
        isOpen
        onClose={() => {}}
      />
    );

    expect(await screen.findByText(/Authentication required/i)).toBeInTheDocument();
    expect(businessApiMock.get).not.toHaveBeenCalled();
    expect(businessApiMock.options).not.toHaveBeenCalled();
  });
});
