import React, { useState } from 'react';
import { LifeBuoy, Send, AlertCircle, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { helpdeskService } from '../../services/helpdeskService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';

const CATEGORY_OPTIONS = [
  { value: 'HR', label: 'HR Inquiries & Policies' },
  { value: 'PAYROLL', label: 'Payroll, Salary & Deductions' },
  { value: 'LEAVE_ATTENDANCE', label: 'Leave & Attendance Queries' },
  { value: 'DOCUMENT', label: 'Document Vault & Verification' },
  { value: 'IT_SUPPORT', label: 'IT Support & Systems Access' },
  { value: 'GENERAL', label: 'General Enterprise Inquiries' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low - Standard inquiry' },
  { value: 'MEDIUM', label: 'Medium - Regular priority' },
  { value: 'HIGH', label: 'High - Time-sensitive' },
  { value: 'URGENT', label: 'Urgent - Critical blocker' },
];

export const CreateTicketModal = ({ isOpen, onClose, onTicketCreated }) => {
  const toast = useToast();
  const [category, setCategory] = useState('HR');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = () => {
    setCategory('HR');
    setSubject('');
    setDescription('');
    setPriority('MEDIUM');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Please provide a descriptive subject for your ticket.');
      return;
    }
    if (subject.trim().length < 3) {
      setError('Subject must be at least 3 characters long.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a detailed description of your issue or request.');
      return;
    }
    if (description.trim().length < 5) {
      setError('Description must be at least 5 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const created = await helpdeskService.createTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });

      toast.showSuccess(
        `Ticket #${created.ticketNumber || 'created'} opened successfully. Our team will review it shortly.`
      );
      handleClose();
      if (onTicketCreated) onTicketCreated(created);
    } catch (err) {
      console.error('Failed to open ticket:', err);
      setError(err.message || 'Failed to submit helpdesk ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Open Support Ticket"
      subtitle="Submit an issue or inquiry to the HR and IT operations team."
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORY_OPTIONS}
            required
          />

          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={PRIORITY_OPTIONS}
            required
          />
        </div>

        <div>
          <Input
            label="Subject"
            placeholder="Brief summary of your inquiry or issue"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={255}
            required
          />
          <span className="text-[10px] text-slate-400 block text-right mt-1">
            {subject.length}/255
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain the background details, steps to reproduce, or specific assistance needed..."
            className="block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-colors"
            required
          />
          <span className="text-[10px] text-slate-400 block text-right mt-1">
            {description.length}/5000
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Send}
            loading={submitting}
          >
            Submit Ticket
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateTicketModal;
