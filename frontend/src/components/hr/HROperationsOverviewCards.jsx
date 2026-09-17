import React from 'react';
import { Users, UserCheck, CalendarOff, Award, TrendingUp, Clock } from 'lucide-react';

export const HROperationsOverviewCards = ({ stats = {} }) => {
  const cards = [
    {
      title: 'Total Workforce',
      value: stats.totalEmployees ?? stats.headcount ?? 0,
      subtext: `${stats.activeEmployees ?? 0} active employees`,
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50/60',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-100',
    },
    {
      title: 'Reporting Managers',
      value: stats.totalManagers ?? stats.managerCount ?? 0,
      subtext: 'Leading active teams',
      icon: UserCheck,
      color: 'from-purple-500 to-indigo-600',
      bgLight: 'bg-purple-50/60',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-100',
    },
    {
      title: 'Today Presence',
      value: stats.todayAttendanceRate ? `${stats.todayAttendanceRate}%` : `${stats.attendancePercentage ?? 95}%`,
      subtext: `${stats.presentToday ?? 0} checked in today`,
      icon: Clock,
      color: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50/60',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'Pending Approvals',
      value: (stats.pendingLeaves ?? 0) + (stats.pendingAppraisals ?? 0) + (stats.pendingApprovals ?? 0),
      subtext: `${stats.pendingLeaves ?? 0} leaves &bull; ${stats.pendingAppraisals ?? 0} reviews`,
      icon: CalendarOff,
      color: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50/60',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.title}
              </span>
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-sm`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                {card.value}
              </h3>
              <p
                className="text-xs text-slate-500 mt-1 font-medium"
                dangerouslySetInnerHTML={{ __html: card.subtext }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
