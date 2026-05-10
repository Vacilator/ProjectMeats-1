import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import { ApiService } from '../services/ApiService';
import { toApiErrorText } from '../services/apiErrorPresentation';
import { RootStackParamList, WorkForm, WorkFormExecution, WorkflowDefinition } from '../types';
import { colors } from '../theme';

type WorkFormDetailNavigationProp = StackNavigationProp<RootStackParamList, 'WorkFormDetail'>;
type WorkFormDetailRouteProp = RouteProp<RootStackParamList, 'WorkFormDetail'>;

interface Props {
  navigation: WorkFormDetailNavigationProp;
  route: WorkFormDetailRouteProp;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString();
}

function getDefinitionCounts(definition?: WorkflowDefinition) {
  return {
    nodes: Array.isArray(definition?.nodes) ? definition!.nodes.length : 0,
    edges: Array.isArray(definition?.edges) ? definition!.edges.length : 0,
  };
}

function getDefinitionPreview(definition?: WorkflowDefinition): { preview: string; hint: string } | null {
  if (!definition) {
    return null;
  }

  // Keep this intentionally small/fast (avoid stringifying a huge workflow graph).
  const nodeCount = Array.isArray(definition.nodes) ? definition.nodes.length : 0;
  const edgeCount = Array.isArray(definition.edges) ? definition.edges.length : 0;

  const previewObject = {
    _meta: {
      node_count: nodeCount,
      edge_count: edgeCount,
      preview_limit: { nodes: 2, edges: 2 },
    },
    nodes: Array.isArray(definition.nodes) ? definition.nodes.slice(0, 2) : [],
    edges: Array.isArray(definition.edges) ? definition.edges.slice(0, 2) : [],
    viewport: definition.viewport,
  };

  let json = '';
  try {
    json = JSON.stringify(previewObject, null, 2);
  } catch {
    json = '{ "error": "Unable to render workflow preview" }';
  }

  const maxChars = 900;
  const preview = json.length > maxChars ? `${json.slice(0, maxChars)}\n…` : json;
  const hint = 'Preview shows up to 2 nodes and 2 edges.';

  return { preview, hint };
}

export default function WorkFormDetailScreen({ navigation, route }: Props) {
  const { id, isGuest = false } = route.params;

  const [form, setForm] = useState<WorkForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executions, setExecutions] = useState<WorkFormExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const detail = await ApiService.getWorkForm(id);
        setForm(detail);

        // Load recent executions (non-blocking)
        setExecutionsLoading(true);
        ApiService.getWorkFormExecutions(id)
          .then((resp) => setExecutions(resp.results.slice(0, 5)))
          .catch(() => setExecutions([]))
          .finally(() => setExecutionsLoading(false));
      } catch (error) {
        setError(
          toApiErrorText(error, {
            fallbackMessage: 'Unable to load workform details.',
          })
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleExecute = useCallback(async () => {
    if (isGuest) {
      Alert.alert('Guest mode', 'WorkForm execution is disabled in guest mode.');
      return;
    }

    if (executing) {
      return;
    }

    setExecuting(true);
    try {
      const execution = await ApiService.executeWorkForm(id, {});
      Alert.alert('Execution started', `Execution ID: ${execution.id}`);
      await load(true);
    } catch (error) {
      Alert.alert(
        'Error',
        toApiErrorText(error, {
          fallbackMessage: 'Unable to start WorkForm execution. Please try again.',
        })
      );
    } finally {
      setExecuting(false);
    }
  }, [executing, id, isGuest, load]);

  const statusLabel = form ? (form.is_active ? 'Active' : 'Inactive') : '—';
  const headerSubtitle = isGuest ? 'Guest · View only' : 'Run and view details';

  const definitionCounts = useMemo(() => getDefinitionCounts(form?.workflow_definition), [form?.workflow_definition]);
  const definitionPreview = useMemo(() => getDefinitionPreview(form?.workflow_definition), [form?.workflow_definition]);

  if (loading && !form) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading workform…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header} accessibilityLabel="WorkForm detail header">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the WorkForms list"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
            {form?.name ?? 'WorkForm'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>
        <View
          style={[styles.badge, form?.is_active ? styles.activeBadge : styles.inactiveBadge]}
          accessibilityLabel={`Status ${statusLabel}`}
        >
          <Text style={[styles.badgeText, form?.is_active ? styles.activeBadgeText : styles.inactiveBadgeText]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => load(false)}
              accessibilityLabel="Retry"
              accessibilityHint="Try loading the workform details again"
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {form ? (
          <View style={styles.card} accessibilityLabel="WorkForm summary section">
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Summary
            </Text>

            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} testID="workform-title">
                {form.name}
              </Text>
              <View style={[styles.badge, form.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                <Text style={[styles.badgeText, form.is_active ? styles.activeBadgeText : styles.inactiveBadgeText]}>
                  {statusLabel}
                </Text>
              </View>
            </View>

            <Text style={styles.cardDescription}>{form.description ? form.description : '—'}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Nodes</Text>
              <Text style={styles.metaValue}>{form.node_count}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Edges</Text>
              <Text style={styles.metaValue}>{form.edge_count ?? definitionCounts.edges}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Updated</Text>
              <Text style={styles.metaValue}>{formatDate(form.updated_at)}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Last executed</Text>
              <Text style={styles.metaValue}>{formatDate(form.last_executed_at)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.executeBtn, (isGuest || executing) && styles.executeBtnDisabled]}
              onPress={handleExecute}
              disabled={isGuest || executing}
              accessibilityLabel={isGuest ? 'Run WorkForm disabled' : 'Run WorkForm'}
              accessibilityHint={
                isGuest
                  ? 'WorkForm execution is disabled in guest mode'
                  : 'Starts a server-side WorkForm execution'
              }
              testID="workform-execute"
            >
              <Text style={styles.executeBtnText}>{executing ? 'Starting…' : 'Run WorkForm'}</Text>
            </TouchableOpacity>

            {isGuest ? <Text style={styles.executeHint}>Execution is disabled in guest mode.</Text> : null}
          </View>
        ) : null}

        {form ? (
          <View style={styles.card} accessibilityLabel="Workflow definition preview section">
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Workflow Definition (preview)
            </Text>

            {!form.workflow_definition ? (
              <Text style={styles.sectionBody}>No workflow definition is available for this workform.</Text>
            ) : (
              <>
                <Text style={styles.sectionBody}>
                  Nodes: {definitionCounts.nodes} · Edges: {definitionCounts.edges}
                </Text>
                {definitionPreview ? <Text style={styles.sectionBody}>{definitionPreview.hint}</Text> : null}
                {definitionPreview ? <Text style={styles.codeBlock}>{definitionPreview.preview}</Text> : null}
              </>
            )}
          </View>
        ) : null}

        {form ? (
          <View style={styles.card} accessibilityLabel="Recent executions section">
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Recent Executions
            </Text>

            {executionsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : executions.length === 0 ? (
              <Text style={styles.sectionBody}>No executions yet.</Text>
            ) : (
              executions.map((exec) => (
                <View key={exec.id} style={styles.executionRow}>
                  <View style={styles.executionInfo}>
                    <View
                      style={[
                        styles.executionDot,
                        exec.status === 'completed'
                          ? styles.dotSuccess
                          : exec.status === 'failed'
                            ? styles.dotError
                            : styles.dotPending,
                      ]}
                    />
                    <Text style={styles.executionStatus}>{exec.status}</Text>
                  </View>
                  <Text style={styles.executionDate}>
                    {formatDate(exec.started_at)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
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
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    paddingRight: 10,
  },
  cardDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activeBadge: {
    backgroundColor: colors.successLighter,
  },
  inactiveBadge: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeBadgeText: {
    color: colors.success,
  },
  inactiveBadgeText: {
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  codeBlock: {
    marginTop: 10,
    backgroundColor: colors.textDark,
    color: colors.infoLight,
    fontSize: 12,
    padding: 10,
    borderRadius: 8,
  },
  errorCard: {
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.errorLightBorder,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.errorDark,
    marginBottom: 6,
  },
  errorText: {
    color: colors.errorDarker,
    fontSize: 13,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.errorDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: colors.textOnPrimary,
    fontWeight: 'bold',
  },
  executeBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  executeBtnDisabled: {
    opacity: 0.5,
  },
  executeBtnText: {
    color: colors.textOnPrimary,
    fontWeight: 'bold',
  },
  executeHint: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 12,
  },
  executionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  executionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  executionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotSuccess: {
    backgroundColor: colors.success,
  },
  dotError: {
    backgroundColor: colors.errorDark,
  },
  dotPending: {
    backgroundColor: colors.warning,
  },
  executionStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  executionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
