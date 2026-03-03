/**
 * Background Task Hook (Phase 8.4: Background Job Processing)
 * 
 * React hook for triggering and monitoring Celery tasks.
 */
import { useState, useEffect, useCallback } from 'react';
import { businessApi } from '@/services/businessApi';

interface TaskStatus {
  task_id: string;
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY';
  result?: any;
  error?: string;
}

/**
 * Hook for background task execution and monitoring.
 */
export const useBackgroundTask = () => {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [polling, setPolling] = useState(false);

  const startTask = useCallback(async (
    taskName: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ) => {
    try {
      const response = await businessApi.post('/tasks/', {
        task: taskName,
        args,
        kwargs
      });

      setTaskId(response.data.task_id);
      setPolling(true);
      return response.data.task_id;
    } catch (err) {
      console.error('Failed to start task:', err);
      throw err;
    }
  }, []);

  const checkStatus = useCallback(async (id: string) => {
    try {
      const response = await businessApi.get(`/tasks/${id}/status/`);
      setStatus(response.data);
      
      // Stop polling if task completed
      if (['SUCCESS', 'FAILURE'].includes(response.data.status)) {
        setPolling(false);
      }

      return response.data;
    } catch (err) {
      console.error('Failed to check task status:', err);
      setPolling(false);
      throw err;
    }
  }, []);

  // Poll task status every 2 seconds
  useEffect(() => {
    if (!polling || !taskId) return;

    const interval = setInterval(() => {
      checkStatus(taskId);
    }, 2000);

    return () => clearInterval(interval);
  }, [polling, taskId, checkStatus]);

  return {
    startTask,
    checkStatus,
    taskId,
    status,
    isComplete: status && ['SUCCESS', 'FAILURE'].includes(status.status),
    isSuccess: status?.status === 'SUCCESS',
    isFailure: status?.status === 'FAILURE'
  };
};

/**
 * Hook for batch background tasks.
 */
export const useBatchBackgroundTasks = () => {
  const [tasks, setTasks] = useState<Map<string, TaskStatus>>(new Map());

  const startBatchTask = useCallback(async (
    taskName: string,
    batchItems: any[]
  ) => {
    try {
      const response = await businessApi.post('/tasks/batch/', {
        task: taskName,
        items: batchItems
      });

      const taskIds = response.data.task_ids;
      const newTasks = new Map(tasks);
      taskIds.forEach((id: string) => {
        newTasks.set(id, { task_id: id, status: 'PENDING' });
      });
      setTasks(newTasks);

      return taskIds;
    } catch (err) {
      console.error('Failed to start batch tasks:', err);
      throw err;
    }
  }, [tasks]);

  const checkBatchStatus = useCallback(async () => {
    const taskIds = Array.from(tasks.keys());
    if (taskIds.length === 0) return;

    try {
      const response = await businessApi.post('/tasks/batch-status/', {
        task_ids: taskIds
      });

      const newTasks = new Map(tasks);
      response.data.statuses.forEach((status: TaskStatus) => {
        newTasks.set(status.task_id, status);
      });
      setTasks(newTasks);
    } catch (err) {
      console.error('Failed to check batch status:', err);
    }
  }, [tasks]);

  const allComplete = Array.from(tasks.values()).every(
    task => ['SUCCESS', 'FAILURE'].includes(task.status)
  );

  return {
    startBatchTask,
    checkBatchStatus,
    tasks: Array.from(tasks.values()),
    allComplete
  };
};
