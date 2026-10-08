import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Building,
  Shield,
  AlertCircle,
  FileCheck,
  Check,
  RotateCcw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ExitChecklistDetailCard = ({
  checklist,
  canManage = false,
  onRefresh,
}) => {
  const toast = useToast();
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  if (!checklist) return null;

  const items = checklist.items || [];
  const completedCount = checklist.completedItemsCount || items.filter((i) => i.status === 'Completed').length;
  const totalCount = items.length || 5;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isAllCompleted = checklist.isAllItemsCompleted || (totalCount > 0 && completedCount === totalCount);
  const isProcessCompleted = checklist.status === 'Completed';

  // Toggle individual checklist item status
  const handleToggleItemStatus = async (item) => {
    if (!canManage || isProcessCompleted) return;

    const newStatus = item.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      setUpdatingItemId(item.id);
      await exitService.updateChecklistItemStatus(checklist.id, item.id, {
        status: newStatus,
      });
      toast.success(`'${item.title}' marked as ${newStatus}.`);
      onRefresh?.();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update item status.';
      toast.error(msg);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Mark entire exit process as completed
  const handleCompleteExitProcess = async () => {
    if (!canManage || !isAllCompleted || isProcessCompleted) return;

    try {
      setIsCompleting(true);
      const res = await exitService.completeExitChecklist(checklist.id);
      toast.success(res?.message || 'Exit process marked as completed successfully!');
      setShowCompleteConfirm(false);
      onRefresh?.();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to complete exit process.';
      toast.error(msg);
    } finally {
      setIsCompleting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'EM';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Top Banner: Employee & Checklist Meta */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/70 dark:from-slate-850 dark:via-slate-900 dark:to-slate-850">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {checklist.avatarUrl ? (
              <img
                src={checklist.avatarUrl}
                alt={checklist.employeeName}
                className="w-13 h-13 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              />
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                {getInitials(checklist.employeeName)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {checklist.employeeName}
                </h2>
                <Badge variant="neutral" size="sm">
                  {checklist.employeeCode || 'EMP'}
                </Badge>
                <Badge
                  variant={isProcessCompleted ? 'success' : 'brand'}
                  size="sm"
                >
                  {isProcessCompleted ? 'Exit Completed' : 'In Progress'}
                </Badge>
                {!canManage && (
                  <Badge variant="neutral" size="sm">
                    <Lock className="w-3 h-3 inline mr-1 text-slate-400" />
                    View Only
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{checklist.designation || 'Staff'}</span>
                {checklist.department && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {checklist.department}
                    </span>
                  </>
                )}
                {checklist.employeeEmail && (
                  <>
                    <span>•</span>
                    <span>{checklist.employeeEmail}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Key Exit Dates */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs">
            <div className="px-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Resignation Date
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-brand-500" />
                {checklist.resignationDate || 'N/A'}
              </span>
            </div>
            <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="px-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Last Working Day
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                {checklist.lastWorkingDay || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Checklist Completion Progress
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {completedCount} of {totalCount} Completed ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isAllCompleted ? 'bg-emerald-500' : 'bg-brand-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Completion Status Alert (if completed) */}
      {isProcessCompleted && (
        <div className="m-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              Exit Process Fully Completed
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              All 5 checklist items have been cleared. Employee status has been updated to Exited
              {checklist.completedAt ? ` on ${new Date(checklist.completedAt).toLocaleDateString()}` : ''}
              {checklist.completedByName ? ` by ${checklist.completedByName}` : ''}.
            </p>
          </div>
        </div>
      )}

      {/* The 5 Checklist Items */}
      <div className="p-6 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Mandatory Exit Checklist Items ({items.length})
        </h3>

        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const isItemCompleted = item.status === 'Completed';
            const isItemUpdating = updatingItemId === item.id;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isItemCompleted
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                {/* Left: Item Info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      isItemCompleted
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isItemCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>Status:</span>
                      {isItemCompleted ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}

                      {isItemCompleted && item.completedAt && (
                        <>
                          <span>•</span>
                          <span>
                            Completed {new Date(item.completedAt).toLocaleDateString()}
                            {item.completedByName ? ` by ${item.completedByName}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions (HR / Admin only) */}
                {canManage && !isProcessCompleted && (
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button
                      variant={isItemCompleted ? 'secondary' : 'primary'}
                      size="sm"
                      isLoading={isItemUpdating}
                      icon={isItemCompleted ? RotateCcw : Check}
                      onClick={() => handleToggleItemStatus(item)}
                    >
                      {isItemCompleted ? 'Mark Pending' : 'Mark Completed'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Bar: Mark Exit Process Completed (HR & Admin) */}
      {canManage && !isProcessCompleted && (
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Finalize Exit Process
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAllCompleted
                ? 'All 5 checklist items are completed. You can now finalize the exit process.'
                : 'All five checklist items must be marked as Completed before this process can be finished.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="success"
              size="sm"
              icon={CheckCircle2}
              disabled={!isAllCompleted || isCompleting}
              isLoading={isCompleting}
              onClick={() => setShowCompleteConfirm(true)}
              title={
                !isAllCompleted
                  ? 'All 5 checklist items must be completed first'
                  : 'Finalize and complete exit process'
              }
            >
              Mark Exit Process as Completed
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Marking Process as Completed */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Finalize Employee Exit?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              All 5 checklist items are marked as <strong>Completed</strong>. Completing this process will:
            </p>

            <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <li>Record the exit checklist as <strong>Completed</strong></li>
              <li>Update employee profile status to <strong>Exited</strong></li>
              <li>Deactivate the portal account for security</li>
            </ul>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCompleteConfirm(false)}
                disabled={isCompleting}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                size="sm"
                icon={CheckCircle2}
                isLoading={isCompleting}
                onClick={handleCompleteExitProcess}
              >
                Yes, Complete Exit Process
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
