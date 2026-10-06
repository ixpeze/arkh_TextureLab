// src/ui/Segmented.tsx
import React from 'react';

export interface SegmentedItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

export interface SegmentedProps<T extends string = string> {
  items?: SegmentedItem<T>[];
  options?: SegmentedItem<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string = string>({
  items,
  options,
  value,
  onChange,
  className = '',
}: SegmentedProps<T>): React.ReactElement {
  const list = items || options || [];

  return (
    <div className={`tl-segmented ${className}`.trim()} role="group">
      {list.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            className={`tl-segmented__item ${isActive ? 'tl-segmented__item--active' : ''}`.trim()}
            onClick={() => onChange(item.value)}
            title={item.title}
            aria-pressed={isActive}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
