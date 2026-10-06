// src/ui/Select.tsx
import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({
  options,
  className = '',
  ...props
}) => {
  return (
    <div className="tl-select">
      <select className={`tl-select__input nodrag ${className}`.trim()} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="tl-select__chevron" />
    </div>
  );
};
