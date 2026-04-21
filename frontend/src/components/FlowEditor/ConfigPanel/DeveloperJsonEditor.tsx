/**
 * DeveloperJsonEditor
 *
 * Escape hatch for power users when schema-driven UI doesn't cover an edge case.
 * This edits the node's `data` object only (not id/type).
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { Button } from './shared/StyledComponents';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

function stripUnsafeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsafeKeys);
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = stripUnsafeKeys(v);
    }

    return out;
  }

  return value;
}

export interface DeveloperJsonEditorProps {
  value: unknown;
  onApply: (value: Record<string, any>) => void;
}

export const DeveloperJsonEditor: React.FC<DeveloperJsonEditorProps> = ({ value, onApply }) => {
  const initialText = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  const [text, setText] = useState(initialText);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setText(initialText);
    setParseError(null);
  }, [initialText]);

  const tryParse = (): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParseError('JSON must be an object');
        return null;
      }
      setParseError(null);
      return stripUnsafeKeys(parsed) as Record<string, any>;
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
      return null;
    }
  };

  const handleApply = () => {
    const parsed = tryParse();
    if (!parsed) return;
    onApply(parsed);
  };

  return (
    <Container>
      <HeaderRow>
        <HeaderText>
          <Title>Developer JSON</Title>
          <Subtitle>
            Use only when the visual editor doesn&apos;t support a specific configuration. Changes apply to this
            node only.
          </Subtitle>
        </HeaderText>
        <Button $variant="primary" onClick={handleApply} disabled={!!parseError}>
          Apply JSON
        </Button>
      </HeaderRow>

      <Suspense
        fallback={
          <PlainTextarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              tryParse();
            }}
            spellCheck={false}
          />
        }
      >
        <MonacoEditor
          height="260px"
          defaultLanguage="json"
          value={text}
          onChange={(value) => {
            const next = value ?? '';
            setText(next);
            tryParse();
          }}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            formatOnPaste: true,
            formatOnType: true,
            automaticLayout: true,
          }}
        />
      </Suspense>

      {parseError && <ErrorText>Invalid JSON: {parseError}</ErrorText>}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background: rgb(var(--color-background));
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const HeaderText = styled.div`
  min-width: 0;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
`;

const PlainTextarea = styled.textarea`
  width: 100%;
  min-height: 220px;
  resize: vertical;
  padding: 10px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: rgb(var(--color-text-primary));
  background: rgba(var(--color-overlay), 0.02);
`;

const ErrorText = styled.div`
  font-size: 12px;
  color: rgb(var(--color-error));
`;

export default DeveloperJsonEditor;
