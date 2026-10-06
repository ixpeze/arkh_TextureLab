// src/ui/Tooltip.tsx
import React from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  badge?: string;
  children: React.ReactElement;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  badge,
  children,
  className = '',
}) => {
  return (
    <div className={`tl-tooltip-wrapper ${className}`.trim()}>
      {children}
      <div className="tl-tooltip" role="tooltip">
        <span>{content}</span>
        {badge && <span className="tl-tooltip__badge">{badge}</span>}
      </div>
    </div>
  );
};
