import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Wallet,
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { notificationService } from '../../services/notificationService.js';

export const getNotificationIcon = (eventType, title = '', entityType = '') => {
  const type = (eventType || '').toUpperCase();
  const lowerTitle = (title || '').toLowerCase();
  const ent = (entityType || '').toUpperCase();

  // Phase 5: Payroll & Payslips
  if (type === 'PAYROLL_PROCESSED') {
    return {
      icon: Wallet,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      route: '/payroll',
    };
  }
  if (type === 'PAYSLIP_AVAILABLE') {
    return {
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
      route: '/payslips',
    };
  }

  // Phase 5: Helpdesk Tickets
  if (type === 'TICKET_CREATED' || type === 'TICKET_STATUS_CHANGED') {
    return {
      icon: LifeBuoy,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      route: '/helpdesk',
    };
  }

  // Phase 5: Employee Requests
  if (type === 'EMPLOYEE_REQUEST_CREATED' || type === 'EMPLOYEE_REQUEST_STATUS_CHANGED') {
    return {
      icon: ClipboardList,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
      route: '/requests',
    };
  }

  // Phase 6: Performance Reviews
  if (
    type === 'PERFORMANCE_SUBMITTED' ||
    type === 'PERFORMANCE_REVIEW_PENDING' ||
    type === 'PERFORMANCE_PENDING' ||
    lowerTitle.includes('performance review awaiting') ||
    lowerTitle.includes('manager review completed') ||
    (ent === 'PERFORMANCE_REVIEW' && lowerTitle.includes('awaiting'))
  ) {
    return {
      icon: Award,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
      route: '/performance',
    };
  }
  if (
    type === 'PERFORMANCE_APPROVED' ||
    lowerTitle.includes('performance review approved')
  ) {
    return {
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      route: '/performance',
    };
  }
  if (
    type === 'PERFORMANCE_RETURNED' ||
    lowerTitle.includes('performance review returned')
  ) {
    return {
      icon: RotateCcw,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      route: '/performance',
    };
  }
  if (
    type === 'PERFORMANCE_REJECTED' ||
    lowerTitle.includes('performance review rejected')
  ) {
    return {
      icon: XCircle,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
      route: '/performance',
    };
  }

  // Phase 6: Leaves
  if (
    type === 'LEAVE_APPROVAL_PENDING' ||
    type === 'LEAVE_PENDING' ||
    type === 'LEAVE_APPLIED' ||
    lowerTitle.includes('leave request pending')
  ) {
    return {
      icon: CalendarDays,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      route: '/approvals',
    };
  }
  if (
    type === 'LEAVE_APPROVED' ||
    lowerTitle.includes('leave request approved')
  ) {
    return {
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      route: '/leaves',
    };
  }
  if (
    type === 'LEAVE_REJECTED' ||
    lowerTitle.includes('leave request rejected')
  ) {
    return {
      icon: XCircle,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
      route: '/leaves',
    };
  }

  // Phase 6: Manager & Hierarchy
  if (
    type === 'MANAGER_ASSIGNED' ||
    type === 'TEAM_ASSIGNED' ||
    lowerTitle.includes('reporting manager assigned') ||
    lowerTitle.includes('direct report assigned')
  ) {
    return {
      icon: UserCheck,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40',
      route: '/team',
    };
  }

  // Phase 6: HR Operations & Broadcasts
  if (
    type === 'HR_APPROVAL_PENDING' ||
    type === 'HR_ANNOUNCEMENT' ||
    lowerTitle.includes('hr announcement') ||
    lowerTitle.includes('hr approval') ||
    ent === 'HR_OPERATIONS'
  ) {
    return {
      icon: ShieldCheck,
      color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40',
      route: '/hr-operations',
    };
  }

  return {
    icon: Bell,
    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
    route: '/notifications',
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

  // Click on single notification
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
    const targetUrl = notif.actionUrl || notif.action_url;
    if (targetUrl) {
      navigate(targetUrl);
    } else {
      const { route } = getNotificationIcon(
        notif.eventType || notif.event_type,
        notif.title,
        notif.entityType || notif.entity_type
      );
      if (route) {
        navigate(route);
      }
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
                  notif.entityType || notif.entity_type
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
