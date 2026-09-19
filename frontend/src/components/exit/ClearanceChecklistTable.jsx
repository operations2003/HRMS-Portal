import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Plus,
  Shield,
  Laptop,
  CreditCard,
  Building,
  FileCheck,
  Edit2,
  Check,
  Calendar,
  User,
  HelpCircle,
  Layers,
  FileText,
  Lock,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ClearanceChecklistTable = ({
  clearances = [],
  summary = {},
  canManage = false,
  dueDateFallback = null,
  onTaskUpdated,
  onOpenAddTask,
}) => {
  const toast = useToast();
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [editingTask, setEditingTask] = useState(null);
  const [statusDraft, setStatusDraft] = useState('CLEARED');
  const [recoveryDraft, setRecoveryDraft] = useState(0);
  const [remarksDraft, setRemarksDraft] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  // Standard Exit Checklist Categories
  const categories = [
    { id: 'ALL', label: 'All Items' },
    { id: 'MANAGER_HANDOVER', label: 'Manager Handover' },
    { id: 'KNOWLEDGE_TRANSFER', label: 'Knowledge Transfer' },
    { id: 'IT_ACCESS', label: 'IT Clearance' },
    { id: 'ASSETS_RETURNED', label: 'Asset Return' },
    { id: 'HR_CLEARANCE', label: 'HR Clearance' },
    { id: 'FINANCE_PAYROLL', label: 'Finance & Payroll' },
    { id: 'DOCUMENTS', label: 'Documents & Legal' },
    { id: 'FINAL_APPROVAL', label: 'Final Approval' },
  ];

  // Map category to nice label
  const getCategoryLabel = (cat) => {
    switch ((cat || '').toUpperCase()) {
      case 'MANAGER_HANDOVER':
        return 'Manager Handover';
      case 'KNOWLEDGE_TRANSFER':
        return 'Knowledge Transfer';
      case 'IT_ACCESS':
        return 'IT Clearance';
      case 'ASSETS_RETURNED':
        return 'Asset Return';
      case 'HR_CLEARANCE':
        return 'HR Clearance';
      case 'FINANCE_PAYROLL':
        return 'Finance/Payroll';
      case 'DOCUMENTS':
        return 'Documents';
      case 'FINAL_APPROVAL':
        return 'Final Approval';
      default:
        return cat || 'General Task';
    }
  };

  const getDeptIcon = (dept) => {
    switch ((dept || '').toUpperCase()) {
      case 'IT':
        return Laptop;
      case 'FINANCE':
        return CreditCard;
      case 'ADMIN':
        return Building;
      case 'HR':
        return Shield;
      case 'MANAGER':
        return User;
      case 'LEGAL':
        return FileText;
      default:
        return FileCheck;
    }
  };

  const isCompleted = (status) =>
    ['CLEARED', 'COMPLETED', 'WAIVED', 'NOT_APPLICABLE'].includes((status || '').toUpperCase());

  // Metrics
  const safeClearances = Array.isArray(clearances)
    ? clearances
    : Array.isArray(clearances?.clearances)
    ? clearances.clearances
    : [];

  const totalTasks = safeClearances.length;
  const completedTasks = safeClearances.filter((t) => isCompleted(t.status)).length;
  const pendingTasks = safeClearances.filter((t) => !isCompleted(t.status) && t.status !== 'REJECTED').length;
  const rejectedTasks = safeClearances.filter((t) => t.status === 'REJECTED').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalRecovery = safeClearances.reduce((sum, t) => sum + (parseFloat(t.recoveryAmount) || 0), 0);

  const filteredTasks = safeClearances.filter((t) => {
    if (activeCategory === 'ALL') return true;
    const cat = (t.checklistCategory || '').toUpperCase();
    const dept = (t.departmentScope || '').toUpperCase();
    if (activeCategory === 'MANAGER_HANDOVER') return cat.includes('HANDOVER') || dept === 'MANAGER';
    if (activeCategory === 'KNOWLEDGE_TRANSFER') return cat.includes('KNOWLEDGE') || cat.includes('KT');
    if (activeCategory === 'IT_ACCESS') return cat.includes('IT') || dept === 'IT';
    if (activeCategory === 'ASSETS_RETURNED') return cat.includes('ASSET');
    if (activeCategory === 'HR_CLEARANCE') return cat.includes('HR') || dept === 'HR';
    if (activeCategory === 'FINANCE_PAYROLL') return cat.includes('FINANCE') || cat.includes('PAYROLL') || dept === 'FINANCE';
    if (activeCategory === 'DOCUMENTS') return cat.includes('DOC') || dept === 'LEGAL';
    if (activeCategory === 'FINAL_APPROVAL') return cat.includes('FINAL') || cat.includes('APPROVAL');
    return true;
  });

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setStatusDraft(task.status || 'CLEARED');
    setRecoveryDraft(task.recoveryAmount || 0);
    setRemarksDraft(task.remarks || task.comments || '');
    setError(null);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      setIsUpdating(true);
      setError(null);
      const res = await exitService.updateClearanceTask(editingTask.id, {
        status: statusDraft,
        recoveryAmount: parseFloat(recoveryDraft) || 0,
        remarks: remarksDraft.trim(),
        comments: remarksDraft.trim(),
      });
      toast.success(`Checklist item "${editingTask.taskTitle}" updated to ${statusDraft}.`);
      setEditingTask(null);
      onTaskUpdated?.(res);
    } catch (err) {
      setError(err.message || 'Failed to update checklist item.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overall Progress Bar Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">Overall Clearance Progress</h4>
              <Badge variant={completionPercentage === 100 ? 'success' : 'brand'} size="sm">
                {completionPercentage}% Complete
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracking departmental handovers, asset returns, IT credential revocations, and finance settlements
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Completed: {completedTasks} / {totalTasks}
              </span>
            </div>

            {totalRecovery > 0 && (
              <div className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-rose-600" />
                <span>Recovery: ${totalRecovery.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              completionPercentage === 100
                ? 'bg-emerald-600'
                : completionPercentage >= 50
                ? 'bg-brand-600'
                : 'bg-amber-500'
            }`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {/* Mini stats counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
            <span className="text-slate-500">Total Items:</span>
            <span className="font-bold text-slate-900">{totalTasks}</span>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between text-emerald-800">
            <span>Cleared / Waived:</span>
            <span className="font-bold">{completedTasks}</span>
          </div>
          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 flex items-center justify-between text-amber-800">
            <span>Pending Action:</span>
            <span className="font-bold">{pendingTasks}</span>
          </div>
          <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100 flex items-center justify-between text-rose-800">
            <span>Issues / Deductions:</span>
            <span className="font-bold">{rejectedTasks > 0 ? `${rejectedTasks} issues` : `$${totalRecovery.toFixed(2)}`}</span>
          </div>
        </div>
      </div>

      {/* Checklist Categories Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shrink-0 ${
                activeCategory === c.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {canManage && onOpenAddTask && (
          <Button variant="secondary" size="sm" icon={Plus} onClick={onOpenAddTask}>
            Add Custom Task
          </Button>
        )}
      </div>

      {/* Checklist Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Checklist Item</th>
                <th className="px-5 py-3.5">Responsible Dept / Person</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Due Date</th>
                <th className="px-5 py-3.5">Completion Date</th>
                <th className="px-5 py-3.5">Comments & Remarks</th>
                {canManage && <th className="px-5 py-3.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-5 py-8 text-center text-slate-500 text-xs">
                    No clearance tasks found in the selected category.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const DeptIcon = getDeptIcon(t.departmentScope);
                  const done = isCompleted(t.status);
                  const formattedDue = t.dueDate || dueDateFallback || 'On or before LWD';
                  const formattedCompleted = t.completedAt || t.clearedAt
                    ? new Date(t.completedAt || t.clearedAt).toLocaleDateString()
                    : done
                    ? 'Completed'
                    : '—';

                  const responsibleName =
                    t.assignedToName ||
                    (t.clearedBy ? `Cleared by ${t.clearedBy}` : `${t.departmentScope || 'Department'} Lead`);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Item Title & Description */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              done
                                ? 'bg-emerald-100 text-emerald-700'
                                : t.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {done ? <Check className="w-3 h-3 stroke-[3]" /> : <Clock className="w-3 h-3" />}
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-slate-900 leading-snug">{t.taskTitle}</p>
                            {t.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm leading-relaxed">
                                {t.description}
                              </p>
                            )}
                            <span className="inline-block mt-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                              {getCategoryLabel(t.checklistCategory)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Responsible Dept / Person */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                            <DeptIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-xs">
                            <p className="font-semibold text-slate-800">{t.departmentScope || 'GENERAL'}</p>
                            <p className="text-[10px] text-slate-400">{responsibleName}</p>
                          </div>
                        </div>
                      </td>

                      {/* 3. Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge
                          variant={
                            done ? 'success' : t.status === 'REJECTED' ? 'danger' : 'warning'
                          }
                          size="sm"
                        >
                          {t.status || 'PENDING'}
                        </Badge>
                      </td>

                      {/* 4. Due Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formattedDue}</span>
                        </div>
                      </td>

                      {/* 5. Completion Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                        {done ? (
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {formattedCompleted}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pending Completion</span>
                        )}
                      </td>

                      {/* 6. Comments & Remarks */}
                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs">
                        {t.remarks || t.comments ? (
                          <p className="truncate" title={t.remarks || t.comments}>
                            {t.remarks || t.comments}
                          </p>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {parseFloat(t.recoveryAmount || 0) > 0 && (
                          <span className="inline-block font-semibold text-rose-600 text-[11px] mt-0.5">
                            Recovery: ${parseFloat(t.recoveryAmount).toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* 7. Action for Authorized Users */}
                      {canManage && (
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit2}
                            onClick={() => handleOpenEdit(t)}
                          >
                            Update
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <Modal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          title={`Update Clearance: ${editingTask.taskTitle}`}
          subtitle={`Department Scope: ${editingTask.departmentScope || 'GENERAL'} • Category: ${getCategoryLabel(
            editingTask.checklistCategory
          )}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveTask} className="space-y-4">
            {error && <Alert variant="danger">{error}</Alert>}

            <Select
              label="Clearance Status"
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              options={[
                { value: 'CLEARED', label: 'CLEARED — Signed off & fully verified' },
                { value: 'IN_PROGRESS', label: 'IN PROGRESS — Inspection / return ongoing' },
                { value: 'PENDING', label: 'PENDING — Awaiting employee action' },
                { value: 'WAIVED', label: 'WAIVED — Clearance waived by department lead' },
                { value: 'REJECTED', label: 'REJECTED — Issue identified / damage deduction' },
                { value: 'NOT_APPLICABLE', label: 'NOT APPLICABLE — Exempted for this role' },
              ]}
            />

            <Input
              label="Recovery / Deduction Amount ($)"
              type="number"
              min="0"
              step="0.01"
              value={recoveryDraft}
              onChange={(e) => setRecoveryDraft(e.target.value)}
              helperText="Damaged items, unreturned hardware, or unpaid dues deducted from FnF"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Comments & Departmental Remarks
              </label>
              <textarea
                rows="3"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                placeholder="Serial numbers received, inspection notes, reason for waiver or recovery..."
                value={remarksDraft}
                onChange={(e) => setRemarksDraft(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setEditingTask(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" icon={Check} isLoading={isUpdating}>
                Save Checklist Status
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
