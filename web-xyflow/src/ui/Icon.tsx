// src/ui/Icon.tsx
import React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

export interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export const Icon: React.FC<IconProps> = ({
  icon: LucideComponent,
  size = 14,
  className = '',
  ...props
}) => {
  return <LucideComponent size={size} className={`tl-icon ${className}`.trim()} {...props} />;
};
