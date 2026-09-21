import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UserCheck,
  Calendar,
  AlertCircle,
  User,
  X,
  RefreshCw,
} from 'lucide-react';
import { probationService } from '../../services/probationService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';

export const ProbationDashboardPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const [probationData, setProbationData] = useState({ stats: {}, records: [] });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [isOverdueFilter, setIsOverdueFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [evaluatingEmployee, setEvaluatingEmployee] = useState(null);
  const [evalForm, setEvalForm] = useState({
    rating: 4,
    recommendation: 'CONFIRM',
    comments: '',
    extensionMonths: 0,
  });

  const [reviewingEmployee, setReviewingEmployee] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    decision: 'CONFIRMED',
    hrComments: '',
    extensionMonths: 0,
  });

  const isHrOrAdmin = hasRole(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);
  const isManagerOrAdmin = hasRole(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

  const fetchProbations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await probationService.getProbations({
        status: statusFilter,
        isOverdue: isOverdueFilter,
        search,
      });
      setProbationData(res.data || { stats: {}, records: [] });
    } catch (err) {
      toast.error(err.message || 'Failed to fetch probation records.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isOverdueFilter, search, toast]);

  useEffect(() => {
    fetchProbations();
  }, [fetchProbations]);

  const handleManagerEvaluation = async (e) => {
    e.preventDefault();
    if (!evaluatingEmployee) return;
    try {
      await probationService.submitEvaluation(evaluatingEmployee.employee_id, evalForm);
      toast.success('Manager probation evaluation submitted successfully.');
      setEvaluatingEmployee(null);
      setEvalForm({ rating: 4, recommendation: 'CONFIRM', comments: '', extensionMonths: 0 });
      fetchProbations();
    } catch (err) {
      toast.error(err.message || 'Evaluation submission failed.');
    }
  };

  const handleHrReview = async (e) => {
    e.preventDefault();
    if (!reviewingEmployee) return;
    try {
      await probationService.hrReview(reviewingEmployee.employee_id, reviewForm);
      toast.success(`Probation decision recorded: ${reviewForm.decision}`);
      setReviewingEmployee(null);
      setReviewForm({ decision: 'CONFIRMED', hrComments: '', extensionMonths: 0 });
      fetchProbations();
    } catch (err) {
      toast.error(err.message || 'Review decision failed.');
    }
  };

  const stats = probationData.stats || {};
  const records = probationData.records || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-indigo-600" />
            Probation & Confirmation Management
          </h1>
          <p className="text-sm text-slate-500">
            Monitor probation lifecycles, manager reviews, duration extensions, and confirmation decisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Standard Policy: 6 Months Probation
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Active in Probation</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.totalInProbation || 0}</h3>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
          <p className="text-xs font-semibold uppercase text-rose-600">Overdue Reviews</p>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">{stats.overdueCount || 0}</h3>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-600">Expiring in 14 Days</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.approachingExpiryCount || 0}</h3>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <p className="text-xs font-semibold uppercase text-emerald-600">Confirmed Staff</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.confirmedCount || 0}</h3>
        </div>
      </div>

      {/* Overdue Alert Banner if any */}
      {stats.overdueCount > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div>
            <strong>Action Required:</strong> You have {stats.overdueCount} employee(s) whose probation end date has passed without final confirmation. Please conduct evaluation and finalize HR confirmation.
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="IN_PROBATION">In Probation</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="EXTENDED">Extended</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <button
          onClick={fetchProbations}
          className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:text-indigo-700"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Probation List Table */}
      {loading ? (
        <LoadingSpinner message="Loading probation records..." />
      ) : records.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
          No probation records found matching filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Employee</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Probation Timeline (6M)</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Manager Evaluation</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.employee_id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 block">
                      {r.first_name} {r.last_name}
                    </span>
                    <span className="text-[10px] text-slate-400">{r.employee_code}</span>
                  </td>
                  <td className="p-3.5 text-slate-600">{r.department_name || 'N/A'}</td>
                  <td className="p-3.5">
                    <div className="space-y-0.5">
                      <span className={`block font-semibold ${r.is_overdue ? 'text-rose-600' : 'text-slate-800'}`}>
                        Ends: {r.probation_end_date || 'N/A'}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Joined: {r.date_of_joining || '—'}
                      </span>
                      {r.is_overdue && (
                        <span className="inline-block text-[10px] font-bold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                          Overdue Review
                        </span>
                      )}
                      {r.is_approaching_expiry && (
                        <span className="inline-block text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          Expiring Soon
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5">
                    <Badge
                      variant={
                        r.probation_status === 'CONFIRMED'
                          ? 'success'
                          : r.probation_status === 'EXTENDED'
                          ? 'warning'
                          : r.probation_status === 'REJECTED'
                          ? 'danger'
                          : 'info'
                      }
                    >
                      {r.probation_status}
                    </Badge>
                  </td>
                  <td className="p-3.5">
                    {r.manager_recommendation ? (
                      <span className="text-xs text-slate-700">
                        Rating: <strong>{r.manager_rating}/5</strong> ({r.manager_recommendation})
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Pending Evaluation</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    {/* Manager Evaluate */}
                    {isManagerOrAdmin && r.probation_status === 'IN_PROBATION' && r.employee_id !== user.employeeId && (
                      <button
                        onClick={() => {
                          setEvaluatingEmployee(r);
                          setEvalForm({ rating: 4, recommendation: 'CONFIRM', comments: '', extensionMonths: 0 });
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        Evaluate
                      </button>
                    )}

                    {/* HR Final Decision */}
                    {isHrOrAdmin && r.probation_status !== 'CONFIRMED' && r.employee_id !== user.employeeId && (
                      <button
                        onClick={() => {
                          setReviewingEmployee(r);
                          setReviewForm({ decision: 'CONFIRMED', hrComments: '', extensionMonths: 0 });
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        Finalize HR
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MANAGER EVALUATION MODAL */}
      {evaluatingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Manager Evaluation</h3>
                <p className="text-xs text-slate-500">
                  {evaluatingEmployee.first_name} {evaluatingEmployee.last_name} ({evaluatingEmployee.employee_code})
                </p>
              </div>
              <button onClick={() => setEvaluatingEmployee(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManagerEvaluation} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Performance Rating (1 to 5) *</label>
                <select
                  value={evalForm.rating}
                  onChange={(e) => setEvalForm({ ...evalForm, rating: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="5">5 - Outstanding Performance</option>
                  <option value="4">4 - Exceeds Expectations</option>
                  <option value="3">3 - Meets Expectations</option>
                  <option value="2">2 - Needs Improvement</option>
                  <option value="1">1 - Unsatisfactory</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recommendation *</label>
                <select
                  value={evalForm.recommendation}
                  onChange={(e) => setEvalForm({ ...evalForm, recommendation: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="CONFIRM">Confirm Employment (Passed Probation)</option>
                  <option value="EXTEND">Extend Probation Period</option>
                  <option value="REJECT">Reject / Discontinue Employment</option>
                </select>
              </div>

              {evalForm.recommendation === 'EXTEND' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Extension Duration (Months) *</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={evalForm.extensionMonths}
                    onChange={(e) => setEvalForm({ ...evalForm, extensionMonths: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Manager Comments</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Feedback on culture fit, technical capability, punctuality..."
                  value={evalForm.comments}
                  onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setEvaluatingEmployee(null)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Evaluation</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR FINAL REVIEW MODAL */}
      {reviewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Final HR Probation Decision</h3>
                <p className="text-xs text-slate-500">
                  {reviewingEmployee.first_name} {reviewingEmployee.last_name} ({reviewingEmployee.employee_code})
                </p>
              </div>
              <button onClick={() => setReviewingEmployee(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleHrReview} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">HR Decision *</label>
                <select
                  value={reviewForm.decision}
                  onChange={(e) => setReviewForm({ ...reviewForm, decision: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="CONFIRMED">CONFIRMED (Issue Confirmation Letter)</option>
                  <option value="EXTENDED">EXTENDED (Extend Probation Period)</option>
                  <option value="REJECTED">REJECTED (Probation Discontinuation)</option>
                </select>
              </div>

              {reviewForm.decision === 'EXTENDED' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Extension Duration (Months) *</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={reviewForm.extensionMonths}
                    onChange={(e) => setReviewForm({ ...reviewForm, extensionMonths: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">HR Decision Notes</label>
                <textarea
                  rows="3"
                  placeholder="Official notes, reason for extension, or confirmation record..."
                  value={reviewForm.hrComments}
                  onChange={(e) => setReviewForm({ ...reviewForm, hrComments: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setReviewingEmployee(null)}>
                  Cancel
                </Button>
                <Button type="submit">Commit HR Decision</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

