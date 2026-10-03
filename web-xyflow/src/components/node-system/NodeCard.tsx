import React from 'react';

export interface NodeCardProps {
  selected?: boolean;
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  headerAction?: React.ReactNode;
  width?: number | string;
  minWidth?: number;
  isBypassed?: boolean;
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
  isBypassed = false,
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
          : isBypassed
          ? '1px dashed rgba(239, 68, 68, 0.4)'
          : '1px solid var(--border-subtle)',
        boxShadow: selected
          ? '0 0 0 1px var(--border-active), 0 8px 20px rgba(56, 189, 248, 0.25)'
          : '0 6px 18px rgba(0, 0, 0, 0.45)',
        overflow: 'visible', // allows handles to sit nicely on border
        fontSize: 10,
        fontFamily: "'Geist', -apple-system, sans-serif",
        transition: 'border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
        position: 'relative',
        userSelect: 'none',
        opacity: isBypassed ? 0.72 : 1,
        ...style,
      }}
    >
      {/* Sleek Node Header */}
      <div
        style={{
          height: 24,
          background: isBypassed
            ? 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.08) 6px, rgba(20, 24, 34, 0.95) 6px, rgba(20, 24, 34, 0.95) 12px)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 100%)',
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
              backgroundColor: isBypassed ? '#ef4444' : accentColor,
              boxShadow: isBypassed ? '0 0 6px #ef4444' : `0 0 6px ${accentColor}`,
              flexShrink: 0,
            }}
          />

          {icon && (
            <div style={{ color: isBypassed ? '#ef4444' : accentColor, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {icon}
            </div>
          )}

          <span
            style={{
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.02em',
              color: isBypassed ? '#94a3b8' : 'var(--text-main)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>

          {isBypassed && (
            <span
              style={{
                fontSize: 7.5,
                fontWeight: 700,
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '1px 3px',
                borderRadius: 2,
                letterSpacing: 0.5,
              }}
            >
              MUTED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {headerAction && <div>{headerAction}</div>}
        </div>
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
          position: 'relative',
        }}
      >
        {isBypassed && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.03), rgba(239, 68, 68, 0.03) 8px, transparent 8px, transparent 16px)',
              pointerEvents: 'none',
              borderRadius: '0 0 7px 7px',
              zIndex: 1,
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
};
