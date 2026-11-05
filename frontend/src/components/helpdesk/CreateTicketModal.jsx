import React, { useState, useEffect } from 'react';
import { LifeBuoy, Send, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
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

const ASSIGN_TO_OPTIONS = [
  { value: 'HR', label: 'HR Operations / Policies' },
  { value: 'MANAGER', label: 'Reporting Manager' },
  { value: 'ADMIN', label: 'Admin / IT Support' },
];

export const CreateTicketModal = ({ isOpen, onClose, onTicketCreated }) => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const normRole = (user?.roleName || '').toLowerCase();
  const isHr = hasRole(['HR', 'HRManager']) || normRole.includes('hr');

  const [category, setCategory] = useState('HR');
  const [assignedToRole, setAssignedToRole] = useState(() => (isHr ? 'MANAGER' : 'HR'));
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Sync default assignee if isHr changes
  useEffect(() => {
    if (isHr) {
      setAssignedToRole('MANAGER');
    }
  }, [isHr]);

  const resetForm = () => {
    setCategory('HR');
    setAssignedToRole(isHr ? 'MANAGER' : 'HR');
    setSubject('');
    setDescription('');
    setPriority('MEDIUM');
    setError(null);
  };

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    if (newCat === 'IT_SUPPORT') {
      setAssignedToRole('ADMIN');
    } else if (newCat === 'LEAVE_ATTENDANCE') {
      setAssignedToRole('MANAGER');
    } else {
      setAssignedToRole(isHr ? 'MANAGER' : 'HR');
    }
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
        assignedToRole,
      });

      toast.showSuccess(
        `Ticket #${created.ticketNumber || 'created'} opened successfully. Assigned to ${
          assignedToRole === 'MANAGER'
            ? 'Reporting Manager'
            : assignedToRole === 'ADMIN'
            ? 'Admin / IT'
            : 'HR Department'
        }.`
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

  const assignOptions = isHr
    ? [
        { value: 'MANAGER', label: 'Reporting Manager (Hierarchy Escalation)' },
        { value: 'ADMIN', label: 'Admin / Executive Leadership' },
      ]
    : ASSIGN_TO_OPTIONS;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Open Support Ticket"
      subtitle={isHr ? 'Submit an issue to your Reporting Manager or Admin for hierarchy review.' : 'Submit an issue or inquiry to your Manager, HR, or IT Admin.'}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isHr && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Hierarchy Escalation Policy</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                As an HR team member, tickets you submit are automatically routed to your Reporting Manager or Executive Administration to maintain segregation of duties and prevent self-resolution.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Category"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            options={CATEGORY_OPTIONS}
            required
          />

          <Select
            label="Assign To"
            value={assignedToRole}
            onChange={(e) => setAssignedToRole(e.target.value)}
            options={assignOptions}
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
