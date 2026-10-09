import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  AlertCircle,
  Timer,
  FileText,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { attendanceService } from '../../services/attendanceService.js';

/**
 * Format total seconds to HH:MM:SS
 */
const formatHMS = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Format timestamp to 12-hour time (e.g. 07:25 PM)
 */
const formatTimeOnly = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
};

/**
 * Format duration minutes / hours to human readable string
 */
const formatDuration = (minutes, hours) => {
  const totalM = minutes !== undefined && minutes !== null ? Number(minutes) : Math.round((Number(hours) || 0) * 60);
  if (!totalM || totalM <= 0) return '0 mins';
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${m} min${m > 1 ? 's' : ''}`;
};

export const OvertimeCard = ({ todayRecord = null, onOvertimeUpdated }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [overtimeState, setOvertimeState] = useState({
    status: 'NOT_STARTED',
    canLogin: false,
    canLogout: false,
    regularAttendanceCompleted: false,
    currentRecord: null,
    todayRecords: [],
    isExempt: false,
  });
  const [liveElapsed, setLiveElapsed] = useState('00:00:00');
  const [notes, setNotes] = useState('');
  const [showNotesField, setShowNotesField] = useState(false);

  const fetchOvertimeState = useCallback(async () => {
    try {
      const res = await attendanceService.getTodayOvertime();
      setOvertimeState(res || {});
      setError(null);
    } catch (err) {
      console.error('Failed to load overtime state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOvertimeState();
  }, [fetchOvertimeState, todayRecord]);

  // Live timer tick during IN_PROGRESS overtime session
  useEffect(() => {
    if (overtimeState.status !== 'IN_PROGRESS' || !overtimeState.currentRecord?.startTime) {
      setLiveElapsed('00:00:00');
      return;
    }

    const computeLiveTime = () => {
      const startTime = new Date(overtimeState.currentRecord.startTime).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setLiveElapsed(formatHMS(diffSec));
    };

    computeLiveTime();
    const timer = setInterval(computeLiveTime, 1000);
    return () => clearInterval(timer);
  }, [overtimeState.status, overtimeState.currentRecord]);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await attendanceService.loginOvertime({
        notes: notes.trim() || undefined,
      });
      toast.success('Overtime session started successfully.');
      setNotes('');
      setShowNotesField(false);
      await fetchOvertimeState();
      if (onOvertimeUpdated) onOvertimeUpdated();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start overtime session.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await attendanceService.logoutOvertime({
        notes: notes.trim() || undefined,
      });
      toast.success('Overtime session completed successfully.');
      setNotes('');
      setShowNotesField(false);
      await fetchOvertimeState();
      if (onOvertimeUpdated) onOvertimeUpdated();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to end overtime session.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (overtimeState.isExempt) {
    return null;
  }

  const { status, canLogin, canLogout, regularAttendanceCompleted, currentRecord, todayRecords } = overtimeState;
  const isStarted = status === 'IN_PROGRESS';
  const isCompleted = status === 'COMPLETED';
  const isNotStarted = status === 'NOT_STARTED';

  // Fallback check against prop todayRecord if regular attendance was completed
  const isRegularClosed = regularAttendanceCompleted || Boolean(todayRecord?.checkIn && todayRecord?.checkOut);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/90 relative overflow-hidden transition-all">
      {/* Decorative Accent Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/5 via-brand-500/5 to-transparent rounded-full blur-2xl pointer-events-none -mr-20 -mt-20"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
            <Zap className="w-5 h-5 fill-amber-500/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Overtime (OT)</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                Post-Shift Only
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dedicated overtime session tracking. Can be started only after completing regular attendance.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isNotStarted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Not Started
            </span>
          )}
          {isStarted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 ring-1 ring-amber-500/30 animate-pulse">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              In Progress
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Completed
            </span>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mt-4">
          <Alert variant="danger" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* Metrics Row: Start Time | End Time | Overtime Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-5">
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Overtime Start</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-slate-900 tracking-tight">
            {formatTimeOnly(currentRecord?.startTime)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {currentRecord?.startTime ? 'Session start recorded' : 'Waiting to start'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Overtime End</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-slate-900 tracking-tight">
            {formatTimeOnly(currentRecord?.endTime)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {currentRecord?.endTime ? 'Session end recorded' : isStarted ? 'Currently in progress' : 'Not completed'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/70">
          <div className="flex items-center justify-between text-xs font-medium text-amber-900">
            <span>Total Overtime Duration</span>
            <Timer className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-amber-950 font-mono tracking-tight">
            {isStarted
              ? liveElapsed
              : isCompleted
              ? formatDuration(currentRecord?.durationMinutes, currentRecord?.durationHours)
              : '00:00:00'}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">
            {isStarted ? 'Live active duration' : isCompleted ? `${currentRecord?.durationHours || 0} hrs credited` : 'No duration accumulated'}
          </div>
        </div>
      </div>

      {/* Requirement Notice / Helper Message if Regular Attendance is still active */}
      {!isRegularClosed && isNotStarted && (
        <div className="mb-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-start gap-3 text-xs text-slate-600">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">Regular Shift Active: </span>
            Overtime login is enabled only after your regular shift attendance has concluded (either via manual logout or automatic shift-end grace period logout).
          </div>
        </div>
      )}

      {/* Completed session banner */}
      {isCompleted && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-between gap-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong className="font-semibold">Overtime Session Completed: </strong>
              Total duration of {formatDuration(currentRecord?.durationMinutes, currentRecord?.durationHours)} logged on {currentRecord?.overtimeDate || 'today'}.
            </span>
          </div>
        </div>
      )}

      {/* Optional Remarks Accordion during In-Progress or Before Login */}
      {(isStarted || (isNotStarted && isRegularClosed)) && (
        <div className="mb-4">
          {!showNotesField ? (
            <button
              type="button"
              onClick={() => setShowNotesField(true)}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{notes ? 'Edit Overtime Remark' : '+ Add Overtime Remark (Optional)'}</span>
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Overtime Remark / Reason
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Critical release deployment, urgent client support"
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                maxLength={200}
              />
            </div>
          )}
        </div>
      )}

      {/* Action Controls: Overtime Login / Overtime Logout */}
      <div className="pt-2">
        {isNotStarted && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full justify-center !py-3 text-sm font-bold shadow-md shadow-brand-500/10 transition-all hover:scale-[1.005] disabled:hover:scale-100 disabled:opacity-50"
            icon={LogIn}
            disabled={!isRegularClosed || submitting || loading}
            isLoading={submitting}
            onClick={handleLogin}
            title={
              !isRegularClosed
                ? 'Complete regular attendance first before starting overtime'
                : 'Start Overtime session'
            }
          >
            {submitting ? 'Starting Overtime...' : 'Overtime Login'}
          </Button>
        )}

        {isStarted && (
          <Button
            type="button"
            variant="danger"
            size="lg"
            className="w-full justify-center !py-3 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition-all hover:scale-[1.005]"
            icon={LogOut}
            disabled={submitting || loading}
            isLoading={submitting}
            onClick={handleLogout}
          >
            {submitting ? 'Ending Overtime...' : 'Overtime Logout'}
          </Button>
        )}

        {isCompleted && (
          <div className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Overtime completed for today • Session finalized</span>
          </div>
        )}
      </div>
    </div>
  );
};

