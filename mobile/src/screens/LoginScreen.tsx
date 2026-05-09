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
  ScrollView
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ApiService } from '../services/ApiService';
import { toApiErrorText } from '../services/apiErrorPresentation';
import { RootStackParamList, User } from '../types';
import { useMobileTranslation } from '../i18n';
import { colors } from '../theme';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
  onLogin: (token: string, user: User) => void;
}

export default function LoginScreen({ navigation, onLogin }: Props) {
  const { t } = useMobileTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t.login.loginFailed, t.login.fillFields);
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.login({
        username: username.trim(),
        password: password
      });
      
      await onLogin(response.token, response.user);
      
    } catch (error) {
      Alert.alert(
        t.login.loginFailed,
        toApiErrorText(error, { fallbackMessage: t.login.invalidCredentials })
      );
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
          <Text style={styles.title}>{t.login.title}</Text>
          <Text style={styles.subtitle}>{t.login.subtitle}</Text>
          
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={t.login.username}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            
            <TextInput
              style={styles.input}
              placeholder={t.login.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
            
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? t.login.signingIn : t.login.signIn}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.alternateActions}>
            <TouchableOpacity
              style={styles.altButton}
              onPress={() => navigation.navigate('Guest')}
              disabled={loading}
              accessibilityLabel="Continue as guest"
            >
              <Text style={styles.altButtonText}>👁  Browse as Guest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.altButton}
              onPress={() => navigation.navigate('Invite', {})}
              disabled={loading}
              accessibilityLabel="Accept an invitation"
            >
              <Text style={styles.altButtonText}>✉️  Accept an Invite</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.versionText}>Version 1.0.0</Text>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  form: {
    width: '100%',
    maxWidth: 300,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    marginHorizontal: 10,
    color: colors.textMuted,
    fontSize: 13,
  },
  alternateActions: {
    width: '100%',
    maxWidth: 300,
  },
  altButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  altButtonText: {
    color: colors.textHint,
    fontSize: 15,
    fontWeight: '500',
  },
  versionText: {
    marginTop: 32,
    fontSize: 12,
    color: colors.textMuted,
  },
});
