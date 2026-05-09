import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spin, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import { ambientAiApi, type ContextualSuggestion } from '@/services/aiService';

const { Text } = Typography;

type AmbientSuggestionsProps = {
  entityType: string;
  entityId: string;
};

export const AmbientSuggestions: React.FC<AmbientSuggestionsProps> = ({
  entityType,
  entityId,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ContextualSuggestion[]>([]);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const normalizedEntityType = String(entityType || '').trim();
    const normalizedEntityId = String(entityId || '').trim();

    if (!normalizedEntityType || !normalizedEntityId) {
      setSuggestions([]);
      return;
    }

    const load = async () => {
      setError(false);
      setLoading(true);
      try {
        const next = await ambientAiApi.getContextualSuggestions({
          entity_type: normalizedEntityType,
          entity_id: normalizedEntityId,
          current_state: {},
        });
        if (mounted) {
          setSuggestions(next);
        }
      } catch {
        if (mounted) {
          setSuggestions([]);
          setError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [entityId, entityType, retryCount]);

  const visibleSuggestions = useMemo(() => suggestions.slice(0, 3), [suggestions]);

  const handleAction = (suggestion: ContextualSuggestion) => {
    if (suggestion.target_url) {
      navigate(suggestion.target_url);
      return;
    }
    if (suggestion.prompt) {
      window.dispatchEvent(
        new CustomEvent('pm:ai-send', {
          detail: {
            message: suggestion.prompt,
            context: {
              entityType,
              entityId,
              suggestionAction: suggestion.action,
            },
          },
        }),
      );
    }
  };

  if (loading) {
    return (
      <div style={{ paddingTop: 12 }}>
        <Spin size="small" />
      </div>
    );
  }

  if (error && !loading && !visibleSuggestions.length) {
    return (
      <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgb(var(--color-warning) / 0.06)', border: '1px solid rgb(var(--color-warning) / 0.15)' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          ⚠️ AI suggestions unavailable —{' '}
          <Button type="link" size="small" onClick={() => { setRetryCount(c => c + 1); setError(false); }} style={{ padding: 0, fontSize: 12 }}>
            retry
          </Button>
        </Text>
      </div>
    );
  }

  if (!visibleSuggestions.length) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 14,
        border: '1px solid rgb(var(--color-border))',
        background: 'rgb(var(--color-surface))',
        boxShadow:
          'inset 0 0 0 1px rgb(var(--color-primary) / 0.12), 0 10px 24px rgb(var(--color-text-primary) / 0.08)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <Text strong style={{ color: 'rgb(var(--color-text-primary))' }}>
            ✨ AI Suggestions
          </Text>
          <Text type="secondary">
            Context-aware next-best actions for this record.
          </Text>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {visibleSuggestions.map((suggestion) => (
            <Button
              key={`${suggestion.action}-${suggestion.label}`}
              type="default"
              onClick={() => handleAction(suggestion)}
            >
              ✨ {suggestion.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AmbientSuggestions;
