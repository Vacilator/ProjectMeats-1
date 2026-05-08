/**
 * Loading Skeleton Component
 *
 * Displays a skeleton screen while data is loading.
 * Provides better perceived performance than spinners.
 *
 * Usage:
 * ```tsx
 * {loading ? (
 *   <LoadingSkeleton
 *     rows={5}
 *     columns={4}
 *     type="table"
 *   />
 * ) : (
 *   <DataTable data={data} />
 * )}
 * ```
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';

interface LoadingSkeletonProps {
  type?: 'table' | 'card' | 'list';
  rows?: number;
  columns?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = 'table',
  rows = 5,
  columns = 4,
}) => {
  if (type === 'table') {
    return (
      <TableSkeleton>
        <TableHeader>
          {Array.from({ length: columns }).map((_, i) => (
            <HeaderCell key={i}>
              <SkeletonBox width="80%" height="16px" />
            </HeaderCell>
          ))}
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <SkeletonBox
                    width={colIndex === 0 ? '60%' : '80%'}
                    height="16px"
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableSkeleton>
    );
  }

  if (type === 'card') {
    return (
      <CardGrid>
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i}>
            <SkeletonBox width="100%" height="120px" marginBottom="16px" />
            <SkeletonBox width="70%" height="20px" marginBottom="8px" />
            <SkeletonBox width="90%" height="16px" marginBottom="8px" />
            <SkeletonBox width="60%" height="16px" />
          </Card>
        ))}
      </CardGrid>
    );
  }

  // Default: list type
  return (
    <ListContainer>
      {Array.from({ length: rows }).map((_, i) => (
        <ListItem key={i}>
          <SkeletonBox width="40px" height="40px" borderRadius="50%" />
          <ListItemContent>
            <SkeletonBox width="60%" height="16px" marginBottom="8px" />
            <SkeletonBox width="40%" height="14px" />
          </ListItemContent>
        </ListItem>
      ))}
    </ListContainer>
  );
};

// Animations

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

// Styled Components

const SkeletonBox = styled.div<{
  width?: string;
  height?: string;
  marginBottom?: string;
  borderRadius?: string;
}>`
  width: ${({ width }) => width || '100%'};
  height: ${({ height }) => height || '16px'};
  margin-bottom: ${({ marginBottom }) => marginBottom || '0'};
  border-radius: ${({ borderRadius }) => borderRadius || 'var(--radius-sm)'};
  background: linear-gradient(
    90deg,
    rgb(var(--color-surface)) 0%,
    rgb(var(--color-surface-hover)) 50%,
    rgb(var(--color-surface)) 100%
  );
  background-size: 1000px 100%;
  animation: ${shimmer} 2s infinite linear;
`;

// Table Skeleton

const TableSkeleton = styled.div`
  width: 100%;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  padding: 16px;
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const HeaderCell = styled.div`
  display: flex;
  align-items: center;
`;

const TableBody = styled.div``;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));

  &:last-child {
    border-bottom: none;
  }
`;

const TableCell = styled.div`
  display: flex;
  align-items: center;
`;

// Card Skeleton

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
`;

const Card = styled.div`
  padding: 24px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

// List Skeleton

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
`;

const ListItemContent = styled.div`
  flex: 1;
`;
