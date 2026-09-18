import React from 'react';
import {
  Users,
  Shield,
  Activity,
  Server,
  Building2,
  CheckCircle2,
  Database,
  Cpu,
} from 'lucide-react';

export const SystemOverviewCards = ({ overview = {} }) => {
  const cards = [
    {
      title: 'Active Portal Users',
      value: overview.activeUsers ?? overview.totalUsers ?? '—',
      subtitle: `${overview.totalUsers || 0} registered user accounts`,
      icon: Users,
      color: 'text-brand-600 bg-brand-50 border-brand-100',
    },
    {
      title: 'Active Employees',
      value: overview.activeEmployees ?? overview.totalEmployees ?? '—',
      subtitle: `${overview.departmentsCount || 0} departments configured`,
      icon: Building2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    {
      title: 'Configured Roles & RBAC',
      value: overview.rolesCount ?? '—',
      subtitle: `${overview.permissionsCount || 0} granular system permissions`,
      icon: Shield,
      color: 'text-violet-600 bg-violet-50 border-violet-100',
    },
    {
      title: 'System Health & Engine',
      value: overview.dbStatus === 'Connected' || !overview.dbStatus ? 'Healthy' : overview.dbStatus,
      subtitle: 'PostgreSQL Relational Storage Active',
      icon: Server,
      color: 'text-teal-600 bg-teal-50 border-teal-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{card.value}</h3>
              <p className="text-[11px] text-slate-400 mt-1">{card.subtitle}</p>
            </div>
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${card.color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
