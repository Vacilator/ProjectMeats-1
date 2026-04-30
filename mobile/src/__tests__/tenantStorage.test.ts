import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tenant } from '../types';

import {
  clearPersistedTenantSelection,
  getPersistedTenantSelection,
  persistTenantSelection,
} from '../utils/tenantStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('tenantStorage', () => {
  const tenant: Tenant = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    name: 'Acme',
    slug: 'acme',
    contact_email: 'ops@example.com',
    contact_phone: '555-0100',
    is_active: true,
    is_trial: false,
    user_count: 3,
    is_trial_expired: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    settings: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists a valid tenant selection', async () => {
    await persistTenantSelection(tenant);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'currentTenant',
      JSON.stringify(tenant)
    );
  });

  it('reads a valid tenant selection', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(tenant));

    await expect(getPersistedTenantSelection()).resolves.toEqual(tenant);
  });

  it('clears malformed tenant payloads during rehydrate', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{oops');

    await expect(getPersistedTenantSelection()).resolves.toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('currentTenant');
  });

  it('clears non-uuid tenant payloads during rehydrate', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ ...tenant, id: 'not-a-uuid' })
    );

    await expect(getPersistedTenantSelection()).resolves.toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('currentTenant');
  });

  it('clears persisted currentTenant selection', async () => {
    await clearPersistedTenantSelection();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('currentTenant');
  });
});
