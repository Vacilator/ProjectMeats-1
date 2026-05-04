/**
 * WorkForm Execute Page
 *
 * Starts a TenantWorkForm execution (runtime), then routes the user to
 * the execution details page.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Skeleton, Space } from 'antd';
import { showAlert } from '@/utils/uiDialogs';
import { getWorkformsErrorUi } from '@/features/workforms/workformsErrors';
import { ApiErrorContent } from '@/components/errors/ApiErrorContent';
import { ApiServiceError } from '@/services/apiErrors';
import {
  createFormSubmission,
  executeTenantWorkForm,
  type WorkFormExecuteResponse,
} from '@/services/workformsApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

type ExecuteResult =
  | { kind: 'workform'; execution: WorkFormExecuteResponse }
  | { kind: 'form'; submissionId: string };

function isCircuitBreakerExecutionError(error: unknown): boolean {
  if (error instanceof ApiServiceError) {
    const data = error.responseData as Record<string, unknown> | null;
    return error.status === 503 && (data?.code === 'CIRCUIT_BREAKER' || data?.error_code === 'CIRCUIT_BREAKER');
  }

  const e = error as { response?: { status?: number; data?: Record<string, unknown> } } | null;
  return (
    e?.response?.status === 503 &&
    (e.response?.data?.code === 'CIRCUIT_BREAKER' || e.response?.data?.error_code === 'CIRCUIT_BREAKER')
  );
}

function getCircuitBreakerRetryAfter(error: unknown): number | undefined {
  if (error instanceof ApiServiceError) {
    const retryAfter = Number((error.responseData as Record<string, unknown> | null)?.retry_after);
    return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
  }

  const retryAfter = Number((error as { response?: { data?: Record<string, unknown> } } | null)?.response?.data?.retry_after);
  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
}

export const ExecuteWorkForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startedExecutionRef = useRef<string | null>(null);
  const [executionError, setExecutionError] = useState<unknown>(null);

  const allowLegacyFallback = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return sp.get('legacy') === '1';
  }, [location.search]);

  const mutation = useMutation({
    mutationFn: async (): Promise<ExecuteResult> => {
      if (!id) throw new Error('Missing workform id');

      let initialData: Record<string, unknown> = {};
      try {
        const raw = sessionStorage.getItem('pm.activeRecordContext');
        if (raw) {
          const parsed = JSON.parse(raw);
          const activeRecord = parsed?.activeRecord;
          if (activeRecord?.type && activeRecord?.id != null) {
            initialData = {
              entity_type: String(activeRecord.type),
              entity_id: String(activeRecord.id),
            };
          }
        }
      } catch {
        // Ignore malformed session payload
      }

      try {
        const execution = await executeTenantWorkForm(id, initialData);
        return { kind: 'workform', execution };
      } catch (err: any) {
        // Backward compatibility is explicit only: older links may point at legacy form IDs.
        // Do NOT silently run legacy execution unless the caller opts in.
        if (allowLegacyFallback && err?.response?.status === 404) {
          const submission = await createFormSubmission(id);
          return { kind: 'form', submissionId: submission.id };
        }
        throw err;
      }
    },
    onSuccess: async (result: ExecuteResult) => {
      setExecutionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: withTenantQueryKey('workforms-catalog-items') }),
        queryClient.invalidateQueries({ queryKey: withTenantQueryKey('workform-executions', 'active') }),
      ]);

      if (result.kind === 'form') {
        navigate(`/workforms/in-progress/${result.submissionId}`, { replace: true });
        return;
      }

      const data = result.execution;
      if (data.status === 'failed') {
        showAlert({
          type: 'error',
          title: 'Execution failed',
          content: data.error_message || 'This WorkForm failed to run.',
        });
      }

      navigate(`/workforms/executions/${data.id}`, { replace: true });
    },
    onError: (err: any) => {
      setExecutionError(err);
    },
  });

  const startExecution = useCallback(async () => {
    if (!id) return;

    setExecutionError(null);
    try {
      await mutation.mutateAsync();
    } catch {
      // onError handles local state; keep the rejection contained to this surface.
    }
  }, [id, mutation]);

  useEffect(() => {
    if (!id || startedExecutionRef.current === id) {
      return;
    }

    startedExecutionRef.current = id;
    void startExecution();
  }, [id, startExecution]);

  const executionErrorUi = executionError ? getWorkformsErrorUi(executionError, 'execute.start') : null;
  const isCircuitBreakerError = executionError ? isCircuitBreakerExecutionError(executionError) : false;
  const retryAfterSeconds = executionError ? getCircuitBreakerRetryAfter(executionError) : undefined;

  return (
    <div data-testid="workforms-execute-page">
      {executionError && executionErrorUi ? (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            data-testid={isCircuitBreakerError ? 'workforms-execute-circuit-alert' : 'workforms-execute-error-alert'}
            type={isCircuitBreakerError ? 'warning' : 'error'}
            showIcon
            title={executionErrorUi.title}
            description={
              isCircuitBreakerError ? (
                <>
                  {executionErrorUi.message}
                  {retryAfterSeconds ? ` Please wait about ${retryAfterSeconds} seconds before retrying.` : ''}
                </>
              ) : (
                <ApiErrorContent error={executionError} fallbackMessage={executionErrorUi.message} />
              )
            }
          />
          <Space>
            <Button
              type="primary"
              onClick={() => {
                mutation.reset();
                void startExecution();
              }}
            >
              Try again
            </Button>
            <Button onClick={() => navigate('/workforms/catalog', { replace: true })}>Back to catalog</Button>
          </Space>
        </Space>
      ) : (
        <div data-testid="workforms-execute-loading">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      )}
    </div>
  );
};

export default ExecuteWorkForm;
