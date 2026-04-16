/**
 * Semantic Checkbox Atom
 */

import React from 'react';
import { Checkbox as AntCheckbox } from 'antd';
import type { CheckboxProps as AntCheckboxProps } from 'antd';

export interface CheckboxProps extends Omit<AntCheckboxProps, 'onChange'> {
  onChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ onChange, ...props }) => {
  return <AntCheckbox onChange={(e) => onChange?.(e.target.checked)} {...props} />;
};
