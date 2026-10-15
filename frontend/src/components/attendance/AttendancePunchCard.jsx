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
  MapPin,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import {
  formatHoursToClock,
  formatTimeWithTimezone,
  getLiveBreakSeconds,
  getLiveBreakMinutes,
  formatLiveBreakDuration,
} from '../../utils/timeUtils.js';

const parseSingleSegmentHours = (segment) => {
  if (!segment || typeof segment !== 'string') return 8.0;
  const parts = segment.split(/\s*[-–—+]|\s+to\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return 8.0;

  const parseTime = (str) => {
    const trimmed = str.trim();
    const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2] ? parseInt(match12[2], 10) : 0;
      const period = (match12[3] || '').toUpperCase();
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return { hour: h, minute: m };
    }
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      return { hour: parseInt(match24[1], 10), minute: parseInt(match24[2], 10) };
    }
    return null;
  };

  const endPeriodMatch = parts[1].match(/(AM|PM)/i);
  const endPeriod = endPeriodMatch ? endPeriodMatch[1].toUpperCase() : null;

  let start = parseTime(parts[0]);
  let end = parseTime(parts[1]);
  if (!start || !end) return 8.0;

  if (!parts[0].match(/(AM|PM)/i) && endPeriod === 'PM' && start.hour >= 1 && start.hour <= 6) {
    start.hour += 12;
  }

  let startM = start.hour * 60 + start.minute;
  let endM = end.hour * 60 + end.minute;
  if (endM <= startM) endM += 24 * 60;

  let diff = endM - startM;
  return parseFloat((diff / 60).toFixed(2));
};

/**
 * Parse scheduled duration hours from shift timing string (e.g. "11:00 AM - 07:00 PM" -> 8.0,
 * or "01:00 PM - 04:00 PM, 10:00 PM - 01:00 AM" -> 6.0)
 */
const parseShiftDurationHours = (shiftTiming) => {
  if (!shiftTiming || typeof shiftTiming !== 'string') return 8.0;
  const segments = shiftTiming.split(/\s*[,;]\s*|\s+(?:and|&)\s+/i).map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    const total = segments.reduce((sum, seg) => sum + parseSingleSegmentHours(seg), 0);
    return parseFloat(total.toFixed(2));
  }
  return parseSingleSegmentHours(shiftTiming);
};

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

const formatTimeOnly = (dateStr, timezone = null) => {
  return formatTimeWithTimezone(dateStr, timezone);
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
  const [overtimeElapsed, setOvertimeElapsed] = useState('00:00:00');
  const [isOvertimeActive, setIsOvertimeActive] = useState(false);
  const [breakElapsed, setBreakElapsed] = useState('00:00:00');
  const [ongoingBreakSeconds, setOngoingBreakSeconds] = useState(0);
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
          pastBreakSeconds += Math.max(
            0,
            Math.floor((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 1000)
          );
        }
      }

      // Fallback if breakDurationMinutes is present without history
      if (history.length === 0 && todayRecord?.breakDurationMinutes) {
        pastBreakSeconds = Number(todayRecord.breakDurationMinutes) * 60;
      }

      // If currently on break, calculate live duration of this break
      let ongoingBreakSeconds = 0;
      if (todayRecord?.isOnBreak && todayRecord?.currentBreakStart) {
        ongoingBreakSeconds = Math.max(
          0,
          Math.floor((now.getTime() - new Date(todayRecord.currentBreakStart).getTime()) / 1000)
        );
      }

      const totalBreakSecs = pastBreakSeconds + ongoingBreakSeconds;
      setOngoingBreakSeconds(ongoingBreakSeconds);
      setBreakElapsed(formatHMS(ongoingBreakSeconds));
      setTotalBreakFormatted(formatBreakDuration(totalBreakSecs));

      // Calculate net working time if logged in
      if (todayRecord?.checkIn && !todayRecord?.checkOut) {
        const checkInTime = new Date(todayRecord.checkIn).getTime();
        const grossElapsedSeconds = Math.max(0, Math.floor((now.getTime() - checkInTime) / 1000));
        let priorSessionsSecs = 0;
        if (Array.isArray(todayRecord?.sessions)) {
          for (const s of todayRecord.sessions) {
            if (s.checkIn && s.checkOut) {
              priorSessionsSecs += s.durationSeconds || Math.round((Number(s.durationHours) || 0) * 3600);
            }
          }
        }
        const netWorkingSeconds = Math.max(0, priorSessionsSecs + grossElapsedSeconds - totalBreakSecs);
        setElapsedTime(formatHMS(netWorkingSeconds));

        // Overtime: work hours beyond scheduled shift duration (universal for all roles)
        const scheduledDurationHours = parseShiftDurationHours(assignedShift);
        const scheduledDurationSeconds = scheduledDurationHours * 3600;
        if (netWorkingSeconds > scheduledDurationSeconds) {
          const otSecs = netWorkingSeconds - scheduledDurationSeconds;
          setOvertimeElapsed(formatHMS(otSecs));
          setIsOvertimeActive(true);
        } else {
          setOvertimeElapsed('00:00:00');
          setIsOvertimeActive(false);
        }
      } else if (todayRecord?.sessions?.some((s) => s.checkIn && s.checkOut)) {
        // Between shifts or completed: show cumulative completed time
        const completedSecs = todayRecord.sessions
          .filter((s) => s.checkIn && s.checkOut)
          .reduce((sum, s) => sum + (s.durationSeconds || Math.round((Number(s.durationHours) || 0) * 3600)), 0);
        setElapsedTime(formatHMS(completedSecs));
        setIsOvertimeActive(false);
      } else {
        setIsOvertimeActive(false);
      }
    };

    computeTimers();
    const interval = setInterval(computeTimers, 1000);
    return () => clearInterval(interval);
  }, [todayRecord, assignedShift]);

  const isSplitShift = assignedShift?.includes(',') || assignedShift?.includes(';') || /\band\b|\b&\b/i.test(assignedShift);
  const splitSlots = isSplitShift
    ? assignedShift.split(/[,;]|\b(?:and|&)\b/i).map((s) => s.trim()).filter(Boolean)
    : [assignedShift];

  const sessions = Array.isArray(todayRecord?.sessions) ? todayRecord.sessions : [];
  const completedSessions = sessions.filter((s) => s.checkIn && s.checkOut);

  const hasCheckedIn = Boolean(todayRecord?.checkIn);
  const hasCheckedOut = Boolean(todayRecord?.checkOut);
  const isActivelyOnShift = Boolean(todayRecord?.checkIn && !todayRecord?.checkOut);
  const hasCompletedAllShifts = isSplitShift
    ? completedSessions.length >= splitSlots.length && !isActivelyOnShift
    : Boolean(todayRecord?.checkIn && todayRecord?.checkOut);
  const isBetweenShifts = isSplitShift && completedSessions.length > 0 && completedSessions.length < splitSlots.length && !isActivelyOnShift;
  const currentSlotIndex = completedSessions.length;
  const nextSlotLabel = isBetweenShifts ? splitSlots[currentSlotIndex] : null;

  const isOnBreak = Boolean(todayRecord?.isOnBreak);
  const breakHistory = Array.isArray(todayRecord?.breakHistory) ? todayRecord.breakHistory : [];

  // Parse time parts for styled digital clock
  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const [timeDigits, timePeriod] = timeString.split(' ');
  const userTimezone = todayRecord?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  // Status mapping
  let statusBadge = (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
      Not Logged In
    </span>
  );

  if (isActivelyOnShift) {
    if (isOnBreak) {
      const breakStartFormatted = formatTimeWithTimezone(todayRecord?.currentBreakStart, userTimezone);
      const breakMins = Math.floor(ongoingBreakSeconds / 60);
      const liveDurationText = breakMins >= 1 ? `${breakMins} mins` : `${ongoingBreakSeconds}s`;

      statusBadge = (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 ring-1 ring-amber-500/30 animate-pulse shadow-2xs">
          <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>On Break · {liveDurationText}</span>
          <span className="text-[11px] font-normal text-amber-700/90 pl-0.5">
            (Started at {breakStartFormatted})
          </span>
        </span>
      );
    } else if (isOvertimeActive) {
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 ring-1 ring-amber-500/30 animate-pulse">
          <Zap className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
          Active Shift • Overtime (OT)
        </span>
      );
    } else {
      const shiftOrdinal = isSplitShift ? `Shift ${completedSessions.length + 1} of ${splitSlots.length}` : 'Active Shift';
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          Logged In • {shiftOrdinal}
        </span>
      );
    }
  } else if (isBetweenShifts) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-indigo-600" />
        Shift 1 Finished · Ready for Shift 2
      </span>
    );
  } else if (hasCompletedAllShifts) {
    const isAutoLoggedOut = todayRecord?.notes?.includes('[SYSTEM_AUTO_LOGOUT]');
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
        {isAutoLoggedOut ? 'Auto-Logged Out (Shift Grace Period)' : `Completed (${todayRecord.status || 'PRESENT'})`}
      </span>
    );
  }

  const handleLoginClick = () => {
    if (isPunchingIn || isPunchingOut) return;
    if (onClearError) onClearError();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    onCheckIn({
      timezone,
      shiftTiming: assignedShift,
      source: 'WEB',
    });
  };

  const handleDirectLogout = () => {
    if (isPunchingIn || isPunchingOut || isBreakLoading) return;
    if (onClearError) onClearError();
    onCheckOut({
      shiftTiming: assignedShift,
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md">
      {/* Top Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-brand-50/30">
        {/* Date Row with Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span>
              {currentTime.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="shrink-0">{statusBadge}</div>
        </div>

        {/* Assigned Shift Pill(s) */}
        <div className="mb-4 flex flex-wrap gap-2">
          {isSplitShift ? (
            splitSlots.map((slot, sIdx) => {
              const isPast = completedSessions.length > sIdx;
              const isCurrent = isActivelyOnShift && completedSessions.length === sIdx;
              return (
                <div
                  key={sIdx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    isPast
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : isCurrent
                      ? 'bg-brand-50 text-brand-800 border-brand-300 ring-2 ring-brand-500/30 animate-pulse'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-brand-600' : isPast ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>
                    Shift {sIdx + 1}: {slot}
                    {isPast && ' ✓'}
                    {isCurrent && ' (Active)'}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50/80 border border-brand-200/80 text-brand-800 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span>Shift: {assignedShift || '11:00 AM - 07:00 PM'}</span>
            </div>
          )}
        </div>

        {/* Large Digital Clock with Clean AM/PM & Timezone */}
        <div className="flex flex-wrap items-baseline gap-2.5">
          <div className="flex items-baseline">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 font-mono">
              {timeDigits}
            </span>
            {timePeriod && (
              <span className="text-xl sm:text-2xl font-extrabold text-slate-800 ml-2 font-mono tracking-tight">
                {timePeriod}
              </span>
            )}
          </div>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200/60">
            {userTimezone}
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

      {/* Middle Content Section */}
      <div className="p-6 space-y-4">
        {/* Active Break Banner */}
        {isOnBreak && (
          <div className="p-4 rounded-2xl bg-amber-50/95 border border-amber-200/90 shadow-2xs flex items-center justify-between gap-3 text-amber-900 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs ring-1 ring-amber-300/40">
                <Coffee className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <span>On Break</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  <span className="text-amber-700 font-bold lowercase">
                    · {Math.floor(ongoingBreakSeconds / 60)} mins
                  </span>
                </div>
                <div className="text-xs text-amber-700 mt-0.5">
                  Started at <strong className="font-semibold text-amber-950">{formatTimeWithTimezone(todayRecord?.currentBreakStart, userTimezone)}</strong>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-amber-600 font-medium">Live Break Duration</div>
              <div className="text-base sm:text-lg font-black font-mono text-amber-950">{breakElapsed}</div>
            </div>
          </div>
        )}

        {/* Intermediate Split Shift Banner */}
        {isBetweenShifts && (
          <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/90 shadow-2xs flex items-center justify-between gap-3 text-indigo-900 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs ring-1 ring-indigo-300/40">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                  <span>Shift 1 Completed · Shift 2 Ready</span>
                </div>
                <div className="text-xs text-indigo-700 mt-0.5">
                  Shift 1 recorded. Next shift: <strong className="font-semibold text-indigo-950">{nextSlotLabel || '10:00 PM - 01:00 AM'}</strong>. Click Login below when ready.
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-indigo-600 font-medium">Shift 1 Worked</div>
              <div className="text-base sm:text-lg font-black font-mono text-indigo-950">
                {formatHoursToClock(completedSessions[0]?.durationHours || 0)}
              </div>
            </div>
          </div>
        )}

        {/* 2x2 Clean Metrics Grid - Eliminates squishing & overlapping */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* 1. Login Time */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between min-w-0 transition-all hover:bg-slate-50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <LogIn className="w-3 h-3" />
              </div>
              <span className="truncate">
                {isSplitShift && completedSessions.length > 0 && isActivelyOnShift ? `Shift ${completedSessions.length + 1} Login` : 'Login Time'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono tracking-tight truncate">
              {todayRecord?.checkIn ? formatTimeOnly(todayRecord.checkIn) : '— : —'}
            </div>
          </div>

          {/* 2. Logout Time */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between min-w-0 transition-all hover:bg-slate-50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <LogOut className="w-3 h-3" />
              </div>
              <span className="truncate">
                {isBetweenShifts ? 'Shift 1 Logout' : 'Logout Time'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono tracking-tight truncate">
              {isBetweenShifts && completedSessions[0]?.checkOut
                ? formatTimeOnly(completedSessions[0].checkOut)
                : todayRecord?.checkOut
                ? formatTimeOnly(todayRecord.checkOut)
                : '— : —'}
            </div>
          </div>

          {/* 3. Work Hours */}
          <div className="p-4 rounded-2xl bg-brand-50/40 border border-brand-200/60 flex flex-col justify-between min-w-0 transition-all hover:bg-brand-50/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-800 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Timer className="w-3 h-3" />
              </div>
              <span className="truncate">
                {hasCheckedIn && !hasCheckedOut ? 'Live Working Time' : 'Total Work Hours'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold text-brand-950 font-mono tracking-tight truncate">
              {hasCheckedIn && !hasCheckedOut
                ? elapsedTime
                : formatHoursToClock(todayRecord?.totalHours)}
            </div>
            {hasCheckedIn && !hasCheckedOut && isOnBreak && (
              <span className="text-[10px] text-amber-700 font-semibold mt-0.5 truncate">
                (Shift Paused)
              </span>
            )}
            {hasCheckedIn && !hasCheckedOut && !isOnBreak && isOvertimeActive && (
              <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 font-bold mt-1 bg-purple-100 px-1.5 py-0.5 rounded-full w-fit">
                <Zap className="w-2.5 h-2.5" /> +{overtimeElapsed} OT
              </span>
            )}
            {hasCheckedOut && Number(todayRecord?.overtimeHours || todayRecord?.overtime_hours || 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 font-bold mt-1 bg-purple-100 px-1.5 py-0.5 rounded-full w-fit">
                <Zap className="w-2.5 h-2.5" /> OT: +{formatHoursToClock(todayRecord?.overtimeHours || todayRecord?.overtime_hours)}
              </span>
            )}
          </div>

          {/* 4. Total Break */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between min-w-0 transition-all hover:bg-slate-50">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 min-w-0">
                <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Coffee className="w-3 h-3" />
                </div>
                <span className="truncate">Total Break</span>
              </div>
              {breakHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBreakHistory(!showBreakHistory)}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors shrink-0 shadow-2xs"
                  title="Toggle break sessions details"
                >
                  <span>{breakHistory.length}</span>
                  <span>{breakHistory.length === 1 ? 'break' : 'breaks'}</span>
                  {showBreakHistory ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono tracking-tight truncate">
              {hasCheckedIn ? totalBreakFormatted : '0 mins'}
            </div>
          </div>
        </div>

        {/* Break History expandable panel */}
        {showBreakHistory && (breakHistory.length > 0 || isOnBreak) && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 transition-all animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                Today's Break Sessions ({breakHistory.length + (isOnBreak ? 1 : 0)})
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Total paused: <strong className="text-slate-800">{totalBreakFormatted}</strong>
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {breakHistory.map((b, idx) => {
                const s = b.startTime ? formatTimeOnly(b.startTime, userTimezone) : '—';
                const e = b.endTime ? formatTimeOnly(b.endTime, userTimezone) : '—';
                const dur = b.durationMinutes != null
                  ? `${b.durationMinutes} mins`
                  : (b.durationSeconds ? `${Math.round(b.durationSeconds / 60)} mins` : '—');
                return (
                  <div
                    key={b.id || idx}
                    className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-white border border-slate-200/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200">
                        {idx + 1}
                      </span>
                      <span className="text-slate-700 font-medium">
                        {s} → {e}
                      </span>
                    </div>
                    <span className="font-mono font-semibold shrink-0 text-slate-600">
                      {dur}
                    </span>
                  </div>
                );
              })}

              {/* Ongoing active break session in history panel */}
              {isOnBreak && todayRecord?.currentBreakStart && (
                <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-amber-50/95 border border-amber-300 text-amber-900 animate-pulse">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-950 font-bold text-[10px] flex items-center justify-center shrink-0 border border-amber-300">
                      {breakHistory.length + 1}
                    </span>
                    <span className="text-amber-900 font-semibold truncate">
                      Started at {formatTimeWithTimezone(todayRecord.currentBreakStart, userTimezone)} → Ongoing
                    </span>
                  </div>
                  <span className="font-mono font-bold shrink-0 text-amber-900">
                    {breakElapsed}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Auto-logout system note banner if applicable */}
      {todayRecord?.notes?.includes('[SYSTEM_AUTO_LOGOUT]') && (
        <div className="mx-6 mb-2 p-3 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-800 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">System Auto-Logout:</span> This session was automatically closed after your shift's 20-minute grace period ended. Total hours have been finalized up to the scheduled cutoff.
          </div>
        </div>
      )}

      {/* Action Punch Buttons */}
      <div className="p-6 pt-2">
        {!hasCheckedIn ? (
          /* 1. Show Login when employee is not logged in */
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full justify-center !py-3.5 text-sm font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-[1.01]"
            icon={LogIn}
            disabled={isPunchingIn || isPunchingOut}
            isLoading={isPunchingIn}
            onClick={handleLoginClick}
          >
            {isPunchingIn ? 'Logging In...' : isSplitShift ? `Login (Shift 1: ${splitSlots[0] || '1:00 PM - 4:00 PM'})` : 'Login'}
          </Button>
        ) : isActivelyOnShift ? (
          /* 2. Show Break control + Logout when active */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {isOnBreak ? (
              <Button
                type="button"
                size="lg"
                className="w-full justify-center !py-3.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01]"
                icon={Play}
                disabled={isBreakLoading || isPunchingOut}
                isLoading={isBreakLoading}
                onClick={onResumeBreak}
              >
                {isBreakLoading ? 'Ending Break...' : 'End Break (Resume Work)'}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className="w-full justify-center !py-3.5 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
                icon={Coffee}
                disabled={isBreakLoading || isPunchingOut}
                isLoading={isBreakLoading}
                onClick={onPauseBreak}
              >
                {isBreakLoading ? 'Starting Break...' : 'Start Break (Pause Shift)'}
              </Button>
            )}

            <Button
              type="button"
              variant="danger"
              size="lg"
              className="w-full justify-center !py-3.5 text-sm font-bold shadow-md shadow-rose-600/20 transition-all hover:scale-[1.01]"
              icon={LogOut}
              disabled={isPunchingIn || isPunchingOut || isBreakLoading}
              isLoading={isPunchingOut}
              onClick={handleDirectLogout}
            >
              {isPunchingOut ? 'Logging Out...' : isSplitShift ? `Logout (Shift ${completedSessions.length + 1})` : 'Logout'}
            </Button>
          </div>
        ) : isBetweenShifts ? (
          /* 2b. Split Shift intermediate: Log in to Shift 2 */
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full justify-center !py-3.5 text-sm font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-[1.01]"
            icon={LogIn}
            disabled={isPunchingIn || isPunchingOut}
            isLoading={isPunchingIn}
            onClick={handleLoginClick}
          >
            {isPunchingIn ? 'Logging In to Shift 2...' : `Login (Shift 2: ${nextSlotLabel || '10:00 PM - 01:00 AM'})`}
          </Button>
        ) : (
          /* 3. Both / all completed */
          <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-emerald-50/40 to-slate-50 border border-slate-200/90 text-center flex items-center justify-center gap-2.5 text-sm font-bold text-slate-700 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              {isSplitShift
                ? `Workday Completed • Both Shifts Finished (Total: ${formatHoursToClock(todayRecord?.totalHours || 0)})`
                : 'Workday Completed • Logged Out for Today'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
