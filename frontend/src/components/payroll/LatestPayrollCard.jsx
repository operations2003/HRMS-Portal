import React from 'react';
import {
  Wallet,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  FileText,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { formatMoney } from './PayrollStatsCard.jsx';

export const LatestPayrollCard = ({
  record,
  onViewDetails,
  onViewPayslip,
  hasPayslip = false,
}) => {
  if (!record) {
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 mb-3 shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Payroll Record Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            There is no payroll statement available for your account yet. Payroll statements will appear here once processed by your HR/Finance department.
          </p>
        </div>
      </div>
    );
  }

  const period = record.period || {};
  const statusVariant =
    record.status === 'PAID'
      ? 'success'
      : record.status === 'PROCESSED'
      ? 'info'
      : record.status === 'PROCESSING'
      ? 'warning'
      : record.status === 'CANCELLED'
      ? 'danger'
      : 'neutral';

  const formatPeriodDate = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-sm transition-all hover:shadow-md">
      {/* Decorative top accent gradient */}
      <div className="h-1.5 w-full bg-gradient-to-r from-brand-600 via-cyan-500 to-indigo-600" />

      <div className="p-5 sm:p-6 lg:p-7">
        {/* Header bar: Title & Period Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-extrabold text-slate-900">
                  {period.periodName || 'Current Payroll Statement'}
                </h2>
                <Badge variant={statusVariant}>{record.status}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {formatPeriodDate(period.startDate)} — {formatPeriodDate(period.endDate)}
                </span>
                {period.periodCode && (
                  <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {period.periodCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-2">
            {onViewDetails && (
              <Button
                variant="secondary"
                size="sm"
                icon={FileText}
                onClick={() => onViewDetails(record)}
              >
                View Breakdown
              </Button>
            )}
            {hasPayslip && onViewPayslip && (
              <Button
                variant="primary"
                size="sm"
                icon={ArrowUpRight}
                onClick={() => onViewPayslip(record)}
              >
                Payslip
              </Button>
            )}
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 pb-6">
          {/* Net Payable (Hero) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-brand-50/70 via-white to-brand-100/30 border border-brand-100/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Net Take-Home Pay
              </span>
              <span className="text-[10px] font-semibold text-brand-600 bg-brand-100/60 px-2 py-0.5 rounded-full">
                Final Payable
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight mt-2">
              {formatMoney(record.netPayable, record.currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Disbursed directly after standard deductions
            </p>
          </div>

          {/* Gross Earnings */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Gross Earnings
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
              {formatMoney(record.grossEarnings, record.currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Base salary + allowances & incentives
            </p>
          </div>

          {/* Total Deductions */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Total Deductions
              </span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
              {formatMoney(record.totalDeductions, record.currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Statutory taxes, PF & adjustments
            </p>
          </div>
        </div>

        {/* Payment & Attendance Metadata footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Payment Status</span>
            <div className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
              {record.status === 'PAID' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-700">Settled & Paid</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-slate-700">{record.status}</span>
                </>
              )}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Payment Method</span>
            <div className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <span>{record.paymentMethod ? record.paymentMethod.replace(/_/g, ' ') : 'Direct Deposit'}</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Payment Reference</span>
            <div className="font-mono text-[11px] font-semibold text-slate-700 mt-0.5 truncate" title={record.paymentReference || '—'}>
              {record.paymentReference || '—'}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Attendance & Days</span>
            <div className="font-semibold text-slate-800 mt-0.5">
              <span className="text-emerald-600">{record.paidDays ?? '—'}</span> / {record.workingDays ?? '—'} Paid Days
              {Number(record.lossOfPayDays) > 0 && (
                <span className="text-rose-600 text-[11px] ml-1">({record.lossOfPayDays} LOP)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
