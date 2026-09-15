import React from 'react';

export const Badge = ({ children, variant = 'neutral', size = 'md', className = '' }) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/10',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/10',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/10',
    info: 'bg-sky-50 text-sky-700 border-sky-200 ring-sky-600/10',
    brand: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-600/10',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-600/10',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs font-medium',
  };

  // Map common status values to badge variants automatically if matching
  let resolvedVariant = variant;
  if (typeof children === 'string') {
    const s = children.toLowerCase();
    if (['active', 'completed', 'approved', 'full-time'].includes(s)) resolvedVariant = 'success';
    if (['on leave', 'pending', 'contract', 'in progress'].includes(s)) resolvedVariant = 'warning';
    if (['inactive', 'terminated', 'rejected', 'deleted'].includes(s)) resolvedVariant = 'danger';
    if (['superadmin', 'orgadmin'].includes(s)) resolvedVariant = 'brand';
    if (['hrmanager'].includes(s)) resolvedVariant = 'info';
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border ring-1 ring-inset ${
        variants[resolvedVariant] || variants.neutral
      } ${sizes[size] || sizes.md} ${className}`}
    >
      {children}
    </span>
  );
};
