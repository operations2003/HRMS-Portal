import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ShieldAlert,
  AlertTriangle,
  UserX,
  CheckCircle2,
  Calendar,
  Building2,
  DollarSign,
  Calculator,
  RefreshCw,
  Clock,
  KeyRound,
  FileCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { Badge } from '../common/Badge.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const CheckFnFAndRevokeModal = ({
  isOpen,
  onClose,
  onSuccess,
  record,
}) => {
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // FnF numbers state
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [dailyRate, setDailyRate] = useState(0);
  const [payableDays, setPayableDays] = useState(30);
  const [salaryPayable, setSalaryPayable] = useState(0);
  const [leaveEncashmentDays, setLeaveEncashmentDays] = useState(0);
  const [leaveEncashmentAmount, setLeaveEncashmentAmount] = useState(0);
  const [bonusGratuity, setBonusGratuity] = useState(0);
  const [otherAllowances, setOtherAllowances] = useState(0);
  const [noticeRecovery, setNoticeRecovery] = useState(0);
  const [assetDeduction, setAssetDeduction] = useState(0);
  const [taxDeduction, setTaxDeduction] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [notes, setNotes] = useState('FnF checked and credentials revoked upon resignation completion.');

  const requestId = record?.id || record?.exitRequestId;

  const emp = record?.employee;
  const empName =
    record?.employeeName ||
    emp?.fullName ||
    `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() ||
    'Employee';
  const empCode = record?.employeeCode || emp?.employeeCode || emp?.empCode || '—';
  const dept = record?.department || emp?.department?.name || '—';
  const lwd = record?.approvedLastWorkingDay || record?.requestedLastWorkingDay || '—';

  // Load or calculate FnF details
  useEffect(() => {
    if (isOpen && requestId) {
      loadFnfData();
    }
  }, [isOpen, requestId]);

  const loadFnfData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await exitService.getFnf(requestId);
      if (data) {
        setMonthlySalary(parseFloat(data.monthlySalary || (data.dailyRate ? data.dailyRate * 30 : 0)) || 0);
        setDailyRate(parseFloat(data.dailyRate) || 0);
        setPayableDays(parseFloat(data.payableDays ?? 30));
        setSalaryPayable(parseFloat(data.salaryPayable) || 0);
        setLeaveEncashmentDays(parseFloat(data.leaveEncashmentDays) || 0);
        setLeaveEncashmentAmount(parseFloat(data.leaveEncashmentAmount) || 0);
        setBonusGratuity(parseFloat(data.bonusGratuity) || 0);
        setOtherAllowances(parseFloat(data.otherAllowances) || 0);
        setNoticeRecovery(parseFloat(data.noticePeriodRecovery) || 0);
        setAssetDeduction(parseFloat(data.assetRecoveryDeduction) || 0);
        setTaxDeduction(parseFloat(data.taxDeduction) || 0);
        setOtherDeductions(parseFloat(data.otherDeductions) || 0);
        if (data.notes) setNotes(data.notes);
      }
    } catch (err) {
      console.warn('Could not load FnF automatically:', err);
      setError('Could not fetch prior settlement calculations. You can verify and input settlement amounts directly below.');
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate salary payable when payableDays changes
  const computedSalaryPayable = Math.round((payableDays * dailyRate) * 100) / 100;
  const grossAdditions = Math.round((computedSalaryPayable + leaveEncashmentAmount + (parseFloat(bonusGratuity) || 0) + (parseFloat(otherAllowances) || 0)) * 100) / 100;
  const totalDeductions = Math.round(((parseFloat(noticeRecovery) || 0) + (parseFloat(assetDeduction) || 0) + (parseFloat(taxDeduction) || 0) + (parseFloat(otherDeductions) || 0)) * 100) / 100;
  const netSettlement = Math.max(0, Math.round((grossAdditions - totalDeductions) * 100) / 100);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleConfirmSettleAndRevoke = async (e) => {
    e.preventDefault();
    if (!requestId) {
      setError('Missing resignation reference ID.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        payableDays: parseFloat(payableDays) || 30,
        bonusGratuity: parseFloat(bonusGratuity) || 0,
        otherAllowances: parseFloat(otherAllowances) || 0,
        noticePeriodRecovery: parseFloat(noticeRecovery) || 0,
        assetRecoveryDeduction: parseFloat(assetDeduction) || 0,
        taxDeduction: parseFloat(taxDeduction) || 0,
        otherDeductions: parseFloat(otherDeductions) || 0,
        netSettlementAmount: netSettlement,
        notes: notes.trim(),
        comments: `Credentials revoked and FnF settled for ${empName} (${formatCurrency(netSettlement)}).`,
      };

      const result = await exitService.settleFnfAndRevokeCredentials(requestId, payload);

      toast.success(
        `FnF settled (${formatCurrency(netSettlement)}) and credentials permanently deleted for ${empName}. This employee cannot log in again.`
      );

      onSuccess?.(result);
      onClose();
    } catch (err) {
      console.error('Failed to settle FnF and revoke credentials:', err);
      setError(err.message || 'Failed to complete FnF and credential revocation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check FnF & Revoke Credentials"
      subtitle={`Verify Full & Final settlement and revoke system login credentials for ${empName}`}
      maxWidth="max-w-2xl"
    >
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-500 font-medium">Computing Full & Final settlement balances...</p>
        </div>
      ) : (
        <form onSubmit={handleConfirmSettleAndRevoke} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Employee Profile Header */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                src={record?.avatarUrl || emp?.avatarUrl}
                alt={empName}
                name={empName}
                size="md"
                className="ring-1 ring-slate-300 dark:ring-slate-600"
              />
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{empName}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {empCode} • {dept}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">Last Working Day</span>
              <span className="font-semibold text-xs text-emerald-700 dark:text-emerald-400">{lwd}</span>
            </div>
          </div>

          {/* FnF Breakdown Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Full & Final (FnF) Statement
                </h4>
              </div>
              <Badge variant="brand" size="xs">
                {dailyRate > 0 ? `Daily Rate: ${formatCurrency(dailyRate)}` : 'Calculated Standard'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Working Days & Salary */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Payable Working Days
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="90"
                    value={payableDays}
                    onChange={(e) => setPayableDays(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-xs font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                  />
                  <span className="text-slate-500 font-medium">days =</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(computedSalaryPayable)}
                  </span>
                </div>
              </div>

              {/* Leave Encashment */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Leave Encashment Balance
                </span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {leaveEncashmentDays} days = {formatCurrency(leaveEncashmentAmount)}
                </p>
              </div>

              {/* Bonus / Gratuity Addition */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Bonus / Gratuity Additions (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bonusGratuity}
                  onChange={(e) => setBonusGratuity(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Total Deductions */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Deductions / Notice Shortfall (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={noticeRecovery}
                  onChange={(e) => setNoticeRecovery(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Total Net Settlement Highlight Banner */}
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">
                  Net Settlement Payable
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Gross: {formatCurrency(grossAdditions)} - Deductions: {formatCurrency(totalDeductions)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatCurrency(netSettlement)}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Settlement & Revocation Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or reference numbers"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Security Notice: Credential Deletion */}
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 flex gap-3 text-xs text-rose-900 dark:text-rose-200">
            <KeyRound className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-950 dark:text-rose-100 flex items-center gap-1.5">
                <span>Immediate Credential Revocation & Deletion</span>
              </p>
              <p className="leading-relaxed text-rose-800 dark:text-rose-300 text-[11px]">
                Confirming will permanently delete this employee's username and password, terminate all active portal
                sessions, and mark their status as <span className="font-bold underline">Exited</span>. They will
                <strong> never be able to log in to the system again</strong>.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              icon={UserX}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isSubmitting ? 'Revoking Access...' : 'Approve FnF & Revoke Credentials'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
