/**
 * Golden Form Shell — Reusable form layout primitives
 *
 * Provides the "golden standard" form design used across all create/edit modals.
 * Based on the Purchase Order form pattern, elevated to production quality.
 *
 * Features:
 * - Section cards with icons and collapsible headers
 * - 2-column responsive field grid
 * - Sticky header and footer
 * - Accessible focus management
 * - Theme-token-only styling
 *
 * Usage:
 *   import {
 *     GoldenFormOverlay, GoldenFormContainer, GoldenFormHeader,
 *     GoldenFormBody, GoldenFormFooter, GoldenSectionCard,
 *     GoldenFieldGrid, GoldenFormGroup, GoldenLabel, GoldenInput,
 *     GoldenSelect, GoldenTextArea, GoldenFieldHint,
 *   } from '@/components/Forms/GoldenFormShell';
 */

import styled, { css, keyframes } from 'styled-components';

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

/* ------------------------------------------------------------------ */
/*  Overlay + Container                                                */
/* ------------------------------------------------------------------ */

export const GoldenFormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  overflow-y: auto;
  animation: ${fadeIn} 0.15s ease-out;

  @media (max-width: 640px) {
    align-items: flex-start;
    padding: 8px;
  }
`;

export const GoldenFormContainer = styled.div<{ $maxWidth?: string }>`
  background: rgb(var(--color-surface));
  color: rgb(var(--color-surface-foreground, var(--color-text-primary)));
  border-radius: 12px;
  width: 100%;
  max-width: ${(p) => p.$maxWidth || '680px'};
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
  animation: ${slideUp} 0.2s ease-out;

  @media (max-width: 640px) {
    max-height: calc(100vh - 16px);
    border-radius: 10px;
  }
`;

/* ------------------------------------------------------------------ */
/*  Sticky Header                                                      */
/* ------------------------------------------------------------------ */

export const GoldenFormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  position: sticky;
  top: 0;
  background: rgb(var(--color-surface));
  z-index: 2;
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

export const GoldenFormTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const GoldenFormSubtitle = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

export const GoldenCloseButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

/* ------------------------------------------------------------------ */
/*  Body (scrollable)                                                  */
/* ------------------------------------------------------------------ */

export const GoldenFormBody = styled.form`
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

/* ------------------------------------------------------------------ */
/*  Sticky Footer                                                      */
/* ------------------------------------------------------------------ */

export const GoldenFormFooter = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  position: sticky;
  bottom: 0;
  background: rgb(var(--color-surface));
  z-index: 2;
  border-radius: 0 0 12px 12px;
  flex-shrink: 0;

  @media (max-width: 640px) {
    padding: 12px 16px;
    flex-wrap: wrap;

    & > button {
      flex: 1 1 100%;
    }
  }
`;

/* ------------------------------------------------------------------ */
/*  Section Card                                                       */
/* ------------------------------------------------------------------ */

export const GoldenSectionCard = styled.section<{ $collapsed?: boolean }>`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const GoldenSectionHeader = styled.div<{ $clickable?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: rgb(var(--color-surface-raised, var(--color-surface)));
  border-bottom: 1px solid rgb(var(--color-border));
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  user-select: none;

  &:hover {
    ${(p) =>
      p.$clickable &&
      css`
        background: rgb(var(--color-border));
      `}
  }
`;

export const GoldenSectionIcon = styled.span`
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
`;

export const GoldenSectionTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  flex: 1;
`;

export const GoldenSectionBody = styled.div`
  padding: 18px;

  @media (max-width: 640px) {
    padding: 14px;
  }
`;

/* ------------------------------------------------------------------ */
/*  Field Grid (2-column responsive)                                   */
/* ------------------------------------------------------------------ */

export const GoldenFieldGrid = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols || 2}, 1fr);
  gap: 16px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

/* ------------------------------------------------------------------ */
/*  Form Group (single field wrapper)                                  */
/* ------------------------------------------------------------------ */

export const GoldenFormGroup = styled.div<{ $span?: number }>`
  ${(p) =>
    p.$span &&
    css`
      grid-column: span ${p.$span};

      @media (max-width: 640px) {
        grid-column: span 1;
      }
    `}
`;

/* ------------------------------------------------------------------ */
/*  Labels, Inputs, Selects, TextAreas                                 */
/* ------------------------------------------------------------------ */

export const GoldenLabel = styled.label<{ $required?: boolean }>`
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  font-size: 13px;

  ${(p) =>
    p.$required &&
    css`
      &::after {
        content: ' *';
        color: rgb(239, 68, 68);
        font-weight: 400;
      }
    `}
`;

const inputBase = css`
  width: 100%;
  padding: 9px 12px;
  border: 1.5px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  transition: border-color 0.15s, box-shadow 0.15s;
  min-height: 40px;

  @media (max-width: 640px) {
    font-size: 16px;
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: rgb(var(--color-border));
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
    opacity: 0.7;
  }
`;

export const GoldenInput = styled.input`
  ${inputBase}

  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type='number'] {
    -moz-appearance: textfield;
  }
`;

export const GoldenSelect = styled.select`
  ${inputBase}
  cursor: pointer;
`;

export const GoldenTextArea = styled.textarea`
  ${inputBase}
  resize: vertical;
  min-height: 72px;
`;

/* ------------------------------------------------------------------ */
/*  Hints & Validation                                                 */
/* ------------------------------------------------------------------ */

export const GoldenFieldHint = styled.div`
  margin-top: 5px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;
`;

export const GoldenFieldError = styled.div`
  margin-top: 5px;
  font-size: 12px;
  color: rgb(239, 68, 68);
  font-weight: 500;
`;

/* ------------------------------------------------------------------ */
/*  Buttons                                                            */
/* ------------------------------------------------------------------ */

export const GoldenSubmitButton = styled.button<{ $loading?: boolean }>`
  background: rgb(var(--color-primary));
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: ${(p) => (p.$loading ? 0.7 : 1)};
  pointer-events: ${(p) => (p.$loading ? 'none' : 'auto')};

  &:hover:not(:disabled) {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const GoldenCancelButton = styled.button`
  background: transparent;
  color: rgb(var(--color-text-secondary));
  border: 1.5px solid rgb(var(--color-border));
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  min-height: 40px;

  &:hover {
    background: rgb(var(--color-border));
    color: rgb(var(--color-text-primary));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

/* ------------------------------------------------------------------ */
/*  Calculated / Read-only field highlight                             */
/* ------------------------------------------------------------------ */

export const GoldenReadonlyValue = styled.div`
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  background: rgba(var(--color-primary), 0.06);
  border: 1.5px dashed rgb(var(--color-border));
  min-height: 40px;
  display: flex;
  align-items: center;
`;
