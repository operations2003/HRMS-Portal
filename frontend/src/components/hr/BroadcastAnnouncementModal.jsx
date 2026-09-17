import React, { useState } from 'react';
import { Send, Megaphone, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { hrOperationsService } from '../../services/hrOperationsService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const BroadcastAnnouncementModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'NORMAL',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Announcement title is required.');
      return;
    }
    if (!formData.message.trim()) {
      setError('Announcement message content is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await hrOperationsService.broadcastAnnouncement({
        title: formData.title.trim(),
        message: formData.message.trim(),
        priority: formData.priority,
      });
      toast.success('Announcement broadcasted to all organization members!');
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to dispatch broadcast announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Broadcast Announcement"
      subtitle="Dispatch an urgent message or update to all employees across the organization"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {error && <Alert variant="error" message={error} />}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Subject / Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Mandatory Holiday Schedule Update & Townhall Notice"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Priority Level
          </label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          >
            <option value="NORMAL">NORMAL - General Notice</option>
            <option value="HIGH">HIGH - Important Action Required</option>
            <option value="URGENT">URGENT - Critical Workforce Alert</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Broadcast Message <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="Type your official announcement here..."
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Megaphone}
            isLoading={isSubmitting}
          >
            Dispatch Announcement
          </Button>
        </div>
      </form>
    </Modal>
  );
};
