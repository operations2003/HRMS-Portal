import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Laptop,
  Package,
  Calendar,
  FileCheck,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { onboardingService } from '../../services/onboardingService.js';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';

export const OnboardingChecklist = ({
  candidateId,
  checklist = {},
  bgvStatus = 'PENDING',
  canEdit = false,
  onChecklistUpdated,
}) => {
  const { showSuccess, showError, showInfo } = useToast();
  const [updatingKey, setUpdatingKey] = useState(null);

  const tracker = checklist || {};
  const completionPercentage = tracker.completionPercentage || 0;

  const handleToggle = async (key, currentValue) => {
    if (!canEdit) return;

    try {
      setUpdatingKey(key);
      const updated = await onboardingService.updateChecklist(candidateId, {
        [key]: !currentValue,
      });
      showSuccess(`Checklist updated.`);
      if (onChecklistUpdated) {
        onChecklistUpdated(updated.readinessTracker);
      }
    } catch (err) {
      showError(err.message || 'Failed to update checklist.');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleRequestItem = (title) => {
    showInfo(`Notification email sent to candidate requesting: ${title}`);
  };

  // Stage Definitions
  const stages = [
    {
      id: 'pre-joining',
      title: '1. Pre-Joining Documents & Compliance',
      subtitle: 'Identity verification, signed documents, and tax disclosures',
      icon: FileCheck,
      color: 'from-blue-500 to-brand-600',
      items: [
        {
          key: 'idCardGenerated',
          title: 'Employee ID Card & Profile Generation',
          description: 'Official employee record and identification badge photo issued',
          completed: !!tracker.idCardGenerated,
        },
      ],
    },
    {
      id: 'bgv-stage',
      title: '2. Background Verification (BGV)',
      subtitle: 'Criminal record, employment history, and educational credentials check',
      icon: ShieldCheck,
      color: 'from-emerald-500 to-teal-600',
      isBgvCustom: true,
    },
    {
      id: 'it-stage',
      title: '3. IT Setup & Digital Access',
      subtitle: 'Corporate email, laptop provisioning, and platform credentials',
      icon: Laptop,
      color: 'from-purple-500 to-brand-600',
      items: [
        {
          key: 'itSetup',
          title: 'Corporate Email & Cloud Accounts',
          description: 'Work email created, 2FA configured, and communication apps granted',
          completed: !!tracker.itSetup,
        },
        {
          key: 'workstationReady',
          title: 'Hardware & Workstation Configuration',
          description: 'Laptop imaged, security agents deployed, and workstation assigned',
          completed: !!tracker.workstationReady,
        },
      ],
    },
    {
      id: 'logistics-stage',
      title: '4. Welcome Kit & Logistics',
      subtitle: 'Welcome package, swag, and access card dispatch',
      icon: Package,
      color: 'from-brand-500 to-brand-700',
      items: [
        {
          key: 'welcomeKitDispatched',
          title: 'Welcome Kit & Swag Dispatched',
          description: 'TaskNera onboarding welcome box sent to candidate address',
          completed: !!tracker.welcomeKitDispatched,
        },
      ],
    },
    {
      id: 'orientation-stage',
      title: '5. Day-1 Orientation & Readiness',
      subtitle: 'Meeting schedule, manager introduction, and buddy assignment',
      icon: Calendar,
      color: 'from-rose-500 to-pink-600',
      items: [
        {
          key: 'orientationScheduled',
          title: 'Day-1 Orientation & Team Welcome Scheduled',
          description: 'Calendar invite sent for 10:00 AM induction with HR & Team Lead',
          completed: !!tracker.orientationScheduled,
        },
      ],
    },
  ];

  const getBgvBadge = (status) => {
    switch (status) {
      case 'CLEAR':
      case 'WAIVED':
        return <Badge variant="success">BGV {status}</Badge>;
      case 'RED_FLAG':
        return <Badge variant="danger">BGV RED FLAG</Badge>;
      case 'IN_PROGRESS':
      case 'INITIATED':
        return <Badge variant="info">BGV IN PROGRESS</Badge>;
      default:
        return <Badge variant="warning">BGV PENDING</Badge>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header & Progress Bar */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-brand-50/30 dark:from-slate-800/40 dark:to-brand-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              Onboarding Checklist & Day-1 Readiness
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Track multi-stage milestones required before official Day-1 employee conversion.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xl font-black text-brand-600 dark:text-brand-400">
                {completionPercentage}%
              </span>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Completed
              </p>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              completionPercentage === 100
                ? 'bg-emerald-500'
                : completionPercentage >= 50
                ? 'bg-brand-600'
                : 'bg-amber-500'
            }`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Stages List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div key={stage.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stage.color} text-white flex items-center justify-center shrink-0 shadow-sm`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                      {stage.title}
                    </h4>
                    {stage.isBgvCustom && getBgvBadge(bgvStatus)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    {stage.subtitle}
                  </p>

                  {/* BGV Stage Custom Card */}
                  {stage.isBgvCustom && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {bgvStatus === 'CLEAR' ? (
                          <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        ) : bgvStatus === 'RED_FLAG' ? (
                          <ShieldAlert className="w-5 h-5 text-rose-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Verification State: <span className="font-bold">{bgvStatus}</span>
                          </p>
                          <p className="text-xs text-slate-400">
                            {bgvStatus === 'CLEAR'
                              ? 'All background checks passed with zero discrepancies.'
                              : bgvStatus === 'RED_FLAG'
                              ? 'High priority flag detected. Candidate cannot be converted until resolved.'
                              : 'Verification vendor currently validating past employment & records.'}
                          </p>
                        </div>
                      </div>

                      {canEdit && bgvStatus !== 'CLEAR' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Send}
                          onClick={() => handleRequestItem('BGV Documentation & Address Verification')}
                        >
                          Send Reminder
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Checklist Items */}
                  {stage.items && (
                    <div className="space-y-3">
                      {stage.items.map((item) => {
                        const isUpdating = updatingKey === item.key;
                        return (
                          <div
                            key={item.key}
                            className={`p-3.5 rounded-xl border transition-all ${
                              item.completed
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                                : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <label
                                className={`flex items-start gap-3 select-none ${
                                  canEdit ? 'cursor-pointer' : 'cursor-default'
                                }`}
                                onClick={(e) => {
                                  if (canEdit && !isUpdating) {
                                    e.preventDefault();
                                    handleToggle(item.key, item.completed);
                                  }
                                }}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {isUpdating ? (
                                    <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                                  ) : item.completed ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                                  )}
                                </div>
                                <div>
                                  <span
                                    className={`text-sm font-semibold ${
                                      item.completed
                                        ? 'text-slate-900 dark:text-white'
                                        : 'text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {item.description}
                                  </p>
                                </div>
                              </label>

                              {canEdit && !item.completed && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  icon={Send}
                                  onClick={() => handleRequestItem(item.title)}
                                  className="shrink-0 text-slate-500 hover:text-brand-600"
                                >
                                  Request
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
