import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tenant } from '../types';

const CURRENT_TENANT_KEY = 'currentTenant';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export async function getPersistedTenantSelection(): Promise<Tenant | null> {
  const raw = await AsyncStorage.getItem(CURRENT_TENANT_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Tenant> | null;
    if (!parsed || !isUuid(parsed.id)) {
      await AsyncStorage.removeItem(CURRENT_TENANT_KEY);
      return null;
    }

    return parsed as Tenant;
  } catch {
    await AsyncStorage.removeItem(CURRENT_TENANT_KEY);
    return null;
  }
}

export async function persistTenantSelection(tenant: Tenant): Promise<void> {
  if (!isUuid(tenant.id)) {
    throw new Error('Tenant selection must contain a valid UUID id.');
  }

  await AsyncStorage.setItem(CURRENT_TENANT_KEY, JSON.stringify(tenant));
}

export async function clearPersistedTenantSelection(): Promise<void> {
  await AsyncStorage.removeItem(CURRENT_TENANT_KEY);
}
