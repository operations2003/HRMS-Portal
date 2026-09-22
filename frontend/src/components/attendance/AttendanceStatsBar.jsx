import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  CalendarCheck,
  Users,
  UserX,
  FileCheck,
} from 'lucide-react';

export const AttendanceStatsBar = ({ statistics = {}, summary = {}, isOrgView = false }) => {
  if (isOrgView) {
    const orgCards = [
      {
        title: 'Present Today',
        value: summary.presentCount || 0,
        subtext: `Out of ${summary.totalEmployees || 0} total employees`,
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bgLight: 'bg-emerald-50',
        border: 'border-emerald-200/70',
      },
      {
        title: 'Late Arrivals',
        value: summary.lateCount || 0,
        subtext: 'Punched in >10 mins after shift',
        icon: Clock,
        color: 'text-amber-600',
        bgLight: 'bg-amber-50',
        border: 'border-amber-200/70',
      },
      {
        title: 'Absent / Unreported',
        value: summary.absentCount || 0,
        subtext: 'No punch recorded today',
        icon: UserX,
        color: 'text-rose-600',
        bgLight: 'bg-rose-50',
        border: 'border-rose-200/70',
      },
      {
        title: 'On Leave / Half Day',
        value: (summary.onLeaveCount || 0) + (summary.halfDayCount || 0),
        subtext: `${summary.halfDayCount || 0} half-days, ${summary.onLeaveCount || 0} approved leaves`,
        icon: CalendarCheck,
        color: 'text-sky-600',
        bgLight: 'bg-sky-50',
        border: 'border-sky-200/70',
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {orgCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`rounded-2xl border ${card.border} bg-white p-5 shadow-sm transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl ${card.bgLight} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">{card.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{card.subtext}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Employee personal summary stats cards
  const presentCount = Math.max(
    Number(statistics.presentDays || 0),
    Number(statistics.lateDays || 0)
  );

  const employeeCards = [
    {
      title: 'Days Present',
      value: presentCount,
      subtext: `${statistics.lateDays || 0} marked late`,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-200/70',
    },
    {
      title: 'Total Hours Worked',
      value: `${Number(statistics.totalHoursWorked || 0).toFixed(1)} hrs`,
      subtext: 'Net duration this period',
      icon: Clock,
      color: 'text-brand-600',
      bgLight: 'bg-brand-50',
      border: 'border-brand-200/70',
    },
    {
      title: 'Overtime Hours',
      value: `${Number(statistics.totalOvertimeHours || 0).toFixed(1)} hrs`,
      subtext: 'Beyond 8.0 hr daily baseline',
      icon: Flame,
      color: 'text-amber-600',
      bgLight: 'bg-amber-50',
      border: 'border-amber-200/70',
    },
    {
      title: 'Half Days / Absent',
      value: (statistics.halfDays || 0) + (statistics.absentDays || 0),
      subtext: `${statistics.halfDays || 0} half-days, ${statistics.absentDays || 0} absent`,
      icon: AlertTriangle,
      color: 'text-slate-600',
      bgLight: 'bg-slate-100',
      border: 'border-slate-200/70',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {employeeCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`rounded-2xl border ${card.border} bg-white p-5 shadow-sm transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-2 rounded-xl ${card.bgLight} ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 tracking-tight">{card.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.subtext}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
