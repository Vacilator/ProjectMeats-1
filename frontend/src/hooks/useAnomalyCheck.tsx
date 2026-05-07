/**
 * useAnomalyCheck - Pre-save anomaly detection hook
 *
 * Integrates with the product anomaly baseline service to provide
 * soft-warning validation before form submission.
 *
 * Features:
 * - Checks submitted values against 90-day baselines
 * - Shows modal confirmation for anomalous values
 * - Allows explicit user override
 * - Graceful degradation when service unavailable
 */

import { useCallback, useState } from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface AnomalyResult {
  product_id: string;
  field_name: string;
  submitted_value: number;
  baseline_mean: number;
  baseline_stddev: number;
  deviation_sigma: number;
  severity: 'normal' | 'warning' | 'critical';
  message: string;
  baseline_context: Record<string, unknown>;
  requires_confirmation: boolean;
}

export interface AnomalyResponse {
  results: AnomalyResult[];
  has_warnings: boolean;
  has_critical: boolean;
  requires_confirmation: boolean;
}

export interface AnomalyCheckConfig {
  entityType: string;
  entityId?: string;
  enabled?: boolean;
  numericFields?: string[];
}

export interface AnomalyCheckHook {
  checkBeforeSave: (
    payload: Record<string, unknown>,
  ) => Promise<{ proceed: boolean; overridden: boolean }>;
  isChecking: boolean;
  lastResult: AnomalyResponse | null;
}

// -------------------------------------------------------------------
// Hook
// -------------------------------------------------------------------

export function useAnomalyCheck(config: AnomalyCheckConfig): AnomalyCheckHook {
  const { entityType, entityId, enabled = true, numericFields } = config;
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<AnomalyResponse | null>(null);

  const checkBeforeSave = useCallback(
    async (
      payload: Record<string, unknown>,
    ): Promise<{ proceed: boolean; overridden: boolean }> => {
      if (!enabled) {
        return { proceed: true, overridden: false };
      }

      // Extract numeric fields from payload
      const fieldsToCheck: Array<{ field_name: string; value: number }> = [];
      const fieldsOfInterest =
        numericFields ?? Object.keys(payload);

      for (const key of fieldsOfInterest) {
        const val = payload[key];
        if (typeof val === 'number' && isFinite(val)) {
          fieldsToCheck.push({ field_name: key, value: val });
        } else if (typeof val === 'string') {
          const parsed = parseFloat(val);
          if (isFinite(parsed)) {
            fieldsToCheck.push({ field_name: key, value: parsed });
          }
        }
      }

      if (fieldsToCheck.length === 0) {
        return { proceed: true, overridden: false };
      }

      setIsChecking(true);

      try {
        const response = await businessApi.post<AnomalyResponse>(
          '/ai-assistant/anomaly/check/',
          {
            entity_type: entityType,
            entity_id: entityId ?? '',
            fields: fieldsToCheck,
          },
        );

        const data = response.data;
        setLastResult(data);

        if (!data.requires_confirmation) {
          return { proceed: true, overridden: false };
        }

        // Show confirmation modal
        const anomalous = data.results.filter(
          (r) => r.severity === 'warning' || r.severity === 'critical',
        );

        return new Promise((resolve) => {
          Modal.confirm({
            title: 'Anomaly Detected',
            icon: <ExclamationCircleOutlined />,
            content: (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <p style={{ marginBottom: 12 }}>
                  The following values differ significantly from recent history:
                </p>
                {anomalous.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      marginBottom: 8,
                      borderRadius: 6,
                      border: `1px solid ${a.severity === 'critical' ? '#fecaca' : '#fef3c7'}`,
                      background:
                        a.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color:
                          a.severity === 'critical' ? '#dc2626' : '#d97706',
                      }}
                    >
                      {a.field_name}: {a.submitted_value}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {a.message}
                    </div>
                  </div>
                ))}
                <p
                  style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}
                >
                  Do you want to proceed with these values?
                </p>
              </div>
            ),
            okText: 'Proceed Anyway',
            cancelText: 'Go Back & Edit',
            okButtonProps: {
              danger: anomalous.some((a) => a.severity === 'critical'),
            },
            onOk: () => resolve({ proceed: true, overridden: true }),
            onCancel: () => resolve({ proceed: false, overridden: false }),
          });
        });
      } catch {
        // Graceful degradation: if service fails, allow save
        return { proceed: true, overridden: false };
      } finally {
        setIsChecking(false);
      }
    },
    [enabled, entityType, entityId, numericFields],
  );

  return { checkBeforeSave, isChecking, lastResult };
}

export default useAnomalyCheck;
