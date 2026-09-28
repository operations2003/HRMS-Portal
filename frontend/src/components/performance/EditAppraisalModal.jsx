import React, { useState, useEffect } from 'react';
import { Target, Award, Star, Plus, Trash2, Save, User, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { Badge } from '../common/Badge.jsx';
import { performanceService } from '../../services/performanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const EditAppraisalModal = ({ isOpen, onClose, record, onSuccess }) => {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    rating: 4.0,
    summary: '',
    reviewPeriod: '',
  });

  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (isOpen && record) {
      setError(null);
      setFormData({
        rating: record.rating !== null && record.rating !== undefined ? Number(record.rating) : 4.0,
        summary: record.reviewerComments || record.feedback || record.selfComments || '',
        reviewPeriod: record.reviewPeriod || record.period?.name || 'Performance Cycle',
      });

      if (Array.isArray(record.goals) && record.goals.length > 0) {
        setGoals(
          record.goals.map((g) => ({
            id: g.id,
            title: g.title || '',
            description: g.description || '',
            weightage: g.weightage || 0,
            status: g.status || 'IN_PROGRESS',
          }))
        );
      } else {
        setGoals([{ title: '', description: '', weightage: 100, status: 'IN_PROGRESS' }]);
      }
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const empName =
    record.employee?.fullName ||
    `${record.employee?.firstName || ''} ${record.employee?.lastName || ''}`.trim() ||
    record.employeeName ||
    'Employee';

  const handleGoalChange = (index, field, val) => {
    const updated = [...goals];
    updated[index][field] = val;
    setGoals(updated);
  };

  const addGoalRow = () => {
    setGoals([...goals, { title: '', description: '', weightage: 0, status: 'IN_PROGRESS' }]);
  };

  const removeGoalRow = (index) => {
    if (goals.length <= 1) return;
    setGoals(goals.filter((_, idx) => idx !== index));
  };

  const validate = () => {
    if (!formData.summary.trim()) {
      setError('Evaluator performance feedback / summary is required.');
      return false;
    }
    const r = parseFloat(formData.rating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      setError('Rating must be between 1.0 and 5.0.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        rating: Number(formData.rating),
        score: Number(formData.rating),
        feedback: formData.summary.trim(),
        reviewerComments: formData.summary.trim(),
        goals: goals
          .filter((g) => g.title && g.title.trim())
          .map((g) => ({
            id: g.id || undefined,
            title: g.title.trim(),
            description: g.description ? g.description.trim() : '',
            weightage: Number(g.weightage) || 0,
            status: g.status || 'IN_PROGRESS',
          })),
      };

      const res = await performanceService.updateRecord(record.id, payload);
      toast.success('Performance review updated successfully!');
      onSuccess?.(res.data || res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update performance review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Performance Review"
      subtitle={`Update evaluation details for ${empName} (${formData.reviewPeriod})`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-sm">
        {error && <Alert variant="error" message={error} />}

        {/* Employee Summary Card */}
        <div className="bg-gradient-to-r from-slate-50 to-brand-50/20 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              src={record.employee?.avatarUrl}
              name={empName}
              size="md"
              className="border border-brand-200 ring-2 ring-brand-100/50"
            />
            <div>
              <h4 className="font-semibold text-slate-900">{empName}</h4>
              <p className="text-xs text-slate-500">
                {record.employee?.designation?.name || record.employee?.department?.name || 'Staff Member'} &bull; Period: {formData.reviewPeriod}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              Status: {record.status}
            </Badge>
          </div>
        </div>

        {/* Performance Rating & Feedback */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              Performance Rating & Evaluator Feedback
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Rating:</span>
              <span className="text-sm font-bold text-brand-600 bg-brand-50 px-2.5 py-0.5 rounded-md border border-brand-200">
                {Number(formData.rating).toFixed(1)} / 5.0
              </span>
            </div>
          </div>

          <div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.5"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
              className="w-full accent-brand-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>1.0 Needs Improvement</span>
              <span>3.0 Meets Expectations</span>
              <span>5.0 Exceeds Expectations</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Evaluator Comments & Growth Feedback <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Provide updated feedback on the employee's work performance, key strengths, contributions, and areas for improvement..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
            />
          </div>
        </div>

        {/* Goals & Key Objectives */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Target className="w-4 h-4 text-brand-600" />
              Goals & Key Objectives
            </h4>
            <button
              type="button"
              onClick={addGoalRow}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Goal
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {goals.map((goal, idx) => (
              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    placeholder={`Goal #${idx + 1} Title (e.g. Complete migration)...`}
                    value={goal.title}
                    onChange={(e) => handleGoalChange(idx, 'title', e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-brand-500 font-medium"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Wt %"
                      value={goal.weightage}
                      onChange={(e) => handleGoalChange(idx, 'weightage', e.target.value)}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center text-slate-800 focus:outline-none focus:border-brand-500"
                      title="Weightage %"
                    />
                    {goals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGoalRow(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Description or key results (optional)..."
                  value={goal.description}
                  onChange={(e) => handleGoalChange(idx, 'description', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs text-slate-700 focus:outline-none focus:border-brand-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            isLoading={isSubmitting}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditAppraisalModal;
