import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AdminPage } from '@/components/Admin/AdminPage';
import { AdminGuard, LoadingSkeleton } from '@/components/Admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface WorkspaceCard {
  title: string;
  description: string;
  path: string;
  icon: string;
  comingSoon?: boolean;
}

const CARDS: WorkspaceCard[] = [
  {
    title: 'Users & Invitations',
    description: 'Invite teammates, manage roles, and deactivate access.',
    path: '/workspace/users',
    icon: '👥',
  },
  {
    title: 'Organization Profile',
    description: 'Update company info, logo, and tenant branding.',
    path: '/workspace/profile',
    icon: '🏢',
  },
  {
    title: 'Configurations',
    description: 'Manage tenant settings by category with safe defaults.',
    path: '/workspace/configurations',
    icon: '🔧',
  },
  {
    title: 'Option Lists',
    description: 'Manage dropdowns and choice lists used across the app.',
    path: '/workspace/option-lists',
    icon: '📋',
  },
  {
    title: 'Activity & Audit Logs',
    description: 'Review admin actions, filter events, and export CSV.',
    path: '/workspace/activity',
    icon: '🕒',
  },
  {
    title: 'My AI',
    description: 'Chat sessions, approvals, preferences, and learning dashboard.',
    path: '/workspace/my-ai',
    icon: '✨',
  },
  {
    title: 'Billing',
    description: 'Subscription status and billing contact details.',
    path: '/workspace/billing',
    icon: '💳',
  },
];

const AdminWorkspaceHome: React.FC = () => {
  useDocumentTitle('Admin Home');
  const { permissions, isLoading } = useAdminPermissions();
  const canAccess = ['admin', 'owner', 'superuser', 'manager'].includes(permissions.role);

  const roleLabel = permissions.role === 'superuser'
    ? 'Superuser'
    : permissions.role.charAt(0).toUpperCase() + permissions.role.slice(1);

  return (
    <AdminPage
      title="Admin Workspace"
      description="Tenant administration tools for users, configuration, and auditing."
      icon="⚙️"
      actions={
        <Link to="/workspace/users" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="sm" disabled={isLoading}>
            Manage Users
          </Button>
        </Link>
      }
      headerExtras={
        <MetaBar>
          <MetaItem>
            <MetaLabel>Your access</MetaLabel>
            <MetaValue>{isLoading ? 'Loading…' : roleLabel}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Quick links</MetaLabel>
            <MetaValue>
              <InlineLinks>
                <InlineLink to="/workspace/configurations">Configurations</InlineLink>
                <Dot aria-hidden="true">•</Dot>
                <InlineLink to="/workspace/activity">Audit Logs</InlineLink>
              </InlineLinks>
            </MetaValue>
          </MetaItem>
        </MetaBar>
      }
    >
      <AdminGuard
        feature="workspace"
        allow={() => canAccess}
        loadingFallback={<LoadingSkeleton type="card" rows={2} />}
      >
        <Grid>
        {CARDS.map((card) => (
          <CardLink
            key={card.path}
            to={card.path}
            aria-label={`${card.title}${card.comingSoon ? ' (coming soon)' : ''}`}
          >
            <CardTop>
              <CardIcon aria-hidden="true">{card.icon}</CardIcon>
              {card.comingSoon && <Pill>Coming soon</Pill>}
            </CardTop>
            <CardTitle>{card.title}</CardTitle>
            <CardDescription>{card.description}</CardDescription>
          </CardLink>
        ))}
        </Grid>
      </AdminGuard>
    </AdminPage>
  );
};

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const CardLink = styled(Link)`
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
    border-color: rgba(var(--color-primary), 0.35);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CardIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-primary), 0.12);
  color: rgb(var(--color-primary));
  font-size: 18px;
`;

const Pill = styled.span`
  font-size: 11px;
  font-weight: 650;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  background: rgba(var(--color-warning), 0.14);
  color: rgb(var(--color-warning));
`;

const CardTitle = styled.h2`
  margin: 0;
  color: rgb(var(--color-text-primary));
  font-size: 15px;
  font-weight: 650;
`;

const CardDescription = styled.p`
  margin: 0;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  line-height: 1.5;
`;

const MetaBar = styled.div`
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MetaLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const MetaValue = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const InlineLinks = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const InlineLink = styled(Link)`
  color: rgb(var(--color-primary));
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const Dot = styled.span`
  color: rgb(var(--color-text-secondary));
`;

export default AdminWorkspaceHome;
