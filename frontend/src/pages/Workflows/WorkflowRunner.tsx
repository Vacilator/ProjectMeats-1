/**
 * WorkflowRunner Page
 * 
 * Container page for executing workflows.
 * Manages workflow state and renders the DynamicFormEngine.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminClient } from '../../services/apiService';
import styled from 'styled-components';
import { DynamicFormEngine } from '../../features/system/DynamicFormEngine';
import { Card } from '../../components/ui/Card';
import { PageContainer } from '../../components/ui/PageContainer';

interface WorkflowRunResponse {
  id: string;
  workflow_slug: string;
  status: string;
  current_step_index: number;
  data_context: Record<string, any>;
}

interface SubmitStepResponse {
  complete: boolean;
  next_step_schema?: any;
  initial_data?: Record<string, any>;
  current_step_index?: number;
  message?: string;
}

const Container = styled.div`
  width: 100%;
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background-color: rgb(var(--color-border-light));
  border-radius: var(--radius-full);
  margin-bottom: 2rem;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ progress: number }>`
  width: ${props => props.progress}%;
  height: 100%;
  background-color: rgb(var(--color-primary));
  transition: width 0.3s ease;
`;

const StepIndicator = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const SuccessMessage = styled.div`
  padding: 2rem;
  text-align: center;
  background-color: rgba(var(--color-success), 0.1);
  border: 1px solid rgb(var(--color-success));
  border-radius: var(--radius-lg);
  color: rgb(var(--color-success));
`;

const SuccessTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const SuccessText = styled.p`
  font-size: 1rem;
  margin-bottom: 1.5rem;
`;

const ErrorMessage = styled.div`
  padding: 1.5rem;
  background-color: rgba(var(--color-danger), 0.1);
  border: 1px solid rgb(var(--color-danger));
  border-radius: var(--radius-lg);
  color: rgb(var(--color-danger));
  margin-bottom: 1.5rem;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
`;

export const WorkflowRunner: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [currentSchema, setCurrentSchema] = useState<any>(null);
  const [initialValues, setInitialValues] = useState<Record<string, any>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch workflow run details
  const { data: workflowRun, isLoading, refetch } = useQuery({
    queryKey: ['workflowRun', runId],
    queryFn: async () => {
      const response = await adminClient.get<WorkflowRunResponse>(
        `/admin/system-config/api/runs/${runId}/`
      );
      return response.data;
    },
    enabled: !!runId,
  });

  // Submit step mutation
  const submitStepMutation = useMutation({
    mutationFn: async (stepData: Record<string, any>) => {
      const response = await adminClient.post<SubmitStepResponse>(
        `/admin/system-config/api/runs/${runId}/submit_step/`,
        { step_data: stepData }
      );
      return response.data;
    },
    onSuccess: (data) => {
      if (data.complete) {
        setIsComplete(true);
        setError(null);
      } else {
        setCurrentSchema(data.next_step_schema);
        setInitialValues(data.initial_data || {});
        setError(null);
        // Refetch to update progress
        refetch();
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'An error occurred while submitting the form';
      setError(message);
    },
  });

  // Load initial schema when workflow run is fetched
  useEffect(() => {
    if (workflowRun && !currentSchema && workflowRun.status === 'IN_PROGRESS') {
      // Fetch the current step schema
      // For simplicity, we'll construct it from the workflow run data
      // In production, you'd have an endpoint to get the current step schema
      
      // TODO: Replace with actual API call to get current step schema
      // For now, use a placeholder
      setCurrentSchema({
        step_index: workflowRun.current_step_index,
        name: `${workflowRun.workflow_slug} - Step ${workflowRun.current_step_index + 1}`,
        description: 'Please fill out the form below',
        fields: [], // Should be populated from API
      });
    }
  }, [workflowRun, currentSchema]);

  const handleSubmit = (data: Record<string, any>) => {
    submitStepMutation.mutate(data);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <PageContainer title="Loading Workflow...">
        <Container>
          <LoadingSpinner>Loading workflow...</LoadingSpinner>
        </Container>
      </PageContainer>
    );
  }

  if (!workflowRun) {
    return (
      <PageContainer title="Workflow Not Found">
        <Container>
          <ErrorMessage>
            Workflow run not found. It may have been deleted or you don't have permission to access it.
          </ErrorMessage>
        </Container>
      </PageContainer>
    );
  }

  if (isComplete || workflowRun.status === 'COMPLETED') {
    return (
      <PageContainer title="Workflow Complete">
        <Container>
          <Card padding="lg">
            <SuccessMessage>
              <SuccessTitle>✓ Workflow Completed!</SuccessTitle>
              <SuccessText>
                Your workflow has been completed successfully.
              </SuccessText>
              <button onClick={handleBackToDashboard}>
                Back to Dashboard
              </button>
            </SuccessMessage>
          </Card>
        </Container>
      </PageContainer>
    );
  }

  const progress = currentSchema
    ? ((currentSchema.step_index + 1) / (currentSchema.step_index + 2)) * 100
    : 0;

  return (
    <PageContainer title={`Workflow: ${workflowRun.workflow_slug}`}>
      <Container>
        <Header>
          <Title>{workflowRun.workflow_slug}</Title>
          <Subtitle>Complete the steps below to finish this workflow</Subtitle>
        </Header>

        <ProgressBar>
          <ProgressFill progress={progress} />
        </ProgressBar>

        {currentSchema && (
          <StepIndicator>
            Step {currentSchema.step_index + 1}
          </StepIndicator>
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {currentSchema && (
          <Card padding="lg">
            <DynamicFormEngine
              schema={currentSchema}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={submitStepMutation.isPending}
            />
          </Card>
        )}

        {!currentSchema && !isLoading && (
          <Card padding="lg">
            <LoadingSpinner>Loading form schema...</LoadingSpinner>
          </Card>
        )}
      </Container>
    </PageContainer>
  );
};

export default WorkflowRunner;
