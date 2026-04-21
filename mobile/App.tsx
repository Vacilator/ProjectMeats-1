import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import TenantsScreen from './src/screens/TenantsScreen';
import GuestLoginScreen from './src/screens/GuestLoginScreen';
import InviteScreen from './src/screens/InviteScreen';
import WorkFormsScreen from './src/screens/WorkFormsScreen';

// Services
import { ApiService } from './src/services/ApiService';

// i18n
import { I18nProvider } from './src/i18n';

// Types
import { User, Tenant, GuestSession, GuestUser, RootStackParamList } from './src/types';

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      const tenantData = await AsyncStorage.getItem('currentTenant');
      const isGuestFlag = await AsyncStorage.getItem('isGuest');

      if (token && userData) {
        setIsAuthenticated(true);
        setIsGuest(isGuestFlag === '1');
        setUser(JSON.parse(userData));
        ApiService.setAuthToken(token);

        if (tenantData) {
          const parsed = JSON.parse(tenantData);
          setCurrentTenant(parsed);
          if (parsed?.id) {
            ApiService.setTenantId(String(parsed.id));
          }
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (token: string, userData: User) => {
    try {
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await AsyncStorage.setItem('isGuest', '0');

      setIsAuthenticated(true);
      setIsGuest(false);
      setUser(userData);
      ApiService.setAuthToken(token);
    } catch (error) {
      console.error('Error saving auth data:', error);
    }
  };

  const handleTenantSelect = async (tenant: Tenant) => {
    try {
      await AsyncStorage.setItem('currentTenant', JSON.stringify(tenant));
      setCurrentTenant(tenant);
      ApiService.setTenantId(String(tenant.id));
    } catch (error) {
      console.error('Error saving tenant data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Best-effort server-side token invalidation (no-op if already logged out).
      try {
        await ApiService.logout();
      } catch {
        // Ignore network/auth errors during logout; local logout still proceeds.
      }

      await AsyncStorage.multiRemove(['authToken', 'userData', 'currentTenant', 'isGuest']);
      setIsAuthenticated(false);
      setIsGuest(false);
      setUser(null);
      setCurrentTenant(null);
      ApiService.removeAuthToken();
      ApiService.clearTenantId();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Guest session handler: guest user is authenticated via Token auth, but we keep a separate UX.
  const handleGuestLogin = async (session: GuestSession) => {
    const guestTenant: Tenant = {
      id: session.tenant.id,
      name: session.tenant.name,
      slug: session.tenant.slug,
      contact_email: '',
      contact_phone: '',
      is_active: true,
      is_trial: false,
      user_count: 0,
      is_trial_expired: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      settings: {},
    };

    try {
      await AsyncStorage.setItem('authToken', session.token);
      await AsyncStorage.setItem('userData', JSON.stringify(session.user));
      await AsyncStorage.setItem('currentTenant', JSON.stringify(guestTenant));
      await AsyncStorage.setItem('isGuest', '1');

      ApiService.setAuthToken(session.token);
      ApiService.setTenantId(String(session.tenant.id));

      setUser(session.user);
      setCurrentTenant(guestTenant);
      setIsGuest(true);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error saving guest session:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  // Derive a guest user object for screens that need a User prop
  const guestUser: GuestUser = {
    id: null,
    username: 'guest',
    email: '',
    first_name: 'Guest',
    last_name: '',
    is_active: true,
    date_joined: new Date().toISOString(),
    is_guest: true,
  };

  return (
    <I18nProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <>
              <Stack.Screen name="Login">
                {(props) => (
                  <LoginScreen
                    {...props}
                    onLogin={handleLogin}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Guest">
                {(props) => (
                  <GuestLoginScreen
                    {...props}
                    onGuestLogin={handleGuestLogin}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Invite">
                {(props) => (
                  <InviteScreen
                    {...props}
                    onInviteAccepted={handleLogin}
                  />
                )}
              </Stack.Screen>
            </>
          ) : !currentTenant ? (
            <Stack.Screen name="Tenants">
              {(props) => (
                <TenantsScreen
                  {...props}
                  user={user!}
                  onTenantSelect={handleTenantSelect}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Home">
                {(props) => (
                  <HomeScreen
                    {...props}
                    user={isGuest ? guestUser : user!}
                    tenant={currentTenant}
                    onLogout={handleLogout}
                    onSwitchTenant={() => {
                      if (isGuest) {
                        // Guest: fully sign out and return to login
                        handleLogout();
                      } else {
                        setCurrentTenant(null);
                        ApiService.clearTenantId();
                      }
                    }}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="WorkForms">
                {(props) => (
                  <WorkFormsScreen
                    {...props}
                    tenant={currentTenant}
                    user={isGuest ? guestUser : user!}
                    isGuest={isGuest}
                  />
                )}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </I18nProvider>
  );
}