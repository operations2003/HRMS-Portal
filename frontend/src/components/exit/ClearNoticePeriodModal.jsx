import React, { useState } from 'react';
import { Calendar, CheckCircle2, ShieldAlert, Sparkles, FileText } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ClearNoticePeriodModal = ({
  isOpen,
  onClose,
  onSuccess,
  record,
}) => {
  const toast = useToast();
  const [waived, setWaived] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    record?.approvedLastWorkingDay ||
      record?.requestedLastWorkingDay ||
      new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !record) return null;

  const empName =
    record.employee?.fullName ||
    `${record.employee?.firstName || ''} ${record.employee?.lastName || ''}`.trim() ||
    record.employeeName ||
    'Employee';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await exitService.clearNoticePeriod(record.id, {
        waived,
        approvedLastWorkingDay: effectiveDate,
        remarks:
          remarks.trim() ||
          (waived
            ? 'Notice period waived by HR. Employee granted early release.'
            : 'Employee completed active notice period. Advanced to checklist & clearance phase.'),
      });

      toast.success('Notice period cleared! Advanced to Checklist & Clearances phase.');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to clear notice period:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to clear notice period.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clear Active Notice Period"
      subtitle={`Advancing exit lifecycle for ${empName} (${record.employee?.empCode || record.employeeCode || 'EMP'})`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Phase Context Banner */}
        <div className="p-3.5 bg-brand-50/70 border border-brand-200/80 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-brand-900">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Transition from Phase 3 (Notice Period) → Phase 4 (Checklist & Clearances)</span>
          </div>
          <p className="text-slate-600">
            Clearing this notice period confirms that the employee's serving period is concluded or waived, unlocking departmental clearance checklists and access revocation protocols.
          </p>
        </div>

        {/* Notice Type Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Resolution Type
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setWaived(false)}
              className={`p-3 rounded-xl border text-left transition-all ${
                !waived
                  ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20 text-brand-950 font-semibold'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Served Notice</span>
                {!waived && <CheckCircle2 className="w-4 h-4 text-brand-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Completed standard notice period duration.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setWaived(true)}
              className={`p-3 rounded-xl border text-left transition-all ${
                waived
                  ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950 font-semibold'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Waived / Early Exit</span>
                {waived && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Notice waived or early release approved by management.
              </p>
            </button>
          </div>
        </div>

        {/* Effective Last Working Day */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Effective Last Working Day
          </label>
          <input
            type="date"
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Confirmed date on which the employee stops active operational responsibilities.
          </p>
        </div>

        {/* HR Remarks / Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Operational Remarks / Directives (Optional)
          </label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={
              waived
                ? 'E.g., Notice period waived by executive management. Proceed with accelerated asset clearance.'
                : 'E.g., Notice period served satisfactorily. Handover verified with department head.'
            }
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            isLoading={loading}
          >
            Clear Notice Period & Advance
          </Button>
        </div>
      </form>
    </Modal>
  );
};
