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
  AlertTriangle,
  RefreshCw,
  Clock,
  Inbox,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { Can } from '../../components/rbac/Can.jsx';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage message="Loading dashboard intelligence..." />;
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-rose-100 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 ring-8 ring-rose-50/50">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Failed to Load Dashboard Intelligence</h3>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">{error}</p>
        <Button variant="primary" icon={RefreshCw} onClick={fetchStats}>
          Retry Connection
        </Button>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: stats?.totalOrganizations || 0,
      subtext: `${stats?.activeOrganizations || 0} active organizations`,
      icon: Building2,
      color: 'bg-indigo-500 text-indigo-600',
      bgLight: 'bg-indigo-50/70',
      border: 'border-indigo-100',
      action: () => navigate('/organizations'),
    },
    {
      title: 'Total Employees',
      value: stats?.totalEmployees || 0,
      subtext: `${stats?.activeEmployees || 0} active, ${stats?.onLeaveEmployees || 0} on leave`,
      icon: Users,
      color: 'bg-emerald-500 text-emerald-600',
      bgLight: 'bg-emerald-50/70',
      border: 'border-emerald-100',
      action: () => navigate('/employees'),
    },
    {
      title: 'Active Departments',
      value: stats?.totalDepartments || 0,
      subtext: 'Operational units mapped',
      icon: Briefcase,
      color: 'bg-amber-500 text-amber-600',
      bgLight: 'bg-amber-50/70',
      border: 'border-amber-100',
      action: () => navigate('/organizations'),
    },
    {
      title: 'System Users',
      value: stats?.totalUsers || 0,
      subtext: 'RBAC identity profiles',
      icon: UserCheck,
      color: 'bg-sky-500 text-sky-600',
      bgLight: 'bg-sky-50/70',
      border: 'border-sky-100',
      action: () => navigate('/users'),
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
              <span>HRMS Enterprise Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="mt-1 text-sm text-indigo-200/80 max-w-xl">
              Oversee corporate organizations, manage employee lifecycle profiles, and maintain strict role-based access control.
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
              onClick={card.action}
              className={`rounded-2xl border ${card.border} bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl ${card.bgLight} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold text-slate-900 tracking-tight">{card.value}</div>
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
            {stats?.recentEmployees && stats.recentEmployees.length > 0 ? (
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
                  {stats.recentEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => navigate('/employees')}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
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
            ) : (
              <div className="p-8">
                <EmptyState
                  icon={Inbox}
                  title="No employee records"
                  description="Staff registrations will appear in this feed."
                  actionLabel="Add Employee"
                  onAction={() => navigate('/employees?action=new')}
                />
              </div>
            )}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6 flex flex-col">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Department Breakdown</h3>
          <p className="text-xs text-slate-500 mb-6">Staff headcount allocated across departments</p>

          <div className="space-y-4 flex-1">
            {stats?.departmentDistribution && stats.departmentDistribution.length > 0 ? (
              stats.departmentDistribution.map((dept) => {
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
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No departmental distributions available.</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Your Session:</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="brand">{user?.roleName}</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
