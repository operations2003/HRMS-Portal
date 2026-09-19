import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  IndianRupee,
  Calendar,
  FileText,
  User,
  X,
} from 'lucide-react';
import { expenseService } from '../../services/expenseService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';

const CATEGORIES = [
  { value: 'TRAVEL', label: 'Travel & Transport' },
  { value: 'MEALS', label: 'Meals & Food' },
  { value: 'TRAINING', label: 'Training & Certifications' },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
  { value: 'CLIENT_ENTERTAINMENT', label: 'Client Entertainment' },
  { value: 'OTHER', label: 'Other Operational Expense' },
];

export const ExpensesPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reviewClaim, setReviewClaim] = useState(null);
  const [reviewAction, setReviewAction] = useState('APPROVE');
  const [reviewComments, setReviewComments] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  // Submit form state
  const [formData, setFormData] = useState({
    category: 'TRAVEL',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    description: '',
    receiptUrl: '',
  });

  const isManagerOrAdmin = hasRole(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);
  const isHrOrAdmin = hasRole(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseService.getExpenses({
        status: statusFilter,
        category: categoryFilter,
        search,
      });
      setExpenses(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch expense claims.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, search, toast]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    try {
      await expenseService.submitClaim(formData);
      toast.success('Expense claim submitted successfully.');
      setShowSubmitModal(false);
      setFormData({
        category: 'TRAVEL',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        description: '',
        receiptUrl: '',
      });
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || 'Failed to submit expense claim.');
    }
  };

  const handleReviewClaim = async (e) => {
    e.preventDefault();
    if (!reviewClaim) return;
    try {
      await expenseService.reviewClaim(reviewClaim.id, {
        action: reviewAction,
        comments: reviewComments,
        paymentReference: paymentRef,
      });
      toast.success(`Expense claim action recorded: ${reviewAction}`);
      setReviewClaim(null);
      setReviewComments('');
      setPaymentRef('');
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || 'Failed to process review.');
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REIMBURSED':
        return <Badge variant="purple">Reimbursed</Badge>;
      case 'REIMBURSEMENT_PENDING':
        return <Badge variant="info">Disbursement Pending</Badge>;
      case 'SUBMITTED':
      case 'MANAGER_REVIEW':
        return <Badge variant="warning">Under Review</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'REWORK_REQUIRED':
        return <Badge variant="neutral">Rework Required</Badge>;
      default:
        return <Badge variant="neutral">{st}</Badge>;
    }
  };

  // Stats calculation
  const totalClaimed = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  const pendingCount = expenses.filter((e) => ['SUBMITTED', 'MANAGER_REVIEW', 'REIMBURSEMENT_PENDING'].includes(e.status)).length;
  const reimbursedTotal = expenses
    .filter((e) => e.status === 'REIMBURSED')
    .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-indigo-600" />
            Expense & Reimbursement Claims
          </h1>
          <p className="text-sm text-slate-500">
            Standalone expense submission, manager approval, and disbursement tracking (Non-Payroll)
          </p>
        </div>

        <Button onClick={() => setShowSubmitModal(true)} icon={Plus}>
          Submit New Claim
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Total Claims Volume</p>
            <h3 className="text-xl font-bold text-slate-800 mt-1">₹{totalClaimed.toLocaleString('en-IN')}</h3>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Pending Approvals</p>
            <h3 className="text-xl font-bold text-amber-600 mt-1">{pendingCount} claims</h3>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Settled Disbursements</p>
            <h3 className="text-xl font-bold text-emerald-600 mt-1">₹{reimbursedTotal.toLocaleString('en-IN')}</h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search claims or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REIMBURSEMENT_PENDING">Disbursement Pending</option>
            <option value="REIMBURSED">Reimbursed</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-semibold text-slate-500">
          Showing {expenses.length} record(s)
        </span>
      </div>

      {/* Claims Table */}
      {loading ? (
        <LoadingSpinner message="Loading expense claims..." />
      ) : expenses.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">No expense claims found</h3>
          <p className="text-xs text-slate-400 mt-1">Submit your business expenditures for reimbursement approval.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Claim Number</th>
                <th className="p-3.5">Employee</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-bold font-mono text-indigo-600">
                    {ex.claim_number}
                  </td>
                  <td className="p-3.5">
                    <span className="font-semibold text-slate-800 block">
                      {ex.first_name} {ex.last_name}
                    </span>
                    <span className="text-[11px] text-slate-400">{ex.employee_code}</span>
                  </td>
                  <td className="p-3.5 text-slate-600">{ex.category}</td>
                  <td className="p-3.5 font-bold text-slate-800">
                    ₹{parseFloat(ex.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-slate-500">{ex.expense_date}</td>
                  <td className="p-3.5">{getStatusBadge(ex.status)}</td>
                  <td className="p-3.5 text-right space-x-2">
                    {isManagerOrAdmin && ex.employee_id !== user.employeeId && (
                      <button
                        onClick={() => {
                          setReviewClaim(ex);
                          setReviewAction(ex.status === 'APPROVED' && isHrOrAdmin ? 'REIMBURSE' : 'APPROVE');
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded transition"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBMIT CLAIM MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Submit Reimbursement Claim</h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g., 2450.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Purpose of expense, client name, route details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt / Invoice Document URL</label>
                <input
                  type="text"
                  placeholder="Receipt link or reference"
                  value={formData.receiptUrl}
                  onChange={(e) => setFormData({ ...formData, receiptUrl: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setShowSubmitModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Claim</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW / APPROVE MODAL */}
      {reviewClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Review Claim {reviewClaim.claim_number}</h3>
                <p className="text-xs text-slate-500">
                  {reviewClaim.first_name} {reviewClaim.last_name} • ₹{reviewClaim.amount}
                </p>
              </div>
              <button onClick={() => setReviewClaim(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviewClaim} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Review Decision *</label>
                <select
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="APPROVE">Approve Claim</option>
                  <option value="REJECT">Reject Claim</option>
                  <option value="REWORK">Request Rework</option>
                  {isHrOrAdmin && <option value="REIMBURSE">Disburse / Mark Reimbursed</option>}
                </select>
              </div>

              {reviewAction === 'REIMBURSE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference / UTR *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., BANK-NEFT-92817349"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Review Comments</label>
                <textarea
                  rows="3"
                  placeholder="Reason, feedback, or disbursement notes..."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setReviewClaim(null)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Decision</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

