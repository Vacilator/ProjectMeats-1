import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  gap: 16px;
`;

const Code = styled.h1`
  font-size: 72px;
  font-weight: 700;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  max-width: 400px;
`;

const BackButton = styled.button`
  margin-top: 8px;
  padding: 10px 24px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse, 255 255 255));
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.9; }
`;

const NotFoundPage: React.FC = () => {
  useDocumentTitle('Page Not Found');
  const navigate = useNavigate();
  return (
    <Container>
      <Code>404</Code>
      <Title>Page not found</Title>
      <Description>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </Description>
      <BackButton onClick={() => navigate('/')}>
        Go to Home
      </BackButton>
    </Container>
  );
};

export default NotFoundPage;
