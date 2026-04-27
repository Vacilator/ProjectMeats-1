import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SystemChoiceList } from '../../../services/configService';

const mockApiClient = {
  post: vi.fn(() => Promise.resolve({ data: {} })),
  patch: vi.fn(() => Promise.resolve({ data: {} })),
};

const mockConfigService = {
  getChoiceLists: vi.fn<[], Promise<SystemChoiceList[]>>(),
  getChoiceList: vi.fn<[string], Promise<SystemChoiceList>>(),
  clearCache: vi.fn(),
};

vi.mock('../../../services/apiService', () => ({
  apiClient: mockApiClient,
}));

vi.mock('../../../services/configService', () => ({
  configService: mockConfigService,
}));

describe('ChoiceListEditor (admin-studio)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Ctrl+S saves the latest edited value (no stale closure in keyboard shortcut handler)', async () => {
    const list: SystemChoiceList = {
      id: 1,
      slug: 'test-list',
      name: 'Test List',
      description: 'desc',
      is_extensible: false,
      is_reorderable: false,
      items: [
        {
          id: 10,
          choice_list: 1,
          value: 'foo',
          label: 'Foo',
          description: '',
          is_system: false,
          is_active: true,
          sort_order: 0,
          metadata: {},
        },
      ],
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-01T00:00:00Z',
    };

    mockConfigService.getChoiceLists.mockResolvedValue([list]);
    mockConfigService.getChoiceList.mockResolvedValue(list);

    const { default: ChoiceListEditor } = await import('./ChoiceListEditor');

    render(<ChoiceListEditor listSlug={list.slug} />);

    const valueInput = await screen.findByDisplayValue('foo');

    fireEvent.change(valueInput, { target: { value: 'bar1' } });
    await screen.findByDisplayValue('bar1');

    // Second edit while `hasChanges` is already true.
    fireEvent.change(valueInput, { target: { value: 'bar2' } });
    await screen.findByDisplayValue('bar2');

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(mockApiClient.patch).toHaveBeenCalled();
    });

    const lastCall = mockApiClient.patch.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('/system/choice-items/10/');
    expect(lastCall?.[1]).toMatchObject({ value: 'bar2' });
  });
});
