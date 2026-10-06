// src/ui/Dialog.tsx
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: number | string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  width = 540,
  footer,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus first focusable element inside dialog
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Dynamic geometry: width is allowed
  const dynamicStyle = typeof width === 'number' ? { width } : { width: width || 'auto' };

  return (
    <div
      className="tl-dialog__backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="tl-dialog"
        style={dynamicStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tl-dialog-title"
      >
        <div className="tl-dialog__header">
          <h2 id="tl-dialog-title" className="tl-dialog__title">
            {title}
          </h2>
          <IconButton
            icon={<X size={14} />}
            title="Close dialog (Esc)"
            onClick={onClose}
          />
        </div>

        <div className="tl-dialog__body">{children}</div>

        {footer && <div className="tl-dialog__footer">{footer}</div>}
      </div>
    </div>
  );
};
