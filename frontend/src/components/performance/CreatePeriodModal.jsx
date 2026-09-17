import React, { useState } from 'react';
import { Calendar, Tag, ShieldCheck, Check } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { performanceService } from '../../services/performanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const CreatePeriodModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    startDate: '',
    endDate: '',
    status: 'ACTIVE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Period name is required.');
      return;
    }
    if (!formData.code.trim()) {
      setError('Period unique code (e.g. Q3-2026) is required.');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setError('Start date and end date are both required.');
      return;
    }
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setError('End date must be after the start date.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await performanceService.createPeriod({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
      });
      toast.success(`Performance review period "${formData.name}" created!`);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create review period.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Appraisal Period"
      subtitle="Establish a new organization-wide performance evaluation cycle"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {error && <Alert variant="error" message={error} />}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Period Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Q3 2026 Annual Performance Cycle"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Unique Code <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Q3-2026"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            className="w-full px-3.5 py-2 font-mono uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Start Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              End Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Initial Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          >
            <option value="ACTIVE">ACTIVE (Open for Submissions)</option>
            <option value="UPCOMING">UPCOMING (Scheduled)</option>
            <option value="DRAFT">DRAFT (Inactive)</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={ShieldCheck}
            isLoading={isSubmitting}
          >
            Launch Period
          </Button>
        </div>
      </form>
    </Modal>
  );
};
