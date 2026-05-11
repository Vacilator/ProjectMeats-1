import React from 'react';
import { Segmented } from 'antd';
import type { SegmentedProps } from 'antd';
import styled, { css } from 'styled-components';

type OperatorMaxWidth = 'content' | 'wide' | 'full';
type OperatorSurface = 'plain' | 'section' | 'card';

const resolveMaxWidth = ($maxWidth: OperatorMaxWidth): string => {
  switch ($maxWidth) {
    case 'wide':
      return '1600px';
    case 'full':
      return 'none';
    case 'content':
    default:
      return '1440px';
  }
};

const resolveInsetPadding = ($surface: OperatorSurface): string => {
  switch ($surface) {
    case 'card':
      return '16px 24px 0';
    case 'section':
      return '20px 24px 12px';
    case 'plain':
    default:
      return '16px 24px 0';
  }
};

const SharedShellRoot = styled.main<{ $maxWidth: OperatorMaxWidth }>`
  min-height: calc(100vh - 180px);
  background: rgb(var(--color-background));
  padding: ${({ $maxWidth }) => ($maxWidth === 'full' ? '0' : '1.5rem 2rem')};
  max-width: ${({ $maxWidth }) => resolveMaxWidth($maxWidth)};
  margin: ${({ $maxWidth }) => ($maxWidth === 'full' ? '0' : '0 auto')};

  @media (max-width: 640px) {
    padding: ${({ $maxWidth }) => ($maxWidth === 'full' ? '0' : '1rem')};
  }
`;

const SharedHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const SharedHeaderMain = styled.div`
  flex: 1;
  min-width: 200px;
`;

const SharedSubtitle = styled.div`
  font-size: 0.82rem;
  color: rgb(var(--color-text-tertiary, 107 114 128));
  display: block;
  margin-top: 2px;
`;

const SharedHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const actionRowSurfaceStyles = {
  plain: css`
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
  `,
  section: css`
    padding: 12px 16px;
    background: rgb(var(--color-surface));
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-lg);
  `,
  card: css`
    padding: 12px 16px;
    margin: 16px 24px 0;
    background: rgb(var(--color-surface));
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-lg);

    @media (max-width: 640px) {
      margin: 12px 16px 0;
    }
  `,
};

const SharedActionRow = styled.div<{ $surface: OperatorSurface }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $surface }) => ($surface === 'plain' ? 'flex-start' : 'space-between')};
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  ${({ $surface }) => actionRowSurfaceStyles[$surface]}
`;

const SharedActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const SharedTabBar = styled.nav`
  margin-bottom: 1.25rem;
`;

const SharedInsetSection = styled.section<{
  $maxWidth: OperatorMaxWidth;
  $surface: OperatorSurface;
}>`
  padding: ${({ $surface }) => resolveInsetPadding($surface)};

  ${({ $surface }) =>
    $surface === 'section' &&
    css`
      background: rgb(var(--color-surface));
      border-bottom: 1px solid rgb(var(--color-border));
    `}

  ${({ $surface }) =>
    $surface === 'card' &&
    css`
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-lg);
      margin: 16px 24px 0;
      padding: 12px 16px;

      @media (max-width: 640px) {
        margin: 12px 16px 0;
      }
    `}

  @media (max-width: 640px) {
    padding: ${({ $surface }) =>
      $surface === 'section'
        ? '16px'
        : $surface === 'card'
          ? '12px 16px'
          : '12px 16px 0'};
  }

  & > * {
    max-width: ${({ $maxWidth }) => resolveMaxWidth($maxWidth)};
    margin: 0 auto;
  }
`;

export interface OperatorShellProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  maxWidth?: OperatorMaxWidth;
  as?: 'main' | 'div' | 'section';
}

export const OperatorShell: React.FC<OperatorShellProps> = ({
  children,
  maxWidth = 'content',
  as = 'main',
  ...props
}) => (
  <SharedShellRoot as={as} $maxWidth={maxWidth} {...props}>
    {children}
  </SharedShellRoot>
);

export interface OperatorHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export const OperatorHeader: React.FC<OperatorHeaderProps> = ({ title, subtitle, actions }) => (
  <SharedHeader>
    <SharedHeaderMain>
      {title}
      {subtitle ? <SharedSubtitle>{subtitle}</SharedSubtitle> : null}
    </SharedHeaderMain>
    {actions ? <SharedHeaderActions>{actions}</SharedHeaderActions> : null}
  </SharedHeader>
);

export interface OperatorActionRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  surface?: OperatorSurface;
}

export const OperatorActionRow: React.FC<OperatorActionRowProps> = ({
  children,
  surface = 'plain',
  ...props
}) => (
  <SharedActionRow $surface={surface} {...props}>
    {children}
  </SharedActionRow>
);

export interface OperatorActionGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const OperatorActionGroup: React.FC<OperatorActionGroupProps> = ({
  children,
  ...props
}) => <SharedActionGroup {...props}>{children}</SharedActionGroup>;

export interface OperatorTabBarProps {
  value: SegmentedProps['value'];
  onChange: (value: SegmentedProps['value']) => void;
  options: NonNullable<SegmentedProps['options']>;
  ariaLabel: string;
}

export const OperatorTabBar: React.FC<OperatorTabBarProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
}) => (
  <SharedTabBar role="navigation" aria-label={ariaLabel}>
    <Segmented
      value={value}
      onChange={onChange}
      aria-label="Select section"
      options={options}
      style={{ borderRadius: 10 }}
      block
    />
  </SharedTabBar>
);

export interface OperatorInsetSectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  maxWidth?: OperatorMaxWidth;
  surface?: OperatorSurface;
  as?: 'section' | 'div';
}

export const OperatorInsetSection: React.FC<OperatorInsetSectionProps> = ({
  children,
  maxWidth = 'wide',
  surface = 'plain',
  as = 'section',
  ...props
}) => (
  <SharedInsetSection as={as} $maxWidth={maxWidth} $surface={surface} {...props}>
    {children}
  </SharedInsetSection>
);
