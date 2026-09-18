import React, { useState, useEffect } from 'react';
import { LogOut, Calendar, AlertCircle, FileText } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ResignationSubmitModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();

  const getToday = () => new Date().toISOString().split('T')[0];

  const getDefaultLwd = (fromDateStr) => {
    const d = fromDateStr ? new Date(fromDateStr) : new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    resignationDate: getToday(),
    requestedLastWorkingDay: getDefaultLwd(getToday()),
    noticePeriodDays: 30,
    exitType: 'VOLUNTARY',
    reasonCategory: 'Career Growth / Better Opportunity',
    reason: '',
    comments: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Recalculate notice period days when dates change
  useEffect(() => {
    if (formData.resignationDate && formData.requestedLastWorkingDay) {
      const d1 = new Date(formData.resignationDate);
      const d2 = new Date(formData.requestedLastWorkingDay);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          setFormData((prev) => ({ ...prev, noticePeriodDays: diffDays }));
        }
      }
    }
  }, [formData.resignationDate, formData.requestedLastWorkingDay]);

  const validate = () => {
    const errs = {};
    if (!formData.resignationDate) {
      errs.resignationDate = 'Resignation date is required.';
    }
    if (!formData.requestedLastWorkingDay) {
      errs.requestedLastWorkingDay = 'Proposed last working day is required.';
    } else if (formData.resignationDate && formData.requestedLastWorkingDay < formData.resignationDate) {
      errs.requestedLastWorkingDay = 'Proposed last day cannot be before the resignation date.';
    }

    if (!formData.reason.trim() || formData.reason.trim().length < 5) {
      errs.reason = 'Please provide a detailed reason of at least 5 characters.';
    }
    return errs;
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      setApiError(null);
      const res = await exitService.submitResignation({
        resignationDate: formData.resignationDate,
        requestedLastWorkingDay: formData.requestedLastWorkingDay,
        noticePeriodDays: parseInt(formData.noticePeriodDays, 10) || 30,
        exitType: formData.exitType,
        reason: `[${formData.reasonCategory}] ${formData.reason.trim()}`,
        comments: formData.comments.trim(),
      });
      toast.success('Resignation submitted successfully. Forwarded to your manager and HR.');
      setShowConfirm(false);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setShowConfirm(false);
      setApiError(err.message || 'Failed to submit resignation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Submit Formal Resignation"
        subtitle="Initiate formal career transition, notice period calculation, and approval routing"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handlePreSubmit} className="space-y-4">
          {apiError && <Alert variant="danger">{apiError}</Alert>}

          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex gap-3 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Standard Organizational Notice Policy: 30 Days</p>
              <p className="mt-0.5">
                Your submission will be routed to your reporting manager for review, followed by HR approval,
                departmental clearances (IT, Finance, Admin), and Full & Final settlement calculation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Resignation Date"
              type="date"
              value={formData.resignationDate}
              onChange={(e) => {
                setFormData({ ...formData, resignationDate: e.target.value });
                if (errors.resignationDate) setErrors({ ...errors, resignationDate: null });
              }}
              error={errors.resignationDate}
              required
            />

            <Input
              label="Proposed Last Working Day"
              type="date"
              value={formData.requestedLastWorkingDay}
              onChange={(e) => {
                setFormData({ ...formData, requestedLastWorkingDay: e.target.value });
                if (errors.requestedLastWorkingDay) setErrors({ ...errors, requestedLastWorkingDay: null });
              }}
              error={errors.requestedLastWorkingDay}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Calculated Notice Period (Days)"
              type="number"
              min="0"
              max="365"
              value={formData.noticePeriodDays}
              onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
              helperText="Calendar days between resignation date and proposed last working day"
              required
            />

            <Select
              label="Exit Classification"
              value={formData.exitType}
              onChange={(e) => setFormData({ ...formData, exitType: e.target.value })}
              options={[
                { value: 'VOLUNTARY', label: 'Voluntary Resignation' },
                { value: 'CONTRACT_END', label: 'End of Employment Contract' },
                { value: 'RETIREMENT', label: 'Retirement' },
                { value: 'MUTUAL', label: 'Mutual Separation' },
              ]}
            />
          </div>

          <Select
            label="Primary Reason Category"
            value={formData.reasonCategory}
            onChange={(e) => setFormData({ ...formData, reasonCategory: e.target.value })}
            options={[
              { value: 'Career Growth / Better Opportunity', label: 'Career Growth / Better Opportunity' },
              { value: 'Higher Studies / Academic Pursuits', label: 'Higher Studies / Academic Pursuits' },
              { value: 'Relocation / Geographical Change', label: 'Relocation / Geographical Change' },
              { value: 'Health / Personal Considerations', label: 'Health / Personal Considerations' },
              { value: 'Compensation & Benefits Realignment', label: 'Compensation & Benefits Realignment' },
              { value: 'Work-Life Balance / Flexible Work', label: 'Work-Life Balance / Flexible Work' },
              { value: 'Other Transition', label: 'Other Transition' },
            ]}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Detailed Statement of Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="3"
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${
                errors.reason ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-200'
              }`}
              placeholder="Please provide details regarding your departure and transition timeline..."
              value={formData.reason}
              onChange={(e) => {
                setFormData({ ...formData, reason: e.target.value });
                if (errors.reason) setErrors({ ...errors, reason: null });
              }}
            />
            {errors.reason && <p className="text-xs text-rose-600 mt-1">{errors.reason}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Transition & Handover Comments (Optional)
            </label>
            <textarea
              rows="2"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              placeholder="Outline pending deliverables, key handover contacts, or documentation links..."
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" icon={LogOut} isLoading={isSubmitting}>
              Review & Confirm Resignation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog before Final Submission */}
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Resignation Submission"
        message={`Are you sure you want to submit your formal resignation with a proposed last working day of ${formData.requestedLastWorkingDay} (${formData.noticePeriodDays} days notice)? This will initiate the formal separation workflow.`}
        confirmText="Yes, Submit Resignation"
        cancelText="Review Details"
        variant="danger"
        isLoading={isSubmitting}
      />
    </>
  );
};
