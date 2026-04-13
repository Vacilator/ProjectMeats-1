/**
 * Semantic Textarea Atom
 *
 * Wraps Ant Design Input.TextArea with typed API and optional error display.
 */

import React from 'react';
import { Input as AntInput, Typography } from 'antd';
import type { TextAreaProps as AntTextAreaProps } from 'antd/es/input';

export interface TextareaProps extends Omit<AntTextAreaProps, 'value' | 'onChange' | 'status'> {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ value, onChange, error, style, ...props }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <AntInput.TextArea
        value={value}
        status={error ? 'error' : undefined}
        style={{ width: '100%', ...style }}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </div>
  );
};
