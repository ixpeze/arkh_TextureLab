import React from 'react';
import { ChevronDown, Check } from 'lucide-react';

/* ========================================================================= */
/* 1. NODE SLIDER                                                            */
/* ========================================================================= */
export interface NodeSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  accentColor?: string;
  onChange: (value: number) => void;
}

export const NodeSlider: React.FC<NodeSliderProps> = ({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit = '',
  accentColor = '#a855f7',
  onChange,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 8.5,
            fontFamily: "'Geist Mono', monospace",
            color: '#f8fafc',
            fontWeight: 600,
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-subtle)',
            padding: '0 4px',
            borderRadius: 2,
            lineHeight: '13px',
          }}
        >
          {typeof value === 'number' ? (Number.isInteger(step) ? value : value.toFixed(2)) : value}
          {unit}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: 3,
          accentColor,
          cursor: 'pointer',
          borderRadius: 2,
          margin: '2px 0 0 0',
        }}
      />
    </div>
  );
};

/* ========================================================================= */
/* 2. NODE INPUT (TEXT & NUMBER)                                            */
/* ========================================================================= */
export interface NodeInputProps {
  label?: string;
  value: string | number;
  type?: 'text' | 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  onChange: (value: any) => void;
}

export const NodeInput: React.FC<NodeInputProps> = ({
  label,
  value,
  type = 'text',
  placeholder = '',
  min,
  max,
  step,
  prefix,
  suffix,
  onChange,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && (
        <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          {label}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(12, 14, 20, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
          padding: '2px 5px',
          gap: 4,
          transition: 'border-color 120ms ease',
        }}
      >
        {prefix && (
          <span style={{ fontSize: 8.5, fontFamily: 'monospace', color: 'var(--text-dim)' }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          min={min}
          max={max}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 9,
            fontFamily: type === 'number' ? "'Geist Mono', monospace" : 'inherit',
            color: '#f8fafc',
            fontWeight: 500,
          }}
        />
        {suffix && (
          <span style={{ fontSize: 8.5, fontFamily: 'monospace', color: 'var(--text-dim)' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 3. NODE TOGGLE / SWITCH                                                  */
/* ========================================================================= */
export interface NodeToggleProps {
  label: string;
  checked: boolean;
  activeColor?: string;
  onChange: (checked: boolean) => void;
}

export const NodeToggle: React.FC<NodeToggleProps> = ({
  label,
  checked,
  activeColor = '#a855f7',
  onChange,
}) => {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        padding: '2px 0',
      }}
    >
      <span style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 500 }}>{label}</span>
      <div
        style={{
          width: 22,
          height: 12,
          borderRadius: 6,
          backgroundColor: checked ? activeColor : 'rgba(255, 255, 255, 0.1)',
          position: 'relative',
          transition: 'background-color 140ms ease',
          boxShadow: checked ? `0 0 6px ${activeColor}60` : 'none',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            position: 'absolute',
            top: 2,
            left: checked ? 12 : 2,
            transition: 'left 140ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 4. NODE CHECKBOX                                                          */
/* ========================================================================= */
export interface NodeCheckboxProps {
  label: string;
  checked: boolean;
  activeColor?: string;
  onChange: (checked: boolean) => void;
}

export const NodeCheckbox: React.FC<NodeCheckboxProps> = ({
  label,
  checked,
  activeColor = '#a855f7',
  onChange,
}) => {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        padding: '2px 0',
      }}
    >
      <div
        style={{
          width: 11,
          height: 11,
          borderRadius: 2.5,
          backgroundColor: checked ? activeColor : 'rgba(12, 14, 20, 0.8)',
          border: checked ? `1px solid ${activeColor}` : '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 120ms ease',
        }}
      >
        {checked && <Check size={8} color="#ffffff" strokeWidth={3} />}
      </div>
      <span style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 500 }}>{label}</span>
    </div>
  );
};

/* ========================================================================= */
/* 5. NODE SELECT / DROPDOWN                                                */
/* ========================================================================= */
export interface NodeSelectProps {
  label?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

export const NodeSelect: React.FC<NodeSelectProps> = ({
  label,
  value,
  options,
  onChange,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && (
        <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          {label}
        </span>
      )}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(12, 14, 20, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
        }}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 9,
            color: '#f8fafc',
            fontWeight: 500,
            padding: '3px 18px 3px 6px',
            appearance: 'none',
            cursor: 'pointer',
          }}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{ backgroundColor: '#151822', color: '#f8fafc' }}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={10}
          color="#94a3b8"
          style={{ position: 'absolute', right: 5, pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 6. NODE DIVIDER                                                          */
/* ========================================================================= */
export const NodeDivider: React.FC<{ style?: React.CSSProperties }> = ({ style = {} }) => (
  <div
    style={{
      height: 1,
      backgroundColor: 'var(--border-subtle)',
      margin: '2px 0',
      ...style,
    }}
  />
);

/* ========================================================================= */
/* 7. NODE BADGE                                                            */
/* ========================================================================= */
export interface NodeBadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'solid' | 'subtle';
}

export const NodeBadge: React.FC<NodeBadgeProps> = ({
  children,
  color = '#a855f7',
  variant = 'subtle',
}) => {
  return (
    <span
      style={{
        fontSize: 7.5,
        fontWeight: 700,
        fontFamily: "'Geist Mono', monospace",
        color: variant === 'solid' ? '#0c0e14' : color,
        backgroundColor: variant === 'solid' ? color : `${color}18`,
        border: `1px solid ${color}${variant === 'solid' ? 'ff' : '35'}`,
        padding: '1px 4px',
        borderRadius: 3,
        letterSpacing: 0.4,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        lineHeight: '11px',
      }}
    >
      {children}
    </span>
  );
};
