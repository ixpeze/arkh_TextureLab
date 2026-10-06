// src/ui/Checkbox.tsx
import React from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  className = '',
  id,
  onChange,
  onCheckedChange,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCheckedChange) {
      onCheckedChange(e.target.checked);
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <label className={`tl-checkbox ${className}`.trim()} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        className="tl-checkbox__input"
        onChange={handleChange}
        {...props}
      />
      <span className="tl-checkbox__box" aria-hidden="true">
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      {label && <span className="tl-checkbox__label">{label}</span>}
    </label>
  );
};
