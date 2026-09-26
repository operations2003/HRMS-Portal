import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  FileText,
  LifeBuoy,
  ClipboardList,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Clock,
  Award,
  CalendarDays,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  GraduationCap,
  CheckSquare,
  CreditCard,
  FileCheck,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { notificationService } from '../../services/notificationService.js';

/**
 * Intelligent Destination Route Resolver
 * Maps any notification (by entityType, eventType, content keywords, actionUrl, or role)
 * to its exact target destination URL.
 */
export const resolveNotificationRoute = (notif, userRole = '') => {
  if (!notif) return '/dashboard';

  const actionUrl = notif.actionUrl || notif.action_url || '';
  const type = (notif.eventType || notif.event_type || '').toUpperCase();
  const ent = (notif.entityType || notif.entity_type || '').toUpperCase();
  const entId = notif.entityId || notif.entity_id;
  const title = (notif.title || '').toLowerCase();
  const msg = (notif.message || '').toLowerCase();
  const combined = `${title} ${msg}`;
  const normRole = (userRole || '').toLowerCase();
  const isManagerOrAdmin = ['manager', 'hr', 'hrmanager', 'admin', 'superadmin', 'orgadmin'].includes(normRole);

  // 1. If explicit specific actionUrl exists (not a generic fallback like /dashboard or /), respect it!
  if (actionUrl && actionUrl !== '/dashboard' && actionUrl !== '/' && actionUrl !== '/notifications') {
    if (actionUrl === '/helpdesk' && (ent === 'HELPDESK_TICKET' || ent === 'TICKET') && entId) {
      return `/helpdesk/${entId}`;
    }
    return actionUrl;
  }

  // 2. Training / Courses / Learning & Development (handles "HR Announcement: course alert", etc.)
  if (
    ent === 'COURSE' ||
    ent === 'TRAINING' ||
    ent === 'COURSE_ENROLLMENT' ||
    type.includes('TRAINING') ||
    type.includes('COURSE') ||
    combined.includes('course') ||
    combined.includes('training') ||
    combined.includes('learning') ||
    combined.includes('curriculum') ||
    combined.includes('skill')
  ) {
    return '/training';
  }

  // 3. Work Tasks
  if (
    ent === 'TASK' ||
    ent === 'WORK_TASK' ||
    type.includes('TASK') ||
    combined.includes('task') ||
    combined.includes('work item')
  ) {
    return '/tasks';
  }

  // 4. Attendance, Shift, Timings & Punching
  if (
    ent === 'ATTENDANCE' ||
    ent === 'ATTENDANCE_RECORD' ||
    type.includes('ATTENDANCE') ||
    type.includes('PUNCH') ||
    type.includes('SHIFT') ||
    combined.includes('attendance') ||
    combined.includes('punch') ||
    combined.includes('late arrival') ||
    combined.includes('shift timing') ||
    combined.includes('regulariz') ||
    combined.includes('check-in') ||
    combined.includes('check-out')
  ) {
    return '/attendance';
  }

  // 5. Helpdesk & Support Tickets
  if (
    ent === 'HELPDESK_TICKET' ||
    ent === 'TICKET' ||
    type.includes('TICKET') ||
    combined.includes('ticket') ||
    combined.includes('helpdesk')
  ) {
    return entId ? `/helpdesk/${entId}` : '/helpdesk';
  }

  // 6. Employee Requests
  if (
    ent === 'EMPLOYEE_REQUEST' ||
    type.includes('EMPLOYEE_REQUEST') ||
    combined.includes('employee request')
  ) {
    return entId ? `/requests/${entId}` : '/helpdesk?tab=requests';
  }

  // 7. Leaves & Approvals
  if (
    ent === 'LEAVE' ||
    ent === 'LEAVE_REQUEST' ||
    type.includes('LEAVE') ||
    combined.includes('leave')
  ) {
    if (
      isManagerOrAdmin &&
      (type.includes('PENDING') || type.includes('APPROVAL') || combined.includes('pending') || combined.includes('awaiting approval'))
    ) {
      return '/approvals';
    }
    return entId ? `/leaves/${entId}` : '/leaves';
  }

  // 8. Performance Reviews & Appraisals
  if (
    ent === 'PERFORMANCE' ||
    ent === 'PERFORMANCE_REVIEW' ||
    ent === 'PERFORMANCE_REPORT' ||
    type.includes('PERFORMANCE') ||
    combined.includes('performance review') ||
    combined.includes('appraisal')
  ) {
    if (ent === 'PERFORMANCE_REPORT' || combined.includes('appraisal report') || combined.includes('performance report')) {
      return '/reports';
    }
    return entId ? `/performance/${entId}` : '/performance';
  }

  // 9. Payroll, Salary & Compensation
  if (
    ent === 'PAYROLL' ||
    ent === 'PAYSLIP' ||
    ent === 'SALARY' ||
    type.includes('PAYROLL') ||
    type.includes('SALARY') ||
    combined.includes('payroll') ||
    combined.includes('payslip') ||
    combined.includes('salary') ||
    combined.includes('compensation')
  ) {
    return '/payroll';
  }

  // 10. Company Policies & Handbooks
  if (
    ent === 'POLICY' ||
    type.includes('POLICY') ||
    combined.includes('policy') ||
    combined.includes('code of conduct') ||
    combined.includes('handbook')
  ) {
    return '/policies';
  }

  // 11. Documents & Document Vault
  if (
    ent === 'DOCUMENT' ||
    ent === 'DOCUMENT_VAULT' ||
    type.includes('DOCUMENT') ||
    combined.includes('document') ||
    combined.includes('vault')
  ) {
    if (isManagerOrAdmin && (type.includes('VERIF') || combined.includes('verify') || combined.includes('submitted a document'))) {
      return '/team?tab=documents';
    }
    return '/documents';
  }

  // 12. Onboarding & New Hires
  if (
    ent === 'ONBOARDING' ||
    ent === 'NEW_HIRE' ||
    type.includes('ONBOARDING') ||
    combined.includes('onboarding') ||
    combined.includes('new hire')
  ) {
    return entId ? `/onboarding/${entId}` : '/onboarding';
  }

  // 13. Exit, Resignation & Clearances
  if (
    ent === 'EXIT' ||
    ent === 'RESIGNATION' ||
    ent === 'OFFBOARDING' ||
    ent === 'FNF' ||
    type.includes('EXIT') ||
    type.includes('RESIGNATION') ||
    type.includes('OFFBOARDING') ||
    combined.includes('resignation') ||
    combined.includes('clearance') ||
    combined.includes('offboarding') ||
    combined.includes('fnf')
  ) {
    if (combined.includes('clearance')) return '/exit-checklist';
    if (combined.includes('fnf') || combined.includes('settlement')) return '/fnf';
    if (isManagerOrAdmin && (combined.includes('offboarding') || type.includes('EXIT'))) return '/offboarding';
    return '/resignation';
  }

  // 14. Manager & Team Assignment
  if (
    ent === 'TEAM' ||
    type === 'MANAGER_ASSIGNED' ||
    type === 'TEAM_ASSIGNED' ||
    combined.includes('reporting manager') ||
    combined.includes('direct report')
  ) {
    return isManagerOrAdmin ? '/team' : '/profile';
  }

  // 15. Probation
  if (
    ent === 'PROBATION' ||
    type.includes('PROBATION') ||
    combined.includes('probation')
  ) {
    return isManagerOrAdmin ? '/probation' : '/profile';
  }

  // 16. HR Broadcasts & Announcements
  if (
    ent === 'HR_OPERATIONS' ||
    type.includes('HR_') ||
    combined.includes('announcement') ||
    combined.includes('broadcast')
  ) {
    return isManagerOrAdmin ? '/hr-operations' : '/dashboard';
  }

  return actionUrl || '/dashboard';
};

/**
 * Returns icon, color, and destination route for any notification
 */
export const getNotificationIcon = (
  eventType = '',
  title = '',
  entityType = '',
  message = '',
  userRole = ''
) => {
  const route = resolveNotificationRoute(
    { eventType, title, entityType, message },
    userRole
  );

  if (route.startsWith('/training')) {
    return {
      icon: GraduationCap,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
      route,
    };
  }

  if (route.startsWith('/tasks')) {
    return {
      icon: CheckSquare,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      route,
    };
  }

  if (route.startsWith('/attendance')) {
    return {
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      route,
    };
  }

  if (route.startsWith('/leaves') || route.startsWith('/approvals')) {
    const isApproval = route.startsWith('/approvals');
    return {
      icon: CalendarDays,
      color: isApproval
        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
        : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
      route,
    };
  }

  if (route.startsWith('/helpdesk') || route.startsWith('/requests')) {
    const isTicket = route.startsWith('/helpdesk');
    return {
      icon: isTicket ? LifeBuoy : ClipboardList,
      color: isTicket
        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
        : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
      route,
    };
  }

  if (route.startsWith('/reports')) {
    return {
      icon: FileText,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
      route,
    };
  }

  if (route.startsWith('/performance')) {
    const isRejected = title.toLowerCase().includes('reject');
    return {
      icon: isRejected ? XCircle : Award,
      color: isRejected
        ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
        : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
      route,
    };
  }

  if (route.startsWith('/payroll')) {
    return {
      icon: CreditCard,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      route,
    };
  }

  if (route.startsWith('/policies')) {
    return {
      icon: FileCheck,
      color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40',
      route,
    };
  }

  if (route.startsWith('/documents')) {
    return {
      icon: FileText,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
      route,
    };
  }

  if (route.startsWith('/onboarding')) {
    return {
      icon: UserPlus,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40',
      route,
    };
  }

  if (route.startsWith('/resignation') || route.startsWith('/exit') || route.startsWith('/fnf') || route.startsWith('/offboarding')) {
    return {
      icon: LogOut,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
      route,
    };
  }

  if (route.startsWith('/team')) {
    return {
      icon: UserCheck,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40',
      route,
    };
  }

  if (route.startsWith('/hr-operations')) {
    return {
      icon: ShieldCheck,
      color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40',
      route,
    };
  }

  return {
    icon: Bell,
    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
    route,
  };
};

export const NotificationBell = () => {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch unread count
  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(typeof count === 'number' ? count : 0);
    } catch {
      // Background poll silently fails
    }
  }, [isAuthenticated]);

  // Fetch recent notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await notificationService.getNotifications({ limit: 10 });
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
      const count = res?.unreadCount ?? res?.data?.unreadCount ?? 0;
      setNotifications(items);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Periodic polling for unread count
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 45000); // every 45s
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Open dropdown
  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, is_read: true }))
      );
      toast.showSuccess('All notifications marked as read.');
    } catch (err) {
      toast.showError('Failed to mark all as read.');
    }
  };

  // Click on single notification to redirect to particular section
  const handleItemClick = async (notif) => {
    const isUnread = notif.isRead === false || notif.is_read === false;
    if (isUnread) {
      try {
        await notificationService.markAsRead(notif.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, isRead: true, is_read: true } : n
          )
        );
      } catch {
        // silent
      }
    }

    setIsOpen(false);
    const targetUrl = resolveNotificationRoute(notif, user?.roleName);
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-hidden"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline flex items-center gap-1 focus:outline-hidden"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 px-4">
                <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                You are all caught up! No notifications at this time.
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = notif.isRead === false || notif.is_read === false;
                const eventType = notif.eventType || notif.event_type;
                const { icon: EventIcon, color } = getNotificationIcon(
                  eventType,
                  notif.title,
                  notif.entityType || notif.entity_type,
                  notif.message,
                  user?.roleName
                );

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                      isUnread ? 'bg-brand-50/30 dark:bg-brand-950/10' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}
                    >
                      <EventIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-xs truncate ${
                            isUnread
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-semibold text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {new Date(notif.createdAt || notif.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="w-full py-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline flex items-center justify-center gap-1 focus:outline-hidden"
            >
              <span>View all notifications</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
