import React from 'react';
import {
  Calendar,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Laptop,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';

export const AttendanceDetailModal = ({ isOpen, onClose, record = null }) => {
  if (!record) return null;

  const formatTimestamp = (ts) => {
    if (!ts) return 'Not recorded';
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  };

  const getStatusVariant = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'PRESENT':
        return 'success';
      case 'LATE':
        return 'warning';
      case 'HALF_DAY':
        return 'info';
      case 'ABSENT':
        return 'danger';
      case 'REGULARIZED':
        return 'brand';
      default:
        return 'neutral';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attendance Record Details"
      subtitle={`Detailed punch telemetry and audit log`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-brand-50/40 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-brand-500" />
              {record.attendanceDate ? new Date(record.attendanceDate).toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }) : 'N/A'}
            </div>
            {record.employee && (
              <div className="mt-1 text-base font-bold text-slate-900">
                {record.employee.firstName} {record.employee.lastName}{' '}
                <span className="text-xs font-medium text-slate-500">
                  ({record.employee.employeeCode})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(record.status)} size="md">
              {record.status}
            </Badge>
            {record.isRegularized && (
              <Badge variant="brand" size="md">
                Regularized
              </Badge>
            )}
          </div>
        </div>

        {/* Timestamps & Hours Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <LogIn className="w-4 h-4 text-emerald-600" />
              Check-In Punch
            </div>
            <div className="text-sm font-bold text-slate-900">
              {formatTimestamp(record.checkIn)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <LogOut className="w-4 h-4 text-rose-600" />
              Check-Out Punch
            </div>
            <div className="text-sm font-bold text-slate-900">
              {formatTimestamp(record.checkOut)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Clock className="w-4 h-4 text-brand-600" />
              Net Total Hours
            </div>
            <div className="text-sm font-bold text-slate-900 font-mono">
              {record.totalHours !== undefined ? `${record.totalHours} hrs` : '0.00 hrs'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Break: {record.breakDurationMinutes || 0} mins
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Overtime Duration
            </div>
            <div className="text-sm font-bold text-slate-900 font-mono">
              {record.overtimeHours !== undefined ? `${record.overtimeHours} hrs` : '0.00 hrs'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Beyond 8 standard shift hours
            </div>
          </div>
        </div>

        {/* Device & Punch Metadata */}
        <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Punch Telemetry & Verification
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Punch Source</span>
              <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5 text-slate-500" />
                {record.source || 'WEB'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">IP Address</span>
              <span className="font-semibold text-slate-800 font-mono">
                {record.ipAddress || 'Recorded Internally'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Timezone</span>
              <span className="font-semibold text-slate-800">
                {record.timezone || 'UTC'}
              </span>
            </div>
          </div>
        </div>

        {/* Regularization Details if applicable */}
        {record.isRegularized && (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
              <UserCheck className="w-4 h-4 text-amber-600" />
              Regularization Audit Trail
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <div>
                <span className="font-semibold text-slate-800">Reason:</span>{' '}
                {record.regularizationReason || 'No detailed reason provided.'}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Regularized At:</span>{' '}
                {formatTimestamp(record.regularizedAt)}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {record.notes && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Punch Remarks / Notes
            </div>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {record.notes}
            </p>
          </div>
        )}

        {/* Close Button */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
