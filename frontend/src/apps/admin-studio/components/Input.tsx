/**
 * Input Component for Admin Studio
 * Simple, styled input field using CSS variables
 */
import React from 'react';
import styled from 'styled-components';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const StyledInput = styled.input<{ hasError?: boolean }>`
  width: 100%;
  height: 2.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: rgb(var(--color-text-primary));
  background-color: rgb(var(--color-surface));
  border: 1px solid ${props => props.hasError ? 'rgb(var(--color-danger))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &:disabled {
    background-color: rgb(var(--color-input-readonly));
    cursor: not-allowed;
    opacity: 0.6;
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const ErrorText = styled.span`
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgb(var(--color-danger));
`;

export const Input: React.FC<InputProps> = ({ error, ...props }) => {
  return (
    <>
      <StyledInput hasError={!!error} {...props} />
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
};
