import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ApiService } from '../services/ApiService';
import { toApiErrorText } from '../services/apiErrorPresentation';
import { RootStackParamList, User, UserTenant, Tenant } from '../types';
import { colors } from '../theme';

type TenantsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Tenants'>;

interface Props {
  navigation: TenantsScreenNavigationProp;
  user: User;
  onTenantSelect: (tenant: Tenant) => void;
  onLogout: () => void;
}

interface TenantItemProps {
  tenant: UserTenant;
  onPress: () => void;
}

const TenantItem: React.FC<TenantItemProps> = ({ tenant, onPress }) => (
  <TouchableOpacity style={styles.tenantItem} onPress={onPress}>
    <View style={styles.tenantHeader}>
      <Text style={styles.tenantName}>{tenant.tenant_name}</Text>
      <View style={[styles.badge, tenant.is_trial ? styles.trialBadge : styles.paidBadge]}>
        <Text style={styles.badgeText}>
          {tenant.is_trial ? 'TRIAL' : 'PAID'}
        </Text>
      </View>
    </View>
    <Text style={styles.tenantRole}>Role: {tenant.role.toUpperCase()}</Text>
    <Text style={styles.tenantSlug}>@{tenant.tenant_slug}</Text>
  </TouchableOpacity>
);

export default function TenantsScreen({ navigation, user, onTenantSelect, onLogout }: Props) {
  const [tenants, setTenants] = useState<UserTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const userTenants = await ApiService.getMyTenants();
      setTenants(userTenants);
    } catch (error) {
      Alert.alert(
        'Error',
        toApiErrorText(error, { fallbackMessage: 'Failed to load tenants' })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTenantPress = async (userTenant: UserTenant) => {
    try {
      // Get full tenant details
      const tenant = await ApiService.getTenant(userTenant.tenant_id);
      onTenantSelect(tenant);
    } catch (error) {
      Alert.alert(
        'Error',
        toApiErrorText(error, {
          fallbackMessage: 'Failed to load tenant details',
        })
      );
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTenants();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const renderTenant = ({ item }: { item: UserTenant }) => (
    <TenantItem 
      tenant={item} 
      onPress={() => handleTenantPress(item)} 
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading tenants...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Organization</Text>
        <Text style={styles.welcomeText}>
          Welcome, {user.first_name || user.username}
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {tenants.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No organizations found</Text>
          <Text style={styles.emptySubtext}>
            Contact your administrator to get access to an organization.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tenants}
          keyExtractor={(item) => item.tenant_id}
          renderItem={renderTenant}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.surface,
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 15,
  },
  logoutButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.error,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  logoutText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  list: {
    padding: 15,
  },
  tenantItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tenantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  tenantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trialBadge: {
    backgroundColor: colors.warning,
  },
  paidBadge: {
    backgroundColor: colors.success,
  },
  badgeText: {
    color: colors.textOnPrimary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tenantRole: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 3,
  },
  tenantSlug: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
