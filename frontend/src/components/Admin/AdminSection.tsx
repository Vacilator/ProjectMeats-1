import React from 'react';
import styled from 'styled-components';

interface AdminSectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminSection: React.FC<AdminSectionProps> = ({ title, description, actions, children }) => {
  return (
    <SectionCard>
      {(title || description || actions) && (
        <SectionHeader>
          <div>
            {title ? <SectionTitle>{title}</SectionTitle> : null}
            {description ? <SectionDescription>{description}</SectionDescription> : null}
          </div>
          {actions ? <SectionActions>{actions}</SectionActions> : null}
        </SectionHeader>
      )}

      <div>{children}</div>
    </SectionCard>
  );
};

const SectionCard = styled.section`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-xl);
  padding: 16px;
  box-shadow: var(--shadow-sm);
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`;

const SectionTitle = styled.h2`
  font-size: 15px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const SectionDescription = styled.p`
  margin: 6px 0 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const SectionActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;
