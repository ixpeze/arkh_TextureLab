// src/ui/Panel.tsx
import React from 'react';

export interface PanelProps {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  width?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  icon,
  actions,
  width,
  className = '',
  style,
  children,
}) => {
  // width style is dynamic geometry
  const dynamicStyle = width !== undefined ? { width, ...style } : style;

  const ariaLabel = typeof title === 'string' ? title : undefined;

  return (
    <div
      className={`tl-panel ${className}`.trim()}
      style={dynamicStyle}
      role="region"
      aria-label={ariaLabel}
    >
      {(title || actions) && (
        <div className="tl-panel__header">
          <div className="tl-panel__title">
            {icon && <span>{icon}</span>}
            {title && <span>{title}</span>}
          </div>
          {actions && <div className="tl-panel__actions">{actions}</div>}
        </div>
      )}
      <div className="tl-panel__body">{children}</div>
    </div>
  );
};

export interface PanelDividerProps {
  onDragStart: (e: React.PointerEvent) => void;
  isDragging?: boolean;
}

export const PanelDivider: React.FC<PanelDividerProps> = ({
  onDragStart,
  isDragging = false,
}) => {
  return (
    <div
      className={`tl-panel-divider ${isDragging ? 'tl-panel-divider--dragging' : ''}`.trim()}
      onPointerDown={onDragStart}
      title="Drag to resize panel"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
    />
  );
};
