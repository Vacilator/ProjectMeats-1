/**
 * Semantic Label Atom
 */

import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label: React.FC<LabelProps> = ({ children, required = false, style, ...props }) => {
  return (
    <label
      style={{
        display: 'inline-flex',
        gap: 4,
        alignItems: 'center',
        color: 'rgb(var(--color-text-primary))',
        fontSize: 13,
        fontWeight: 500,
        ...style,
      }}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden="true" style={{ color: 'rgb(var(--color-danger))' }}>
          *
        </span>
      ) : null}
    </label>
  );
};
