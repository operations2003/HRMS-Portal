import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export const Alert = ({
  type = 'info',
  title,
  message,
  errors = [],
  onClose,
  className = '',
}) => {
  const types = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: AlertCircle,
      iconColor: 'text-rose-500',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    info: {
      bg: 'bg-sky-50 border-sky-200 text-sky-800',
      icon: Info,
      iconColor: 'text-sky-500',
    },
  };

  const current = types[type] || types.info;
  const Icon = current.icon;

  return (
    <div className={`rounded-xl border p-4 shadow-sm flex items-start gap-3 ${current.bg} ${className}`} role="alert">
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${current.iconColor}`} />
      <div className="flex-1 text-sm">
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        {message && <p>{message}</p>}
        {errors && errors.length > 0 && (
          <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-xs">
            {errors.map((err, idx) => (
              <li key={idx}>{typeof err === 'string' ? err : err.message}</li>
            ))}
          </ul>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors p-1 -mr-1 -mt-1 rounded-md"
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
