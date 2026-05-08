/**
 * Shared Styled Components Library
 *
 * Provides semantic, reusable styled components with consistent naming.
 * Replaces auto-generated classnames (sc-XXXXX) with descriptive display names.
 *
 * Usage:
 *   import { FlexContainer, Button, Card } from '@/styles/shared';
 *
 * Created: 2026-02-26 - Shared Components Cleanup
 */

import styled, { css } from 'styled-components';

// ============================================================================
// Layout Components
// ============================================================================

export const FlexContainer = styled.div<{
  $direction?: 'row' | 'column';
  $align?: string;
  $justify?: string;
  $gap?: string;
  $wrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
}>`
  display: flex;
  flex-direction: ${props => props.$direction || 'row'};
  align-items: ${props => props.$align || 'stretch'};
  justify-content: ${props => props.$justify || 'flex-start'};
  gap: ${props => props.$gap || '0'};
  flex-wrap: ${props => props.$wrap || 'nowrap'};
`;

export const GridContainer = styled.div<{
  $columns?: string;
  $rows?: string;
  $gap?: string;
}>`
  display: grid;
  grid-template-columns: ${props => props.$columns || '1fr'};
  grid-template-rows: ${props => props.$rows || 'auto'};
  gap: ${props => props.$gap || '0'};
`;

export const Card = styled.div<{ $padding?: string; $shadow?: boolean }>`
  background: rgb(var(--color-surface));
  border-radius: 8px;
  padding: ${props => props.$padding || '16px'};
  box-shadow: ${props => props.$shadow ? 'var(--shadow-md)' : 'none'};
`;

export const Panel = styled.div<{ $variant?: 'default' | 'primary' | 'secondary' }>`
  background: ${props => {
    switch (props.$variant) {
      case 'primary': return 'rgb(var(--color-primary))';
      case 'secondary': return 'rgb(var(--color-secondary))';
      default: return 'rgb(var(--color-surface))';
    }
  }};
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 16px;
`;

export const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; $size?: 'sm' | 'md' | 'lg' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  ${props => {
    switch (props.$size) {
      case 'sm':
        return css`padding: 6px 12px; font-size: 14px;`;
      case 'lg':
        return css`padding: 12px 24px; font-size: 16px;`;
      default:
        return css`padding: 8px 16px; font-size: 14px;`;
    }
  }}

  ${props => {
    switch (props.$variant) {
      case 'primary':
        return css`background: rgb(var(--color-primary)); color: rgb(var(--color-primary-foreground, 255 255 255)); &:hover { opacity: 0.9; }`;
      case 'danger':
        return css`background: rgb(var(--color-error)); color: rgb(var(--color-primary-foreground, 255 255 255)); &:hover { opacity: 0.9; }`;
      case 'ghost':
        return css`background: transparent; color: rgb(var(--color-text-primary)); &:hover { background: rgba(var(--color-overlay), 0.05); }`;
      default:
        return css`background: rgb(var(--color-surface)); color: rgb(var(--color-text-primary)); border: 1px solid rgb(var(--color-border)); &:hover { background: rgb(var(--color-background-hover)); }`;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const Input = styled.input<{ $error?: boolean }>`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${props => props.$error ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &:disabled {
    background: rgb(var(--color-background-disabled));
    cursor: not-allowed;
  }
`;

export const Badge = styled.span<{ $variant?: 'success' | 'warning' | 'error' | 'info' | 'default' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;

  ${props => {
    switch (props.$variant) {
      case 'success':
        return css`background: rgba(var(--color-success), 0.1); color: rgb(var(--color-success));`;
      case 'warning':
        return css`background: rgba(var(--color-warning), 0.1); color: rgb(var(--color-warning));`;
      case 'error':
        return css`background: rgba(var(--color-error), 0.1); color: rgb(var(--color-error));`;
      case 'info':
        return css`background: rgba(var(--color-info), 0.1); color: rgb(var(--color-info));`;
      default:
        return css`background: rgba(var(--color-overlay), 0.05); color: rgb(var(--color-text-secondary));`;
    }
  }}
`;
