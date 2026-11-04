import React, { useState } from 'react';
import { Sliders, CheckCircle2, Upload, AlertCircle, FileText, Link as LinkIcon } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';

export const TaskProgressUpdateModal = ({ isOpen, onClose, task, onSubmit }) => {
  const [progress, setProgress] = useState(task?.progress || 0);
  const [status, setStatus] = useState(task?.status || 'IN_PROGRESS');
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setIsSubmitting(true);
      await onSubmit(task.id, {
        progress: parseInt(progress, 10),
        status,
        note,
        evidenceUrl: evidenceUrl.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update progress.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Task Progress & Deliverables"
      subtitle={`Updating: ${task.title}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Progress Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Completion Progress (%)
            </label>
            <span className="font-extrabold text-base text-brand-600 dark:text-brand-400 font-mono">
              {progress}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setProgress(val);
              if (val === 100) setStatus('COMPLETED');
              else if (val > 0 && status === 'TODO') setStatus('IN_PROGRESS');
            }}
            className="w-full accent-brand-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
            <span>0% (Not Started)</span>
            <span>50% (In Progress)</span>
            <span>100% (Completed)</span>
          </div>
        </div>

        {/* Status Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked (Facing Impediment)</option>
            <option value="COMPLETED">Completed (Deliverable Ready)</option>
          </select>
        </div>

        {/* Progress Update Note */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Progress Update Note / Accomplishments
          </label>
          <textarea
            rows="2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what has been delivered today, blockers, or next sprint milestone..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Completion Evidence Attachment / Link */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Deliverable Link / Completion Evidence
          </label>
          <div className="relative">
            <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="e.g. https://github.com/... or Google Drive documentation URL"
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Verifiable deliverable link for managerial & executive audit review.
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Submit Update
          </Button>
        </div>
      </form>
    </Modal>
  );
};

