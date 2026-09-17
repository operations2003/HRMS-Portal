import React, { useState } from 'react';
import {
  Printer,
  Download,
  Calendar,
  Building2,
  User,
  CreditCard,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { TaskNeraLogo } from '../common/TaskNeraLogo.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { formatMoney } from './PayrollStatsCard.jsx';
import { payrollService } from '../../services/payrollService.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Format date string helper
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const PayslipDocument = ({
  payslip,
  onDownloadComplete,
  className = '',
}) => {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!payslip) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60">
        <FileText className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No Payslip Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Select a payslip cycle from the list to view the complete earnings, deductions, and payment statement.
        </p>
      </div>
    );
  }

  // Normalize field names (handles both SQL view snake_case and camelCase)
  const payslipId = payslip.payslip_id || payslip.id;
  const payslipNumber = payslip.payslip_number || payslip.payslipNumber || '—';
  const orgName = payslip.org_name || payslip.orgName || 'Tasknera Global HR Solutions';
  const orgCode = payslip.org_code || payslip.orgCode || 'TASKNERA';
  const empName = payslip.employee_name || payslip.employeeName || (payslip.employee ? payslip.employee.fullName : '—');
  const empCode = payslip.employee_code || payslip.employeeCode || (payslip.employee ? payslip.employee.employeeCode : '—');
  const empDept = payslip.department_name || payslip.department || (payslip.employee ? payslip.employee.department : '—');
  const empDesig = payslip.designation_title || payslip.designation || (payslip.employee ? payslip.employee.designation : '—');
  const empEmail = payslip.employee_email || payslip.email || (payslip.employee ? payslip.employee.email : '—');
  const employmentType = payslip.employment_type || payslip.employmentType || 'Full-Time';

  const periodName = payslip.period_name || payslip.periodName || '—';
  const periodCode = payslip.period_code || payslip.periodCode || '—';
  const startDate = payslip.period_start_date || payslip.startDate;
  const endDate = payslip.period_end_date || payslip.endDate;
  const paymentDate = payslip.payment_date || payslip.paymentDate;

  const currency = payslip.currency || 'INR';
  const baseSalary = payslip.base_salary !== undefined ? payslip.base_salary : payslip.baseSalary;
  const grossEarnings = payslip.gross_earnings !== undefined ? payslip.gross_earnings : payslip.grossEarnings;
  const totalDeductions = payslip.total_deductions !== undefined ? payslip.total_deductions : payslip.totalDeductions;
  const netPayable = payslip.net_payable !== undefined ? payslip.net_payable : payslip.netPayable;

  const workingDays = payslip.working_days !== undefined ? payslip.working_days : payslip.workingDays;
  const paidDays = payslip.paid_days !== undefined ? payslip.paid_days : payslip.paidDays;
  const lossOfPayDays = payslip.loss_of_pay_days !== undefined ? payslip.loss_of_pay_days : payslip.lossOfPayDays;

  const paymentStatus = payslip.payment_status || payslip.status || 'PAID';
  const paymentMethod = payslip.payment_method || payslip.paymentMethod || 'BANK_TRANSFER';
  const paymentReference = payslip.payment_reference || payslip.paymentReference || '—';
  const paidAt = payslip.paid_at || payslip.paidAt;
  const issueDate = payslip.issue_date || payslip.issueDate;
  const downloadCount = payslip.download_count !== undefined ? payslip.download_count : (payslip.downloadCount || 0);

  // Line items
  const items = Array.isArray(payslip.items) ? payslip.items : [];
  const earnings = items.filter(
    (it) => (it.item_type || it.itemType)?.toUpperCase() === 'EARNING'
  );
  const deductions = items.filter(
    (it) => (it.item_type || it.itemType)?.toUpperCase() === 'DEDUCTION'
  );

  /**
   * Handle download & print via backend endpoint integration
   */
  const handleDownloadAndPrint = async () => {
    try {
      setDownloading(true);
      if (payslipId) {
        await payrollService.recordPayslipDownload(payslipId);
        if (onDownloadComplete) onDownloadComplete(payslipId);
      }
      // Print dialog (browser Save as PDF)
      window.print();
      toast?.success?.('Payslip download recorded.');
    } catch (err) {
      console.warn('Payslip download tracking error:', err);
      // Still trigger print if recording had network issue
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Badge variant={paymentStatus === 'PAID' ? 'success' : 'info'}>
            {paymentStatus}
          </Badge>
          <span className="text-xs text-slate-500 font-mono">
            Ref: {payslipNumber}
          </span>
          {downloadCount > 0 && (
            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Downloaded {downloadCount}x
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            isLoading={downloading}
            onClick={handleDownloadAndPrint}
          >
            Download Official PDF
          </Button>
        </div>
      </div>

      {/* Official Enterprise Payslip Document */}
      <div
        id="official-payslip-document"
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6 text-slate-800 print:border-0 print:shadow-none print:p-0 print:rounded-none"
      >
        {/* Document Header */}
        <div className="flex flex-wrap items-start justify-between border-b border-slate-200 pb-5 gap-4">
          <div className="flex items-center gap-3.5">
            <TaskNeraLogo variant="icon" className="w-12 h-12" />
            <div>
              <div className="flex items-center text-xl font-black tracking-tight leading-none">
                <span className="text-slate-900">Task</span>
                <span className="text-brand-500">Nera</span>
              </div>
              <div className="text-xs font-bold text-slate-800 mt-1">{orgName}</div>
              <div className="text-[11px] text-slate-400 font-mono uppercase">
                Org Code: {orgCode} • Enterprise HRMS
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800 mb-1.5">
              PAYSLIP NUMBER: {payslipNumber}
            </div>
            <div className="text-xs text-slate-500">
              Statement Date:{' '}
              <span className="font-semibold text-slate-700">{formatDate(issueDate)}</span>
            </div>
            {paymentDate && (
              <div className="text-xs text-slate-500 mt-0.5">
                Disbursement Date:{' '}
                <span className="font-semibold text-emerald-700">{formatDate(paymentDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Employee & Payroll Period Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
          {/* Employee Information */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Employee Information
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Employee Name:</span>
              <span className="font-bold text-slate-900">{empName}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Employee Code:</span>
              <span className="font-mono font-semibold text-slate-800">{empCode}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Department:</span>
              <span className="font-semibold text-slate-800">{empDept}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Designation:</span>
              <span className="font-semibold text-slate-800">{empDesig}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Employment Type:</span>
              <span className="font-semibold text-slate-800">{employmentType}</span>
            </div>
          </div>

          {/* Payroll Period & Attendance Information */}
          <div className="space-y-1.5 md:border-l md:border-slate-200 md:pl-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Payroll Period & Attendance
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Payroll Period:</span>
              <span className="font-bold text-slate-900">{periodName}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Period Code:</span>
              <span className="font-mono font-semibold text-brand-600">{periodCode}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Cycle Dates:</span>
              <span className="font-medium text-slate-800">
                {formatDate(startDate)} — {formatDate(endDate)}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Working Days in Month:</span>
              <span className="font-semibold text-slate-800">{workingDays} days</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 font-medium">Paid Attendance Days:</span>
              <span className="font-bold text-emerald-700">
                {paidDays} days {Number(lossOfPayDays) > 0 && `(${lossOfPayDays} LOP)`}
              </span>
            </div>
          </div>
        </div>

        {/* Itemized Earnings & Deductions Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Earnings Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-emerald-50/70 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-900 uppercase tracking-wider">
              <span>Earnings Line Items</span>
              <span>Amount ({currency})</span>
            </div>
            <div className="p-3.5 space-y-2 text-xs divide-y divide-slate-100">
              {earnings.length > 0 ? (
                earnings.map((it, idx) => (
                  <div key={idx} className="flex justify-between pt-2 first:pt-0">
                    <span className="text-slate-700 font-medium">{it.item_name || it.name}</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(it.amount, currency)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between py-1">
                  <span className="text-slate-700 font-medium">Basic Salary</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(baseSalary || grossEarnings, currency)}
                  </span>
                </div>
              )}
            </div>
            <div className="bg-emerald-100/60 border-t border-emerald-200 px-4 py-3 flex justify-between text-xs font-black text-emerald-950">
              <span>Gross Earnings (A)</span>
              <span>{formatMoney(grossEarnings, currency)}</span>
            </div>
          </div>

          {/* Deductions Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-rose-50/70 px-4 py-2.5 border-b border-rose-100 flex items-center justify-between text-xs font-bold text-rose-900 uppercase tracking-wider">
              <span>Deductions Line Items</span>
              <span>Amount ({currency})</span>
            </div>
            <div className="p-3.5 space-y-2 text-xs divide-y divide-slate-100">
              {deductions.length > 0 ? (
                deductions.map((it, idx) => (
                  <div key={idx} className="flex justify-between pt-2 first:pt-0">
                    <span className="text-slate-700 font-medium">{it.item_name || it.name}</span>
                    <span className="font-semibold text-rose-700">
                      -{formatMoney(it.amount, currency)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between py-1">
                  <span className="text-slate-700 font-medium">Standard Deductions</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(totalDeductions || 0, currency)}
                  </span>
                </div>
              )}
            </div>
            <div className="bg-rose-100/60 border-t border-rose-200 px-4 py-3 flex justify-between text-xs font-black text-rose-950">
              <span>Total Deductions (B)</span>
              <span>{formatMoney(totalDeductions, currency)}</span>
            </div>
          </div>
        </div>

        {/* Net Take-Home Salary Banner */}
        <div className="p-5 rounded-xl bg-gradient-to-r from-brand-50 via-white to-brand-100/40 border border-brand-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 block">
              Net Payable Take-Home Amount (A - B)
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Net salary disbursed directly to employee bank account
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {formatMoney(netPayable, currency)}
            </div>
            <span className="text-xs font-semibold text-emerald-600 flex items-center justify-end gap-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4" /> Disbursed & Reconciled
            </span>
          </div>
        </div>

        {/* Payment & Banking Information Box */}
        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Payment & Settlement Details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-slate-400 block font-medium">Payment Mode</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {paymentMethod ? paymentMethod.replace(/_/g, ' ') : 'Direct Bank Transfer'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Transaction Reference / UTR</span>
              <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate" title={paymentReference}>
                {paymentReference}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Payment Status</span>
              <span className="font-bold text-emerald-700 mt-0.5 block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {paymentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Official Legal Footer */}
        <div className="pt-4 border-t border-slate-200 text-center text-[11px] text-slate-400 space-y-1">
          <p className="font-medium text-slate-500">
            This payslip is an official system-generated statement issued by TaskNera HRMS.
          </p>
          <p>
            Confidential document strictly intended for the recipient employee. No physical signature is required.
          </p>
        </div>
      </div>
    </div>
  );
};
