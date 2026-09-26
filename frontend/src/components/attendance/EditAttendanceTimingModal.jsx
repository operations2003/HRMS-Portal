import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  Info,
  RotateCcw,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { attendanceService } from '../../services/attendanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const EditAttendanceTimingModal = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const toast = useToast();

  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [status, setStatus] = useState('AUTO');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Helper to extract HH:MM (24-hour format) from ISO timestamp
  const extractTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  // Helper to format date string YYYY-MM-DD
  const getDateStr = (rec) => {
    if (!rec) return '';
    if (rec.attendanceDate) {
      return typeof rec.attendanceDate === 'string'
        ? rec.attendanceDate.split('T')[0]
        : new Date(rec.attendanceDate).toISOString().split('T')[0];
    }
    if (rec.checkIn) {
      return new Date(rec.checkIn).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  useEffect(() => {
    if (record) {
      setCheckInTime(extractTime(record.checkIn));
      setCheckOutTime(extractTime(record.checkOut));
      setStatus(record.status === 'LATE' ? 'AUTO' : record.status || 'AUTO');
      setReason(record.regularizationReason || '');
      setError(null);
    }
  }, [record]);

  if (!record) return null;

  const dateStr = getDateStr(record);
  const shiftTiming = record.employee?.shiftTiming || '11:00 AM - 07:00 PM';

  // Common quick reasons for late arrivals due to technical issues
  const quickReasons = [
    'Portal login delayed due to network / technical issue',
    'Biometric scanner failure; arrived on time',
    'System downtime / authentication glitch during check-in',
    'Hardware / work device malfunction during arrival',
    'Manager-approved delayed arrival due to transit issue',
  ];

  const handleApplyQuickReason = (text) => {
    setReason(text);
  };

  // Quick button to set arrival to shift start
  const handleSetToShiftStart = () => {
    // Standard shift is 11:00 AM unless configured otherwise
    if (shiftTiming.includes('11:00 AM')) {
      setCheckInTime('11:00');
    } else if (shiftTiming.includes('09:00 AM') || shiftTiming.includes('9:00 AM')) {
      setCheckInTime('09:00');
    } else if (shiftTiming.includes('10:00 AM')) {
      setCheckInTime('10:00');
    } else {
      setCheckInTime('11:00');
    }
    if (status === 'LATE') {
      setStatus('AUTO');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!reason || reason.trim().length < 5) {
      setError('Please provide a descriptive reason / text message (minimum 5 characters) explaining why timings were changed.');
      return;
    }

    if (!checkInTime) {
      setError('Check-in arrival time is required.');
      return;
    }

    try {
      setSubmitting(true);

      // Construct ISO timestamps with current date
      const [inH, inM] = checkInTime.split(':').map(Number);
      const checkInDate = new Date(`${dateStr}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00`);

      let checkOutDate = null;
      if (checkOutTime) {
        const [outH, outM] = checkOutTime.split(':').map(Number);
        checkOutDate = new Date(`${dateStr}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00`);

        // Check if checkout time is earlier than checkin (possible overnight or mistake)
        if (checkOutDate.getTime() < checkInDate.getTime()) {
          setError('Check-out time cannot be earlier than check-in arrival time.');
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate ? checkOutDate.toISOString() : undefined,
        status: status === 'AUTO' ? undefined : status,
        regularizationReason: reason.trim(),
      };

      const updated = await attendanceService.regularize(record.id, payload);

      toast.success(
        `Attendance timing adjusted successfully for ${record.employee?.firstName || 'employee'}. Status wisely set to '${updated.status || 'Updated'}'.`
      );

      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update attendance timings.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Attendance Timing"
      subtitle={`Correct arrival or departure timing and log reason`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Employee & Record Context Header */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-brand-50/30 to-slate-50 border border-slate-200/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-500" />
                {dateStr ? new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }) : 'N/A'}
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {record.employee
                  ? `${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeCode})`
                  : 'Employee Session'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Scheduled Shift: <span className="font-semibold text-slate-700">{shiftTiming}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block mb-0.5">Current Status</span>
              <Badge
                variant={
                  record.status === 'LATE'
                    ? 'warning'
                    : record.status === 'PRESENT'
                    ? 'success'
                    : 'brand'
                }
              >
                {record.status === 'LATE' ? 'Late Arrival' : record.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Informational Guidance for Late Arrival / Technical Issue */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-950 block">Late Arrival Technical Adjustment</span>
            <p className="text-amber-800 leading-relaxed">
              If the employee arrived on time but could not log in due to a technical, biometric, or network issue, you can adjust their arrival time to their actual arrival. The system will wisely update their status to <strong>Present</strong> and record your explanation in the audit log.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Timings Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Check-In Arrival Time */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Check-In (Arrival) Time <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleSetToShiftStart}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
              >
                Set to Shift Start
              </button>
            </div>
            <div className="relative">
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs"
              />
            </div>
            <span className="text-[11px] text-slate-400">
              Original: {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
            </span>
          </div>

          {/* Check-Out Departure Time */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Check-Out Time (Optional)
            </label>
            <div className="relative">
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs"
              />
            </div>
            <span className="text-[11px] text-slate-400">
              {record.checkOut
                ? `Original: ${new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Session is currently active / open'}
            </span>
          </div>
        </div>

        {/* Wise Status Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Attendance Status Outcome
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs"
          >
            <option value="AUTO">
              ⚡ Auto-Evaluate (Wisely marks Present if arrival within grace window)
            </option>
            <option value="PRESENT">
              ✅ Present (Waive Late arrival penalty completely)
            </option>
            <option value="REGULARIZED">
              🛡️ Regularized (Official Manager/HR Regularization)
            </option>
            <option value="LATE">
              ⚠️ Late Arrival (Keep marked as Late)
            </option>
            <option value="HALF_DAY">
              ⏱️ Half Day
            </option>
          </select>
          <p className="text-[11px] text-slate-400">
            Selecting &apos;Auto-Evaluate&apos; or &apos;Present&apos; removes the Late Arrival penalty if the employee arrived on time.
          </p>
        </div>

        {/* Mandatory Reason / Text Message */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Reason for Time Change (Text Message / Audit Log) <span className="text-rose-500">*</span>
          </label>

          {/* Quick Reason Suggestions Chips */}
          <div className="flex flex-wrap gap-1.5">
            {quickReasons.map((qr, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyQuickReason(qr)}
                className="text-[10px] bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 text-slate-600 px-2 py-1 rounded-lg border border-slate-200 transition-colors text-left"
              >
                + {qr}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Describe why the time was changed (e.g., Employee was present at office at 11:00 AM, but could not check in due to technical portal glitch)..."
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>This text message will appear on the employee&apos;s attendance record and audit trail.</span>
            <span>{reason.length}/500</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={CheckCircle2}
            disabled={submitting}
            isLoading={submitting}
          >
            Save &amp; Update Timing
          </Button>
        </div>
      </form>
    </Modal>
  );
};
