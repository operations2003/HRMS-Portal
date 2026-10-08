import React, { useState, useEffect, useMemo } from 'react';
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
  Moon,
  Coffee,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { TimePicker12 } from '../common/TimePicker12.jsx';
import { attendanceService } from '../../services/attendanceService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatHoursToClock } from '../../utils/timeUtils.js';

/**
 * Robust shift timing parser
 * Handles "2:00 PM - 08:00 PM", "11:00 AM - 07:00 PM", "09:30 AM to 06:30 PM", etc.
 */
export const parseShiftTiming = (shiftStr) => {
  if (!shiftStr || typeof shiftStr !== 'string') return null;
  const parts = shiftStr.split(/[-–—]|(?:\s+to\s+)/i).map((s) => s.trim());
  const parsePart = (str) => {
    const m = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2].padStart(2, '0');
    let period = (m[3] || '').toUpperCase();
    if (!period) {
      period = h >= 12 ? 'PM' : 'AM';
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
    }
    return {
      hour: String(h).padStart(2, '0'),
      minute: min,
      period: period || 'AM',
      display: `${String(h).padStart(2, '0')}:${min} ${period}`,
    };
  };
  return {
    start: parts[0] ? parsePart(parts[0]) : null,
    end: parts[1] ? parsePart(parts[1]) : null,
  };
};

/**
 * Converts ISO string into 12-hour object { hour, minute, period }
 */
export const extractTime12 = (isoString) => {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    const hours24 = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    return {
      hour: String(hours12).padStart(2, '0'),
      minute: minutes,
      period,
    };
  } catch {
    return null;
  }
};

/**
 * Formats ISO string into 12-hour display string (e.g. "02:00 PM")
 */
export const formatTime12Display = (isoString) => {
  if (!isoString) return 'None';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'None';
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'None';
  }
};

/**
 * Extracts YYYY-MM-DD in local time
 * Prioritizes rec.checkIn so check-in and check-out are locked to the exact same calendar day
 */
export const getDateStr = (rec) => {
  if (!rec) return '';
  if (rec.checkIn) {
    const d = new Date(rec.checkIn);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  if (rec.attendanceDate) {
    if (typeof rec.attendanceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.attendanceDate.trim())) {
      return rec.attendanceDate.trim();
    }
    const d = new Date(rec.attendanceDate);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const EditAttendanceTimingModal = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const { user } = useAuth();
  const toast = useToast();

  const normRole = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isHR = normRole === 'hr' || normRole === 'hrmanager';
  const isAdmin = normRole === 'admin' || normRole === 'superadmin' || normRole === 'orgadmin';

  const isOwnRecord = Boolean(
    record &&
      user &&
      ((user.employeeId && (record.employeeId === user.employeeId || record.employee?.id === user.employeeId)) ||
        (user.id && (record.employee?.userId === user.id || record.employeeId === user.id)) ||
        (record.employee?.email && user.email && record.employee.email.toLowerCase() === user.email.toLowerCase()))
  );

  const isHRSelfAttendanceDisabled = isHR && !isAdmin && isOwnRecord;

  const [checkInTime, setCheckInTime] = useState({ hour: '02', minute: '00', period: 'PM' });
  const [checkOutTime, setCheckOutTime] = useState({ hour: '09', minute: '00', period: 'PM' });
  const [isCheckOutEnabled, setIsCheckOutEnabled] = useState(false);
  const [isNextDayDeparture, setIsNextDayDeparture] = useState(false);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [status, setStatus] = useState('AUTO');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const shiftTiming = record?.employee?.shiftTiming || '11:00 AM - 07:00 PM';
  const parsedShift = useMemo(() => parseShiftTiming(shiftTiming), [shiftTiming]);

  // Derive dateStr here (safe even if record is null — returns today)
  const dateStr = useMemo(() => getDateStr(record), [record]);

  useEffect(() => {
    if (record) {
      const parsedIn = extractTime12(record.checkIn);
      const parsedOut = extractTime12(record.checkOut);

      if (parsedIn) {
        setCheckInTime(parsedIn);
      } else if (parsedShift?.start) {
        setCheckInTime({
          hour: parsedShift.start.hour,
          minute: parsedShift.start.minute,
          period: parsedShift.start.period,
        });
      } else {
        setCheckInTime({ hour: '11', minute: '00', period: 'AM' });
      }

      if (parsedOut) {
        setCheckOutTime(parsedOut);
        setIsCheckOutEnabled(true);
      } else if (parsedShift?.end) {
        setCheckOutTime({
          hour: parsedShift.end.hour,
          minute: parsedShift.end.minute,
          period: parsedShift.end.period,
        });
        setIsCheckOutEnabled(false);
      } else {
        setCheckOutTime({ hour: '07', minute: '00', period: 'PM' });
        setIsCheckOutEnabled(false);
      }

      // When adjusting timings, ALWAYS keep on the same day by default.
      // Do NOT push to the next day unless the user explicitly checks the box.
      setIsNextDayDeparture(false);

      setStatus(record.status === 'LATE' ? 'AUTO' : record.status || 'AUTO');
      setReason(record.regularizationReason || '');
      setBreakDurationMinutes(record.breakDurationMinutes || 0);
      setIsOnBreak(Boolean(record.isOnBreak));
      setError(null);
    }
  }, [record, parsedShift]);

  // Calculate live preview metrics — MUST be before any early return (Rules of Hooks)
  const liveCalculation = useMemo(() => {
    if (!dateStr) return { valid: false };
    try {
      const safeIn = checkInTime || { hour: '11', minute: '00', period: 'AM' };
      let inH = parseInt(safeIn.hour || '11', 10);
      const inM = parseInt(safeIn.minute || '00', 10);
      if (isNaN(inH)) inH = 11;
      if (safeIn.period === 'PM' && inH < 12) inH += 12;
      if (safeIn.period === 'AM' && inH === 12) inH = 0;
      const inDate = new Date(`${dateStr}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00`);

      const breakMins = Math.max(0, parseInt(breakDurationMinutes, 10) || 0);
      const breakHours = breakMins / 60;

      if (!isCheckOutEnabled) {
        return {
          valid: true,
          checkInDate: inDate,
          checkOutDate: null,
          totalHours: null,
          breakMinutes: breakMins,
        };
      }

      const safeOut = checkOutTime || { hour: '07', minute: '00', period: 'PM' };
      let outH = parseInt(safeOut.hour || '07', 10);
      const outM = parseInt(safeOut.minute || '00', 10);
      if (isNaN(outH)) outH = 7;
      if (safeOut.period === 'PM' && outH < 12) outH += 12;
      if (safeOut.period === 'AM' && outH === 12) outH = 0;

      // Ensure checkout date is anchored on the exact same day as inDate
      const outDate = new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate(), outH, outM, 0);
      if (isNextDayDeparture) {
        outDate.setDate(outDate.getDate() + 1);
      }

      const diffMs = outDate.getTime() - inDate.getTime();
      const grossHours = Math.max(0, diffMs / (1000 * 60 * 60));
      const netHours = Math.max(0, grossHours - breakHours);

      return {
        valid: diffMs >= 0,
        checkInDate: inDate,
        checkOutDate: outDate,
        grossHours: grossHours.toFixed(2),
        breakMinutes: breakMins,
        netHours: netHours.toFixed(2),
        totalHours: netHours.toFixed(2),
        isNegative: diffMs < 0,
      };
    } catch {
      return { valid: false };
    }
  }, [dateStr, checkInTime, checkOutTime, isCheckOutEnabled, isNextDayDeparture, breakDurationMinutes]);

  // ALL hooks above — early return is safe here
  if (!record) return null;

  // Common quick reasons for timings and break adjustments
  const quickReasons = [
    'Portal login delayed due to network / technical issue',
    'Biometric scanner failure; arrived on time',
    'Break duration corrected (forgot to end break / timer mistake)',
    'Accidental break punch removed per manager confirmation',
    'System downtime / authentication glitch during check-in',
    'Manager-approved delayed arrival due to transit issue',
  ];

  const handleApplyQuickReason = (text) => {
    setReason(text);
  };

  // Quick button to set arrival to shift start
  const handleSetToShiftStart = () => {
    if (parsedShift?.start) {
      setCheckInTime({
        hour: parsedShift.start.hour,
        minute: parsedShift.start.minute,
        period: parsedShift.start.period,
      });
    } else {
      setCheckInTime({ hour: '11', minute: '00', period: 'AM' });
    }
    if (status === 'LATE') {
      setStatus('AUTO');
    }
  };

  // Quick button to set departure to shift end
  const handleSetToShiftEnd = () => {
    setIsCheckOutEnabled(true);
    if (parsedShift?.end) {
      setCheckOutTime({
        hour: parsedShift.end.hour,
        minute: parsedShift.end.minute,
        period: parsedShift.end.period,
      });
    } else {
      setCheckOutTime({ hour: '07', minute: '00', period: 'PM' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isHRSelfAttendanceDisabled) {
      setError('HR cannot modify her own attendance records. Please contact an Administrator.');
      return;
    }

    if (!reason || reason.trim().length < 5) {
      setError('Please provide a descriptive reason / text message (minimum 5 characters) explaining why timings were changed.');
      return;
    }

    if (!checkInTime || !checkInTime.hour || !checkInTime.minute || !checkInTime.period) {
      setError('Check-in arrival time is required.');
      return;
    }

    try {
      setSubmitting(true);

      // Convert check-in to 24-hr Date object
      let inH = parseInt(checkInTime.hour, 10);
      const inM = parseInt(checkInTime.minute, 10);
      if (checkInTime.period === 'PM' && inH < 12) inH += 12;
      if (checkInTime.period === 'AM' && inH === 12) inH = 0;

      const checkInDate = new Date(`${dateStr}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00`);

      let checkOutDate = null;
      if (isCheckOutEnabled && checkOutTime) {
        let outH = parseInt(checkOutTime.hour, 10);
        const outM = parseInt(checkOutTime.minute, 10);
        if (checkOutTime.period === 'PM' && outH < 12) outH += 12;
        if (checkOutTime.period === 'AM' && outH === 12) outH = 0;

        // Ensure checkout date is anchored on the exact same day as checkInDate
        checkOutDate = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate(), outH, outM, 0);
        if (isNextDayDeparture) {
          checkOutDate.setDate(checkOutDate.getDate() + 1);
        }

        // Validate ordering
        if (checkOutDate.getTime() < checkInDate.getTime()) {
          setError('Check-out departure time cannot be earlier than check-in arrival time. If this was an overnight shift, please enable "Next Day Departure".');
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate ? checkOutDate.toISOString() : undefined,
        breakDurationMinutes: Math.max(0, parseInt(breakDurationMinutes, 10) || 0),
        isOnBreak,
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
      subtitle="Correct arrival or departure timing with 12-hour AM/PM controls and audit justification"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {isHRSelfAttendanceDisabled && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>HR attendance records cannot be self-modified. Please contact an Administrator to update this record.</span>
          </div>
        )}

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
                  ? `${record.employee.firstName || ''} ${record.employee.lastName || ''}${record.employee.employeeCode ? ` (${record.employee.employeeCode})` : ''}`.trim() || 'Employee'
                  : record.employeeName || record.fullName || 'Employee Session'}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                <span>Scheduled Shift:</span>
                <span className="font-bold text-brand-700 bg-white px-2 py-0.5 rounded border border-brand-200/70 shadow-2xs">
                  {shiftTiming}
                </span>
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

        {/* Timings Inputs Grid with AM / PM Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Check-In Arrival Time (12-Hour with AM/PM) */}
          <TimePicker12
            label="Check-In (Arrival) Time"
            value={checkInTime}
            onChange={(val) => {
              setCheckInTime(val);
              if (status === 'LATE') setStatus('AUTO');
            }}
            required
            originalTimeStr={formatTime12Display(record.checkIn)}
            shiftPreset={
              parsedShift?.start
                ? {
                    label: `Shift Start (${parsedShift.start.display})`,
                    onClick: handleSetToShiftStart,
                  }
                : null
            }
            extraPresets={
              parsedShift?.start
                ? [
                    {
                      label: `${parsedShift.start.display}`,
                      onClick: handleSetToShiftStart,
                    },
                  ]
                : []
            }
          />

          {/* Check-Out Departure Time (12-Hour with AM/PM) */}
          <TimePicker12
            label="Check-Out Departure Time"
            value={checkOutTime}
            onChange={setCheckOutTime}
            isOptional
            isEnabled={isCheckOutEnabled}
            onToggleEnabled={setIsCheckOutEnabled}
            originalTimeStr={
              record.checkOut
                ? formatTime12Display(record.checkOut)
                : 'Session is currently active / open'
            }
            shiftPreset={
              parsedShift?.end
                ? {
                    label: `Shift End (${parsedShift.end.display})`,
                    onClick: handleSetToShiftEnd,
                  }
                : null
            }
            extraPresets={
              parsedShift?.end
                ? [
                    {
                      label: `${parsedShift.end.display}`,
                      onClick: handleSetToShiftEnd,
                    },
                    {
                      label: '+1h OT',
                      onClick: () => {
                        setIsCheckOutEnabled(true);
                        let h = parseInt(parsedShift.end.hour, 10) + 1;
                        let period = parsedShift.end.period;
                        if (h === 12) {
                          period = period === 'AM' ? 'PM' : 'AM';
                        } else if (h > 12) {
                          h = 1;
                        }
                        setCheckOutTime({
                          hour: String(h).padStart(2, '0'),
                          minute: parsedShift.end.minute,
                          period,
                        });
                      },
                    },
                  ]
                : []
            }
            allowClear
            onClear={() => setIsCheckOutEnabled(false)}
          />
        </div>

        {/* Overnight / Next Day Departure Toggle */}
        {isCheckOutEnabled && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isNextDayDeparture}
                onChange={(e) => setIsNextDayDeparture(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 cursor-pointer"
              />
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                Next Day Departure (Overnight shift past midnight)
              </span>
            </label>

            {liveCalculation.grossHours && (
              <span className="text-slate-600 font-medium">
                Gross Duration: <strong className="text-slate-800">{formatHoursToClock(liveCalculation.grossHours)}</strong>
                <span className="text-xs text-slate-400 ml-1">({liveCalculation.grossHours} hrs)</span>
              </span>
            )}
          </div>
        )}

        {/* Break Duration Adjustment Section for HR & Admin */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-amber-50/70 border border-amber-200/80 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shadow-2xs">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  Break Timing &amp; Duration
                  {record.breakDurationMinutes > 0 && (
                    <span className="text-[10px] font-normal normal-case text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                      Originally: {record.breakDurationMinutes}m
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-amber-800">
                  Correct break minutes if employee forgot to end break or had an accidental timer mistake.
                </p>
              </div>
            </div>

            {Number(breakDurationMinutes) !== (record.breakDurationMinutes || 0) && (
              <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                Modified: {record.breakDurationMinutes || 0}m ➔ {breakDurationMinutes}m
              </span>
            )}
          </div>

          {/* Active break indicator / toggle if record is currently marked on break */}
          {record.isOnBreak && (
            <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200 text-xs flex items-center justify-between gap-2">
              <span className="text-amber-900 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Employee session is currently marked <strong>ON BREAK</strong>
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={isOnBreak}
                  onChange={(e) => setIsOnBreak(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <span>Keep Break Active</span>
              </label>
            </div>
          )}

          {/* Controls: Input + Quick Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Break Duration (Minutes)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="720"
                  step="5"
                  value={breakDurationMinutes}
                  onChange={(e) => setBreakDurationMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full pl-3 pr-12 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  mins
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-[11px] font-semibold text-slate-500">
                Quick Presets:
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: '0m (None)', val: 0 },
                  { label: '15m', val: 15 },
                  { label: '30m (Lunch)', val: 30 },
                  { label: '45m', val: 45 },
                  { label: '60m (1 hr)', val: 60 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setBreakDurationMinutes(preset.val)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-semibold border transition-all cursor-pointer ${
                      Number(breakDurationMinutes) === preset.val
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-100/60 hover:border-amber-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Net Working Hours Breakdown */}
          {isCheckOutEnabled && liveCalculation.grossHours && (
            <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200/60 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Gross Time</span>
                <span className="font-bold text-slate-700">
                  {formatHoursToClock(liveCalculation.grossHours)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Break Deducted</span>
                <span className="font-bold text-amber-700">
                  -{breakDurationMinutes}m
                </span>
              </div>
              <div className="border-l border-amber-100 pl-2">
                <span className="text-[10px] text-slate-400 block font-medium">Net Work Time</span>
                <span className="font-bold text-brand-700">
                  {formatHoursToClock(liveCalculation.netHours)}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">({liveCalculation.netHours}h)</span>
              </div>
            </div>
          )}
        </div>

        {/* Wise Status Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Attendance Status Outcome
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs cursor-pointer"
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
                className="text-[10px] bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 text-slate-600 px-2 py-1 rounded-lg border border-slate-200 transition-colors text-left cursor-pointer"
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
            placeholder="Describe why the time was changed (e.g., Employee was present at office at 2:00 PM, but could not check in due to technical portal glitch)..."
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>This text message will appear on the employee&apos;s attendance record and audit trail.</span>
            <span>{(reason || '').length}/500</span>
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
            disabled={submitting || isHRSelfAttendanceDisabled}
            isLoading={submitting}
          >
            Save &amp; Update Timing
          </Button>
        </div>
      </form>
    </Modal>
  );
};
