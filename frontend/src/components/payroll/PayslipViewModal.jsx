import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Building2,
  User,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { TaskNeraLogo } from '../common/TaskNeraLogo.jsx';
import { formatMoney } from './PayrollStatsCard.jsx';
import { payrollService } from '../../services/payrollService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const PayslipViewModal = ({
  isOpen,
  onClose,
  payslip = null,
  record = null,
}) => {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  // Resolve record & employee data
  const data = record || payslip?.record || {};
  const employee = data.employee || payslip?.employee || {};
  const period = data.period || payslip?.period || {};
  const payslipNumber = payslip?.payslipNumber || `PS-${data.id ? data.id.slice(-6) : 'OFFICIAL'}`;
  const issueDate = payslip?.issueDate ? new Date(payslip.issueDate).toLocaleDateString() : new Date().toLocaleDateString();

  const items = data.items || [];
  const earnings = items.filter((it) => it.itemType?.toUpperCase() === 'EARNING');
  const deductions = items.filter((it) => it.itemType?.toUpperCase() === 'DEDUCTION');

  const handleDownload = async () => {
    try {
      setDownloading(true);
      if (payslip?.id) {
        await payrollService.recordPayslipDownload(payslip.id);
      }
      // Trigger print dialog as browser PDF save
      window.print();
      toast?.success?.('Payslip download recorded.');
    } catch (err) {
      toast?.error?.('Failed to process download.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Salary Payslip"
      subtitle={`Official Payslip Ref: ${payslipNumber}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Printable Payslip Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-5 gap-4">
            <div className="flex items-center gap-3">
              <TaskNeraLogo variant="icon" className="w-10 h-10" />
              <div>
                <div className="flex items-center text-lg font-black tracking-tight leading-none">
                  <span className="text-slate-900">Task</span>
                  <span className="text-brand-500">Nera</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Enterprise Human Resource Management System</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">PAYSLIP FOR</span>
              <span className="text-base font-bold text-slate-900">{period.periodName || 'Monthly Payroll'}</span>
              <div className="text-xs text-slate-500 mt-0.5">
                Issue Date: <span className="font-semibold text-slate-700">{issueDate}</span>
              </div>
            </div>
          </div>

          {/* Employee & Bank Info 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee Name:</span>
                <span className="font-bold text-slate-900">
                  {employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Employee Code:</span>
                <span className="font-mono font-semibold text-slate-800">{employee.employeeCode || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-medium text-slate-800">{employee.department || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Designation:</span>
                <span className="font-medium text-slate-800">{employee.designation || '—'}</span>
              </div>
            </div>

            <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Payslip Number:</span>
                <span className="font-mono font-semibold text-brand-600">{payslipNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-medium text-slate-800">{data.paymentMethod || 'Bank Transfer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Ref / UTR:</span>
                <span className="font-mono font-semibold text-slate-800 truncate max-w-[150px]" title={data.paymentReference}>
                  {data.paymentReference || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid / Working Days:</span>
                <span className="font-semibold text-emerald-700">
                  {data.paidDays ?? '—'} / {data.workingDays ?? '—'} days
                </span>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings Column */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/80 px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-700 uppercase">
                <span>Earnings</span>
                <span>Amount</span>
              </div>
              <div className="p-3 space-y-2 text-xs divide-y divide-slate-100">
                {earnings.length > 0 ? (
                  earnings.map((it, idx) => (
                    <div key={idx} className="flex justify-between pt-1.5 first:pt-0">
                      <span className="text-slate-600">{it.name}</span>
                      <span className="font-semibold text-slate-800">{formatMoney(it.amount, data.currency)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">Base Salary</span>
                    <span className="font-semibold text-slate-800">
                      {formatMoney(data.baseSalary || data.grossEarnings, data.currency)}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-emerald-50/70 border-t border-emerald-100 px-4 py-2.5 flex justify-between text-xs font-bold text-emerald-900">
                <span>Gross Earnings</span>
                <span>{formatMoney(data.grossEarnings, data.currency)}</span>
              </div>
            </div>

            {/* Deductions Column */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/80 px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-700 uppercase">
                <span>Deductions</span>
                <span>Amount</span>
              </div>
              <div className="p-3 space-y-2 text-xs divide-y divide-slate-100">
                {deductions.length > 0 ? (
                  deductions.map((it, idx) => (
                    <div key={idx} className="flex justify-between pt-1.5 first:pt-0">
                      <span className="text-slate-600">{it.name}</span>
                      <span className="font-semibold text-rose-700">-{formatMoney(it.amount, data.currency)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">Standard Deductions</span>
                    <span className="font-semibold text-slate-800">
                      {formatMoney(data.totalDeductions || 0, data.currency)}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-rose-50/70 border-t border-rose-100 px-4 py-2.5 flex justify-between text-xs font-bold text-rose-900">
                <span>Total Deductions</span>
                <span>{formatMoney(data.totalDeductions, data.currency)}</span>
              </div>
            </div>
          </div>

          {/* Net Salary Highlight Footer */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-brand-50 via-white to-brand-100/40 border border-brand-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-brand-700 uppercase tracking-wider block">Net Take-Home Pay</span>
              <p className="text-xs text-slate-500 mt-0.5">Amount credited to employee account</p>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {formatMoney(data.netPayable, data.currency)}
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Settled & Disbursed
              </span>
            </div>
          </div>

          {/* Note & Confidentiality Warning */}
          <div className="text-[11px] text-slate-400 text-center leading-relaxed pt-2 border-t border-slate-100">
            This is a system-generated document and requires no physical signature.
            Confidential — meant solely for the designated employee.
          </div>
        </div>

        {/* Modal footer action buttons */}
        <div className="flex items-center justify-end gap-3 print:hidden">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            icon={Download}
            isLoading={downloading}
            onClick={handleDownload}
          >
            Download / Print Payslip
          </Button>
        </div>
      </div>
    </Modal>
  );
};
