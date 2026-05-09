/**
 * Workflow Center - Available Workflows Catalog
 * 
 * The "App Store" view where users discover and launch workflows.
 * Displays published blueprints as cards with "Start Workflow" actions.
 */
import React, { useState } from 'react';
import { Skeleton } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { showAlert } from '@/utils/uiDialogs';
import { adminClient } from '../../services/apiService';
import styled from 'styled-components';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { withTenantQueryKey } from '../../utils/queryKeys';
import { logger } from '@/utils/logger';
import { formatDateLocal } from '@/utils/formatters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface Blueprint {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface StartWorkflowResponse {
  run_id: string;
  step_schema: any;
  message: string;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: rgb(var(--color-text-secondary));
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.3;
`;

const EmptyStateTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: rgb(var(--color-text-primary));
`;

const EmptyStateDescription = styled.p`
  font-size: 1rem;
  max-width: 500px;
  margin: 0 auto;
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem;
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
`;

const ErrorState = styled.div`
  padding: 1.5rem;
  background-color: rgba(var(--color-danger), 0.1);
  border: 1px solid rgb(var(--color-danger));
  border-radius: var(--radius-lg);
  color: rgb(var(--color-danger));
`;

const BlueprintCardContent = styled.div`
  min-height: 60px;
  color: rgb(var(--color-text-secondary));
  font-size: 0.875rem;
`;

const BlueprintMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgb(var(--color-text-muted));
  margin-top: 0.5rem;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

export const WorkflowList: React.FC = () => {
  useDocumentTitle('Workflows');
  const navigate = useNavigate();
  const [startingWorkflow, setStartingWorkflow] = useState<string | null>(null);

  // Fetch available workflows
  const { 
    data: blueprints, 
    isLoading, 
    error,
    refetch 
  } = useQuery<Blueprint[]>({
    queryKey: withTenantQueryKey('availableWorkflows'),
    queryFn: async () => {
      const response = await adminClient.get<Blueprint[]>(
        '/admin/system-config/api/available-workflows/'
      );
      return response.data;
    },
  });

  // Start workflow mutation
  const startWorkflowMutation = useMutation({
    mutationFn: async (blueprintSlug: string) => {
      const response = await adminClient.post<StartWorkflowResponse>(
        '/admin/system-config/api/runs/',
        { blueprint_slug: blueprintSlug }
      );
      return response.data;
    },
    onSuccess: (data) => {
      navigate(`/workflows/run/${data.run_id}`);
    },
    onError: (error: any) => {
      logger.error('Failed to start workflow:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        content: error.response?.data?.error || 'Failed to start workflow. Please try again.',
      });
      setStartingWorkflow(null);
    },
  });

  const handleStartWorkflow = (slug: string) => {
    setStartingWorkflow(slug);
    startWorkflowMutation.mutate(slug);
  };

  return (
    <PageContainer 
      title="Workflows" 
      description="Browse and start available workflows"
      maxWidth="xl"
    >
      {isLoading && (
        <LoadingState>
          <Skeleton active paragraph={{ rows: 8 }} />
        </LoadingState>
      )}

      {error && (
        <ErrorState>
          <strong>Error loading workflows</strong>
          <p style={{ marginTop: '0.5rem' }}>
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            style={{ marginTop: '1rem' }}
          >
            Try Again
          </Button>
        </ErrorState>
      )}

      {!isLoading && !error && blueprints && blueprints.length === 0 && (
        <Card>
          <EmptyState>
            <EmptyStateIcon>📋</EmptyStateIcon>
            <EmptyStateTitle>No Workflows Available</EmptyStateTitle>
            <EmptyStateDescription>
              There are currently no published workflows available. 
              Contact your system administrator to publish workflows.
            </EmptyStateDescription>
          </EmptyState>
        </Card>
      )}

      {!isLoading && !error && blueprints && blueprints.length > 0 && (
        <Grid>
          {blueprints.map((blueprint) => (
            <Card key={blueprint.id}>
              <CardHeader title={blueprint.name} />
              <CardContent>
                <BlueprintCardContent>
                  <div>
                    <strong>Slug:</strong> {blueprint.slug}
                  </div>
                  <BlueprintMeta>
                    <MetaItem>
                      📅 Added {formatDateLocal(blueprint.created_at)}
                    </MetaItem>
                  </BlueprintMeta>
                </BlueprintCardContent>
              </CardContent>
              <CardFooter>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => handleStartWorkflow(blueprint.slug)}
                  disabled={startingWorkflow === blueprint.slug}
                >
                  {startingWorkflow === blueprint.slug 
                    ? 'Starting...' 
                    : 'Start Workflow'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </Grid>
      )}
    </PageContainer>
  );
};
