import React, { useState, useEffect } from 'react';
import { Edit2, Calendar, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { exitService } from '../../services/exitService.js';

const SEPARATION_TYPES = [
  { value: 'INVOLUNTARY', label: 'Involuntary Separation' },
  { value: 'MUTUAL', label: 'Mutual Agreement' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'VOLUNTARY', label: 'Resignation' },
  { value: 'RETIREMENT', label: 'Retirement' },
];

const REASON_CATEGORIES = [
  { value: 'MISCONDUCT', label: 'Misconduct / Behavior' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'RESTRUCTURING', label: 'Restructuring / Layoff' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { value: 'ABSCONDING', label: 'Job Abandonment / Absent' },
  { value: 'MUTUAL_SEPARATION', label: 'Mutual Agreement' },
  { value: 'CONTRACT_EXPIRY', label: 'Contract Expiry' },
  { value: 'OTHER', label: 'Other Reason' },
];

export const EditTerminationModal = ({ isOpen, onClose, onSuccess, record }) => {
  const toast = useToast();

  const [exitType, setExitType] = useState('INVOLUNTARY');
  const [category, setCategory] = useState('MISCONDUCT');
  const [reasonText, setReasonText] = useState('');
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (record && isOpen) {
      setError(null);

      // Parse existing exit type
      const currentType = (record.exitType || 'INVOLUNTARY').toUpperCase();
      setExitType(currentType);

      // Parse existing reason and category
      const rawReason = record.reason || '';
      const match = rawReason.match(/^\[([A-Z_]+)\]\s*(.*)$/i);
      if (match) {
        setCategory(match[1].toUpperCase());
        setReasonText(match[2] || '');
      } else {
        // Fallback category matching exit type
        if (currentType === 'MUTUAL') setCategory('MUTUAL_SEPARATION');
        else if (currentType === 'CONTRACT_END') setCategory('CONTRACT_EXPIRY');
        else setCategory('OTHER');
        setReasonText(rawReason);
      }

      // Dates and notice period
      const lwd = record.approvedLastWorkingDay || record.requestedLastWorkingDay || '';
      setLastWorkingDay(lwd ? lwd.split('T')[0] : '');
      setNoticePeriodDays(record.noticePeriodDays ?? 0);
      setNotes(record.hrComments || record.comments || '');
    }
  }, [record, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!record?.id) return;

    if (!reasonText.trim()) {
      setError('Please enter a reason or description.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        exitType,
        terminationCategory: category,
        reason: reasonText.trim(),
        approvedLastWorkingDay: lastWorkingDay || null,
        effectiveDate: lastWorkingDay || null,
        noticePeriodDays: parseInt(noticePeriodDays, 10) || 0,
        comments: notes.trim(),
        hrComments: notes.trim(),
      };

      const updated = await exitService.updateExitRequest(record.id, payload);
      toast.success('Separation details updated successfully.');
      onSuccess?.(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update separation details:', err);
      const msg = err.message || err.response?.data?.message || 'Failed to update separation details.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !record) return null;

  const empName = record.employeeName || record.employee?.fullName || 'Employee';
  const empCode = record.employeeCode || record.employee?.empCode || '—';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Separation Details"
      subtitle={`Update separation type, grounds, and dates for ${empName} (${empCode})`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger" title="Error">
            {error}
          </Alert>
        )}

        {/* Separation Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Separation Type <span className="text-red-500">*</span>
          </label>
          <select
            value={exitType}
            onChange={(e) => {
              const val = e.target.value;
              setExitType(val);
              if (val === 'MUTUAL') setCategory('MUTUAL_SEPARATION');
              else if (val === 'CONTRACT_END') setCategory('CONTRACT_EXPIRY');
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {SEPARATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reason Category / Grounds */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Grounds / Category <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {REASON_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reason / Statement */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Reason / Description <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Explain the reason for separation..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Preview: <span className="font-mono text-indigo-600 dark:text-indigo-400">[{category}] {reasonText || '...'}</span>
          </p>
        </div>

        {/* Dates & Notice Period Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Last Working Day
            </label>
            <input
              type="date"
              value={lastWorkingDay}
              onChange={(e) => setLastWorkingDay(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notice Period (Days)
            </label>
            <input
              type="number"
              min="0"
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(e.target.value)}
              placeholder="0 for immediate"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">0 days means immediate departure</p>
          </div>
        </div>

        {/* Additional Comments / Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Internal Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes for HR or Admin records..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="flex items-center gap-1.5"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

