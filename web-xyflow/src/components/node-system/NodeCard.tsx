import React from 'react';

export interface NodeCardProps {
  selected?: boolean;
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  headerAction?: React.ReactNode;
  width?: number | string;
  minWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  selected = false,
  title,
  icon,
  accentColor = '#a855f7',
  headerAction,
  width = 172,
  minWidth = 150,
  style = {},
  children,
}) => {
  return (
    <div
      style={{
        width,
        minWidth,
        backgroundColor: 'var(--bg-card)',
        borderRadius: 8,
        border: selected
          ? '1.5px solid var(--border-active)'
          : '1px solid var(--border-subtle)',
        boxShadow: selected
          ? '0 0 0 1px var(--border-active), 0 8px 20px rgba(168, 85, 247, 0.28)'
          : '0 6px 18px rgba(0, 0, 0, 0.45)',
        overflow: 'visible', // allows handles to sit nicely on border
        fontSize: 10,
        fontFamily: "'Geist', -apple-system, sans-serif",
        transition: 'border-color 140ms ease, box-shadow 140ms ease',
        position: 'relative',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Sleek Node Header */}
      <div
        style={{
          height: 24,
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 100%)',
          backgroundColor: 'var(--bg-header)',
          borderTopLeftRadius: 7,
          borderTopRightRadius: 7,
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          {/* Accent glow pill */}
          <div
            style={{
              width: 3,
              height: 11,
              borderRadius: 1.5,
              backgroundColor: accentColor,
              boxShadow: `0 0 6px ${accentColor}`,
              flexShrink: 0,
            }}
          />

          {icon && (
            <div style={{ color: accentColor, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {icon}
            </div>
          )}

          <span
            style={{
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.02em',
              color: 'var(--text-main)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
        </div>

        {headerAction && <div style={{ flexShrink: 0 }}>{headerAction}</div>}
      </div>

      {/* Node Body with Standard Compact Padding & Spacing */}
      <div
        style={{
          padding: '5px 7px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          borderBottomLeftRadius: 7,
          borderBottomRightRadius: 7,
        }}
      >
        {children}
      </div>
    </div>
  );
};
