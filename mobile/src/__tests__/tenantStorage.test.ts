import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearPersistedTenantSelection } from '../utils/tenantStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    removeItem: jest.fn(),
  },
}));

describe('tenantStorage', () => {
  it('clears persisted currentTenant selection', async () => {
    await clearPersistedTenantSelection();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('currentTenant');
  });
});
