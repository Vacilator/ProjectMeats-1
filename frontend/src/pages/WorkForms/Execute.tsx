/**
 * WorkForm Execute Page
 *
 * Starts a TenantWorkForm execution (runtime), then routes the user to
 * the execution details page.
 */

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { showAlert } from '@/utils/uiDialogs';
import { executeTenantWorkForm, type WorkFormExecuteResponse } from '@/services/workformsApi';

export const ExecuteWorkForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
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

      return executeTenantWorkForm(id, initialData);
    },
    onSuccess: async (data: WorkFormExecuteResponse) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workforms-catalog-items'] }),
        queryClient.invalidateQueries({ queryKey: ['workform-executions', 'active'] }),
      ]);

      if (data.status === 'failed') {
        showAlert({
          type: 'error',
          title: 'Execution failed',
          content: data.error_message || 'This workflow failed to execute.',
        });
      }

      navigate(`/workforms/executions/${data.id}`, { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to start workflow.';
      showAlert({ type: 'error', title: 'Error', content: msg });
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
    <div>
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
};

export default ExecuteWorkForm;
