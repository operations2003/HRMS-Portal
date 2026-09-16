import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Timer,
  Coffee,
  FileText,
  MapPin,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';

export const AttendancePunchCard = ({
  todayRecord = null,
  onCheckIn,
  onCheckOut,
  isPunchingIn = false,
  isPunchingOut = false,
  error = null,
  onClearError,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [breakDuration, setBreakDuration] = useState('0');
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // Live real-time clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live elapsed working time if checked in but not checked out
  useEffect(() => {
    if (todayRecord?.checkIn && !todayRecord?.checkOut) {
      const updateElapsed = () => {
        const checkInDate = new Date(todayRecord.checkIn);
        const diffMs = Math.max(0, new Date().getTime() - checkInDate.getTime());
        const totalSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        setElapsedTime(
          `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [todayRecord]);

  const hasCheckedIn = Boolean(todayRecord?.checkIn);
  const hasCheckedOut = Boolean(todayRecord?.checkOut);

  // Status mapping
  let statusBadge = (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
      Not Checked In
    </span>
  );

  if (hasCheckedIn && !hasCheckedOut) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-500/20 animate-pulse">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        Currently In Office ({todayRecord.status || 'PRESENT'})
      </span>
    );
  } else if (hasCheckedIn && hasCheckedOut) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
        Completed Workday ({todayRecord.status || 'PRESENT'})
      </span>
    );
  }

  const handlePunchInClick = () => {
    if (isPunchingIn || isPunchingOut) return;
    if (onClearError) onClearError();
    // Gather client timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    onCheckIn({
      timezone,
      source: 'WEB',
    });
  };

  const handlePunchOutConfirm = () => {
    if (isPunchingIn || isPunchingOut) return;
    if (onClearError) onClearError();
    onCheckOut({
      breakDurationMinutes: parseInt(breakDuration, 10) || 0,
      notes: checkOutNotes.trim(),
    });
    setIsCheckOutModalOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md">
        {/* Top Header with Live Date & Status */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 via-white to-brand-50/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Check-In Time */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                Check In
              </div>
              <div className="text-sm font-bold text-slate-800">
                {todayRecord?.checkIn
                  ? new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '— : —'}
              </div>
            </div>

            {/* Check-Out Time */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                Check Out
              </div>
              <div className="text-sm font-bold text-slate-800">
                {todayRecord?.checkOut
                  ? new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '— : —'}
              </div>
            </div>

            {/* Live Worked Hours or Total */}
            <div className="p-3.5 rounded-2xl bg-brand-50/50 border border-brand-100/60">
              <div className="flex items-center gap-1.5 text-xs font-medium text-brand-700 mb-1">
                <Timer className="w-3.5 h-3.5 text-brand-600" />
                {hasCheckedIn && !hasCheckedOut ? 'Live Working Time' : 'Total Work Hours'}
              </div>
              <div className="text-sm font-bold text-brand-900 font-mono">
                {hasCheckedIn && !hasCheckedOut
                  ? elapsedTime
                  : todayRecord?.totalHours
                  ? `${todayRecord.totalHours} hrs`
                  : '0.00 hrs'}
              </div>
            </div>
          </div>

          {/* Notes or regularized info if available */}
          {todayRecord?.notes && (
            <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span className="truncate">{todayRecord.notes}</span>
            </div>
          )}
        </div>

        {/* Action Punch Buttons */}
        <div className="p-6 pt-0">
          {!hasCheckedIn ? (
            /* 1. Show Check In when employee is not checked in */
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full justify-center !py-3.5 text-sm font-bold shadow-md shadow-brand-500/20"
              icon={LogIn}
              disabled={isPunchingIn || isPunchingOut}
              isLoading={isPunchingIn}
              onClick={handlePunchInClick}
            >
              {isPunchingIn ? 'Recording Check-In...' : 'Check In'}
            </Button>
          ) : !hasCheckedOut ? (
            /* 2. Show Check Out after successful check-in */
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <Button
                type="button"
                variant="danger"
                size="lg"
                className="w-full justify-center !py-3.5 text-sm font-bold shadow-md shadow-rose-600/20"
                icon={LogOut}
                disabled={isPunchingIn || isPunchingOut}
                isLoading={isPunchingOut}
                onClick={() => setIsCheckOutModalOpen(true)}
              >
                {isPunchingOut ? 'Recording Check-Out...' : 'Check Out'}
              </Button>
            </div>
          ) : (
            /* 3. Both completed */
            <div className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Workday Completed • Checked Out for Today</span>
            </div>
          )}
        </div>
      </div>

      {/* Check Out Confirmation & Remarks Modal */}
      <Modal
        isOpen={isCheckOutModalOpen}
        onClose={() => setIsCheckOutModalOpen(false)}
        title="Confirm Workday Check-Out"
        subtitle="Finalize your working hours and clock out"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to clock out for today? Total net hours and overtime will be calculated
            automatically.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-slate-500" />
              Break Duration (Minutes)
            </label>
            <Input
              type="number"
              min="0"
              max="720"
              value={breakDuration}
              onChange={(e) => setBreakDuration(e.target.value)}
              placeholder="e.g. 45"
              helperText="Duration spent on lunch or personal break (deducted from gross hours)."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Punch Remarks / Notes (Optional)
            </label>
            <Input
              type="text"
              value={checkOutNotes}
              onChange={(e) => setCheckOutNotes(e.target.value)}
              placeholder="e.g. Completed scheduled sprint tasks"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsCheckOutModalOpen(false)}
              disabled={isPunchingOut}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              icon={LogOut}
              isLoading={isPunchingOut}
              onClick={handlePunchOutConfirm}
            >
              Confirm Check-Out
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
