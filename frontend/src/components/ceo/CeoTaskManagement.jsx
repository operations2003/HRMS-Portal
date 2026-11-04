import React, { useState } from 'react';
import {
  Plus,
  ShieldCheck,
  Sparkles,
  Calendar,
  Clock,
  UserCheck,
  AlertTriangle,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  RotateCcw,
  History,
  ArrowRightLeft,
  ChevronDown,
  CheckSquare,
  Flame,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { CeoTaskCreateModal } from './CeoTaskCreateModal.jsx';
import { TaskAuditTrailModal } from './TaskAuditTrailModal.jsx';
import { filterNonCeoEmployees } from '../../utils/roleUtils.js';

export const CeoTaskManagement = ({
  tasks = [],
  employees = [],
  departments = [],
  onCreateTask,
  onUpdateStatus,
  onReassignTask,
  onModifyDeadline,
  onChangePriority,
  onDeleteTask,
  onReopenTask,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAuditTask, setSelectedAuditTask] = useState(null);

  // Reassignment Modal State
  const [reassignModal, setReassignModal] = useState({ isOpen: false, task: null, newAssigneeId: '', reason: '' });
  // Deadline Modal State
  const [deadlineModal, setDeadlineModal] = useState({ isOpen: false, task: null, newDate: '', reason: '' });
  // Delete Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, task: null });
  // Reopen Dialog State
  const [reopenModal, setReopenModal] = useState({ isOpen: false, task: null, reason: '' });

  // Filter out CEO from assignee options
  const assignableEmployees = filterNonCeoEmployees(employees);

  const handleConfirmReassign = async (e) => {
    e.preventDefault();
    if (!reassignModal.newAssigneeId) return;
    await onReassignTask(reassignModal.task.id, reassignModal.newAssigneeId, reassignModal.reason);
    setReassignModal({ isOpen: false, task: null, newAssigneeId: '', reason: '' });
  };

  const handleConfirmDeadline = async (e) => {
    e.preventDefault();
    if (!deadlineModal.newDate) return;
    await onModifyDeadline(deadlineModal.task.id, deadlineModal.newDate, deadlineModal.reason);
    setDeadlineModal({ isOpen: false, task: null, newDate: '', reason: '' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.task) return;
    await onDeleteTask(deleteConfirm.task.id);
    setDeleteConfirm({ isOpen: false, task: null });
  };

  const handleConfirmReopen = async (e) => {
    e.preventDefault();
    if (!reopenModal.task) return;
    await onReopenTask(reopenModal.task.id, { reason: reopenModal.reason });
    setReopenModal({ isOpen: false, task: null, reason: '' });
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Executive Task Management</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-900">
              {tasks.length} Directives
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Full organizational task visibility, cross-department assignments, and priority control.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Issue Official Task
        </Button>
      </div>

      {/* Tasks Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Directive & Scope</th>
                <th className="py-3 px-3">Assignee & Dept</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Deadline</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Executive Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 italic">
                    No tasks match the selected criteria.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const assigneeName =
                    task.assignee_first
                      ? `${task.assignee_first} ${task.assignee_last || ''}`
                      : task.assigneeName || 'Assigned Staff';
                  const dept = task.assignee_dept_name || task.department_name || task.department || 'Operations';
                  const isOverdue =
                    task.is_overdue ||
                    (task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED');
                  const isAi = task.assigned_by === 'AI' || task.is_ai_assigned;

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Title & Description */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={task.title}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-[11px] text-slate-500 truncate" title={task.description}>
                            {task.description}
                          </div>
                        )}
                        {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                            <CheckSquare className="w-3 h-3 text-slate-400" />
                            <span>
                              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks completed
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Assignee & Dept */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{assigneeName}</div>
                        <div className="text-[10px] text-slate-400">{dept}</div>
                      </td>

                      {/* Source Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isAi ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Sparkles className="w-2.5 h-2.5" /> AI Engine
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                            <ShieldCheck className="w-2.5 h-2.5 text-brand-600" /> CEO Directive
                          </span>
                        )}
                      </td>

                      {/* Priority Selector */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={task.priority || 'MEDIUM'}
                          onChange={(e) => onChangePriority && onChangePriority(task.id, e.target.value)}
                          className={`text-[10px] font-bold rounded px-1.5 py-0.5 border cursor-pointer ${
                            task.priority === 'URGENT'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                              : task.priority === 'HIGH'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <option value="URGENT">URGENT</option>
                          <option value="HIGH">HIGH</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="LOW">LOW</option>
                        </select>
                      </td>

                      {/* Deadline */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div
                          className={`font-semibold flex items-center gap-1 ${
                            isOverdue
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isOverdue && <Flame className="w-3 h-3 text-rose-500 animate-pulse" />}
                          <span>{task.due_date ? String(task.due_date).split('T')[0] : 'No deadline'}</span>
                        </div>
                        {isOverdue && (
                          <span className="text-[10px] text-rose-500 font-bold block">Overdue</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <Badge
                          variant={
                            task.status === 'COMPLETED'
                              ? 'success'
                              : task.status === 'IN_PROGRESS'
                              ? 'info'
                              : task.status === 'BLOCKED'
                              ? 'danger'
                              : 'default'
                          }
                        >
                          {task.status || 'TODO'}
                        </Badge>
                      </td>

                      {/* Executive Action Controls */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Reassign Button */}
                          <button
                            type="button"
                            title="Reassign Task"
                            onClick={() =>
                              setReassignModal({
                                isOpen: true,
                                task,
                                newAssigneeId: task.assignee_id || '',
                                reason: '',
                              })
                            }
                            className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Modify Deadline */}
                          <button
                            type="button"
                            title="Modify Deadline"
                            onClick={() =>
                              setDeadlineModal({
                                isOpen: true,
                                task,
                                newDate: task.due_date ? String(task.due_date).split('T')[0] : '',
                                reason: '',
                              })
                            }
                            className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>

                          {/* Close / Reopen */}
                          {task.status === 'COMPLETED' ? (
                            <button
                              type="button"
                              title="Reopen Task"
                              onClick={() => setReopenModal({ isOpen: true, task, reason: '' })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Mark Closed/Completed"
                              onClick={() => onUpdateStatus && onUpdateStatus(task.id, 'COMPLETED')}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Audit Trail */}
                          <button
                            type="button"
                            title="View Complete Activity & Audit Trail"
                            onClick={() => setSelectedAuditTask(task)}
                            className="p-1.5 text-slate-500 hover:text-purple-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            title="Delete Task Directive"
                            onClick={() => setDeleteConfirm({ isOpen: true, task })}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Task Creation Modal */}
      <CeoTaskCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={onCreateTask}
        employees={employees}
        departments={departments}
      />

      {/* Reassignment Modal */}
      <Modal
        isOpen={reassignModal.isOpen}
        onClose={() => setReassignModal({ isOpen: false, task: null, newAssigneeId: '', reason: '' })}
        title="Reassign Task Directive"
        subtitle={`Transferring: ${reassignModal.task?.title || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmReassign} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Select New Operational Assignee <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={reassignModal.newAssigneeId}
              onChange={(e) => setReassignModal({ ...reassignModal, newAssigneeId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select Target Employee</option>
              {assignableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} — {emp.departmentName || emp.department || 'Operations'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Reassignment Rationale / Handover Note
            </label>
            <textarea
              rows="2"
              value={reassignModal.reason}
              onChange={(e) => setReassignModal({ ...reassignModal, reason: e.target.value })}
              placeholder="e.g. Reassigned to balance engineering workload across sprint squads..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setReassignModal({ isOpen: false, task: null, newAssigneeId: '', reason: '' })}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Confirm Reassignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modify Deadline Modal */}
      <Modal
        isOpen={deadlineModal.isOpen}
        onClose={() => setDeadlineModal({ isOpen: false, task: null, newDate: '', reason: '' })}
        title="Modify Task Deadline"
        subtitle={`Updating due date for: ${deadlineModal.task?.title || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmDeadline} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              New Executive Deadline <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={deadlineModal.newDate}
              onChange={(e) => setDeadlineModal({ ...deadlineModal, newDate: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Extension Justification
            </label>
            <textarea
              rows="2"
              value={deadlineModal.reason}
              onChange={(e) => setDeadlineModal({ ...deadlineModal, reason: e.target.value })}
              placeholder="e.g. Extended to accommodate client legal verification dependencies..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setDeadlineModal({ isOpen: false, task: null, newDate: '', reason: '' })}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Apply Deadline Update
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reopen Task Modal */}
      <Modal
        isOpen={reopenModal.isOpen}
        onClose={() => setReopenModal({ isOpen: false, task: null, reason: '' })}
        title="Reopen Completed Task"
        subtitle={`Mandatory rationale for: ${reopenModal.task?.title || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmReopen} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Reason for Reopening Task <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows="3"
              value={reopenModal.reason}
              onChange={(e) => setReopenModal({ ...reopenModal, reason: e.target.value })}
              placeholder="Specify defects, missing deliverables, or additional requirements..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setReopenModal({ isOpen: false, task: null, reason: '' })}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Reopen Directive
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, task: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Task Directive"
        message={`Are you sure you want to permanently delete task "${deleteConfirm.task?.title}"? This action is recorded in the permanent audit trail.`}
        confirmText="Permanently Delete"
        variant="danger"
      />

      {/* Audit Trail Modal */}
      <TaskAuditTrailModal
        isOpen={!!selectedAuditTask}
        onClose={() => setSelectedAuditTask(null)}
        task={selectedAuditTask}
      />
    </div>
  );
};

