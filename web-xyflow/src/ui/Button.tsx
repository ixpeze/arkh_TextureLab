// src/ui/Button.tsx
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}) => {
  const variantClass = `tl-btn--${variant}`;
  const sizeClass = size === 'sm' ? 'tl-btn--sm' : '';
  const fullClass = `tl-btn ${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <button type="button" className={fullClass} {...props}>
      {icon && <span className="tl-btn__icon">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
};
