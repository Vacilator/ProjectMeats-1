import React from 'react';
import styled from 'styled-components';

interface AdminPageProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  title,
  description,
  icon,
  actions,
  headerExtras,
  children,
}) => {
  return (
    <PageContainer>
      <Header>
        <TitleRow>
          <TitleLeft>
            {icon ? <IconWrap aria-hidden="true">{icon}</IconWrap> : null}
            <div>
              <Title>{title}</Title>
              {description ? <Description>{description}</Description> : null}
            </div>
          </TitleLeft>

          {actions ? <Actions>{actions}</Actions> : null}
        </TitleRow>

        {headerExtras ? <HeaderExtras>{headerExtras}</HeaderExtras> : null}
      </Header>

      <Content>{children}</Content>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 18px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
`;

const TitleLeft = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
`;

const IconWrap = styled.div`
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: rgba(var(--color-primary), 0.12);
  color: rgb(var(--color-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
`;

const Title = styled.h1`
  font-size: 22px;
  font-weight: 750;
  color: rgb(var(--color-text-primary));
  margin: 0;
  line-height: 1.2;
`;

const Description = styled.p`
  margin: 6px 0 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const HeaderExtras = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
