import React from 'react';
import styled from 'styled-components';

export interface AdminPageProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | 'full';
  headerExtras?: React.ReactNode;
}

const getMaxWidth = (maxWidth: AdminPageProps['maxWidth']) => {
  switch (maxWidth) {
    case 'md':
      return '768px';
    case 'lg':
      return '1024px';
    case 'xl':
      return '1280px';
    default:
      return '100%';
  }
};

export const AdminPage: React.FC<AdminPageProps> = ({
  title,
  description,
  icon,
  actions,
  headerExtras,
  children,
  maxWidth = 'xl',
}) => {
  return (
    <Container>
      <Inner style={{ maxWidth: getMaxWidth(maxWidth) }}>
        <Header>
          <HeaderLeft>
            {icon && <IconWrap aria-hidden="true">{icon}</IconWrap>}
            <TitleBlock>
              <Title>{title}</Title>
              {description && <Description>{description}</Description>}
            </TitleBlock>
          </HeaderLeft>
          {actions && <HeaderActions>{actions}</HeaderActions>}
        </Header>

        {headerExtras && <HeaderExtras>{headerExtras}</HeaderExtras>}

        <Content>{children}</Content>
      </Inner>
    </Container>
  );
};

const Container = styled.div`
  flex: 1;
  min-height: calc(100vh - 64px);
  background: rgb(var(--color-background));
  padding: 16px;

  @media (min-width: 768px) {
    padding: 24px;
  }
`;

const Inner = styled.div`
  width: 100%;
  margin: 0 auto;
`;

const Header = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  @media (min-width: 768px) {
    margin-bottom: 20px;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
`;

const IconWrap = styled.div`
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgba(var(--color-primary), 0.12);
  color: rgb(var(--color-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const Title = styled.h1`
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: rgb(var(--color-text-primary));
  margin: 0;
  line-height: 1.15;

  @media (min-width: 768px) {
    font-size: 28px;
  }
`;

const Description = styled.p`
  margin: 0;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  line-height: 1.5;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const HeaderExtras = styled.div`
  margin-bottom: 16px;
`;

const Content = styled.main`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
