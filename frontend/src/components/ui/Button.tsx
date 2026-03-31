/**
 * Semantic Button Component
 * 
 * Uses CSS variables for colors, allowing tenant-specific branding
 * without component changes.
 * 
 * Usage:
 *   <Button variant="primary">Save</Button>
 *   <Button variant="secondary" size="lg">Cancel</Button>
 */
import React from 'react';
import { Button as AntButton } from 'antd';
import type { ButtonProps as AntButtonProps } from 'antd';

type HtmlButtonType = React.ButtonHTMLAttributes<HTMLButtonElement>['type'];

export interface ButtonProps extends Omit<AntButtonProps, 'type' | 'htmlType' | 'size' | 'variant'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  type?: HtmlButtonType;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type: htmlType,
  style,
  ...props
}) => {
  const antdSize: AntButtonProps['size'] = size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'middle';

  const { antdType, danger } = (() => {
    switch (variant) {
      case 'primary':
        return { antdType: 'primary' as const, danger: false };
      case 'secondary':
        return { antdType: 'default' as const, danger: false };
      case 'outline':
        return { antdType: 'default' as const, danger: false };
      case 'ghost':
        return { antdType: 'text' as const, danger: false };
      case 'danger':
        return { antdType: 'primary' as const, danger: true };
      default:
        return { antdType: 'default' as const, danger: false };
    }
  })();

  return (
    <AntButton
      type={antdType}
      danger={danger}
      size={antdSize}
      htmlType={htmlType}
      style={{ width: fullWidth ? '100%' : undefined, ...style }}
      {...props}
    >
      {children}
    </AntButton>
  );
};
