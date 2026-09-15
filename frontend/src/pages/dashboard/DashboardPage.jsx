import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardService } from '../../services/dashboardService.js';
import {
  Building2,
  Users,
  UserCheck,
  Briefcase,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Can } from '../../components/rbac/Can.jsx';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getStats();
        setStats(data);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage message="Loading dashboard intelligence..." />;
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: stats?.totalOrganizations || 0,
      subtext: `${stats?.activeOrganizations || 0} active systems`,
      icon: Building2,
      color: 'bg-indigo-500 text-indigo-600',
      bgLight: 'bg-indigo-50/70',
      border: 'border-indigo-100',
    },
    {
      title: 'Total Employees',
      value: stats?.totalEmployees || 0,
      subtext: `${stats?.activeEmployees || 0} currently active`,
      icon: Users,
      color: 'bg-emerald-500 text-emerald-600',
      bgLight: 'bg-emerald-50/70',
      border: 'border-emerald-100',
    },
    {
      title: 'Active Departments',
      value: stats?.totalDepartments || 0,
      subtext: 'Operational units',
      icon: Briefcase,
      color: 'bg-amber-500 text-amber-600',
      bgLight: 'bg-amber-50/70',
      border: 'border-amber-100',
    },
    {
      title: 'System Users',
      value: stats?.totalUsers || 0,
      subtext: 'RBAC user accounts',
      icon: UserCheck,
      color: 'bg-sky-500 text-sky-600',
      bgLight: 'bg-sky-50/70',
      border: 'border-sky-100',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold backdrop-blur-sm border border-indigo-400/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phase 1 Enterprise Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="mt-1 text-sm text-indigo-200/80 max-w-xl">
              Manage your corporate organizations, track active employee records, and oversee role-based permissions from a single command center.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Can permission="employee:write">
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => navigate('/employees?action=new')}
                className="bg-white text-indigo-950 hover:bg-indigo-50 border-0 shadow-md font-semibold"
              >
                Add Employee
              </Button>
            </Can>
            <Can permission="org:write">
              <Button
                variant="secondary"
                size="md"
                icon={Plus}
                onClick={() => navigate('/organizations?action=new')}
                className="bg-indigo-800/60 text-white border-indigo-700/50 hover:bg-indigo-700/60"
              >
                Add Organization
              </Button>
            </Can>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-16 -top-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`rounded-2xl border ${card.border} bg-white p-5 shadow-sm transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl ${card.bgLight} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold text-slate-900">{card.value}</div>
                <div className="text-xs text-slate-500 mt-1">{card.subtext}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dashboard 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Employees Table */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Employees</h3>
              <p className="text-xs text-slate-500 mt-0.5">Recently registered staff across departments</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              onClick={() => navigate('/employees')}
            >
              View Directory
            </Button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats?.recentEmployees?.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-800">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-xs text-slate-400">{emp.email}</div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {emp.department?.name || 'General'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{emp.employmentType}</td>
                    <td className="px-6 py-3.5">
                      <Badge variant="neutral" size="sm">
                        {emp.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Distribution */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6 flex flex-col">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Department Breakdown</h3>
          <p className="text-xs text-slate-500 mb-6">Staff allocation by department</p>

          <div className="space-y-4 flex-1">
            {stats?.departmentDistribution?.map((dept) => {
              const percentage =
                stats.totalEmployees > 0
                  ? Math.round((dept.count / stats.totalEmployees) * 100)
                  : 0;

              return (
                <div key={dept.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-700">{dept.name}</span>
                    <span className="text-slate-500">
                      {dept.count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Current Role:</span>
            <Badge variant="brand">{user?.roleName}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
