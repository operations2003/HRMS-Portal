import React, { useState } from 'react';
import { FileText, LogOut, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { dailyReportService } from '../../services/dailyReportService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const PunchOutDailyReportModal = ({
  isOpen,
  onClose,
  onConfirmCheckOut,
  isCheckingOut = false,
  todayDateStr,
}) => {
  const toast = useToast();
  const [workSummary, setWorkSummary] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const handleSubmitAndCheckOut = async (e) => {
    if (e) e.preventDefault();
    const summary = workSummary.trim();
    if (!summary) {
      toast.error('Please enter a work summary before submitting.');
      return;
    }
    if (summary.length < 10) {
      toast.error('Please provide a slightly more descriptive summary (at least 10 characters).');
      return;
    }

    setIsSubmittingReport(true);
    try {
      const todayDate = todayDateStr || new Date().toLocaleDateString('en-CA');
      await dailyReportService.submitReport({
        workSummary: summary,
        reportDate: todayDate,
      });
      toast.success('Daily work report submitted successfully!');
      // Proceed directly to check out
      await onConfirmCheckOut();
      onClose();
    } catch (err) {
      const msg = err?.message || 'Failed to submit daily report. Please try again.';
      toast.error(msg);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSkipAndCheckOut = async () => {
    if (!confirmSkip) {
      setConfirmSkip(true);
      return;
    }
    await onConfirmCheckOut();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmittingReport && !isCheckingOut) {
          setConfirmSkip(false);
          onClose();
        }
      }}
      title="Daily Work Report Required"
      subtitle="Submit what you worked on today before logging out"
      maxWidth="max-w-lg"
    >
      <div className="p-6 space-y-4">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200/80 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-xs text-brand-900 leading-relaxed">
            <span className="font-bold block text-brand-950 mb-0.5">Keep your work records up to date!</span>
            Daily reports ensure your efforts are accurately credited, help managers stay aligned with your progress, and maintain attendance compliance.
          </div>
        </div>

        {/* Form */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="punch-out-work-summary"
              className="text-xs font-bold text-slate-700 uppercase tracking-wider"
            >
              Today's Work Summary <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400">
              {workSummary.trim().length} chars
            </span>
          </div>
          <textarea
            id="punch-out-work-summary"
            rows={5}
            value={workSummary}
            onChange={(e) => {
              setWorkSummary(e.target.value);
              if (confirmSkip) setConfirmSkip(false);
            }}
            placeholder="• Tasks or client deliverables completed&#10;• Meetings attended or milestones reached&#10;• Any blockers or pending items for tomorrow"
            className="w-full px-4 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 placeholder:text-slate-400 transition-all"
            disabled={isSubmittingReport || isCheckingOut}
            autoFocus
          />
        </div>

        {/* Skip Warning Notice if user toggled skip */}
        {confirmSkip && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Are you sure?</span> You are clocking out without submitting today's work report. You can still backfill it later under the Daily Reports section.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            {!confirmSkip ? (
              <button
                type="button"
                onClick={handleSkipAndCheckOut}
                disabled={isSubmittingReport || isCheckingOut}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 underline decoration-slate-300 underline-offset-4 cursor-pointer disabled:opacity-50"
              >
                Skip & Clock Out
              </button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={handleSkipAndCheckOut}
                isLoading={isCheckingOut}
                disabled={isSubmittingReport || isCheckingOut}
              >
                Confirm Skip & Clock Out
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmittingReport || isCheckingOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={CheckCircle2}
              onClick={handleSubmitAndCheckOut}
              isLoading={isSubmittingReport || isCheckingOut}
              disabled={!workSummary.trim() || isSubmittingReport || isCheckingOut}
              className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
            >
              Submit & Clock Out
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
