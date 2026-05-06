import React from 'react';
import styled from 'styled-components';

interface PortalPageShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const PortalPageShell: React.FC<PortalPageShellProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <PageContainer>
      <HeaderCard>
        <Eyebrow>Counterparty Portal</Eyebrow>
        <Title>{title}</Title>
        <Subtitle>{subtitle}</Subtitle>
      </HeaderCard>
      <Content>{children}</Content>
    </PageContainer>
  );
};

const PageContainer = styled.main`
  min-height: 100vh;
  background: rgb(var(--color-background));
  padding: 2rem 1rem 3rem;
`;

const HeaderCard = styled.section`
  max-width: 1100px;
  margin: 0 auto 1.5rem;
  padding: 1.5rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: 20px;
  background: rgb(var(--color-surface));
  box-shadow: 0 12px 32px rgba(var(--color-primary), 0.08);
`;

const Eyebrow = styled.p`
  margin: 0 0 0.5rem;
  color: rgb(var(--color-text-secondary));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  margin: 0;
  color: rgb(var(--color-text-primary));
  font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.1;
`;

const Subtitle = styled.p`
  margin: 0.75rem 0 0;
  color: rgb(var(--color-text-secondary));
  font-size: 1rem;
  line-height: 1.6;
  max-width: 70ch;
`;

const Content = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

export default PortalPageShell;
