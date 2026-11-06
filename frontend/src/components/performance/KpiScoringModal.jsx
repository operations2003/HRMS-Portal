import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Star,
  Target,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Save,
  Send,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Avatar } from '../common/Avatar.jsx';
import {
  KPI_DESIGNATION_FRAMEWORKS,
  RATING_SCALE,
  calculateKpiWeightedScore,
  calculateTotalKpiScore,
  getPerformanceRatingFromScore,
  matchFrameworkForDesignation,
} from '../../constants/kpiFrameworks.js';
import { employeeService } from '../../services/employeeService.js';
import { performanceService } from '../../services/performanceService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { filterNonCeoEmployees, isCeoOrAdmin } from '../../utils/roleUtils.js';

export const KpiScoringModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialCandidate = null,
  existingRecord = null,
}) => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const userRoleStr = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().trim();
  const isAdmin = isCeoOrAdmin(user) || ['admin', 'superadmin', 'orgadmin', 'ceo'].some((r) => userRoleStr.includes(r));
  const isHR = !isAdmin && ['hr', 'hrmanager', 'ld hr', 'l&d hr'].some((r) => userRoleStr.includes(r));
  const isManagerOnly = !isAdmin && !isHR && (['manager', 'lead', 'supervisor'].some((r) => userRoleStr.includes(r)) || hasRole('Manager'));

  // Employees & Periods list
  const [employees, setEmployees] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form selections
  const [selectedEmpId, setSelectedEmpId] = useState(
    existingRecord?.employeeId || existingRecord?.employee?.id || initialCandidate?.id || ''
  );
  const [selectedPeriodId, setSelectedPeriodId] = useState(existingRecord?.periodId || '');
  const [reviewPeriodName, setReviewPeriodName] = useState(() => {
    if (existingRecord?.reviewPeriod) return existingRecord.reviewPeriod;
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getFullYear()} Evaluation`;
  });

  // Selected Framework & KPI evaluations state
  const [frameworkId, setFrameworkId] = useState('operations_manager');
  const [kpiScores, setKpiScores] = useState({}); // { [kpiId]: achievementPercent }
  const [showResponsibilities, setShowResponsibilities] = useState(false);

  // Qualitative Feedback
  const [summary, setSummary] = useState('');
  const [achievements, setAchievements] = useState('');
  const [challenges, setChallenges] = useState('');

  // Selected Employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Current Active Framework
  const activeFramework = useMemo(() => {
    return (
      KPI_DESIGNATION_FRAMEWORKS.find((f) => f.id === frameworkId) ||
      KPI_DESIGNATION_FRAMEWORKS[0]
    );
  }, [frameworkId]);

  // Auto-load metadata on open
  useEffect(() => {
    if (isOpen) {
      loadData();
      setError(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoadingMetadata(true);
      const [empRes, perRes] = await Promise.allSettled([
        employeeService.listEmployees({ limit: 300 }),
        performanceService.getPeriods(),
      ]);

      if (empRes.status === 'fulfilled') {
        const all = empRes.value.employees || empRes.value.data || (Array.isArray(empRes.value) ? empRes.value : []);
        const nonAdmin = filterNonCeoEmployees(all).filter(
          (e) => e.id !== user?.employeeId && e.userId !== user?.id
        );

        if (isManagerOnly && (user?.employeeId || user?.id)) {
          const reportees = nonAdmin.filter((e) => {
            const mgrId = e.managerId || e.manager?.id || e.reportingManagerId;
            const userEmpId = user.employeeId || user.id;
            return mgrId === userEmpId || (user.employeeId && mgrId === user.employeeId) || (user.id && mgrId === user.id);
          });
          setEmployees(reportees.length > 0 ? reportees : nonAdmin);
        } else {
          setEmployees(nonAdmin);
        }
      }

      if (perRes.status === 'fulfilled') {
        const list = perRes.value.items || perRes.value.data || (Array.isArray(perRes.value) ? perRes.value : []);
        setPeriods(list);
        const active = list.find((p) => p.status === 'ACTIVE') || list[0];
        if (active) {
          setSelectedPeriodId(active.id);
        }
      }
    } catch (err) {
      console.error('Failed to load performance scoring metadata:', err);
    } finally {
      setLoadingMetadata(false);
    }
  };

  // When candidate changes, auto-detect framework and prefill
  useEffect(() => {
    if (selectedEmployee) {
      const desig =
        selectedEmployee.designation?.name ||
        selectedEmployee.designationTitle ||
        selectedEmployee.role ||
        '';
      const matched = matchFrameworkForDesignation(desig);
      setFrameworkId(matched.id);
    }
  }, [selectedEmployee]);

  // Initialize or reset KPI scores when framework changes
  useEffect(() => {
    if (activeFramework) {
      const initial = {};
      activeFramework.kpis.forEach((kpi) => {
        // default achievement to 85% or keep existing if exists
        initial[kpi.id] = kpiScores[kpi.id] !== undefined ? kpiScores[kpi.id] : 85;
      });
      setKpiScores(initial);
    }
  }, [frameworkId]);

  // Handle achievement score change
  const handleAchievementChange = (kpiId, val) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    setKpiScores((prev) => ({
      ...prev,
      [kpiId]: num,
    }));
  };

  // Real-time calculation of weighted scores
  const calculatedKpis = useMemo(() => {
    return activeFramework.kpis.map((kpi) => {
      const ach = kpiScores[kpi.id] !== undefined ? kpiScores[kpi.id] : 80;
      const weightedScore = calculateKpiWeightedScore(ach, kpi.weight);
      return {
        ...kpi,
        achievement: ach,
        weightedScore,
      };
    });
  }, [activeFramework, kpiScores]);

  // Total Score (0 - 100)
  const totalScore = useMemo(() => {
    return calculateTotalKpiScore(calculatedKpis);
  }, [calculatedKpis]);

  // Rating Result (1 to 5)
  const ratingResult = useMemo(() => {
    return getPerformanceRatingFromScore(totalScore);
  }, [totalScore]);

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedEmpId) {
      setError('Please select a candidate to evaluate.');
      return;
    }

    try {
      setSubmitting(true);

      // Map KPIs into structured goals for backend storage
      const goalsPayload = calculatedKpis.map((kpi) => ({
        title: kpi.name,
        description: `Designation: ${activeFramework.title} | Monthly Target: ${kpi.monthlyTarget}`,
        metric_target: kpi.monthlyTarget,
        metric_achieved: `${kpi.achievement}%`,
        weightage: kpi.weight,
        rating: Math.max(1, Math.min(5, Math.round((kpi.achievement / 20) * 10) / 10)),
        status: kpi.achievement >= 90 ? 'ACHIEVED' : kpi.achievement >= 70 ? 'IN_PROGRESS' : 'PARTIALLY_ACHIEVED',
      }));

      // Feedback combining summary & KPI notes
      const structuredFeedback = [
        summary.trim(),
        achievements.trim() ? `Key Achievements: ${achievements.trim()}` : null,
        challenges.trim() ? `Growth Areas: ${challenges.trim()}` : null,
        `[TaskNera KPI Evaluation: Framework=${activeFramework.title}; TotalScore=${totalScore}%; Rating=${ratingResult.rating}/5.0 (${ratingResult.level})]`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const payload = {
        employeeId: selectedEmpId,
        periodId: selectedPeriodId || null,
        reviewPeriod: reviewPeriodName.trim() || `${activeFramework.title} Evaluation`,
        rating: ratingResult.rating,
        score: totalScore,
        feedback: structuredFeedback,
        reviewerComments: structuredFeedback,
        selfComments: '',
        goals: goalsPayload,
      };

      if (existingRecord?.id) {
        await performanceService.updateRecord(existingRecord.id, payload, goalsPayload);
        toast.success(
          `Performance review updated for ${selectedEmployee?.fullName || 'Candidate'}: Score ${totalScore}% (${ratingResult.level})`
        );
      } else {
        await performanceService.createRecord(payload, goalsPayload);
        toast.success(
          `Performance review recorded for ${selectedEmployee?.fullName || 'Candidate'}: Score ${totalScore}% (${ratingResult.level})`
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit KPI performance review:', err);
      setError(err.message || 'Failed to submit candidate evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Candidate Performance Review & KPI Scoring"
      subtitle="Evaluate candidate against official TaskNera designation framework with real-time weighted scoring."
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Candidate & Framework Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          {/* Candidate Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Candidate / Staff <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              required
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">-- Choose Candidate to Evaluate --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode}) — {emp.designation?.name || emp.role || 'Staff'}
                </option>
              ))}
            </select>
          </div>

          {/* Designation Framework Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Designation KPI Framework <span className="text-rose-500">*</span>
            </label>
            <select
              value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 font-medium"
            >
              {KPI_DESIGNATION_FRAMEWORKS.map((fw) => (
                <option key={fw.id} value={fw.id}>
                  {fw.title} (100% Weight)
                </option>
              ))}
            </select>
          </div>

          {/* Review Period */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Evaluation Cycle / Month
            </label>
            <input
              type="text"
              value={reviewPeriodName}
              onChange={(e) => setReviewPeriodName(e.target.value)}
              placeholder="e.g. November 2026 Monthly KPI"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Framework Objective & Guideline Banner */}
        <div className="p-4 bg-gradient-to-r from-brand-50 via-amber-50/40 to-indigo-50/50 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-brand-200/80 dark:border-slate-700 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/60 px-2 py-0.5 rounded-full">
                  {activeFramework.category}
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {activeFramework.title}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                <strong>Primary Objective:</strong> {activeFramework.primaryObjective}
              </p>
              {activeFramework.guidelineNote && (
                <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 p-2 rounded-lg mt-2 font-medium">
                  {activeFramework.guidelineNote}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowResponsibilities(!showResponsibilities)}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold shrink-0 cursor-pointer"
            >
              <span>{showResponsibilities ? 'Hide Responsibilities' : 'View Responsibilities'}</span>
              {showResponsibilities ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Accordion: Evaluated Responsibilities */}
          {showResponsibilities && (
            <div className="pt-2 border-t border-brand-200/60 dark:border-slate-700">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                Key Responsibilities Evaluated:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400 list-disc list-inside">
                {activeFramework.keyResponsibilities.map((resp, idx) => (
                  <li key={idx}>{resp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Real-time Scorecard Summary Banner */}
        <div className="p-4 bg-white dark:bg-slate-900 border-2 border-brand-500/30 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-200 font-display font-black text-xl">
              {ratingResult.rating}.0
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  Performance Level:
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${ratingResult.bgColor}`}>
                  {ratingResult.level}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {ratingResult.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 text-right">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Weighted Score</span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {totalScore}%
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Common Rating</span>
              <div className="flex items-center gap-1 text-amber-500 font-bold text-base">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= ratingResult.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Scoring Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
          <div className="p-3 bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-600" />
              Designation KPIs &amp; Weighted Scoring Breakdown
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              Formula: Weighted Score = (Achievement % × Weight) ÷ 100
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {calculatedKpis.map((kpi, idx) => (
              <div
                key={kpi.id}
                className="p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
              >
                {/* KPI Name & Target */}
                <div className="md:col-span-5 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {idx + 1}. {kpi.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {kpi.weight}% Wt
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Target:</span> {kpi.monthlyTarget}
                  </p>
                </div>

                {/* Achievement Input Slider */}
                <div className="md:col-span-4 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={kpi.achievement}
                    onChange={(e) => handleAchievementChange(kpi.id, e.target.value)}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={kpi.achievement}
                      onChange={(e) => handleAchievementChange(kpi.id, e.target.value)}
                      className="w-16 px-2 py-1 text-xs text-center font-bold font-mono border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </div>

                {/* Calculated Weighted Score */}
                <div className="md:col-span-3 text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Weighted Score
                  </span>
                  <span className="text-sm font-black font-mono text-brand-600 dark:text-brand-400">
                    +{kpi.weightedScore.toFixed(2)} pts
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    ({kpi.achievement}% of {kpi.weight}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
            <span>Total Cumulative Score (Sum of Weighted Scores)</span>
            <span className="font-mono text-brand-600 text-sm font-black">
              {totalScore.toFixed(2)} / 100.00%
            </span>
          </div>
        </div>

        {/* Qualitative Evaluation Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Executive Evaluation Summary
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Overall performance evaluation and leadership review..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Key Achievements
            </label>
            <textarea
              rows={3}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder="Specific milestones, targets exceeded, or client appreciations..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Growth Areas &amp; Turnaround Actions
            </label>
            <textarea
              rows={3}
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              placeholder="Areas needing improvement, coaching, or SOP training..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            loading={submitting}
            disabled={!selectedEmpId || submitting}
          >
            Save &amp; Submit KPI Review ({totalScore}%)
          </Button>
        </div>
      </form>
    </Modal>
  );
};

