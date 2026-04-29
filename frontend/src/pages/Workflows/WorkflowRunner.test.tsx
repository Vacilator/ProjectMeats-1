import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const navigateMock = vi.hoisted(() => vi.fn());
const formMountSpy = vi.hoisted(() => vi.fn());

vi.mock('../../services/apiService', () => ({
  adminClient: adminClientMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ runId: 'run-1' }),
  };
});

vi.mock('../../features/system/DynamicFormEngine', () => ({
  DynamicFormEngine: ({
    initialValues,
    onSubmit,
  }: {
    initialValues?: Record<string, unknown>;
    onSubmit: (data: Record<string, unknown>) => void;
  }) => {
    React.useEffect(() => {
      formMountSpy(initialValues?.name ?? null);
    }, []);

    return (
      <div>
        <div data-testid="initial-name">{String(initialValues?.name ?? 'empty')}</div>
        <button type="button" onClick={() => onSubmit({})}>
          Submit step
        </button>
      </div>
    );
  },
}));

import { WorkflowRunner } from './WorkflowRunner';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('WorkflowRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    adminClientMock.get.mockResolvedValue({
      data: {
        workflow_slug: 'Plant Intake',
        status: 'IN_PROGRESS',
        current_step_index: 0,
      },
    });
    adminClientMock.post.mockResolvedValue({
      data: {
        complete: false,
        next_step_schema: {
          step_index: 1,
          name: 'Plant Intake - Step 2',
          fields: [],
        },
        initial_data: {
          name: 'North Fabrication Plant',
        },
      },
    });
  });

  it('remounts the form when workflow steps advance so new initial values apply', async () => {
    render(<WorkflowRunner />, { wrapper: createWrapper() });

    expect(await screen.findByTestId('initial-name')).toHaveTextContent('empty');
    expect(formMountSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Submit step' }));

    await waitFor(() => {
      expect(screen.getByTestId('initial-name')).toHaveTextContent('North Fabrication Plant');
    });

    await waitFor(() => {
      expect(formMountSpy).toHaveBeenCalledTimes(2);
    });
    expect(formMountSpy).toHaveBeenLastCalledWith('North Fabrication Plant');
  });
});
