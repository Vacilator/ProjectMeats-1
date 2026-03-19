import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ApiService } from '../services/ApiService';
import { RootStackParamList, GuestSession } from '../types';

type GuestLoginNavigationProp = StackNavigationProp<RootStackParamList, 'Guest'>;

interface Props {
  navigation: GuestLoginNavigationProp;
  onGuestLogin: (session: GuestSession) => void;
}

export default function GuestLoginScreen({ navigation, onGuestLogin }: Props) {
  const [tenantSlug, setTenantSlug] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = async () => {
    if (!tenantSlug.trim()) {
      Alert.alert('Error', 'Please enter a workspace name');
      return;
    }

    setLoading(true);
    try {
      const session = await ApiService.loginAsGuest(tenantSlug.trim(), accessCode.trim() || undefined);
      ApiService.setGuestToken(session.guest_token);
      onGuestLogin(session);
    } catch (error: any) {
      const message =
        error.response?.status === 404
          ? 'Workspace not found. Please check the name and try again.'
          : error.response?.status === 403
          ? 'Guest access is not enabled for this workspace, or the access code is incorrect.'
          : 'Unable to start guest session. Please try again.';
      Alert.alert('Access Denied', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Guest Access</Text>
          <Text style={styles.subtitle}>
            Browse a workspace without creating an account
          </Text>

          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              ℹ️  Guest sessions are read-only. You won't be able to create or
              modify data.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Workspace Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. acme-meats"
              value={tenantSlug}
              onChangeText={setTenantSlug}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>Access Code (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter access code if required"
              value={accessCode}
              onChangeText={setAccessCode}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleGuestLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Connecting...' : 'Browse as Guest'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>← Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#7f8c8d',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoBanner: {
    backgroundColor: '#eaf4fb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
  },
  infoText: {
    fontSize: 13,
    color: '#2471a3',
    lineHeight: 18,
  },
  form: {
    width: '100%',
    maxWidth: 320,
  },
  label: {
    fontSize: 13,
    color: '#5d6d7e',
    marginBottom: 6,
    marginLeft: 2,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  primaryButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: '#3498db',
    fontSize: 15,
  },
});
