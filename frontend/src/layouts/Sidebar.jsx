import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  Briefcase,
  ShieldCheck,
  X,
  Sparkles,
  CalendarCheck,
  CalendarDays,
  FileText,
  FolderLock,
  LifeBuoy,
  ClipboardList,
  Award,
  CheckCircle2,
  LogOut,
  UserMinus,
  Sliders,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { TaskNeraLogo } from '../components/common/TaskNeraLogo.jsx';

export const Sidebar = ({ isOpen, onClose }) => {
  const { hasPermission, hasRole } = useAuth();

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      permission: 'dashboard:read',
    },
    {
      name: 'Manager Cockpit',
      path: '/manager',
      icon: Briefcase,
      roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
    },
    {
      name: 'Team',
      path: '/team',
      icon: Users,
      roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
    },
    {
      name: 'Approvals',
      path: '/approvals',
      icon: CheckCircle2,
      roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
    },
    {
      name: 'Performance',
      path: '/performance',
      icon: Award,
      permission: ['performance:read', 'employee:read'],
    },
    {
      name: 'HR Operations',
      path: '/hr-operations',
      icon: ShieldCheck,
      roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
    },
    {
      name: 'Attendance',
      path: '/attendance',
      icon: CalendarCheck,
      permission: 'attendance:read',
    },
    {
      name: 'Leaves',
      path: '/leaves',
      icon: CalendarDays,
      permission: 'leave:read',
    },
    {
      name: 'Organizations',
      path: '/organizations',
      icon: Building2,
      permission: 'org:read',
    },
    {
      name: 'Onboarding',
      path: '/onboarding',
      icon: UserCheck,
      permission: 'onboarding:read',
    },
    {
      name: 'Employees',
      path: '/employees',
      icon: Users,
      permission: 'employee:read',
    },
    {
      name: 'Documents',
      path: '/documents',
      icon: FolderLock,
      permission: ['document:read', 'employee:read'],
    },
    {
      name: 'Helpdesk',
      path: '/helpdesk',
      icon: LifeBuoy,
      permission: ['helpdesk:read', 'employee:read'],
    },
    {
      name: 'Requests',
      path: '/requests',
      icon: ClipboardList,
      permission: ['request:read', 'employee:read'],
    },
    {
      name: 'Departments',
      path: '/departments',
      icon: Briefcase,
      permission: 'dept:read',
    },
    {
      name: 'User Accounts',
      path: '/users',
      icon: UserCheck,
      permission: 'user:write',
    },
    {
      name: 'Resignation',
      path: '/resignation',
      icon: LogOut,
      permission: ['exit:read', 'exit:write', 'employee:read'],
    },
    {
      name: 'Exit Checklist',
      path: '/exit-checklist',
      icon: ClipboardList,
      permission: ['exit:read', 'exit:write', 'employee:read'],
    },
    {
      name: 'Offboarding',
      path: '/offboarding',
      icon: UserMinus,
      permission: ['exit:read', 'exit:admin', 'employee:read'],
    },
    {
      name: 'Full & Final',
      path: '/fnf',
      icon: Wallet,
      permission: ['exit:read', 'employee:read'],
    },
    {
      name: 'Roles & RBAC',
      path: '/roles',
      icon: KeyRound,
      roles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
    },
    {
      name: 'Admin Settings',
      path: '/admin-settings',
      icon: Sliders,
      roles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
    },
  ];

  // Filter navigation links based on user permissions & roles
  const visibleItems = navItems.filter((item) => {
    if (item.roles && !hasRole(item.roles)) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:z-auto flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo & Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/80 bg-white">
          <NavLink to="/dashboard" className="flex items-center gap-2.5 group focus:outline-none">
            <TaskNeraLogo variant="icon" className="w-8 h-8" />
            <div className="flex flex-col">
              <div className="flex items-center text-lg font-black tracking-tight leading-none">
                <span className="text-slate-900 group-hover:text-slate-800 transition-colors">Task</span>
                <span className="bg-gradient-to-r from-brand-600 to-cyan-600 bg-clip-text text-transparent">Nera</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                HRMS Portal
              </span>
            </div>
          </NavLink>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Enterprise Management
          </div>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onClose && onClose()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-700 dark:text-brand-400 font-bold border-l-[3.5px] border-brand-600 shadow-xs translate-x-0.5'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer branding */}
        <div className="p-3.5 m-3 rounded-2xl bg-gradient-to-br from-brand-50/80 via-white to-slate-50 border border-brand-100/70 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 mb-1">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">People. Processes. Performance.</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Enterprise HRMS • RBAC Enabled
          </p>
        </div>
      </aside>
    </>
  );
};
