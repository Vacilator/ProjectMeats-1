import React from 'react';
import styled from 'styled-components';
import { Card } from '@/components/ui/Card';

export interface AdminSectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const AdminSection: React.FC<AdminSectionProps> = ({
  title,
  description,
  actions,
  children,
  padding = 'md',
}) => {
  return (
    <Card padding={padding}>
      {(title || actions) && (
        <Header>
          <HeaderText>
            {title && <Title>{title}</Title>}
            {description && <Description>{description}</Description>}
          </HeaderText>
          {actions && <Actions>{actions}</Actions>}
        </Header>
      )}
      {children}
    </Card>
  );
};

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  color: rgb(var(--color-text-primary));
`;

const Description = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
