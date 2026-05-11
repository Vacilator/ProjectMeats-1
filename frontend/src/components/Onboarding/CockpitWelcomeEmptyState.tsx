import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Compass, LayoutGrid, PackagePlus, UsersRound } from 'lucide-react';
import { EmptyState } from '../Admin/EmptyState';

interface CockpitWelcomeEmptyStateProps {
  onCustomizeDashboard: () => void;
  onStartTour: () => void;
}

const Checklist = styled.ul`
  margin: 0 0 24px;
  padding-left: 20px;
  max-width: 520px;
  text-align: left;
  color: rgb(var(--color-text-secondary));
  line-height: 1.6;
`;

const ChecklistItem = styled.li`
  margin-bottom: 8px;
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: rgb(var(--color-primary) / 0.12);
  color: rgb(var(--color-primary));
`;

export const CockpitWelcomeEmptyState: React.FC<CockpitWelcomeEmptyStateProps> = ({
  onCustomizeDashboard,
  onStartTour,
}) => {
  const navigate = useNavigate();

  const actions = useMemo(
    () => [
      {
        label: 'Take the Workspace Tour',
        onClick: onStartTour,
        variant: 'primary' as const,
      },
      {
        label: 'Add Your First Customer',
        onClick: () => navigate('/customers/new'),
        variant: 'secondary' as const,
      },
      {
        label: 'Create Your First Inquiry',
        onClick: () => navigate('/inquiries', { state: { openCreateModal: true } }),
        variant: 'secondary' as const,
      },
      {
        label: 'Customize Workspace Dashboard',
        onClick: onCustomizeDashboard,
        variant: 'secondary' as const,
      },
    ],
    [navigate, onCustomizeDashboard, onStartTour],
  );

  return (
    <EmptyState
      icon={
        <IconWrapper>
          <Compass size={36} />
        </IconWrapper>
      }
      title="Set up your workspace dashboard"
      message="Command Center is ready for daily triage. This secondary workspace becomes more useful once you add a few core records and tailor the widgets to your team."
      actions={actions}
    >
      <Checklist>
        <ChecklistItem>
          <UsersRound size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
          Add a customer or supplier so search and related records have real business context.
        </ChecklistItem>
        <ChecklistItem>
          <PackagePlus size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
          Create an inquiry to kick off the main sales and fulfillment workflow.
        </ChecklistItem>
        <ChecklistItem>
          <LayoutGrid size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
          Customize your widget layout once you know which metrics and queues matter most.
        </ChecklistItem>
      </Checklist>
    </EmptyState>
  );
};
