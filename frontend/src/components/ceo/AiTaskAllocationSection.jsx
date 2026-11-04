import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  User,
  Calendar,
  AlertCircle,
  Sliders,
  CheckSquare,
  Building2,
  Activity,
  Layers,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { filterNonCeoEmployees } from '../../utils/roleUtils.js';

export const AiTaskAllocationSection = ({
  allocations = [],
  employees = [],
  onApprove,
  onReject,
  onAdjust,
}) => {
  const [rejectModal, setRejectModal] = useState({ isOpen: false, item: null, feedback: '' });
  const [adjustModal, setAdjustModal] = useState({
    isOpen: false,
    item: null,
    newAssigneeId: '',
    newDeadline: '',
    priority: 'HIGH',
  });

  const assignableEmployees = filterNonCeoEmployees(employees);

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal.item) return;
    await onReject(rejectModal.item.id, rejectModal.feedback);
    setRejectModal({ isOpen: false, item: null, feedback: '' });
  };

  const handleConfirmAdjust = async (e) => {
    e.preventDefault();
    if (!adjustModal.item) return;
    await onAdjust(adjustModal.item.id, {
      assigneeId: adjustModal.newAssigneeId,
      dueDate: adjustModal.newDeadline,
      priority: adjustModal.priority,
    });
    setAdjustModal({ isOpen: false, item: null, newAssigneeId: '', newDeadline: '', priority: 'HIGH' });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-brand-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-purple-200 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              Autonomous Workforce AI Engine
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">AI Task Allocation & Capacity Balancing</h2>
            <p className="text-xs text-purple-200/90 leading-relaxed">
              Workload-optimized task allocation based on real-time employee availability, skills match, and active sprint load. High-impact organizational assignments require your executive approval prior to deployment.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center shrink-0 w-36">
            <span className="block text-2xl font-black text-white">{allocations.length}</span>
            <span className="text-[10px] uppercase font-bold text-purple-200 tracking-wider">Awaiting Decision</span>
          </div>
        </div>
      </div>

      {/* Allocations Cards Stream */}
      <div className="space-y-4">
        {allocations.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">All AI Allocations Processed</h4>
            <p className="text-xs text-slate-500 mt-1">There are no pending AI task recommendations requiring CEO intervention.</p>
          </div>
        ) : (
          allocations.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 hover:border-brand-300 dark:hover:border-brand-800 transition-all"
            >
              {/* Card Top: Badges & Title */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <Sparkles className="w-3 h-3" /> AI Assigned
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Clock className="w-3 h-3" /> Awaiting CEO Approval
                  </span>
                  <Badge variant={item.priority === 'URGENT' ? 'danger' : 'warning'}>
                    {item.priority || 'HIGH'}
                  </Badge>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Suggested Deadline: <strong>{item.suggestedDeadline}</strong></span>
                </div>
              </div>

              {/* Task Title & Description */}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{item.taskTitle}</h3>
                {item.taskDescription && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {item.taskDescription}
                  </p>
                )}
              </div>

              {/* Suggested Employee Workload Profile */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <Avatar name={item.suggestedAssignee.name} size="md" />
                  <div>
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                      Recommended Assignee
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.suggestedAssignee.name}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {item.suggestedAssignee.designation} ({item.suggestedAssignee.department})
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Capacity & Workload
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: '74%' }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {item.suggestedAssignee.workload}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {item.suggestedAssignee.existingAssignmentsCount} other active assignments
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Real-time Availability
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <Activity className="w-3 h-3" />
                    {item.suggestedAssignee.availability}
                  </span>
                </div>
              </div>

              {/* AI Allocation Reasoning Card */}
              <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">AI Allocation Rationale: </span>
                  <span>{item.aiReasoning}</span>
                </div>
              </div>

              {/* AI-Generated Subtasks */}
              {item.aiSubtasks && item.aiSubtasks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    AI-Synthesized Work Milestones:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {item.aiSubtasks.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{st.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons: 1-Click Approve, Reject, or Adjust */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  onClick={() =>
                    setAdjustModal({
                      isOpen: true,
                      item,
                      newAssigneeId: item.suggestedAssignee.id,
                      newDeadline: item.suggestedDeadline,
                      priority: item.priority,
                    })
                  }
                  className="text-xs inline-flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" /> Adjust & Override
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setRejectModal({ isOpen: true, item, feedback: '' })}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1.5"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> Reject Allocation
                </Button>

                <Button
                  variant="primary"
                  onClick={() => onApprove(item.id, item)}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1.5"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Approve & Deploy Directive
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, item: null, feedback: '' })}
        title="Reject AI Task Recommendation"
        subtitle="Provide guidance to refine future AI allocations"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Rejection Rationale <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows="3"
              value={rejectModal.feedback}
              onChange={(e) => setRejectModal({ ...rejectModal, feedback: e.target.value })}
              placeholder="e.g. Employee already leading confidential client bid; re-assign to another squad..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setRejectModal({ isOpen: false, item: null, feedback: '' })}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Allocation Modal */}
      <Modal
        isOpen={adjustModal.isOpen}
        onClose={() =>
          setAdjustModal({
            isOpen: false,
            item: null,
            newAssigneeId: '',
            newDeadline: '',
            priority: 'HIGH',
          })
        }
        title="Adjust & Override AI Allocation"
        subtitle={`Modifying recommendation for: ${adjustModal.item?.taskTitle || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmAdjust} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Assignee (No CEO) <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={adjustModal.newAssigneeId}
              onChange={(e) => setAdjustModal({ ...adjustModal, newAssigneeId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {assignableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()} — {emp.designationTitle || emp.departmentName || 'Operations'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Revised Deadline
            </label>
            <input
              type="date"
              required
              value={adjustModal.newDeadline}
              onChange={(e) => setAdjustModal({ ...adjustModal, newDeadline: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={adjustModal.priority}
              onChange={(e) => setAdjustModal({ ...adjustModal, priority: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() =>
                setAdjustModal({
                  isOpen: false,
                  item: null,
                  newAssigneeId: '',
                  newDeadline: '',
                  priority: 'HIGH',
                })
              }
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Approve with Adjustments
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

