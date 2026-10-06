// src/ui/Toast.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastItem } from './toastContext';
import { ToastContext } from './toastContext';

export type { ToastItem };

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).slice(2, 9);
      const newToast: ToastItem = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.durationMs ?? 4500;
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const contextValue = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="tl-toast-container" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`tl-toast tl-toast--${t.type}`}>
            <div className="tl-toast__content">
              {t.type === 'success' && <CheckCircle2 size={14} color="var(--ok)" />}
              {t.type === 'error' && <AlertCircle size={14} color="var(--danger)" />}
              {t.type === 'info' && <Info size={14} color="var(--info)" />}
              <span>{t.message}</span>
            </div>

            <div className="tl-toast__actions">
              {t.action && (
                <button
                  type="button"
                  className="tl-toast__action"
                  onClick={() => {
                    t.action?.onClick();
                    removeToast(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                className="tl-icon-btn tl-toast__close"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

