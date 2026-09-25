import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  LogOut,
  UserMinus,
  Sliders,
  KeyRound,
  Wallet,
  CheckSquare,
  GraduationCap,
  Megaphone,
  Clock,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { TaskNeraLogo } from '../components/common/TaskNeraLogo.jsx';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  // Top-level direct shortcuts
  const directItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      permission: 'dashboard:read',
    },
  ];

  // Collapsible dropdown navigation groups
  const navGroups = [
    {
      id: 'attendance-leave',
      title: 'Attendance & Leave',
      icon: CalendarCheck,
      items: [
        {
          name: 'Attendance',
          path: '/attendance',
          icon: Clock,
          permission: 'attendance:read',
        },
        {
          name: 'Leaves & Approvals',
          path: '/leaves',
          icon: CalendarDays,
          permission: 'leave:read',
        },
      ],
    },
    {
      id: 'performance-growth',
      title: 'Performance & Growth',
      icon: Award,
      items: [
        {
          name: 'Appraisals & Reviews',
          path: '/performance',
          icon: Award,
          permission: ['performance:read', 'employee:read'],
        },
        {
          name: 'Performance Reports',
          path: '/reports',
          icon: FileText,
          permission: ['employee:read'],
        },
        {
          name: 'Tasks & Goals',
          path: '/tasks',
          icon: CheckSquare,
          permission: ['task:read', 'employee:read'],
        },
        {
          name: 'Learning & Development',
          path: '/training',
          icon: GraduationCap,
          permission: ['training:read', 'employee:read'],
        },
        {
          name: 'Probation Confirmation',
          path: '/probation',
          icon: Clock,
          roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },
    {
      id: 'team-management',
      title: 'Team',
      icon: Users,
      roles: ['Manager', 'HRManager'],
      excludeRoles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
      items: [
        {
          name: 'Team Management',
          path: '/team',
          icon: Users,
          roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Manager Cockpit',
          path: '/manager',
          icon: Briefcase,
          roles: ['Manager', 'HR', 'HRManager'],
          excludeRoles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Team Appraisals',
          path: '/performance',
          icon: Award,
          roles: ['Manager', 'HR', 'HRManager'],
          excludeRoles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },
    {
      id: 'people',
      title: 'People',
      icon: Building2,
      items: [
        {
          name: 'Employees Directory',
          path: '/employees',
          icon: Users,
          permission: 'employee:read',
        },
        {
          name: 'Departments',
          path: '/departments',
          icon: Building2,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Onboarding',
          path: '/onboarding',
          icon: UserCheck,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Offboarding & Clearances',
          path: '/offboarding',
          icon: UserMinus,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },
    {
      id: 'payroll-finance',
      title: 'Payroll & Finance',
      icon: Wallet,
      items: [
        {
          name: (user?.roleName || '').toLowerCase().includes('admin') ? 'Payroll Management' : 'Payroll & Slips',
          path: '/payroll',
          icon: Wallet,
          permission: ['employee:read'],
        },
        {
          name: 'Full & Final Settlement',
          path: '/fnf',
          icon: Wallet,
          permission: ['exit:read', 'employee:read'],
        },
      ],
    },
    {
      id: 'company',
      title: 'Company',
      icon: BookOpen,
      items: [
        {
          name: 'Documents',
          path: '/documents',
          icon: FolderLock,
          permission: ['document:read', 'employee:read'],
        },
        {
          name: 'Help Desk & Requests',
          path: '/helpdesk',
          icon: LifeBuoy,
          permission: ['helpdesk:read', 'request:read', 'employee:read'],
        },
        {
          name: 'Company Policies',
          path: '/policies',
          icon: BookOpen,
          permission: ['employee:read'],
        },
        {
          name: 'Engagement & Surveys',
          path: '/engagement',
          icon: Megaphone,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },
    {
      id: 'hr-operations',
      title: 'HR Operations',
      icon: ShieldCheck,
      roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
      items: [
        {
          name: 'HR Operations & Analytics',
          path: '/hr-operations',
          icon: ShieldCheck,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Performance Reviews',
          path: '/performance',
          icon: Award,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },
    {
      id: 'exit-management',
      title: 'Exit Management',
      icon: LogOut,
      items: [
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
          name: 'Offboarding & Clearances',
          path: '/offboarding',
          icon: UserMinus,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },
    {
      id: 'system-admin',
      title: 'System Admin',
      icon: Sliders,
      roles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
      items: [
        {
          name: 'Organizations',
          path: '/organizations',
          icon: Building2,
          permission: 'org:read',
        },
        {
          name: 'User Accounts',
          path: '/users',
          icon: UserCheck,
          permission: 'user:write',
        },
        {
          name: 'Roles & RBAC',
          path: '/roles',
          icon: KeyRound,
          roles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Performance Reviews',
          path: '/performance',
          icon: Award,
          roles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Admin Settings',
          path: '/admin-settings',
          icon: Sliders,
          roles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },
  ];

  // Helper to check user permissions & roles for a nav item
  const isItemPermitted = (item) => {
    if (item.excludeRoles) {
      const userRoleStr = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().trim();
      const excluded = item.excludeRoles.map((r) => r.toLowerCase().trim());
      if (excluded.includes(userRoleStr)) return false;
    }
    if (item.roles && !hasRole(item.roles)) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  };

  // Filter direct links and group items based on active user RBAC
  const visibleDirectItems = directItems.filter(isItemPermitted);

  const visibleGroups = navGroups
    .map((group) => {
      if (group.excludeRoles) {
        const userRoleStr = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().trim();
        const excluded = group.excludeRoles.map((r) => r.toLowerCase().trim());
        if (excluded.includes(userRoleStr)) return null;
      }
      if (group.roles && !hasRole(group.roles)) return null;
      const permittedItems = group.items.filter(isItemPermitted);
      if (permittedItems.length === 0) return null;
      return { ...group, items: permittedItems };
    })
    .filter(Boolean);

  // Track accordion expand/collapse state
  const [openGroups, setOpenGroups] = useState({});

  // Auto-expand the dropdown containing the active URL route
  useEffect(() => {
    const currentPath = location.pathname;
    visibleGroups.forEach((group) => {
      const isInside = group.items.some(
        (item) => currentPath === item.path || currentPath.startsWith(`${item.path}/`)
      );
      if (isInside) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

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
        {/* Logo & Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/80 bg-white shrink-0">
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
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {/* Direct Quick Shortcuts */}
          <div className="space-y-1">
            {visibleDirectItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-700 font-bold border-l-[3.5px] border-brand-600 shadow-xs translate-x-0.5'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="pt-2 pb-1 px-3">
            <div className="h-px bg-slate-100" />
          </div>

          <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Workspace Modules
          </div>

          {/* Collapsible Dropdown Groups */}
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = !!openGroups[group.id];
            const isGroupActive = group.items.some(
              (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
            );

            return (
              <div key={group.id} className="space-y-0.5">
                {/* Dropdown Header Trigger */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 select-none ${
                    isGroupActive
                      ? 'text-brand-700 bg-brand-50/50 hover:bg-brand-50'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GroupIcon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isGroupActive ? 'text-brand-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{group.title}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                      isExpanded ? 'rotate-180 text-brand-600' : ''
                    }`}
                  />
                </button>

                {/* Sub-item Links with Smooth Accordion */}
                {isExpanded && (
                  <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-slate-100 ml-4.5 transition-all">
                    {group.items.map((subItem) => {
                      const SubIcon = subItem.icon;
                      return (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          onClick={() => onClose && onClose()}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                              isActive
                                ? 'bg-brand-50 text-brand-700 font-bold border-l-2 border-brand-600 shadow-xs'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                            }`
                          }
                        >
                          <SubIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{subItem.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer branding */}
        <div className="p-3 m-3 rounded-2xl bg-gradient-to-br from-brand-50/80 via-white to-slate-50 border border-brand-100/70 shadow-sm shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">TaskNera Enterprise</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            People. Processes. Performance.
          </p>
        </div>
      </aside>
    </>
  );
};
