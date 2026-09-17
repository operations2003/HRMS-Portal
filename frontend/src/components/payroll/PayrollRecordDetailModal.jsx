import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  User,
  Building,
  Briefcase,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Alert } from '../common/Alert.jsx';
import { formatMoney } from './PayrollStatsCard.jsx';
import { payrollService } from '../../services/payrollService.js';

export const PayrollRecordDetailModal = ({
  isOpen,
  onClose,
  recordId,
  initialRecord = null,
  isEmployeeSelfService = false,
  onViewPayslip = null,
}) => {
  const [record, setRecord] = useState(initialRecord);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !recordId) return;

    // Fetch full record with line items
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = isEmployeeSelfService
          ? await payrollService.getMyRecordById(recordId)
          : await payrollService.getRecordById(recordId);
        setRecord(data);
      } catch (err) {
        console.error('Failed to load payroll record detail:', err);
        setError(err.message || 'Unable to retrieve record details.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, recordId, isEmployeeSelfService]);

  if (!isOpen) return null;

  const employee = record?.employee || initialRecord?.employee || {};
  const period = record?.period || initialRecord?.period || {};
  const items = record?.items || [];
  const earnings = items.filter((it) => it.itemType?.toUpperCase() === 'EARNING');
  const deductions = items.filter((it) => it.itemType?.toUpperCase() === 'DEDUCTION');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payroll Statement Details"
      subtitle={period.periodName || 'Itemized Salary & Deductions Breakdown'}
      maxWidth="max-w-2xl"
    >
      {loading && !record ? (
        <div className="py-12">
          <LoadingSpinner message="Loading payroll statement..." />
        </div>
      ) : error ? (
        <div className="space-y-4 py-4">
          <Alert type="error" title="Error Loading Record" message={error} />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : record ? (
        <div className="space-y-6">
          {/* Header Summary Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm shadow-sm">
                {employee.firstName ? employee.firstName[0] : 'E'}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee'}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                    {employee.employeeCode || '—'}
                  </span>
                  {employee.department && (
                    <span>• {employee.department}</span>
                  )}
                  {employee.designation && (
                    <span>• {employee.designation}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Net Payable</div>
              <div className="text-xl font-black text-slate-900">
                {formatMoney(record.netPayable, record.currency)}
              </div>
              <div className="mt-1">
                <Badge
                  variant={
                    record.status === 'PAID'
                      ? 'success'
                      : record.status === 'PROCESSED'
                      ? 'info'
                      : record.status === 'PROCESSING'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {record.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Period & Attendance Information */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-200/70">
            <div>
              <span className="text-slate-400 block font-medium">Period Code</span>
              <span className="font-semibold text-slate-700 font-mono mt-0.5 block">{period.periodCode || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Working Days</span>
              <span className="font-semibold text-slate-700 mt-0.5 block">{record.workingDays ?? '—'} days</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Paid Days</span>
              <span className="font-semibold text-emerald-700 mt-0.5 block">{record.paidDays ?? '—'} days</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Loss of Pay</span>
              <span className="font-semibold text-slate-700 mt-0.5 block">{record.lossOfPayDays ?? 0} days</span>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings Section */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-emerald-50/60 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Earnings</span>
                <span className="text-xs font-black text-emerald-800">
                  {formatMoney(record.grossEarnings, record.currency)}
                </span>
              </div>
              <div className="p-3 space-y-2 text-xs">
                {earnings.length > 0 ? (
                  earnings.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-600 font-medium">{item.name}</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(item.amount, record.currency)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600 font-medium">Base Salary</span>
                    <span className="font-semibold text-slate-800">
                      {formatMoney(record.baseSalary || record.grossEarnings, record.currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Deductions Section */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-rose-50/60 px-4 py-2.5 border-b border-rose-100 flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Deductions</span>
                <span className="text-xs font-black text-rose-800">
                  {formatMoney(record.totalDeductions, record.currency)}
                </span>
              </div>
              <div className="p-3 space-y-2 text-xs">
                {deductions.length > 0 ? (
                  deductions.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-600 font-medium">{item.name}</span>
                      <span className="font-semibold text-rose-700">
                        -{formatMoney(item.amount, record.currency)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600 font-medium">Total Deductions</span>
                    <span className="font-semibold text-slate-800">
                      {formatMoney(record.totalDeductions || 0, record.currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Details Footer */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Payment Method:</span>
              <span className="font-semibold text-slate-800">{record.paymentMethod || 'Direct Deposit'}</span>
            </div>
            {record.paymentReference && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payment Reference:</span>
                <span className="font-mono font-semibold text-slate-800">{record.paymentReference}</span>
              </div>
            )}
            {record.paidAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Paid Date:</span>
                <span className="text-slate-800 font-medium">{new Date(record.paidAt).toLocaleDateString()}</span>
              </div>
            )}
            {record.notes && (
              <div className="pt-1.5 border-t border-slate-200 text-slate-600 italic">
                Note: {record.notes}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {onViewPayslip && (
              <Button
                variant="primary"
                icon={FileText}
                onClick={() => {
                  onClose();
                  onViewPayslip(record);
                }}
              >
                View Full Payslip
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
