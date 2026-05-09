import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { ApiService } from '../services/ApiService';
import { getApiErrorPresentation, toApiErrorText } from '../services/apiErrorPresentation';
import { RootStackParamList, TenantInvite, User } from '../types';
import { colors } from '../theme';

type InviteScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Invite'>;
type InviteScreenRouteProp = RouteProp<RootStackParamList, 'Invite'>;

interface Props {
  navigation: InviteScreenNavigationProp;
  route: InviteScreenRouteProp;
  onInviteAccepted: (token: string, user: User) => void;
}

export default function InviteScreen({ navigation, route, onInviteAccepted }: Props) {
  const inviteToken = route.params?.token ?? '';

  const [tokenInput, setTokenInput] = useState(inviteToken);
  const [invite, setInvite] = useState<TenantInvite | null>(null);
  const [validating, setValidating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Account creation fields (shown after invite is validated)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const validateToken = useCallback(async (token: string) => {
    if (!token.trim()) {
      Alert.alert('Error', 'Please enter an invite token');
      return;
    }
    setValidating(true);
    try {
      const result = await ApiService.validateInvite(token.trim());
      setInvite(result);
      // Suggest a username derived from the invited email.
      const suggestion = result.email.includes('@') ? result.email.split('@')[0] : result.email;
      setUsername(suggestion);
    } catch (error) {
      const presentation = getApiErrorPresentation(error, {
        fallbackMessage: 'Unable to validate invite. Please try again.',
      });
      Alert.alert(
        'Invalid Invite',
        presentation.status === 404
          ? 'This invite token was not found. Please check the link or code and try again.'
          : presentation.friendlyMessage
      );
    } finally {
      setValidating(false);
    }
  }, []);

  useEffect(() => {
    if (inviteToken) {
      validateToken(inviteToken);
    }
  }, [inviteToken, validateToken]);

  const handleAcceptInvite = async () => {
    if (!invite) return;

    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setAccepting(true);
    try {
      const response = await ApiService.acceptInvite({
        token: invite.token,
        username: username.trim(),
        email: invite.email,
        password,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      });
      onInviteAccepted(response.token, response.user);
    } catch (error) {
      Alert.alert(
        'Error',
        toApiErrorText(error, {
          fallbackMessage: 'Unable to accept the invite. Please try again.',
        })
      );
    } finally {
      setAccepting(false);
    }
  };

  // --- Token entry step ---
  if (!invite) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Accept Invite</Text>
            <Text style={styles.subtitle}>
              Enter the invite token from your invitation email
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Invite Token</Text>
              <TextInput
                style={styles.input}
                placeholder="Paste your invite token here"
                value={tokenInput}
                onChangeText={setTokenInput}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!validating}
                multiline
              />

              <TouchableOpacity
                style={[styles.primaryButton, validating && styles.disabledButton]}
                onPress={() => validateToken(tokenInput)}
                disabled={validating}
              >
                {validating ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Validate Invite</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                disabled={validating}
              >
                <Text style={styles.backButtonText}>← Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- Account creation step ---
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Your Account</Text>

          <View style={styles.inviteBanner}>
            <Text style={styles.inviteBannerTitle}>
              You've been invited to{' '}
              <Text style={styles.tenantName}>{invite.tenant.name}</Text>
            </Text>
            <Text style={styles.inviteBannerMeta}>
              Role: <Text style={styles.roleText}>{invite.role}</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Username / Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="Choose a username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!accepting}
            />

            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Min 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!accepting}
            />

            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              value={firstName}
              onChangeText={setFirstName}
              editable={!accepting}
            />

            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              value={lastName}
              onChangeText={setLastName}
              editable={!accepting}
            />

            <TouchableOpacity
              style={[styles.primaryButton, accepting && styles.disabledButton]}
              onPress={handleAcceptInvite}
              disabled={accepting}
            >
              {accepting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Join Workspace</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setInvite(null)}
              disabled={accepting}
            >
              <Text style={styles.backButtonText}>← Use a different token</Text>
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
  inviteBanner: {
    backgroundColor: colors.successLight,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  inviteBannerTitle: {
    fontSize: 15,
    color: colors.successDark,
    marginBottom: 4,
    fontWeight: '500',
  },
  tenantName: {
    fontWeight: 'bold',
  },
  inviteBannerMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  roleText: {
    color: colors.primaryDark,
    fontWeight: '500',
  },
  form: {
    width: '100%',
    maxWidth: 320,
  },
  label: {
    fontSize: 13,
    color: colors.textHint,
    marginBottom: 6,
    marginLeft: 2,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.primary,
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
