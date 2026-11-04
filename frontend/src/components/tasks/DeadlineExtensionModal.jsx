import React, { useState } from 'react';
import { Calendar, AlertCircle, Clock, Send } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';

export const DeadlineExtensionModal = ({ isOpen, onClose, task, onSubmit }) => {
  const [proposedDate, setProposedDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!proposedDate) {
      setError('Please propose a new deadline date.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a detailed justification for the extension.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(task.id, {
        proposedDate,
        reason,
        currentDeadline: task.due_date,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit extension request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Deadline Extension"
      subtitle={`Submitting formal request for: ${task.title}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Deadline Info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
          <span className="text-slate-500 font-medium">Current Deadline:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
            {task.due_date ? String(task.due_date).split('T')[0] : 'N/A'}
          </span>
        </div>

        {/* Proposed Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Proposed New Deadline <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            min={new Date().toISOString().split('T')[0]}
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Justification */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Impediment Justification & Mitigation Plan <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows="3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what unforeseen dependencies or technical roadblocks caused this delay and how the extension guarantees delivery..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Submit Extension Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};

