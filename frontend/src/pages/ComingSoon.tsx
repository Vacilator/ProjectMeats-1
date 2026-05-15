/**
 * ComingSoon Component
 *
 * Polished placeholder for features in development. Shows an optional
 * feature list and a "Go Back" button. Uses CSS custom properties only.
 */
import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface ComingSoonProps {
  title: string;
  description?: string;
  icon?: string;
  features?: string[];
}

export const ComingSoon: React.FC<ComingSoonProps> = ({
  title,
  icon = '🚧',
  description = 'This feature is currently under development and will be available soon.',
  features,
}) => {
  const navigate = useNavigate();
  useDocumentTitle('Coming Soon');

  return (
    <Container>
      <Content>
        <Icon>{icon}</Icon>
        <Title>{title}</Title>
        <Description>{description}</Description>
        {features && features.length > 0 && (
          <FeatureList>
            {features.map((_feature, _i) => (
              <FeatureItem key={_feature}>
                <FeatureCheck>✓</FeatureCheck>
                {_feature}
              </FeatureItem>
            ))}
          </FeatureList>
        )}
        <BackButton onClick={() => navigate(-1)}>
          ← Go Back
        </BackButton>
      </Content>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
`;

const Content = styled.div`
  text-align: center;
  max-width: 500px;
`;

const Icon = styled.div`
  font-size: 64px;
  margin-bottom: 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.75rem;
`;

const Description = styled.p`
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 1.5rem;
  line-height: 1.6;
`;

const FeatureList = styled.div`
  text-align: left;
  max-width: 360px;
  margin: 0 auto 2rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: rgb(var(--color-text-primary));
`;

const FeatureCheck = styled.span`
  color: rgb(var(--color-success));
  font-weight: 600;
`;

const BackButton = styled.button`
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: rgb(var(--color-primary-foreground));
  background-color: rgb(var(--color-primary));
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgb(var(--color-primary-hover));
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export default ComingSoon;
