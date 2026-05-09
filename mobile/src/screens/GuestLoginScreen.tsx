import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ApiService } from '../services/ApiService';
import { getApiErrorPresentation } from '../services/apiErrorPresentation';
import { RootStackParamList, GuestSession } from '../types';
import { colors } from '../theme';

type GuestLoginNavigationProp = StackNavigationProp<RootStackParamList, 'Guest'>;

interface Props {
  navigation: GuestLoginNavigationProp;
  onGuestLogin: (session: GuestSession) => Promise<void>;
}

export default function GuestLoginScreen({ navigation, onGuestLogin }: Props) {
  // Backend guest mode logs into a pre-configured guest tenant.
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      // Backend endpoint does not accept tenant slug/access code; it logs into a configured guest tenant.
      const session = await ApiService.guestLogin();
      await onGuestLogin(session);
    } catch (error) {
      const presentation = getApiErrorPresentation(error, {
        fallbackMessage: 'Unable to start guest session. Please try again.',
      });
      const message =
        presentation.status === 404
          ? 'Guest account is not configured on the server.'
          : presentation.status === 503
          ? 'Guest access is temporarily unavailable.'
          : presentation.friendlyMessage;
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
    backgroundColor: colors.background,
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
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  infoBanner: {
    backgroundColor: colors.infoBanner,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
  },
  infoText: {
    fontSize: 13,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  form: {
    width: '100%',
    maxWidth: 320,
  },

  primaryButton: {
    backgroundColor: colors.success,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 15,
  },
});
