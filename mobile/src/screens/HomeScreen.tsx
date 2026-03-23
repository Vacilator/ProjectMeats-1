import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ApiService } from '../services/ApiService';
import { RootStackParamList, User, GuestUser, Tenant, Customer, Supplier } from '../types';
import { useMobileTranslation } from '../i18n';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
  user: User | GuestUser;
  tenant: Tenant;
  onLogout: () => void;
  onSwitchTenant: () => void;
}

interface EntityCardProps {
  title: string;
  count: number;
  onPress: () => void;
  color: string;
}

const EntityCard: React.FC<EntityCardProps> = ({ title, count, onPress, color }) => (
  <TouchableOpacity style={[styles.entityCard, { backgroundColor: color }]} onPress={onPress}>
    <Text style={styles.entityTitle}>{title}</Text>
    <Text style={styles.entityCount}>{count}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation, user, tenant, onLogout, onSwitchTenant }: Props) {
  const { t } = useMobileTranslation();
  const [dashboardData, setDashboardData] = useState({
    customers: 0,
    suppliers: 0,
    contacts: 0,
    plants: 0,
    carriers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [customers, suppliers, contacts, plants, carriers] = await Promise.all([
        ApiService.getCustomers(),
        ApiService.getSuppliers(),
        ApiService.getContacts(),
        ApiService.getPlants(),
        ApiService.getCarriers(),
      ]);

      setDashboardData({
        customers: customers.count,
        suppliers: suppliers.count,
        contacts: contacts.count,
        plants: plants.count,
        carriers: carriers.count,
      });
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityPress = (entityType: string) => {
    Alert.alert(
      t.home.comingSoon,
      t.home.nextUpdate(entityType),
      [{ text: 'OK' }]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      t.home.logout,
      t.home.logoutConfirm,
      [
        { text: t.home.cancel, style: 'cancel' },
        { text: t.home.logout, style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const handleSwitchTenant = () => {
    Alert.alert(
      t.home.switchOrg,
      t.home.switchConfirm,
      [
        { text: t.home.cancel, style: 'cancel' },
        { text: t.home.switchBtn, onPress: onSwitchTenant },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.tenantName}>{tenant.name}</Text>
          <Text style={styles.welcomeText}>
            {t.home.welcome(user.first_name || user.username)}
          </Text>
          {tenant.is_trial && (
            <View style={styles.trialBanner}>
              <Text style={styles.trialText}>{t.home.trialAccount}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerButton, styles.switchButton]} 
            onPress={handleSwitchTenant}
          >
            <Text style={styles.headerButtonText}>{t.home.switchBtn}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.headerButton, styles.logoutButton]} 
            onPress={handleLogout}
          >
            <Text style={styles.headerButtonText}>{t.home.logout}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dashboard */}
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>{t.home.dashboard}</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>{t.home.loadingDashboard}</Text>
          </View>
        ) : (
          <View style={styles.entityGrid}>
            <EntityCard
              title={t.home.customers}
              count={dashboardData.customers}
              onPress={() => handleEntityPress('Customer')}
              color="#3498db"
            />
            
            <EntityCard
              title={t.home.suppliers}
              count={dashboardData.suppliers}
              onPress={() => handleEntityPress('Supplier')}
              color="#e74c3c"
            />
            
            <EntityCard
              title={t.home.contacts}
              count={dashboardData.contacts}
              onPress={() => handleEntityPress('Contact')}
              color="#f39c12"
            />
            
            <EntityCard
              title={t.home.plants}
              count={dashboardData.plants}
              onPress={() => handleEntityPress('Plant')}
              color="#27ae60"
            />
            
            <EntityCard
              title={t.home.carriers}
              count={dashboardData.carriers}
              onPress={() => handleEntityPress('Carrier')}
              color="#9b59b6"
            />
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t.home.quickActions}</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.quickActionButton, styles.workFormsButton]}
            onPress={() => navigation.navigate('WorkForms')}
          >
            <Text style={[styles.quickActionText, styles.workFormsButtonText]}>WorkForms</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => Alert.alert(t.home.comingSoon, t.home.featureSoon)}
          >
            <Text style={styles.quickActionText}>{t.home.createOrder}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => Alert.alert(t.home.comingSoon, t.home.featureSoon)}
          >
            <Text style={styles.quickActionText}>{t.home.viewReports}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => Alert.alert(t.home.comingSoon, t.home.featureSoon)}
          >
            <Text style={styles.quickActionText}>{t.home.aiAssistant}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tenantName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  trialBanner: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  trialText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  switchButton: {
    backgroundColor: '#3498db',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    marginTop: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  entityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  entityCard: {
    width: '48%',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  entityTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  entityCount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  workFormsButton: {
    backgroundColor: '#2c3e50',
    borderColor: '#2c3e50',
  },
  workFormsButtonText: {
    color: '#fff',
  },
  quickActionText: {
    color: '#2c3e50',
    fontSize: 14,
    fontWeight: 'bold',
  },
});