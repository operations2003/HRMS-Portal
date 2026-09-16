import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  AlertCircle,
  Info,
  CheckCircle2,
  Sparkles,
  Sun,
  Sunset,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { leaveService } from '../../services/leaveService.js';

const DEFAULT_LEAVE_CATEGORIES = [
  { id: 'lt-el', name: 'Emergency', code: 'EL', description: 'Leave for unforeseen emergencies and urgent personal matters' },
  { id: 'lt-sl', name: 'Sick', code: 'SL', description: 'Leave for medical and health recovery' },
  { id: 'lt-cl', name: 'Casual', code: 'CL', description: 'Casual leave for personal matters' },
];

export const ApplyLeaveModal = ({
  isOpen,
  onClose,
  onSuccess,
  leaveTypes = [],
  leaveBalances = [],
}) => {
  const effectiveLeaveTypes = leaveTypes && leaveTypes.length > 0 ? leaveTypes : DEFAULT_LEAVE_CATEGORIES;

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayPeriod: 'FIRST_HALF',
    reason: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Duration calculation preview from backend
  const [durationPreview, setDurationPreview] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Initialize or reset form on open
  useEffect(() => {
    if (isOpen) {
      const defaultType = effectiveLeaveTypes[0]?.id || '';
      const todayStr = new Date().toISOString().split('T')[0];
      setFormData({
        leaveTypeId: defaultType,
        startDate: todayStr,
        endDate: todayStr,
        isHalfDay: false,
        halfDayPeriod: 'FIRST_HALF',
        reason: '',
      });
      setFormErrors({});
      setApiError(null);
      setDurationPreview(null);
    }
  }, [isOpen, leaveTypes]);

  // Handle live duration calculation from backend when dates change
  useEffect(() => {
    if (!formData.startDate || !formData.endDate) {
      setDurationPreview(null);
      return;
    }

    if (formData.startDate > formData.endDate && !formData.isHalfDay) {
      setDurationPreview(null);
      return;
    }

    let isMounted = true;
    const calculate = async () => {
      try {
        setIsCalculating(true);
        const result = await leaveService.calculateDuration({
          startDate: formData.startDate,
          endDate: formData.isHalfDay ? formData.startDate : formData.endDate,
          isHalfDay: formData.isHalfDay,
          halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : undefined,
        });
        if (isMounted) {
          setDurationPreview(result);
        }
      } catch (err) {
        // Suppress live calculation error if dates are invalid
      } finally {
        if (isMounted) setIsCalculating(false);
      }
    };

    const timer = setTimeout(calculate, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.startDate, formData.endDate, formData.isHalfDay, formData.halfDayPeriod]);

  // Real-time client validation (backend remains authoritative)
  const validateForm = () => {
    const errs = {};

    if (!formData.leaveTypeId) {
      errs.leaveTypeId = 'Please select a leave type.';
    }

    if (!formData.startDate) {
      errs.startDate = 'Start date is required.';
    }

    if (!formData.isHalfDay) {
      if (!formData.endDate) {
        errs.endDate = 'End date is required.';
      } else if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
        errs.endDate = 'End date cannot be earlier than start date.';
      }
    }

    if (formData.isHalfDay && !formData.halfDayPeriod) {
      errs.halfDayPeriod = 'Please choose First Half or Second Half.';
    }

    if (!formData.reason || formData.reason.trim().length < 5) {
      errs.reason = 'Reason must be at least 5 characters long.';
    } else if (formData.reason.trim().length > 1000) {
      errs.reason = 'Reason cannot exceed 1000 characters.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStartDateChange = (val) => {
    setFormData((prev) => ({
      ...prev,
      startDate: val,
      endDate: prev.isHalfDay ? val : prev.endDate < val ? val : prev.endDate,
    }));
  };

  const handleHalfDayToggle = (checked) => {
    setFormData((prev) => ({
      ...prev,
      isHalfDay: checked,
      endDate: checked ? prev.startDate : prev.endDate,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setApiError(null);

      const payload = {
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate,
        endDate: formData.isHalfDay ? formData.startDate : formData.endDate,
        isHalfDay: formData.isHalfDay,
        halfDayPeriod: formData.isHalfDay ? formData.halfDayPeriod : undefined,
        reason: formData.reason.trim(),
      };

      const newRecord = await leaveService.applyLeave(payload);
      if (onSuccess) {
        onSuccess(newRecord);
      }
      onClose();
    } catch (err) {
      setApiError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Leave Category options mapping (Emergency, Sick, Casual)
  const typeOptions = effectiveLeaveTypes.map((t) => {
    return {
      value: t.id,
      label: t.name,
    };
  });

  const selectedTypeObj = effectiveLeaveTypes.find((t) => t.id === formData.leaveTypeId);
  const selectedBalanceObj = leaveBalances.find((b) => b.leaveTypeId === formData.leaveTypeId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Submit a new time-off request with duration calculation"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Alert from Server */}
        {apiError && (
          <Alert variant="danger" dismissible onDismiss={() => setApiError(null)}>
            {apiError}
          </Alert>
        )}

        {/* 1. Leave Type Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Leave Category <span className="text-rose-500">*</span>
          </label>
          <Select
            value={formData.leaveTypeId}
            onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
            options={typeOptions}
            error={formErrors.leaveTypeId}
          />
          {selectedTypeObj && (
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>{selectedTypeObj.description}</span>
              {selectedBalanceObj && (
                <span className="font-semibold text-brand-600">
                  Available: {selectedBalanceObj.remainingDays} / {selectedBalanceObj.entitledDays} days
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2. Half-Day Control (Supported by Backend) */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isHalfDay"
              checked={formData.isHalfDay}
              onChange={(e) => handleHalfDayToggle(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
            />
            <label htmlFor="isHalfDay" className="text-xs font-bold text-slate-800 cursor-pointer">
              Apply for Half Day Leave (0.5 Day)
            </label>
          </div>

          {formData.isHalfDay && (
            <div className="flex items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="halfDayPeriod"
                  value="FIRST_HALF"
                  checked={formData.halfDayPeriod === 'FIRST_HALF'}
                  onChange={(e) => setFormData({ ...formData, halfDayPeriod: e.target.value })}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>First Half (Morning)</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="halfDayPeriod"
                  value="SECOND_HALF"
                  checked={formData.halfDayPeriod === 'SECOND_HALF'}
                  onChange={(e) => setFormData({ ...formData, halfDayPeriod: e.target.value })}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <Sunset className="w-3.5 h-3.5 text-indigo-500" />
                <span>Second Half (Afternoon)</span>
              </label>
            </div>
          )}
        </div>

        {/* 3. Date Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {formData.isHalfDay ? 'Leave Date' : 'Start Date'} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              error={formErrors.startDate}
            />
          </div>

          {!formData.isHalfDay && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                End Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                min={formData.startDate}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                error={formErrors.endDate}
              />
            </div>
          )}
        </div>

        {/* 4. Backend-Calculated Duration Preview */}
        {durationPreview && (
          <div className="p-3.5 rounded-2xl bg-brand-50/60 border border-brand-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              <span className="font-semibold text-brand-900">
                Calculated Duration:{' '}
                <strong className="text-brand-700 font-bold">
                  {durationPreview.totalDays} {durationPreview.totalDays === 1 ? 'day' : 'days'}
                </strong>
              </span>
            </div>
            <div className="text-slate-500">
              {durationPreview.weekendDays > 0 && `(Excludes ${durationPreview.weekendDays} weekend days)`}
              {durationPreview.holidayDays > 0 && `(Excludes ${durationPreview.holidayDays} holiday days)`}
            </div>
          </div>
        )}

        {/* 5. Reason for Leave */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Reason for Leave <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Please specify the reason for taking leave (minimum 5 characters)..."
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              formErrors.reason
                ? 'border-rose-300 focus:ring-rose-400'
                : 'border-slate-200 focus:border-brand-500 focus:ring-brand-400/20'
            }`}
          />
          {formErrors.reason && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{formErrors.reason}</p>
          )}
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>Enforced by backend validation (minimum 5 characters).</span>
            <span>{formData.reason.length} / 1000</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={CalendarDays}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting Application...' : 'Submit Leave Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
