import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Calendar, AlertCircle, Users, Tag, Clock } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { filterNonCeoEmployees } from '../../utils/roleUtils.js';

export const CeoTaskCreateModal = ({
  isOpen,
  onClose,
  onSubmit,
  employees = [],
  departments = [],
}) => {
  // CRITICAL BUSINESS RULE: Filter out CEO so they NEVER appear in assignee dropdown
  const assignableEmployees = filterNonCeoEmployees(employees);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigneeId: '',
    deptId: '',
    priority: 'HIGH',
    dueDate: '',
  });

  const [subtasks, setSubtasks] = useState(['']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubtaskChange = (index, value) => {
    const updated = [...subtasks];
    updated[index] = value;
    setSubtasks(updated);
  };

  const addSubtaskField = () => {
    setSubtasks([...subtasks, '']);
  };

  const removeSubtaskField = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Please provide a task title.');
      return;
    }

    if (!formData.assigneeId) {
      setError('Please select an operational employee to assign this task.');
      return;
    }

    if (!formData.dueDate) {
      setError('Please specify a due date for this directive.');
      return;
    }

    try {
      setIsSubmitting(true);
      const filteredSubtasks = subtasks
        .map((s) => s.trim())
        .filter(Boolean)
        .map((title, idx) => ({ id: `sub-${Date.now()}-${idx}`, title, completed: false }));

      await onSubmit({
        ...formData,
        subtasks: filteredSubtasks,
        isOfficial: true,
        assignedBy: 'CEO',
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        assigneeId: '',
        deptId: '',
        priority: 'HIGH',
        dueDate: '',
      });
      setSubtasks(['']);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to issue official task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Issue Official Organisational Task"
      subtitle="Direct executive assignment across company departments"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* CEO Directive Banner */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 text-brand-800 dark:text-brand-200 text-xs">
          <ShieldCheck className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
          <span>
            <strong>Official Executive Directive:</strong> As CEO, tasks assigned here bypass reporting hierarchies and are marked company-wide with highest priority visibility.
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Task Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Task Directive Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Conduct Q4 Security Architecture & Encryption Key Audit"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Directive Scope & Deliverables
          </label>
          <textarea
            rows="3"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Detail objectives, acceptance criteria, sensitive constraints, or dependencies..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* 2-column Grid: Assignee (No CEO) & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Assignee <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={formData.assigneeId}
              onChange={(e) => {
                const emp = assignableEmployees.find((x) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  assigneeId: e.target.value,
                  deptId: emp?.deptId || emp?.dept_id || formData.deptId,
                });
              }}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select Operational Assignee</option>
              {assignableEmployees.map((emp) => {
                const name = emp.fullName || `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim() || 'Employee';
                const desig = emp.designationTitle || emp.designation?.title || emp.departmentName || '';
                return (
                  <option key={emp.id} value={emp.id}>
                    {name} {desig ? `— ${desig}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Target Department
            </label>
            <select
              value={formData.deptId}
              onChange={(e) => setFormData({ ...formData, deptId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All / Cross-Department</option>
              {departments.map((dept) => (
                <option key={dept.id || dept.dept_id} value={dept.id || dept.dept_id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2-column Grid: Priority & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Priority Level
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="URGENT">Urgent (CEO Priority)</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Deadline <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.dueDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Subtasks Builder */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Breakdown Subtasks & Milestones
            </label>
            <button
              type="button"
              onClick={addSubtaskField}
              className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Subtask
            </button>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {subtasks.map((st, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold w-4 text-center">{idx + 1}.</span>
                <input
                  type="text"
                  value={st}
                  onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                  placeholder={`Subtask milestone ${idx + 1}...`}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {subtasks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSubtaskField(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Deploy Official Directive
          </Button>
        </div>
      </form>
    </Modal>
  );
};
