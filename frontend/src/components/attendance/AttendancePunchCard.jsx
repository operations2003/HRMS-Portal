import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  Timer,
  Coffee,
  Play,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';

/**
 * Format total seconds into HH:MM:SS
 */
const formatHMS = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Format break seconds into human readable string (e.g. "12m 30s" or "45 mins")
 */
const formatBreakDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatTimeOnly = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const AttendancePunchCard = ({
  todayRecord = null,
  assignedShift = '11:00 AM - 07:00 PM',
  onCheckIn,
  onCheckOut,
  onPauseBreak,
  onResumeBreak,
  isPunchingIn = false,
  isPunchingOut = false,
  isBreakLoading = false,
  error = null,
  onClearError,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [breakElapsed, setBreakElapsed] = useState('00:00:00');
  const [totalBreakFormatted, setTotalBreakFormatted] = useState('0 mins');
  const [showBreakHistory, setShowBreakHistory] = useState(false);

  // Live real-time clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live elapsed working time and live break duration every second
  useEffect(() => {
    const computeTimers = () => {
      const now = new Date();

      // Sum completed past breaks from breakHistory
      const history = Array.isArray(todayRecord?.breakHistory) ? todayRecord.breakHistory : [];
      let pastBreakSeconds = 0;

      for (const b of history) {
        if (b.durationSeconds !== undefined && b.durationSeconds !== null) {
          pastBreakSeconds += Number(b.durationSeconds);
        } else if (b.durationMinutes !== undefined && b.durationMinutes !== null) {
          pastBreakSeconds += Number(b.durationMinutes) * 60;
        } else if (b.startTime && b.endTime) {
          pastBreakSeconds += Math.max(0, Math.floor((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 1000));
        }
      }

      // Fallback if breakDurationMinutes is present without history
      if (history.length === 0 && todayRecord?.breakDurationMinutes) {
        pastBreakSeconds = Number(todayRecord.breakDurationMinutes) * 60;
      }

      // If currently on break, calculate live duration of this break
      let ongoingBreakSeconds = 0;
      if (todayRecord?.isOnBreak && todayRecord?.currentBreakStart) {
        ongoingBreakSeconds = Math.max(0, Math.floor((now.getTime() - new Date(todayRecord.currentBreakStart).getTime()) / 1000));
      }

      const totalBreakSecs = pastBreakSeconds + ongoingBreakSeconds;
      setBreakElapsed(formatHMS(ongoingBreakSeconds));
      setTotalBreakFormatted(formatBreakDuration(totalBreakSecs));

      // Calculate net working time if logged in
      if (todayRecord?.checkIn && !todayRecord?.checkOut) {
        const checkInTime = new Date(todayRecord.checkIn).getTime();
        const grossElapsedSeconds = Math.max(0, Math.floor((now.getTime() - checkInTime) / 1000));
        // Net working seconds freezes while on break because grossElapsed and ongoingBreakSecs grow at the same rate
        const netWorkingSeconds = Math.max(0, grossElapsedSeconds - totalBreakSecs);
        setElapsedTime(formatHMS(netWorkingSeconds));
      }
    };

    computeTimers();
    const interval = setInterval(computeTimers, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  const hasCheckedIn = Boolean(todayRecord?.checkIn);
  const hasCheckedOut = Boolean(todayRecord?.checkOut);
  const isOnBreak = Boolean(todayRecord?.isOnBreak);
  const breakHistory = Array.isArray(todayRecord?.breakHistory) ? todayRecord.breakHistory : [];

  // Status mapping
  let statusBadge = (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
      Not Logged In
    </span>
  );

  if (hasCheckedIn && !hasCheckedOut) {
    if (isOnBreak) {
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 ring-1 ring-amber-500/20 animate-pulse">
          <Coffee className="w-3.5 h-3.5 text-amber-600" />
          On Break (Shift Paused)
        </span>
      );
    } else {
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-500/20 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Logged In • Active Shift ({todayRecord.status || 'PRESENT'})
        </span>
      );
    }
  } else if (hasCheckedIn && hasCheckedOut) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
        Logged Out • Completed ({todayRecord.status || 'PRESENT'})
      </span>
    );
  }

  const handleLoginClick = () => {
    if (isPunchingIn || isPunchingOut) return;
    if (onClearError) onClearError();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    onCheckIn({
      timezone,
      source: 'WEB',
    });
  };

  // Direct logout without unnecessary dialogs or fixed break inputs
  const handleDirectLogout = () => {
    if (isPunchingIn || isPunchingOut || isBreakLoading) return;
    if (onClearError) onClearError();
    onCheckOut();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md">
      {/* Top Header with Live Date, Assigned Shift & Status */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 via-white to-brand-50/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-brand-500" />
              <span>
                {currentTime.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {/* Assigned Shift Time Slot Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-bold shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-brand-600" />
              <span>Shift: {assignedShift || '11:00 AM - 07:00 PM'}</span>
            </div>
          </div>

          {statusBadge}
        </div>

        {/* Large Live Digital Clock */}
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 font-mono">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-xs font-medium text-slate-400">
            ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          </span>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="px-6 pt-4">
          <Alert variant="danger" dismissible onDismiss={onClearError}>
            {error}
          </Alert>
        </div>
      )}

      {/* Middle Status & Duration Stats */}
      <div className="p-6 space-y-5">
        {/* Active Break Banner */}
        {isOnBreak && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 shadow-2xs flex items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Break in Progress
                </div>
                <div className="text-xs text-amber-700">
                  Shift paused since{' '}
                  {todayRecord?.currentBreakStart
                    ? formatTimeOnly(todayRecord.currentBreakStart)
                    : 'just now'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-amber-600 font-medium">Break Time</div>
              <div className="text-lg font-extrabold font-mono text-amber-900">{breakElapsed}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Login Time */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
              <LogIn className="w-3.5 h-3.5 text-emerald-600" />
              Login Time
            </div>
            <div className="text-sm font-bold text-slate-800">
              {todayRecord?.checkIn ? formatTimeOnly(todayRecord.checkIn) : '— : —'}
            </div>
          </div>

          {/* Logout Time */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              Logout Time
            </div>
            <div className="text-sm font-bold text-slate-800">
              {todayRecord?.checkOut ? formatTimeOnly(todayRecord.checkOut) : '— : —'}
            </div>
          </div>

          {/* Live Worked Hours (Freezes on Break) or Total Completed */}
          <div className="p-3.5 rounded-2xl bg-brand-50/50 border border-brand-100/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-700 mb-1">
              <Timer className="w-3.5 h-3.5 text-brand-600" />
              {hasCheckedIn && !hasCheckedOut ? 'Live Working Time' : 'Total Work Hours'}
            </div>
            <div className="text-sm font-bold text-brand-900 font-mono">
              {hasCheckedIn && !hasCheckedOut
                ? elapsedTime
                : todayRecord?.totalHours !== undefined
                ? `${Number(todayRecord.totalHours).toFixed(2)} hrs`
                : '0.00 hrs'}
            </div>
            {hasCheckedIn && !hasCheckedOut && isOnBreak && (
              <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                (Paused for Break)
              </span>
            )}
          </div>

          {/* Break Duration Total - Dynamically Calculated */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                Total Break
              </div>
              {breakHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBreakHistory(!showBreakHistory)}
                  className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center font-medium"
                >
                  {breakHistory.length} {breakHistory.length === 1 ? 'break' : 'breaks'}
                  {showBreakHistory ? (
                    <ChevronUp className="w-3 h-3 ml-0.5" />
                  ) : (
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  )}
                </button>
              )}
            </div>
            <div className="text-sm font-bold text-slate-800 font-mono">
              {hasCheckedIn ? totalBreakFormatted : '0 mins'}
            </div>
          </div>
        </div>

        {/* Break Sessions Breakdown (collapsible if breaks exist) */}
        {showBreakHistory && breakHistory.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2 text-xs">
            <div className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Today's Break Sessions ({breakHistory.length})</span>
              <span className="text-slate-400 font-normal">Calculated dynamically</span>
            </div>
            <div className="space-y-1.5">
              {breakHistory.map((b, idx) => {
                const durMin = b.durationMinutes ?? (b.durationSeconds ? Math.round(b.durationSeconds / 60) : 0);
                const durSec = b.durationSeconds ? `${b.durationSeconds % 60}s` : '';
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white border border-slate-200/60 text-slate-700"
                  >
                    <span className="font-medium text-slate-600">Break #{idx + 1}</span>
                    <span className="text-slate-500 font-mono">
                      {formatTimeOnly(b.startTime)} — {formatTimeOnly(b.endTime)}
                    </span>
                    <span className="font-semibold text-amber-700 font-mono">
                      {durMin}m {durSec}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action Punch Buttons */}
      <div className="p-6 pt-0">
        {!hasCheckedIn ? (
          /* 1. Show Login when employee is not logged in */
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full justify-center !py-3.5 text-sm font-bold shadow-md shadow-brand-500/20"
            icon={LogIn}
            disabled={isPunchingIn || isPunchingOut}
            isLoading={isPunchingIn}
            onClick={handleLoginClick}
          >
            {isPunchingIn ? 'Logging In...' : 'Login'}
          </Button>
        ) : !hasCheckedOut ? (
          /* 2. Show Break control + Logout when active */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {isOnBreak ? (
              <Button
                type="button"
                size="lg"
                className="w-full justify-center !py-3.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                icon={Play}
                disabled={isBreakLoading || isPunchingOut}
                isLoading={isBreakLoading}
                onClick={onResumeBreak}
              >
                {isBreakLoading ? 'Resuming...' : 'Resume Work (End Break)'}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className="w-full justify-center !py-3.5 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
                icon={Coffee}
                disabled={isBreakLoading || isPunchingOut}
                isLoading={isBreakLoading}
                onClick={onPauseBreak}
              >
                {isBreakLoading ? 'Pausing...' : 'Pause for Break'}
              </Button>
            )}

            <Button
              type="button"
              variant="danger"
              size="lg"
              className="w-full justify-center !py-3.5 text-sm font-bold shadow-md shadow-rose-600/20"
              icon={LogOut}
              disabled={isPunchingIn || isPunchingOut || isBreakLoading}
              isLoading={isPunchingOut}
              onClick={handleDirectLogout}
            >
              {isPunchingOut ? 'Logging Out...' : 'Logout'}
            </Button>
          </div>
        ) : (
          /* 3. Both completed */
          <div className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Workday Completed • Logged Out for Today</span>
          </div>
        )}
      </div>
    </div>
  );
};
