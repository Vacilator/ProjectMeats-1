/**
 * WorkForm Execute Page
 *
 * Starts a TenantWorkForm execution (runtime), then routes the user to
 * the execution details page.
 */

import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { showAlert } from '@/utils/uiDialogs';
import { getWorkformsErrorUi } from '@/features/workforms/workformsErrors';
import { ApiErrorContent } from '@/components/errors/ApiErrorContent';
import {
  createFormSubmission,
  executeTenantWorkForm,
  type WorkFormExecuteResponse,
} from '@/services/workformsApi';

type ExecuteResult =
  | { kind: 'workform'; execution: WorkFormExecuteResponse }
  | { kind: 'form'; submissionId: string };

export const ExecuteWorkForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workforms-catalog-items'] }),
        queryClient.invalidateQueries({ queryKey: ['workform-executions', 'active'] }),
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
      const ui = getWorkformsErrorUi(err, 'execute.start');
      showAlert({
        type: 'error',
        title: ui.title,
        content: <ApiErrorContent error={err} fallbackMessage={ui.message} />,
      });
      navigate('/workforms/catalog', { replace: true });
    },
  });

  useEffect(() => {
    if (!mutation.isPending && !mutation.isSuccess) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div data-testid="workforms-execute-page">
      <div data-testid="workforms-execute-loading">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </div>
  );
};

export default ExecuteWorkForm;
