import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, Calendar, Clock, FileText } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';

export const RegularizeModal = ({
  isOpen,
  onClose,
  record = null,
  onSubmit,
  isLoading = false,
  apiError = null,
}) => {
  const [formData, setFormData] = useState({
    checkIn: '',
    checkOut: '',
    status: 'REGULARIZED',
    regularizationReason: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  // Helper to format ISO timestamp for input datetime-local: "YYYY-MM-DDTHH:mm"
  const toDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  };

  useEffect(() => {
    if (record) {
      setFormData({
        checkIn: toDateTimeLocal(record.checkIn),
        checkOut: toDateTimeLocal(record.checkOut),
        status: record.status || 'REGULARIZED',
        regularizationReason: '',
        notes: '',
      });
      setErrors({});
    }
  }, [record]);

  const validate = () => {
    const errs = {};
    if (!formData.regularizationReason || formData.regularizationReason.trim().length < 5) {
      errs.regularizationReason = 'Reason must be at least 5 characters long.';
    }

    if (formData.checkIn && formData.checkOut) {
      const inTime = new Date(formData.checkIn).getTime();
      const outTime = new Date(formData.checkOut).getTime();
      if (outTime < inTime) {
        errs.checkOut = 'Check-out timestamp cannot be earlier than check-in.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      status: formData.status,
      regularizationReason: formData.regularizationReason.trim(),
    };

    if (formData.checkIn) {
      payload.checkIn = new Date(formData.checkIn).toISOString();
    }
    if (formData.checkOut) {
      payload.checkOut = new Date(formData.checkOut).toISOString();
    }
    if (formData.notes && formData.notes.trim()) {
      payload.notes = formData.notes.trim();
    }

    onSubmit(record.id, payload);
  };

  const statusOptions = [
    { value: 'PRESENT', label: 'Present' },
    { value: 'LATE', label: 'Late Arrival' },
    { value: 'HALF_DAY', label: 'Half Day' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'REGULARIZED', label: 'Regularized' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Regularize Attendance Record"
      subtitle="Adjust attendance punch timestamps and status with audit justification"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <Alert variant="danger" dismissible>
            {apiError}
          </Alert>
        )}

        {record?.employee && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <span className="text-slate-500 font-medium">Employee: </span>
            <span className="font-bold text-slate-800">
              {record.employee.firstName} {record.employee.lastName} ({record.employee.employeeCode})
            </span>
            <div className="mt-0.5 text-slate-400">
              Attendance Date: {record.attendanceDate}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Adjusted Check-In Timestamp
          </label>
          <Input
            type="datetime-local"
            value={formData.checkIn}
            onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
            error={errors.checkIn}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Adjusted Check-Out Timestamp
          </label>
          <Input
            type="datetime-local"
            value={formData.checkOut}
            onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
            error={errors.checkOut}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Status Adjustment
          </label>
          <Select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={statusOptions}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            Regularization Reason <span className="text-rose-500">*</span>
          </label>
          <Input
            type="text"
            required
            value={formData.regularizationReason}
            onChange={(e) => setFormData({ ...formData, regularizationReason: e.target.value })}
            placeholder="e.g. Biometric device offline; punch verified by manager."
            error={errors.regularizationReason}
            helperText="Enforced minimum 5 characters. Stored in immutable audit trail."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Additional Audit Notes (Optional)
          </label>
          <Input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. Approved via Slack request #412"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={ShieldCheck}
            isLoading={isLoading}
          >
            Apply Regularization
          </Button>
        </div>
      </form>
    </Modal>
  );
};
