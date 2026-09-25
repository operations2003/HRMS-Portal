import React, { useState, useEffect } from 'react';
import { Target, Award, AlertCircle, Plus, Trash2, Send, Save, Star, UserCheck, Users } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Alert } from '../common/Alert.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { performanceService } from '../../services/performanceService.js';
import { employeeService } from '../../services/employeeService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { filterNonCeoEmployees } from '../../utils/roleUtils.js';

export const CreateAppraisalModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const { user, hasRole } = useAuth();
  const userRoleStr = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().trim();
  const isAdmin = ['admin', 'superadmin', 'orgadmin'].some((r) => userRoleStr.includes(r));
  const isHR = !isAdmin && ['hr', 'hrmanager'].some((r) => userRoleStr.includes(r));
  const isManagerOnly = !isAdmin && !isHR && (['manager', 'lead', 'supervisor'].some((r) => userRoleStr.includes(r)) || hasRole('Manager'));

  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    employeeId: '',
    period_id: '',
    rating: 4.0,
    summary: '',
    achievements: '',
    challenges: '',
  });

  const [goals, setGoals] = useState([
    { title: '', description: '', target_date: '', weightage: 100 },
  ]);

  useEffect(() => {
    if (isOpen) {
      loadPeriods();
      loadEmployees();
      setError(null);
      setShowConfirmSubmit(false);
      setFormData({
        employeeId: '',
        period_id: '',
        rating: 4.0,
        summary: '',
        achievements: '',
        challenges: '',
      });
      setGoals([{ title: '', description: '', target_date: '', weightage: 100 }]);
    }
  }, [isOpen]);

  const loadPeriods = async () => {
    try {
      setIsLoadingPeriods(true);
      const res = await performanceService.getPeriods();
      const list = res.items || res.data || (Array.isArray(res) ? res : []);
      setPeriods(list);
      // Auto select first active period if exists
      const active = list.find((p) => p.status === 'ACTIVE') || list[0];
      if (active) {
        setFormData((prev) => ({ ...prev, period_id: active.id }));
      }
    } catch (err) {
      toast.error('Failed to load performance review cycles.');
    } finally {
      setIsLoadingPeriods(false);
    }
  };

  const loadEmployees = async () => {
    try {
      setIsLoadingEmployees(true);
      const res = await employeeService.listEmployees({ limit: 300 });
      const all = res.employees || res.data || (Array.isArray(res) ? res : []);

      // Filter out CEO and Admin accounts globally (they cannot be reviewees)
      const nonAdminCandidates = filterNonCeoEmployees(all);

      // Exclude self (employees cannot evaluate themselves)
      const nonSelf = nonAdminCandidates.filter(
        (e) => e.id !== user?.employeeId && e.userId !== user?.id
      );

      if (isManagerOnly && (user?.employeeId || user?.id)) {
        // Manager can only evaluate their direct reporting employees
        const reportees = nonSelf.filter((e) => {
          const mgrId = e.managerId || e.manager?.id || e.reportingManagerId;
          const userEmpId = user.employeeId || user.id;
          return mgrId === userEmpId || mgrId === user.employeeId;
        });
        setEmployees(reportees);
      } else {
        // HR and Admin can evaluate other employees
        setEmployees(nonSelf);
      }
    } catch (err) {
      console.warn('Failed to load employees for appraisal:', err);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const handleGoalChange = (index, field, val) => {
    const updated = [...goals];
    updated[index][field] = val;
    setGoals(updated);
  };

  const addGoalRow = () => {
    setGoals([...goals, { title: '', description: '', target_date: '', weightage: 0 }]);
  };

  const removeGoalRow = (index) => {
    if (goals.length <= 1) return;
    setGoals(goals.filter((_, idx) => idx !== index));
  };

  const validate = () => {
    if (!formData.employeeId) {
      setError('Please select the employee to be appraised.');
      return false;
    }
    if (!formData.period_id) {
      setError('Please select an appraisal review period.');
      return false;
    }
    if (!formData.summary.trim()) {
      setError('Evaluator performance summary is required.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (shouldSubmitDirectly = false) => {
    setError(null);
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const selectedPeriod = periods.find((p) => p.id === formData.period_id);
      let reviewPeriod = selectedPeriod?.name || selectedPeriod?.code;
      if (!reviewPeriod) {
        if (formData.period_id === 'period-6-months' || formData.period_id === '6-months') {
          reviewPeriod = '6 Months';
        } else if (formData.period_id === 'period-12-months' || formData.period_id === '12-months') {
          reviewPeriod = '12 Months';
        } else {
          reviewPeriod = formData.period_id || '6 Months';
        }
      }

      let periodId = selectedPeriod?.id;
      if (!periodId) {
        if (formData.period_id === 'period-6-months' || formData.period_id === '6-months') {
          periodId = periods.find((p) => p.id === 'period-6-months' || (p.name || '').toLowerCase() === '6 months')?.id || 'period-6-months';
        } else if (formData.period_id === 'period-12-months' || formData.period_id === '12-months') {
          periodId = periods.find((p) => p.id === 'period-12-months' || (p.name || '').toLowerCase() === '12 months')?.id || 'period-12-months';
        }
      }

      const payload = {
        employeeId: formData.employeeId,
        periodId: periodId,
        reviewPeriod: reviewPeriod,
        rating: Number(formData.rating),
        score: Number(formData.rating),
        feedback: formData.summary.trim(),
        reviewerComments: formData.summary.trim(),
        selfComments: '',
        self_review: {
          summary: formData.summary.trim(),
          achievements: formData.achievements.trim(),
          challenges: formData.challenges.trim(),
          rating: Number(formData.rating),
        },
        goals: goals
          .filter((g) => g.title.trim())
          .map((g) => ({
            title: g.title.trim(),
            description: g.description.trim(),
            targetDate: g.target_date || null,
            weightage: Number(g.weightage) || 0,
            status: 'IN_PROGRESS',
          })),
      };

      const res = await performanceService.createRecord(payload);
      const recordId = res.id || res.record?.id;

      if (shouldSubmitDirectly && recordId) {
        await performanceService.submitRecord(recordId, {
          comments: 'Performance appraisal finalized and submitted.',
        }).catch(() => {});
        toast.success('Performance appraisal submitted successfully for employee!');
      } else {
        toast.success('Performance appraisal saved as draft.');
      }

      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save appraisal record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSubmitConfirm = () => {
    if (validate()) {
      setShowConfirmSubmit(true);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conduct Employee Performance Appraisal"
      subtitle="Evaluate employee performance, assign rating, and provide developmental feedback"
      maxWidth="max-w-2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(false);
        }}
        className="space-y-6 text-sm"
      >
        {error && <Alert variant="error" message={error} />}

        {/* Employee & Period Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Employee <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              disabled={isLoadingEmployees}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium text-xs"
            >
              <option value="">
                {isLoadingEmployees
                  ? 'Loading employees...'
                  : isManagerOnly && employees.length === 0
                  ? 'No direct reporting employees assigned'
                  : 'Choose employee to evaluate...'}
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeCode}) — {e.department?.name || 'General'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Review Period <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.period_id}
              onChange={(e) => setFormData({ ...formData, period_id: e.target.value })}
              disabled={isLoadingPeriods}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium text-xs"
            >
              <option value="">Select appraisal period...</option>
              <option value="period-6-months">6 Months</option>
              <option value="period-12-months">12 Months</option>
              {periods
                .filter(
                  (p) =>
                    p.id !== 'period-6-months' &&
                    p.id !== 'period-12-months' &&
                    (p.name || '').toLowerCase() !== '6 months' &&
                    (p.name || '').toLowerCase() !== '12 months'
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code || 'CYCLE'}) &bull; {p.status}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Performance Evaluation & Rating */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              Performance Rating & Feedback
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Assigned Rating:</span>
              <span className="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
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
              <span>1.0 Unsatisfactory</span>
              <span>3.0 Meets Expectations</span>
              <span>5.0 Outstanding</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Evaluator Performance Summary & Key Highlights <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Provide a comprehensive evaluation of the employee's performance, quality of work, core competencies, and reliability during this cycle..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Key Accomplishments & Strengths
              </label>
              <textarea
                rows={2}
                value={formData.achievements}
                onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                placeholder="Specific achievements, project milestones, or positive behaviors demonstrated..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Areas of Improvement & Development Feedback
              </label>
              <textarea
                rows={2}
                value={formData.challenges}
                onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                placeholder="Constructive feedback, skill gaps to bridge, and development targets..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Goals & Deliverables */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-brand-600" />
              Key Deliverables & Objectives for Next Period
            </label>
            <button
              type="button"
              onClick={addGoalRow}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Objective
            </button>
          </div>

          <div className="space-y-2.5">
            {goals.map((g, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    placeholder={`Objective #${idx + 1} Title`}
                    value={g.title}
                    onChange={(e) => handleGoalChange(idx, 'title', e.target.value)}
                    className="flex-1 text-xs font-medium px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {goals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGoalRow(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  placeholder="Target outcome, KPI, or measurement criteria..."
                  value={g.description}
                  onChange={(e) => handleGoalChange(idx, 'description', e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              icon={Save}
              isLoading={isSubmitting}
              onClick={() => handleSubmit(false)}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={Send}
              isLoading={isSubmitting}
              onClick={handleOpenSubmitConfirm}
            >
              Submit Appraisal
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showConfirmSubmit}
        onClose={() => setShowConfirmSubmit(false)}
        onConfirm={() => {
          setShowConfirmSubmit(false);
          handleSubmit(true);
        }}
        title="Submit Employee Performance Appraisal"
        message="Are you sure you want to finalize and submit this performance appraisal? It will be recorded under the employee's official performance profile."
        confirmText="Submit Appraisal"
        cancelText="Keep Editing"
        variant="primary"
        isLoading={isSubmitting}
      />
    </Modal>
  );
};
