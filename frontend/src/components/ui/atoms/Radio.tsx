/**
 * Semantic Radio Atom
 */

import React from 'react';
import { Radio as AntRadio } from 'antd';
import type { RadioProps as AntRadioProps } from 'antd';

export interface RadioProps extends Omit<AntRadioProps, 'onChange'> {
  onChange?: (checked: boolean) => void;
}

export const Radio: React.FC<RadioProps> = ({ onChange, ...props }) => {
  return <AntRadio onChange={(e) => onChange?.(e.target.checked)} {...props} />;
};

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  disabled?: boolean;
  optionType?: 'default' | 'button';
  buttonStyle?: 'outline' | 'solid';
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  optionType = 'default',
  buttonStyle,
}) => {
  return (
    <AntRadio.Group
      value={value}
      onChange={(e) => onChange(String(e.target.value))}
      options={options}
      disabled={disabled}
      optionType={optionType}
      buttonStyle={buttonStyle}
    />
  );
};
