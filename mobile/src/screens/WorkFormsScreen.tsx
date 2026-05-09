import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ApiService } from '../services/ApiService';
import { toApiErrorText } from '../services/apiErrorPresentation';
import { RootStackParamList, WorkForm, Tenant, User, GuestUser } from '../types';
import { colors } from '../theme';

type WorkFormsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'WorkForms'>;

interface Props {
  navigation: WorkFormsScreenNavigationProp;
  tenant: Tenant;
  user: User | GuestUser;
  isGuest?: boolean;
}

function WorkFormCard({
  form,
  isGuest,
  onPress,
}: {
  form: WorkForm;
  isGuest: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {form.name}
        </Text>
        <View style={[styles.badge, form.is_active ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.badgeText, form.is_active ? styles.activeBadgeText : styles.inactiveBadgeText]}>
            {form.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {form.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {form.description}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>{form.node_count} node{form.node_count !== 1 ? 's' : ''}</Text>
        <Text style={styles.cardMeta}>
          Updated {new Date(form.updated_at).toLocaleDateString()}
        </Text>
      </View>

      {isGuest && (
        <View style={styles.guestNotice}>
          <Text style={styles.guestNoticeText}>👁 View only</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function WorkFormsScreen({ navigation, tenant, user, isGuest = false }: Props) {
  const [forms, setForms] = useState<WorkForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadForms = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await ApiService.getWorkForms();
      setForms(response.results);
    } catch (error) {
      if (!isRefresh) {
        Alert.alert(
          'Error',
          toApiErrorText(error, {
            fallbackMessage: 'Unable to load workforms. Please try again.',
          })
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const handleFormPress = (form: WorkForm) => {
    // Full editing is handled on the web Workform Editor.
    // On mobile, show a read-only summary (works for both guest + authed).
    navigation.navigate('WorkFormDetail', { id: form.id, isGuest });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading workforms…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>WorkForms</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {tenant.name}
          </Text>
        </View>
        {isGuest && (
          <View style={styles.guestBadge}>
            <Text style={styles.guestBadgeText}>GUEST</Text>
          </View>
        )}
      </View>

      {forms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No workforms yet</Text>
          <Text style={styles.emptySubtitle}>
            {isGuest
              ? 'This workspace has no workforms to browse.'
              : 'Create your first workform using the web editor.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={forms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WorkFormCard
              form={item}
              isGuest={isGuest}
              onPress={() => handleFormPress(item)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadForms(true)}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {isGuest && (
        <View style={styles.guestFooter}>
          <Text style={styles.guestFooterText}>
            Browsing as guest · Read-only access
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.secondary,
  },
  backBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backBtnText: {
    color: colors.textOnPrimary,
    fontSize: 22,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: colors.borderMuted,
    fontSize: 13,
  },
  guestBadge: {
    backgroundColor: colors.warning,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  guestBadgeText: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  list: {
    padding: 14,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 8,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
  },
  inactiveBadge: {
    backgroundColor: colors.surfaceAlt,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeBadgeText: {
    color: colors.successDark,
  },
  inactiveBadgeText: {
    color: colors.textMuted,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  guestNotice: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  guestNoticeText: {
    fontSize: 11,
    color: colors.warning,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  guestFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.warning,
    padding: 10,
    alignItems: 'center',
  },
  guestFooterText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
});
