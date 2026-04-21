import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import { ApiService } from '../services/ApiService';
import { RootStackParamList, WorkForm, WorkflowDefinition } from '../types';

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
  const { id } = route.params;

  const [form, setForm] = useState<WorkForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } catch {
        setError('Unable to load workform details.');
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

  const statusLabel = form ? (form.is_active ? 'Active' : 'Inactive') : '—';

  const definitionCounts = useMemo(() => getDefinitionCounts(form?.workflow_definition), [form?.workflow_definition]);
  const definitionPreview = useMemo(() => getDefinitionPreview(form?.workflow_definition), [form?.workflow_definition]);

  if (loading && !form) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3498db" />
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
            Read-only summary
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#3498db" />}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#7f8c8d',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#2c3e50',
  },
  backBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 22,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#bdc3c7',
    fontSize: 13,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
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
    color: '#2c3e50',
    paddingRight: 10,
  },
  cardDescription: {
    color: '#7f8c8d',
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
    backgroundColor: '#d5f5e3',
  },
  inactiveBadge: {
    backgroundColor: '#ecf0f1',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeBadgeText: {
    color: '#27ae60',
  },
  inactiveBadgeText: {
    color: '#7f8c8d',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  metaLabel: {
    color: '#7f8c8d',
    fontSize: 13,
  },
  metaValue: {
    color: '#2c3e50',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  sectionBody: {
    color: '#7f8c8d',
    fontSize: 13,
    lineHeight: 18,
  },
  codeBlock: {
    marginTop: 10,
    backgroundColor: '#0b1020',
    color: '#e8eefc',
    fontSize: 12,
    padding: 10,
    borderRadius: 8,
  },
  errorCard: {
    backgroundColor: '#fdecea',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c0392b',
    marginBottom: 6,
  },
  errorText: {
    color: '#922b21',
    fontSize: 13,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#c0392b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
