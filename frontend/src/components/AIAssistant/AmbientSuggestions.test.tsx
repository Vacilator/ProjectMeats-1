import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import AmbientSuggestions from './AmbientSuggestions';
import { ambientAiApi } from '@/services/aiService';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/services/aiService', () => ({
  ambientAiApi: {
    getContextualSuggestions: vi.fn(),
  },
}));

const mockGetContextualSuggestions = vi.mocked(ambientAiApi.getContextualSuggestions);

describe('AmbientSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders contextual actions and routes target-url suggestions', async () => {
    const user = userEvent.setup();
    mockGetContextualSuggestions.mockResolvedValue([
      {
        action: 'draft_check_in_email',
        label: 'Draft Check-in Email',
        confidence: 0.93,
        target_url: '/my-tasks?tab=ai-review',
      },
    ]);

    render(
      <MemoryRouter>
        <AmbientSuggestions entityType="supplier" entityId="sup-1" />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /Draft Check-in Email/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Draft Check-in Email/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-tasks?tab=ai-review');
    });
  });
});
