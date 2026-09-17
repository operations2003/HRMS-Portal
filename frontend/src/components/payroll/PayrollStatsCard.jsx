import React from 'react';

/**
 * Currency formatter helper for INR and custom currencies
 */
export const formatMoney = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString('en-IN')}`;
  }
};

export const PayrollStatsCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'text-brand-600',
  bgLight = 'bg-brand-50',
  border = 'border-slate-200/70',
  badgeText = null,
  badgeVariant = 'neutral',
}) => {
  return (
    <div
      className={`group rounded-2xl border ${border} bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-card hover:-translate-y-1 hover:border-brand-200/80`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-brand-600 transition-colors">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-xl ${bgLight} ${color} transition-transform duration-300 group-hover:scale-110 shadow-xs`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-black text-slate-900 tracking-tight font-display">{value}</div>
          {badgeText && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {badgeText}
            </span>
          )}
        </div>
        {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
      </div>
    </div>
  );
};
