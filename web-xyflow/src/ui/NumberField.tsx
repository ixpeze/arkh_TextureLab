// src/ui/NumberField.tsx
import React, { useState } from 'react';

export interface NumberFieldProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  className = '',
  placeholder,
  size = 'md',
  'aria-label': ariaLabel,
}) => {
  const [prevValue, setPrevValue] = useState(value);
  const [text, setText] = useState(value.toString());

  if (prevValue !== value) {
    setPrevValue(value);
    setText(value.toString());
  }

  const commit = () => {
    const normalized = text.replace(',', '.').trim();
    let num = parseFloat(normalized);
    if (Number.isNaN(num)) {
      setText(value.toString());
      return;
    }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    onChange(num);
    setText(num.toString());
  };

  const sizeClass = size === 'sm' ? 'tl-number-field--sm' : '';

  return (
    <div className={`tl-number-field ${sizeClass} ${className}`.trim()}>
      <input
        type="text"
        className="tl-number-field__input nodrag"
        value={text}
        step={step}
        placeholder={placeholder}
        aria-label={ariaLabel || 'Number Input'}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setText(value.toString());
        }}
      />
    </div>
  );
};
