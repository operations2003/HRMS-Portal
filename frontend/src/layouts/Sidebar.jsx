import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  X,
  Sparkles,
  CalendarCheck,
  CalendarDays,
  FolderLock,
  LifeBuoy,
  ClipboardList,
  Award,
  LogOut,
  UserX,
  Sliders,
  Wallet,
  CheckSquare,
  GraduationCap,
  Clock,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { TaskNeraLogo } from '../components/common/TaskNeraLogo.jsx';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  // 1. Dashboard - Direct 1-click shortcut
  const directItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      permission: 'dashboard:read',
    },
  ];

  // 2-5. Flattened Core Navigation Hubs
  const navGroups = [
    // 2. People (Workforce, Shifts, Attendance, Documents & Clearances)
    {
      id: 'people-attendance',
      title: 'People',
      icon: Users,
      items: [
        {
          name: 'Employees',
          path: '/employees',
          icon: Users,
          permission: 'employee:read',
        },
        {
          name: 'Shifts & Roster',
          path: '/shifts',
          icon: CalendarCheck,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin', 'Manager', 'TeamLead'],
          permission: 'employee:write',
        },
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
        {
          name: 'Documents',
          path: '/documents',
          icon: FolderLock,
          permission: ['document:read', 'employee:read'],
        },
        {
          name: 'Team Management',
          path: '/team',
          icon: UserCheck,
          roles: ['Manager', 'HR', 'HRManager'],
          excludeRoles: ['Admin', 'SuperAdmin', 'OrgAdmin'],
        },
      ],
    },

    // 3. Performance & Goals
    {
      id: 'performance-goals',
      title: 'Performance & Goals',
      icon: Award,
      items: [
        {
          name: 'Appraisals & Reviews',
          path: '/performance',
          icon: Award,
          permission: ['performance:read', 'employee:read'],
        },
        {
          name: 'Tasks & Goals',
          path: '/tasks',
          icon: CheckSquare,
          permission: ['task:read', 'employee:read'],
        },
        {
          name: 'Learning & Training',
          path: '/training',
          icon: GraduationCap,
          permission: ['training:read', 'employee:read'],
        },
      ],
    },

    // 4. Payroll & Finance (Single direct 1-click access)
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
      ],
    },

    // 5. Exit Management (Single direct 1-click access)
    {
      id: 'exit-management',
      title: 'Exit Management',
      icon: LogOut,
      items: [
        {
          name: 'Exit Management',
          path: '/resignation',
          icon: LogOut,
          permission: ['exit:read', 'exit:write', 'employee:read'],
        },
      ],
    },

    // 6. Company & Administration
    {
      id: 'company-admin',
      title: 'Company & Admin',
      icon: Sliders,
      items: [
        {
          name: 'Departments',
          path: '/departments',
          icon: Building2,
          roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'],
        },
        {
          name: 'Company Policies',
          path: '/policies',
          icon: BookOpen,
          permission: ['employee:read'],
        },
        {
          name: 'Help Desk & Requests',
          path: '/helpdesk',
          icon: LifeBuoy,
          permission: ['helpdesk:read', 'request:read', 'employee:read'],
        },
        {
          name: 'System Administration',
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
      if (excluded.includes(userRoleStr) || excluded.some((r) => userRoleStr.includes(r))) return false;
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
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {/* Direct Quick Shortcuts (Dashboard) */}
          <div className="space-y-0.5">
            {visibleDirectItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 text-brand-600" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Collapsible Dropdown Groups & Direct Modules */}
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = !!openGroups[group.id];
            const isGroupActive = group.items.some(
              (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
            );

            // If a section only has 1 consolidated module, render it directly as a clean single button without an accordion dropdown
            if (group.items.length === 1) {
              const singleItem = group.items[0];
              const isSingleActive =
                location.pathname === singleItem.path ||
                location.pathname.startsWith(`${singleItem.path}/`) ||
                location.pathname === '/organizations' ||
                location.pathname === '/users' ||
                location.pathname === '/roles';
              return (
                <div key={group.id} className="space-y-0.5">
                  <NavLink
                    to={singleItem.path}
                    onClick={() => onClose && onClose()}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 select-none ${
                      isSingleActive
                        ? 'text-brand-700 bg-brand-50 shadow-2xs font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GroupIcon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isSingleActive ? 'text-brand-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{group.title}</span>
                    </div>
                  </NavLink>
                </div>
              );
            }

            return (
              <div key={group.id} className="space-y-0.5">
                {/* Dropdown Header Trigger */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 select-none ${
                    isGroupActive
                      ? 'text-brand-700 bg-brand-50/60 font-semibold'
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
                  <div className="pl-3.5 pr-1 py-0.5 space-y-0.5 border-l border-slate-100 ml-4 transition-all">
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
                                ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
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
        <div className="p-3 mx-3 mb-3 rounded-xl bg-slate-50/80 border border-slate-200/60 shadow-2xs shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="truncate">TaskNera Enterprise</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            People. Processes. Performance.
          </p>
        </div>
      </aside>
    </>
  );
};
