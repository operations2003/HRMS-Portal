import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { id, type, title, message };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message, title = 'Success', duration = 4000) =>
      addToast({ type: 'success', title, message, duration }),
    [addToast]
  );
  const showError = useCallback(
    (message, title = 'Error', duration = 5000) =>
      addToast({ type: 'error', title, message, duration }),
    [addToast]
  );
  const showWarning = useCallback(
    (message, title = 'Warning', duration = 4500) =>
      addToast({ type: 'warning', title, message, duration }),
    [addToast]
  );
  const showInfo = useCallback(
    (message, title = 'Information', duration = 4000) =>
      addToast({ type: 'info', title, message, duration }),
    [addToast]
  );

  const toast = {
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const typeStyles = {
    success: {
      border: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      iconColor: 'text-emerald-600',
    },
    error: {
      border: 'border-rose-200 bg-rose-50 text-rose-900',
      iconColor: 'text-rose-600',
    },
    warning: {
      border: 'border-amber-200 bg-amber-50 text-amber-900',
      iconColor: 'text-amber-600',
    },
    info: {
      border: 'border-sky-200 bg-sky-50 text-sky-900',
      iconColor: 'text-sky-600',
    },
  };

  const contextValue = {
    ...toast,
    toast,
    addToast,
    removeToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast floating container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info;
          const styles = typeStyles[t.type] || typeStyles.info;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-md transition-all duration-200 ${styles.border}`}
              role="alert"
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.iconColor}`} />
              <div className="flex-1 min-w-0">
                {t.title && <h5 className="text-sm font-semibold leading-snug">{t.title}</h5>}
                {t.message && (
                  <p className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 -mr-1 -mt-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition-opacity"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
