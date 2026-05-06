import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBusinessApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./businessApi', () => ({
  businessApi: mockBusinessApi,
}));

import { settlementEventsService } from './settlementEventsService';

describe('settlementEventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes paginated queue responses', async () => {
    mockBusinessApi.get.mockResolvedValue({
      data: {
        results: [{ id: 7, state: 'ready_to_post' }],
      },
    });

    const result = await settlementEventsService.list({ queue_only: true });

    expect(mockBusinessApi.get).toHaveBeenCalledWith('/settlement-events/', {
      params: { queue_only: true },
    });
    expect(result).toEqual([{ id: 7, state: 'ready_to_post' }]);
  });

  it('posts override payloads to the manual review action', async () => {
    mockBusinessApi.post.mockResolvedValue({
      data: { id: 7, state: 'posted' },
    });

    const result = await settlementEventsService.override(7, {
      target_type: 'invoice',
      target_id: 12,
      review_note: 'Matched from remittance',
    });

    expect(mockBusinessApi.post).toHaveBeenCalledWith('/settlement-events/7/override/', {
      target_type: 'invoice',
      target_id: 12,
      review_note: 'Matched from remittance',
    });
    expect(result).toEqual({ id: 7, state: 'posted' });
  });
});
