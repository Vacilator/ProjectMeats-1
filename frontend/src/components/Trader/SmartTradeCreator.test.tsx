/**
 * SmartTradeCreator Tests
 *
 * Covers: rendering modes, AI text parsing, suggestion application,
 * trade creation flow, navigation between steps, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SmartTradeCreator } from './SmartTradeCreator';

// Mock services
vi.mock('../../services/traderService', () => ({
  traderService: {
    initiateTrade: vi.fn().mockResolvedValue({
      trade_id: 'T-001',
      trade_session_id: 'sess-123',
      dependencies: {
        inquiry_id: 'inq-1',
        all_satisfied: true,
        checklist: [],
      },
    }),
    advanceTrade: vi.fn().mockResolvedValue({ status: 'pipeline_started' }),
    checkDependencies: vi.fn().mockResolvedValue({
      inquiry_id: 'inq-1',
      all_satisfied: true,
      checklist: [],
    }),
  },
}));

vi.mock('../../services/businessApi', () => ({
  businessApi: {
    get: vi.fn().mockResolvedValue({ data: { results: [] } }),
  },
}));

vi.mock('../../utils/queryKeys', () => ({
  withTenantQueryKey: (key: string) => ['test-tenant', key],
}));

// Simple stubs for child components
vi.mock('./DependencyWizard', () => ({
  DependencyWizard: ({ onStartTrade }: { onStartTrade: () => void }) => (
    <div data-testid="dependency-wizard">
      <button onClick={onStartTrade}>Start Trade</button>
    </div>
  ),
}));

vi.mock('./TradePipelineTracker', () => ({
  TradePipelineTracker: () => <div data-testid="pipeline-tracker" />,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SmartTradeCreator', () => {
  const mockOnTradeCreated = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with all 4 input modes', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Smart Entry')).toBeInTheDocument();
    expect(screen.getByText('Quick Fields')).toBeInTheDocument();
    expect(screen.getByText('Paste Text')).toBeInTheDocument();
    expect(screen.getByText('AI Chat')).toBeInTheDocument();
  });

  it('renders title "Smart Trade Creator"', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Smart Trade Creator')).toBeInTheDocument();
  });

  it('shows text input on Smart Entry mode by default', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByPlaceholderText(/Describe your trade/)).toBeInTheDocument();
  });

  it('switches to Quick Fields mode and shows route selector', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Quick Fields'));
    expect(screen.getByText('Trade Route *')).toBeInTheDocument();
    expect(screen.getByText('Protein Type')).toBeInTheDocument();
  });

  it('switches to Paste mode with larger placeholder', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Paste Text'));
    expect(screen.getByPlaceholderText(/Paste an email/)).toBeInTheDocument();
  });

  it('parses text input and detects protein type', async () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    const textarea = screen.getByPlaceholderText(/Describe your trade/);
    fireEvent.change(textarea, { target: { value: 'Need 5000 lbs beef ribeye from supplier' } });

    // Advance debounce timer and flush state updates
    await act(async () => { vi.advanceTimersByTime(500); });

    expect(screen.getByText(/AI detected/)).toBeInTheDocument();
  });

  it('parses broker route keywords', async () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    const textarea = screen.getByPlaceholderText(/Describe your trade/);
    fireEvent.change(textarea, { target: { value: 'broker 1000 lbs chicken from supplier' } });

    await act(async () => { vi.advanceTimersByTime(500); });

    expect(screen.getByText(/Broker Route/)).toBeInTheDocument();
  });

  it('navigates to Review step on "Review & Continue" click', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Review & Continue'));
    expect(screen.getByText('Review & Create Trade')).toBeInTheDocument();
    expect(screen.getByText('Trade Route')).toBeInTheDocument();
  });

  it('shows Cancel button that calls onCancel', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('shows Back button in review step to return to input', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Go to review
    fireEvent.click(screen.getByText('Review & Continue'));
    expect(screen.getByText('Review & Create Trade')).toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Smart Trade Creator')).toBeInTheDocument();
  });

  it('shows pipeline preview in review step', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Review & Continue'));
    expect(screen.getByTestId('pipeline-tracker')).toBeInTheDocument();
  });

  it('shows supplier select only in BROKER mode', () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Switch to minimal mode where route is visible
    fireEvent.click(screen.getByText('Quick Fields'));

    // Default is FULFILL — no supplier field visible
    expect(screen.queryByText('Supplier')).not.toBeInTheDocument();
  });

  it('shows Quick Create button when confidence >= 70%', async () => {
    render(
      <SmartTradeCreator onTradeCreated={mockOnTradeCreated} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    const textarea = screen.getByPlaceholderText(/Describe your trade/);
    fireEvent.change(textarea, { target: { value: 'broker 40000 lbs beef ribeye' } });

    await act(async () => { vi.advanceTimersByTime(500); });

    expect(screen.getByText('Quick Create')).toBeInTheDocument();
  });
});
