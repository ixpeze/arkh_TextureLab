// src/ui/Kbd.tsx
import React from 'react';

export interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export const Kbd: React.FC<KbdProps> = ({ children, className = '' }) => {
  return <kbd className={`tl-kbd ${className}`.trim()}>{children}</kbd>;
};
