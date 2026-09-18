import React, { useState, useEffect } from 'react';
import { Sliders, Save } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ConfigEditorModal = ({ isOpen, onClose, onSuccess, config = null }) => {
  const toast = useToast();
  const isEdit = !!config;

  const [formData, setFormData] = useState({
    configKey: '',
    configValue: '',
    category: 'GENERAL',
    description: '',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        configKey: config.configKey || config.key || '',
        configValue:
          typeof config.configValue === 'object'
            ? JSON.stringify(config.configValue, null, 2)
            : String(config.configValue || ''),
        category: config.category || 'GENERAL',
        description: config.description || '',
      });
    } else {
      setFormData({
        configKey: '',
        configValue: '',
        category: 'GENERAL',
        description: '',
      });
    }
    setError(null);
  }, [config, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.configKey.trim()) {
      setError('Configuration key is required.');
      return;
    }
    if (formData.configValue === undefined || formData.configValue === null || formData.configValue === '') {
      setError('Configuration value cannot be empty.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Try parsing JSON if applicable, else string
      let parsedValue = formData.configValue;
      try {
        parsedValue = JSON.parse(formData.configValue);
      } catch {
        // Keep string
      }

      const res = await adminService.updateConfiguration({
        configKey: formData.configKey.trim(),
        configValue: parsedValue,
        category: formData.category,
        description: formData.description.trim(),
      });

      toast.success(`Configuration "${formData.configKey}" saved.`);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Configuration: ${config?.configKey || config?.key}` : 'Add Configuration Entry'}
      subtitle="Administrative setting affecting operational policy and automation"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <Input
          label="Configuration Key"
          value={formData.configKey}
          onChange={(e) => setFormData({ ...formData, configKey: e.target.value })}
          placeholder="e.g., EXIT_NOTICE_PERIOD_MIN_DAYS"
          disabled={isEdit}
          required
        />

        <Select
          label="Configuration Category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          options={[
            { value: 'GENERAL', label: 'General System Settings' },
            { value: 'EXIT_OFFBOARDING', label: 'Exit & Offboarding Policy' },
            { value: 'SECURITY_RBAC', label: 'Security & Access Control' },
            { value: 'PAYROLL', label: 'Payroll & Compensation Settings' },
          ]}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Setting Value (String, Number, or JSON Object) <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows="4"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder={'e.g., 30 or true or { "maxDays": 90 }'}
            value={formData.configValue}
            onChange={(e) => setFormData({ ...formData, configValue: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Documentation / Description</label>
          <textarea
            rows="2"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder="Document what this configuration controls and expected values..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={Save} isLoading={isSubmitting}>
            Save Configuration
          </Button>
        </div>
      </form>
    </Modal>
  );
};
