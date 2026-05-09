import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_CHOICES } from './choiceConstants';

vi.mock('./businessApi', () => ({
  businessApi: {
    get: vi.fn(),
  },
}));

import { businessApi } from './businessApi';
import { contactFormOptionsService } from './contactFormOptionsService';

describe('contactFormOptionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contactFormOptionsService.clearCache();
  });

  it('uses one canonical slug and caches the stable empty choices reference', async () => {
    vi.mocked(businessApi.get).mockResolvedValue({ data: [] });

    const first = await contactFormOptionsService.getSystemChoiceOptions('protein-type');
    const second = await contactFormOptionsService.getSystemChoiceOptions('protein_type');

    expect(businessApi.get).toHaveBeenCalledTimes(1);
    expect(businessApi.get).toHaveBeenCalledWith('/system/choices/', {
      params: { list: 'protein_types' },
    });
    expect(first).toBe(EMPTY_CHOICES);
    expect(second).toBe(EMPTY_CHOICES);
  });
});
