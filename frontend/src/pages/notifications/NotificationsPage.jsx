import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Check,
  RefreshCw,
  FileText,
  LifeBuoy,
  ClipboardList,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { notificationService } from '../../services/notificationService.js';
import { getNotificationIcon } from '../../components/notifications/NotificationBell.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';

export const NotificationsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter: 'all' | 'unread'
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(
    async (isBackground = false) => {
      try {
        if (isBackground) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const res = await notificationService.getNotifications({
          limit: 50,
          unreadOnly: filter === 'unread',
        });

        const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
        const count = res?.unreadCount ?? res?.data?.unreadCount ?? 0;

        setNotifications(items);
        setUnreadCount(count);
      } catch (err) {
        console.error('Failed to load notifications:', err);
        setError(err.message || 'Failed to retrieve notifications.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      toast.showSuccess('Notification marked as read.');
    } catch {
      toast.showError('Failed to update notification.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, is_read: true }))
      );
      setUnreadCount(0);
      toast.showSuccess('All notifications marked as read.');
    } catch {
      toast.showError('Failed to mark notifications as read.');
    }
  };

  const handleNavigate = (notif) => {
    const targetUrl = notif.actionUrl || notif.action_url;
    if (targetUrl) {
      navigate(targetUrl);
    } else {
      const eventType = notif.eventType || notif.event_type;
      const { route } = getNotificationIcon(
        eventType,
        notif.title,
        notif.entityType || notif.entity_type
      );
      if (route) {
        navigate(route);
      }
    }
  };

  const displayedNotifications = notifications.filter((notif) => {
    if (filter === 'unread') return notif.isRead === false || notif.is_read === false;
    if (filter === 'performance') {
      const type = (notif.eventType || notif.event_type || '').toUpperCase();
      const ent = (notif.entityType || notif.entity_type || '').toUpperCase();
      const title = (notif.title || '').toLowerCase();
      return (
        type.includes('PERFORMANCE') ||
        ent.includes('PERFORMANCE') ||
        title.includes('performance') ||
        title.includes('appraisal')
      );
    }
    if (filter === 'leaves') {
      const type = (notif.eventType || notif.event_type || '').toUpperCase();
      const ent = (notif.entityType || notif.entity_type || '').toUpperCase();
      const title = (notif.title || '').toLowerCase();
      return type.includes('LEAVE') || ent.includes('LEAVE') || title.includes('leave');
    }
    if (filter === 'requests') {
      const type = (notif.eventType || notif.event_type || '').toUpperCase();
      const ent = (notif.entityType || notif.entity_type || '').toUpperCase();
      return (
        type.includes('TICKET') ||
        type.includes('REQUEST') ||
        ent.includes('HELPDESK') ||
        ent.includes('REQUEST')
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Notification Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Activity alerts for leaves, performance reviews, manager approvals, and tickets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchNotifications(true)}
          >
            Refresh
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={CheckCheck}
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            filter === 'all'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            filter === 'unread'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                filter === 'unread'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('performance')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            filter === 'performance'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Performance
        </button>
        <button
          onClick={() => setFilter('leaves')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            filter === 'leaves'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Leaves
        </button>
        <button
          onClick={() => setFilter('requests')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            filter === 'requests'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Helpdesk
        </button>
      </div>

      {/* Error state */}
      {error && (
        <Alert
          variant="danger"
          title="Notification Error"
          message={error}
          action={
            <Button size="xs" variant="outline" onClick={() => fetchNotifications()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Notification List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <LoadingSpinner size="lg" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
              Loading your alerts...
            </p>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Bell className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No notifications in this category.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              You will receive updates when leaves are actioned, performance reviews progress, or requests are updated.
            </p>
          </div>
        ) : (
          displayedNotifications.map((notif) => {
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
                onClick={() => handleNavigate(notif)}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                  isUnread ? 'bg-brand-50/30 dark:bg-brand-950/15' : ''
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}
                  >
                    <EventIcon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`text-sm ${
                          isUnread
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {isUnread && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                          NEW
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                      <span>{new Date(notif.createdAt || notif.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span className="font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1">
                        View related module <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isUnread && (
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={Check}
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
