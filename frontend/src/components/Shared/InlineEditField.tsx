import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';

interface InlineEditFieldProps {
  value: string | number | null | undefined;
  fieldName: string;
  onSave: (fieldName: string, value: string) => Promise<void>;
  type?: 'text' | 'number' | 'textarea';
  disabled?: boolean;
  placeholder?: string;
}

const Wrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  width: 100%;
`;

const DisplayValue = styled.span<{ $hasValue: boolean }>`
  color: ${({ $hasValue }) =>
    $hasValue
      ? 'rgb(var(--color-text-primary))'
      : 'rgb(var(--color-text-secondary))'};
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.15s;
  width: 100%;
  &:hover {
    background: rgba(var(--color-primary), 0.06);
    border-color: rgba(var(--color-primary), 0.2);
  }
`;

const EditIcon = styled.span`
  opacity: 0;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  transition: opacity 0.15s;
  ${Wrapper}:hover & {
    opacity: 0.6;
  }
`;

const EditInput = styled.input`
  width: 100%;
  padding: 4px 8px;
  border: 1px solid rgb(var(--color-primary));
  border-radius: 4px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: inherit;
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--color-primary), 0.15);
`;

const SavingIndicator = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  font-style: italic;
`;

const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  fieldName,
  onSave,
  type = 'text',
  disabled = false,
  placeholder = 'Click to edit',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  const handleSave = useCallback(async () => {
    if (draft === String(value ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(fieldName, draft);
    } catch {
      setDraft(String(value ?? ''));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, value, fieldName, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') {
        setDraft(String(value ?? ''));
        setEditing(false);
      }
    },
    [handleSave, value],
  );

  if (disabled) {
    return (
      <Wrapper>
        <DisplayValue $hasValue={!!value}>{value ?? '—'}</DisplayValue>
      </Wrapper>
    );
  }

  if (saving) {
    return (
      <Wrapper>
        <SavingIndicator>Saving...</SavingIndicator>
      </Wrapper>
    );
  }

  if (editing) {
    return (
      <Wrapper>
        <EditInput
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
    >
      <DisplayValue $hasValue={!!value}>{value || placeholder}</DisplayValue>
      <EditIcon>✏️</EditIcon>
    </Wrapper>
  );
};

export default InlineEditField;
