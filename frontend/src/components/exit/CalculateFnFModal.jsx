import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const CalculateFnFModal = ({
  isOpen,
  onClose,
  exitRequestId,
  employeeName = 'Employee',
  initialFnf = null,
  clearanceRecoveryTotal = 0,
  onCalculated = null,
}) => {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form fields
  const [formData, setFormData] = useState({
    payableDays: 30,
    bonusGratuity: 0,
    otherAllowances: 0,
    reimbursements: 0,
    noticePeriodRecovery: 0,
    assetRecoveryDeduction: 0,
    taxDeduction: 0,
    otherDeductions: 0,
    settlementDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialFnf) {
        setFormData({
          payableDays: initialFnf.payableDays !== undefined ? initialFnf.payableDays : 30,
          bonusGratuity: initialFnf.bonusGratuity || 0,
          otherAllowances: initialFnf.otherAllowances || 0,
          reimbursements: initialFnf.reimbursements || 0,
          noticePeriodRecovery: initialFnf.noticePeriodRecovery || 0,
          assetRecoveryDeduction:
            initialFnf.assetRecoveryDeduction !== undefined
              ? initialFnf.assetRecoveryDeduction
              : clearanceRecoveryTotal,
          taxDeduction: initialFnf.taxDeduction || 0,
          otherDeductions: initialFnf.otherDeductions || 0,
          settlementDate: initialFnf.settlementDate || new Date().toISOString().split('T')[0],
          notes: initialFnf.notes || 'Full and final settlement computed.',
        });
      } else {
        setFormData({
          payableDays: 30,
          bonusGratuity: 0,
          otherAllowances: 0,
          reimbursements: 0,
          noticePeriodRecovery: 0,
          assetRecoveryDeduction: clearanceRecoveryTotal || 0,
          taxDeduction: 0,
          otherDeductions: 0,
          settlementDate: new Date().toISOString().split('T')[0],
          notes: 'Full and final settlement computed.',
        });
      }
    }
  }, [isOpen, initialFnf, clearanceRecoveryTotal]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Live estimated totals
  const dailyRate = parseFloat(initialFnf?.dailyRate) || 0;
  const pDays = parseFloat(formData.payableDays) || 0;
  const estimatedSalary = pDays * dailyRate;
  const leaveEncashment = parseFloat(initialFnf?.leaveEncashmentAmount) || 0;
  const bonusGratuity = parseFloat(formData.bonusGratuity) || 0;
  const allowances = parseFloat(formData.otherAllowances) || 0;
  const reimbursements = parseFloat(formData.reimbursements) || 0;

  const estimatedGross = estimatedSalary + leaveEncashment + bonusGratuity + allowances + reimbursements;

  const noticeRecovery = parseFloat(formData.noticePeriodRecovery) || 0;
  const assetRecovery = parseFloat(formData.assetRecoveryDeduction) || 0;
  const taxDeduction = parseFloat(formData.taxDeduction) || 0;
  const otherDeductions = parseFloat(formData.otherDeductions) || 0;

  const estimatedDeductions = noticeRecovery + assetRecovery + taxDeduction + otherDeductions;
  const estimatedNet = Math.max(0, estimatedGross - estimatedDeductions);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!exitRequestId) {
      setError('Exit request reference missing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        payableDays: parseFloat(formData.payableDays) || 0,
        bonusGratuity: parseFloat(formData.bonusGratuity) || 0,
        otherAllowances: parseFloat(formData.otherAllowances) || 0,
        reimbursements: parseFloat(formData.reimbursements) || 0,
        noticePeriodRecovery: parseFloat(formData.noticePeriodRecovery) || 0,
        assetRecoveryDeduction: parseFloat(formData.assetRecoveryDeduction) || 0,
        taxDeduction: parseFloat(formData.taxDeduction) || 0,
        otherDeductions: parseFloat(formData.otherDeductions) || 0,
        settlementDate: formData.settlementDate,
        notes: formData.notes,
      };

      const result = await exitService.calculateFnf(exitRequestId, payload);
      toast.success('FnF settlement calculated and updated successfully.');
      onCalculated?.(result);
      onClose();
    } catch (err) {
      console.error('Calculate FnF error:', err);
      setError(err.message || 'Failed to compute FnF settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compute Full & Final Settlement"
      subtitle={`Configure dues, encashments, and recoveries for ${employeeName}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Live Calculation Preview Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Projected Net Settlement Payable</span>
            </div>
            <h3 className="text-2xl font-extrabold text-white mt-1">
              ₹ {estimatedNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            {dailyRate > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Daily Rate: ₹{dailyRate.toFixed(2)} × {pDays} payable days = ₹{estimatedSalary.toFixed(2)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs sm:border-l sm:border-slate-700 sm:pl-4">
            <div>
              <span className="text-slate-400 block text-[11px]">Gross Earnings</span>
              <span className="font-semibold text-emerald-400">
                +₹{estimatedGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Total Deductions</span>
              <span className="font-semibold text-rose-400">
                -₹{estimatedDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Earnings Group */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 border-b border-emerald-100 pb-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            <span>Earnings & Payables</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Payable Days (Salary)"
              type="number"
              min="0"
              step="0.5"
              value={formData.payableDays}
              onChange={(e) => handleChange('payableDays', e.target.value)}
              helperText="Number of working days to compensate"
              required
            />
            <Input
              label="Statutory Gratuity & Exit Bonus (₹)"
              type="number"
              min="0"
              step="0.01"
              value={formData.bonusGratuity}
              onChange={(e) => handleChange('bonusGratuity', e.target.value)}
            />
            <Input
              label="Other Allowances & Adjustments (₹)"
              type="number"
              min="0"
              step="0.01"
              value={formData.otherAllowances}
              onChange={(e) => handleChange('otherAllowances', e.target.value)}
            />
            <Input
              label="Expense Reimbursements (₹)"
              type="number"
              min="0"
              step="0.01"
              value={formData.reimbursements}
              onChange={(e) => handleChange('reimbursements', e.target.value)}
            />
          </div>
        </div>

        {/* Deductions & Recoveries Group */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 border-b border-rose-100 pb-2">
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
            <span>Deductions & Recoveries</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Notice Period Shortfall Recovery (₹)"
              type="number"
              min="0"
              step="0.01"
              value={formData.noticePeriodRecovery}
              onChange={(e) => handleChange('noticePeriodRecovery', e.target.value)}
              helperText="Unserved notice period recovery"
            />
            <Input
              label="Asset & Equipment Damage Recovery (₹)"
              type="number"
              min="0"
              step="0.01"
              value={formData.assetRecoveryDeduction}
              onChange={(e) => handleChange('assetRecoveryDeduction', e.target.value)}
              helperText={`Checklist recovery: ₹${clearanceRecoveryTotal.toFixed(2)}`}
            />
            <Input
              label="Withholding Tax / TDS Deductions (₹)"
              type="number"
              min="0"
              step="0.01"
              value={formData.taxDeduction}
              onChange={(e) => handleChange('taxDeduction', e.target.value)}
            />
            <Input
              label="Other Deductions / Advances (₹)"
              type="number"
              min="0"
              step="0.01"
              value={formData.otherDeductions}
              onChange={(e) => handleChange('otherDeductions', e.target.value)}
            />
          </div>
        </div>

        {/* Date and Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Settlement Date"
            type="date"
            value={formData.settlementDate}
            onChange={(e) => handleChange('settlementDate', e.target.value)}
            required
          />
          <Input
            label="Settlement Notes / Remarks"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Audit notes or special considerations"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={Calculator}
            isLoading={isSubmitting}
          >
            Compute & Save Settlement
          </Button>
        </div>
      </form>
    </Modal>
  );
};
