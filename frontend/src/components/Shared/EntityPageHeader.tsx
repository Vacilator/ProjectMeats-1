/**
 * EntityPageHeader — shared header for all entity list and detail pages.
 *
 * Provides a consistent title + subtitle + action buttons layout.
 * Replaces 4+ bespoke styled header implementations across entity pages.
 *
 * Usage:
 *   <EntityPageHeader
 *     title="Suppliers"
 *     subtitle="Headquarters list"
 *     actions={<Button type="primary">New Supplier</Button>}
 *   />
 */
import React from 'react';
import styled from 'styled-components';

export interface EntityPageHeaderProps {
  /** Page title (e.g., "Suppliers", "Plants & Facilities") */
  title: string;
  /** Optional subtitle (e.g., "Headquarters list", "Manage processing facilities") */
  subtitle?: string;
  /** Action buttons rendered on the right side */
  actions?: React.ReactNode;
  /** Optional className for styled-component extension */
  className?: string;
}

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const TitleSection = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.125rem 0;
  letter-spacing: -0.01em;
  line-height: 1.2;
`;

const Subtitle = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.4;
`;

const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

export const EntityPageHeader: React.FC<EntityPageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className,
}) => (
  <HeaderRow className={className}>
    <TitleSection>
      <Title>{title}</Title>
      {subtitle && <Subtitle>{subtitle}</Subtitle>}
    </TitleSection>
    {actions && <ActionsRow>{actions}</ActionsRow>}
  </HeaderRow>
);

export default EntityPageHeader;
