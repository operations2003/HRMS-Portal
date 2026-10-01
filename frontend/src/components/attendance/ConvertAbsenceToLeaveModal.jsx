import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Umbrella,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  FileText,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { attendanceService } from '../../services/attendanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ConvertAbsenceToLeaveModal = ({
  isOpen,
  onClose,
  record = null,
  onSuccess,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [optionsData, setOptionsData] = useState(null);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && record?.id) {
      setLoading(true);
      setError(null);
      setSelectedLeaveTypeId('');
      setReason('');

      attendanceService
        .getAbsentLeaveOptions(record.id)
        .then((res) => {
          setOptionsData(res);
          // Pre-select first available leave type with remaining balance or first type
          const available = res.balances?.find((b) => parseFloat(b.remainingDays) > 0);
          if (available) {
            setSelectedLeaveTypeId(available.leaveTypeId);
          } else if (res.leaveTypes?.length > 0) {
            setSelectedLeaveTypeId(res.leaveTypes[0].id);
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to load leave options for this employee.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, record]);

  if (!isOpen) return null;

  const employee = optionsData?.employee || record?.employee || {};
  const employeeName =
    employee.fullName ||
    `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
    record?.fullName ||
    'Employee';
  const roleName = employee.roleName || 'Employee';
  const departmentName = employee.departmentName || employee.department?.name || '';
  const employeeCode = employee.employeeCode || record?.employeeCode || '';
  const absenceDate = record?.attendanceDate || record?.date;

  const selectedBalance = optionsData?.balances?.find(
    (b) => b.leaveTypeId === selectedLeaveTypeId
  );
  const selectedType = optionsData?.leaveTypes?.find(
    (t) => t.id === selectedLeaveTypeId
  );

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedLeaveTypeId) {
      setError('Please select a leave category.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await attendanceService.convertAbsenceToLeave(record.id, {
        leaveTypeId: selectedLeaveTypeId,
        reason: reason.trim(),
      });

      toast.success(
        res.message ||
          `Absence on ${absenceDate} converted to ${res.leaveType || 'Leave'} successfully!`
      );
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to convert absence to leave.');
      toast.error(err.message || 'Failed to convert absence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Absence to Leave"
      size="lg"
    >
      <div className="space-y-6">
        {/* Error Notice */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner message="Loading employee leave bucket..." />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Employee & Absence Context Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={employee.avatarUrl}
                  name={employeeName}
                  size="md"
                  className="ring-2 ring-brand-100"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{employeeName}</span>
                    <Badge variant={roleName === 'Manager' ? 'warning' : roleName === 'HR' ? 'brand' : 'neutral'} size="sm">
                      {roleName}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span className="font-mono">{employeeCode || 'No Code'}</span>
                    {departmentName && (
                      <>
                        <span>•</span>
                        <span>{departmentName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Marked Absent
                </span>
                <span className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {absenceDate
                    ? new Date(absenceDate).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
            </div>

            {/* Leave Bucket Overview */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Leave Category <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  1 day will be deducted from balance
                </span>
              </div>

              {/* Bucket Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {(optionsData?.leaveTypes || []).map((type) => {
                  const bal = optionsData?.balances?.find((b) => b.leaveTypeId === type.id);
                  const isSelected = selectedLeaveTypeId === type.id;
                  const remaining = bal ? parseFloat(bal.remainingDays || 0) : parseFloat(type.daysPerYear || 0);
                  const allocated = bal ? parseFloat(bal.allocatedDays || 0) : parseFloat(type.daysPerYear || 0);
                  const used = bal ? parseFloat(bal.usedDays || 0) : 0;
                  const isLow = type.isPaid && remaining <= 0;

                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelectedLeaveTypeId(type.id)}
                      className={`text-left p-3 rounded-xl border transition-all duration-200 relative ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-xs text-slate-900 block truncate pr-2">
                          {type.name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          {type.isPaid ? 'Paid' : 'Unpaid'} Quota
                        </span>
                        <span
                          className={`font-bold ${
                            isLow
                              ? 'text-rose-600'
                              : remaining > 0
                              ? 'text-emerald-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {type.isPaid
                            ? `${remaining} / ${allocated} left`
                            : 'Unrestricted'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Summary Notice */}
            {selectedType && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Converting to <strong>{selectedType.name}</strong> will create an approved leave record and reduce the employee's available bucket balance by <strong>1.0 day</strong>.
                </span>
              </div>
            )}

            {/* Reason / Remarks */}
            <div className="space-y-1.5">
              <label htmlFor="absence-convert-reason" className="block text-xs font-semibold text-slate-700">
                Reason / Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="absence-convert-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Employee informed they were sick / Family emergency"
                className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 placeholder:text-slate-400"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                icon={Umbrella}
                isLoading={isSubmitting}
                disabled={!selectedLeaveTypeId}
                className="bg-brand-600 hover:bg-brand-700"
              >
                Confirm &amp; Deduct from Bucket
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default ConvertAbsenceToLeaveModal;
