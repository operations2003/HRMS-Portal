import React from 'react';
import { Clock, CheckCircle2, XCircle, RotateCcw, Send, User, MessageSquare } from 'lucide-react';
import { Badge } from '../common/Badge.jsx';

export const WorkflowAuditTimeline = ({ history = [] }) => {
  if (!history || history.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-slate-400">
        No workflow history recorded yet.
      </div>
    );
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'SUBMIT':
      case 'SUBMITTED':
        return <Send className="w-3.5 h-3.5 text-sky-500" />;
      case 'APPROVE':
      case 'APPROVED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'REJECT':
      case 'REJECTED':
        return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
      case 'RETURN':
      case 'RETURNED':
        return <RotateCcw className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getActionBadgeVariant = (action) => {
    switch (action) {
      case 'APPROVE':
      case 'APPROVED':
        return 'success';
      case 'REJECT':
      case 'REJECTED':
        return 'danger';
      case 'RETURN':
      case 'RETURNED':
        return 'warning';
      case 'SUBMIT':
      case 'SUBMITTED':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {history.map((step, idx) => {
        const dateStr = step.created_at || step.createdAt || step.timestamp;
        const formattedDate = dateStr
          ? new Date(dateStr).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : '';

        const actorName =
          step.actorName ||
          step.actor_name ||
          (step.actor ? `${step.actor.first_name || ''} ${step.actor.last_name || ''}`.trim() : null) ||
          step.action_by ||
          'System';

        const prevStatus = step.fromStatus || step.from_status || step.previous_status;
        const nextStatus = step.toStatus || step.to_status || step.new_status;
        const commentText = step.comments || step.comment;

        return (
          <div key={step.id || idx} className="relative group">
            {/* Step marker icon */}
            <div className="absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-slate-300 shadow-xs">
              {getActionIcon(step.action)}
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1.5 hover:bg-slate-100/60 transition-colors">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{actorName}</span>
                  {(step.actor_role || step.actorRole) && (
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({step.actor_role || step.actorRole})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getActionBadgeVariant(step.action)} size="sm">
                    {step.action}
                  </Badge>
                  {formattedDate && (
                    <span className="text-[11px] text-slate-400">{formattedDate}</span>
                  )}
                </div>
              </div>

              {/* Status transition */}
              {(prevStatus || nextStatus) && (
                <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                  <span className="text-slate-400">Transition:</span>
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                    {prevStatus || 'Start'}
                  </span>
                  <span>&rarr;</span>
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium text-slate-900">
                    {nextStatus}
                  </span>
                </div>
              )}

              {/* Comments / reason */}
              {commentText && (
                <div className="flex items-start gap-1.5 text-slate-700 pt-1 border-t border-slate-200/60">
                  <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                  <p className="italic text-slate-600">{commentText}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
