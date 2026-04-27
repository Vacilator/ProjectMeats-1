import AsyncStorage from '@react-native-async-storage/async-storage';

export async function clearPersistedTenantSelection(): Promise<void> {
  await AsyncStorage.removeItem('currentTenant');
}
