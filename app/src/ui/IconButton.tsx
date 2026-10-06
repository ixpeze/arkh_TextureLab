// src/ui/IconButton.tsx
import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  title?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  title,
  label,
  size = 'md',
  variant,
  active = false,
  className = '',
  ...props
}) => {
  const activeClass = active ? 'tl-icon-btn--active' : '';
  const sizeClass = size === 'sm' ? 'tl-icon-btn--sm' : size === 'lg' ? 'tl-icon-btn--lg' : '';
  const variantClass = variant ? `tl-icon-btn--${variant}` : '';
  const fullClass = `tl-icon-btn ${activeClass} ${sizeClass} ${variantClass} ${className}`.trim();
  const accessibleLabel = label || title || props['aria-label'] || 'Button';

  return (
    <button
      type="button"
      className={fullClass}
      title={title || label}
      aria-label={accessibleLabel}
      {...props}
    >
      {icon}
    </button>
  );
};
