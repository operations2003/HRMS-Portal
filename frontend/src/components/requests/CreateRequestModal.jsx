import React, { useState } from 'react';
import { Send, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { requestService } from '../../services/requestService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';

export const REQUEST_TYPE_OPTIONS = [
  { value: 'DOCUMENT_REQUEST', label: 'Document Request (Salary Certificate, Bonafide, Letters)' },
  { value: 'BANK_DETAILS_CHANGE', label: 'Bank Details Change Request (Account, IFSC, Branch)' },
  { value: 'UAN_CHANGE', label: 'UAN / Statutory Details Update Request' },
  { value: 'HR_REQUEST', label: 'HR Policy & Employment Clarification' },
  { value: 'PAYROLL_CLARIFICATION', label: 'Payroll & Reimbursement Clarification' },
  { value: 'EMPLOYEE_SERVICE', label: 'Employee Service (ID Badge, Access Card, Workstation)' },
  { value: 'OTHER', label: 'Other Service Request' },
];

export const REQUEST_PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low - Standard Turnaround' },
  { value: 'MEDIUM', label: 'Medium - Regular Priority' },
  { value: 'HIGH', label: 'High - Expedited Processing' },
  { value: 'URGENT', label: 'Urgent - Critical Requirement' },
];

export const CreateRequestModal = ({ isOpen, onClose, onRequestCreated }) => {
  const toast = useToast();
  const [requestType, setRequestType] = useState('DOCUMENT_REQUEST');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = () => {
    setRequestType('DOCUMENT_REQUEST');
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
      setError('Subject is required.');
      return;
    }
    if (subject.trim().length < 3) {
      setError('Subject must be at least 3 characters long.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (description.trim().length < 5) {
      setError('Description must be at least 5 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const created = await requestService.createRequest({
        requestType,
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });

      toast.showSuccess(
        `Request #${created.requestNumber || 'created'} submitted successfully.`
      );
      handleClose();
      if (onRequestCreated) onRequestCreated(created);
    } catch (err) {
      console.error('Error creating request:', err);
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Submit Employee Service Request"
      subtitle="Request documentation, HR certificates, or operational services."
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
            label="Request Type"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            options={REQUEST_TYPE_OPTIONS}
            required
          />

          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={REQUEST_PRIORITY_OPTIONS}
            required
          />
        </div>

        <div>
          <Input
            label="Subject / Title"
            placeholder="e.g. Salary Certificate for Visa Application"
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
            Detailed Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Specify reason, format required, destination institution, or other relevant details..."
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
            Submit Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateRequestModal;
