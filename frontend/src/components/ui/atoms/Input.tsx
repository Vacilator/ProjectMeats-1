/**
 * Semantic Input Atom
 *
 * Wraps Ant Design Input with a small, typed API and optional error display.
 * Uses CSS variables for colors via global theme.
 */

import React from 'react';
import { Input as AntInput, Typography } from 'antd';
import type { InputProps as AntInputProps } from 'antd';

export interface InputProps extends Omit<AntInputProps, 'value' | 'onChange' | 'size' | 'status'> {
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  error?: string;
}

export const Input: React.FC<InputProps> = ({ value, onChange, size = 'md', error, style, ...props }) => {
  const antdSize: AntInputProps['size'] = size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'middle';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <AntInput
        value={value}
        size={antdSize}
        status={error ? 'error' : undefined}
        style={{ width: '100%', ...style }}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </div>
  );
};
