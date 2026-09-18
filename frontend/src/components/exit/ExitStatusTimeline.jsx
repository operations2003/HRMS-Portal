import React from 'react';
import {
  FileText,
  UserCheck,
  Calendar,
  ClipboardList,
  ShieldCheck,
  UserX,
  Wallet,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export const ExitStatusTimeline = ({ status, currentStage, offboarding = null }) => {
  const isWithdrawn = status === 'WITHDRAWN';
  const isRejected = status === 'REJECTED';

  if (isWithdrawn) {
    return (
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <RotateCcw className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-900">Resignation Withdrawn</h4>
          <p className="text-xs text-amber-700 mt-0.5">
            This resignation request was retracted by the employee and active employment continues without disruption.
          </p>
        </div>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-rose-900">Resignation Not Approved</h4>
          <p className="text-xs text-rose-700 mt-0.5">
            The resignation request was reviewed and rejected. Active employment remains in place.
          </p>
        </div>
      </div>
    );
  }

  // Exact 8-stage lifecycle sequence
  const steps = [
    {
      id: 'RESIGNATION',
      title: 'Resignation',
      subtitle: 'Submitted',
      icon: FileText,
    },
    {
      id: 'REVIEW',
      title: 'Review',
      subtitle: 'Manager / HR',
      icon: UserCheck,
    },
    {
      id: 'NOTICE_PERIOD',
      title: 'Notice Period',
      subtitle: 'Active Notice',
      icon: Calendar,
    },
    {
      id: 'CHECKLIST',
      title: 'Checklist',
      subtitle: 'Assigned',
      icon: ClipboardList,
    },
    {
      id: 'CLEARANCE',
      title: 'Clearance',
      subtitle: 'Depts Sign-off',
      icon: ShieldCheck,
    },
    {
      id: 'ACCESS_REMOVAL',
      title: 'Access Removal',
      subtitle: 'Deprovisioned',
      icon: UserX,
    },
    {
      id: 'FULL_AND_FINAL',
      title: 'Full & Final',
      subtitle: 'Settled',
      icon: Wallet,
    },
    {
      id: 'COMPLETED',
      title: 'Completed',
      subtitle: 'Archived',
      icon: CheckCircle2,
    },
  ];

  // Determine active step index (1-based)
  let activeIndex = 1;
  const s = (status || '').toUpperCase();
  const c = (currentStage || '').toUpperCase();
  const accessRevoked = offboarding?.accessRemovalStatus === 'DEPROVISIONED';
  const fnfSettled = offboarding?.fnfSummary?.paymentStatus === 'DISBURSED';

  if (s === 'SUBMITTED' || c === 'MANAGER_REVIEW') {
    activeIndex = 1;
  } else if (s === 'UNDER_REVIEW' || c === 'HR_REVIEW') {
    activeIndex = 2;
  } else if (s === 'APPROVED' || s === 'NOTICE_PERIOD') {
    activeIndex = 3;
  } else if (c === 'CLEARANCE_IN_PROGRESS') {
    activeIndex = 4;
  } else if (s === 'EXIT_PROCESSING') {
    if (accessRevoked) activeIndex = 7;
    else activeIndex = 5;
  } else if (s === 'COMPLETED' || c === 'COMPLETED') {
    activeIndex = 8;
  }

  if (accessRevoked && activeIndex < 6) activeIndex = 6;
  if (fnfSettled && activeIndex < 7) activeIndex = 7;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Employee Exit Lifecycle</h4>
          <p className="text-xs text-slate-500">
            Resignation → Review → Notice Period → Checklist → Clearance → Access Removal → Full & Final → Completed
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          Stage {activeIndex} of 8
        </span>
      </div>

      <div className="relative">
        {/* Progress connector line */}
        <div className="hidden lg:block absolute top-4 left-6 right-6 h-0.5 bg-slate-100 -z-0" />

        {/* Steps Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 relative z-10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const stepNum = idx + 1;
            const isDone = stepNum < activeIndex || (stepNum === 8 && s === 'COMPLETED');
            const isCurrent = stepNum === activeIndex && s !== 'COMPLETED';

            return (
              <div key={step.id} className="flex flex-col items-center text-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                      : isCurrent
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100 shadow-brand-600/25 animate-pulse'
                      : 'bg-slate-50 text-slate-400 border border-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <h5
                  className={`mt-2 text-[11px] font-bold leading-tight ${
                    isDone || isCurrent ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {step.title}
                </h5>
                <p className="text-[10px] text-slate-400 mt-0.5">{step.subtitle}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
