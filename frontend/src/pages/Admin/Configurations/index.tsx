/**
 * Configurations Page
 * 
 * System and tenant configuration management
 * Admin Workspace section
 * 
 * Created: 2026-02-04
 */
import React from 'react';
import styled from 'styled-components';

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const PageDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const ContentCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 32px;
`;

const PlaceholderText = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
  margin: 48px 0;
`;

const ConfigurationsPage: React.FC = () => {
  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>⚙️ Configurations</PageTitle>
        <PageDescription>
          Manage system configurations, choice lists, and field schemas
        </PageDescription>
      </PageHeader>

      <ContentCard>
        <PlaceholderText>
          Configuration management interface coming soon.
          <br />
          This page will allow you to configure system settings, choice lists, and field schemas.
        </PlaceholderText>
      </ContentCard>
    </PageContainer>
  );
};

export default ConfigurationsPage;
