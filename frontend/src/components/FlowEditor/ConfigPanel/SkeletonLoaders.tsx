/**
 * Skeleton Loading Components
 * 
 * Reusable skeleton screens for loading states.
 * Provides better UX than plain "Loading..." text.
 * 
 * Created: 2026-02-21 - Loading States Enhancement
 * 
 * @module SkeletonLoaders
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';

// ============================================================================
// Animations
// ============================================================================

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

// ============================================================================
// Base Skeleton Component
// ============================================================================

const SkeletonBase = styled.div`
  background: linear-gradient(
    90deg,
    rgb(var(--color-background-secondary)) 0%,
    rgb(var(--color-background-tertiary)) 50%,
    rgb(var(--color-background-secondary)) 100%
  );
  background-size: 1000px 100%;
  animation: ${shimmer} 2s infinite linear;
  border-radius: 4px;
`;

// ============================================================================
// Specific Skeleton Components
// ============================================================================

export const SkeletonText = styled(SkeletonBase)<{ width?: string; height?: string }>`
  width: ${props => props.width || '100%'};
  height: ${props => props.height || '16px'};
  margin: 8px 0;
`;

export const SkeletonCard = styled(SkeletonBase)`
  width: 100%;
  height: 80px;
  margin: 8px 0;
  padding: 12px;
`;

export const SkeletonInput = styled(SkeletonBase)`
  width: 100%;
  height: 40px;
  margin: 8px 0;
`;

export const SkeletonButton = styled(SkeletonBase)<{ width?: string }>`
  width: ${props => props.width || '100px'};
  height: 36px;
  margin: 8px 0;
`;

// ============================================================================
// Field List Skeleton
// ============================================================================

export const FieldListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <FieldItemSkeleton key={i} />
      ))}
    </div>
  );
};

const FieldItemSkeleton: React.FC = () => {
  return (
    <FieldItemContainer>
      <SkeletonText width="30%" height="14px" />
      <SkeletonText width="60%" height="12px" />
    </FieldItemContainer>
  );
};

const FieldItemContainer = styled.div`
  padding: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

// ============================================================================
// Entity Selector Skeleton
// ============================================================================

export const EntitySelectorSkeleton: React.FC = () => {
  return (
    <div>
      <SkeletonText width="120px" height="14px" />
      <SkeletonInput />
      <SkeletonText width="100px" height="12px" />
    </div>
  );
};

// ============================================================================
// Config Panel Skeleton
// ============================================================================

export const ConfigPanelSkeleton: React.FC = () => {
  return (
    <Container>
      <SectionSkeleton />
      <SectionSkeleton />
      <SectionSkeleton />
    </Container>
  );
};

const Container = styled.div`
  padding: 16px;
`;

const SectionSkeleton: React.FC = () => {
  return (
    <SectionContainer>
      <SkeletonText width="150px" height="18px" />
      <SkeletonInput />
      <SkeletonInput />
      <SkeletonText width="200px" height="12px" />
    </SectionContainer>
  );
};

const SectionContainer = styled.div`
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  
  &:last-child {
    border-bottom: none;
  }
`;

// ============================================================================
// Retry Button Component
// ============================================================================

export const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-primary-hover));
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

// ============================================================================
// Error State Component
// ============================================================================

export const ErrorStateContainer = styled.div`
  padding: 24px;
  text-align: center;
  background: rgba(var(--color-error), 0.05);
  border: 1px solid rgba(var(--color-error), 0.2);
  border-radius: 8px;
  margin: 16px 0;
`;

export const ErrorIcon = styled.div`
  color: rgb(var(--color-error));
  margin-bottom: 12px;
  font-size: 32px;
`;

export const ErrorTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-error));
`;

export const ErrorMessage = styled.p`
  margin: 0 0 16px 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Timeout Component
// ============================================================================

export const TimeoutContainer = styled.div`
  padding: 24px;
  text-align: center;
  background: rgba(var(--color-warning), 0.05);
  border: 1px solid rgba(var(--color-warning), 0.2);
  border-radius: 8px;
  margin: 16px 0;
`;

export const TimeoutMessage = styled.p`
  margin: 0 0 16px 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;
