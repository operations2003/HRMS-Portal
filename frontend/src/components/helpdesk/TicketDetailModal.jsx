import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CheckCheck,
  Send,
  User,
  Building2,
  UserCheck,
  Tag,
  ShieldCheck,
  Ban,
  MessageSquare,
  Lock,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { helpdeskService } from '../../services/helpdeskService.js';
import { userService } from '../../services/userService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Select } from '../common/Select.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';

export const getTicketStatusBadge = (status) => {
  switch (status) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          <Clock className="w-3.5 h-3.5" />
          Open
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5" />
          In Progress
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolved
        </span>
      );
    case 'CLOSED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <CheckCheck className="w-3.5 h-3.5" />
          Closed
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <XCircle className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const getTicketPriorityBadge = (priority) => {
  switch (priority) {
    case 'URGENT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
          URGENT
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
          HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          MEDIUM
        </span>
      );
    case 'LOW':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          LOW
        </span>
      );
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
};

export const TicketDetailModal = ({
  isOpen,
  onClose,
  ticketId,
  onTicketUpdated,
}) => {
  const { user, hasPermission, hasRole } = useAuth();
  const toast = useToast();

  const canManage =
    hasPermission('helpdesk:manage') ||
    hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Comment State
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Management Actions State
  const [usersList, setUsersList] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Resolution Form State
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionText, setResolutionText] = useState('');

  // Fetch ticket details
  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await helpdeskService.getTicketById(ticketId);
      setTicket(data);
      if (data.assignedTo) {
        setSelectedAssignee(data.assignedTo);
      }
    } catch (err) {
      console.error('Failed to load ticket details:', err);
      setError(err.message || 'Failed to retrieve ticket information.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // Load user list for assignment if staff
  useEffect(() => {
    if (canManage && isOpen) {
      userService
        .listUsers()
        .then((res) => {
          const list = res.data || res.users || (Array.isArray(res) ? res : []);
          setUsersList(list);
        })
        .catch((err) => console.error('Failed to load users for assignment:', err));
    }
  }, [canManage, isOpen]);

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchTicket();
    } else {
      setTicket(null);
      setNewComment('');
      setIsInternal(false);
      setIsResolving(false);
      setResolutionText('');
    }
  }, [isOpen, ticketId, fetchTicket]);

  // Submit comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);
      await helpdeskService.addComment(ticket.id, {
        comment: newComment.trim(),
        isInternal: canManage ? isInternal : false,
      });

      toast.showSuccess('Response posted successfully.');
      setNewComment('');
      setIsInternal(false);
      await fetchTicket();
      if (onTicketUpdated) onTicketUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to post response.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Cancel Ticket (Employee or Admin)
  const handleCancelTicket = async () => {
    if (!window.confirm('Are you sure you want to cancel this ticket?')) return;
    try {
      setActionLoading(true);
      await helpdeskService.cancelTicket(ticket.id);
      toast.showSuccess('Ticket has been cancelled.');
      await fetchTicket();
      if (onTicketUpdated) onTicketUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to cancel ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  // Assign Ticket (HR / Admin)
  const handleAssignTicket = async () => {
    try {
      setActionLoading(true);
      await helpdeskService.assignTicket(ticket.id, {
        assignedTo: selectedAssignee || null,
      });
      toast.showSuccess('Ticket assignment updated.');
      await fetchTicket();
      if (onTicketUpdated) onTicketUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to assign ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Status (HR / Admin)
  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'RESOLVED') {
      setIsResolving(true);
      return;
    }

    try {
      setActionLoading(true);
      await helpdeskService.updateStatus(ticket.id, newStatus);
      toast.showSuccess(`Status updated to ${newStatus}.`);
      await fetchTicket();
      if (onTicketUpdated) onTicketUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to update ticket status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve Ticket (HR / Admin)
  const handleResolveTicket = async (e) => {
    e.preventDefault();
    if (!resolutionText.trim()) {
      toast.showError('Please explain how the ticket was resolved.');
      return;
    }

    try {
      setActionLoading(true);
      await helpdeskService.resolveTicket(ticket.id, resolutionText.trim());
      toast.showSuccess('Ticket marked as Resolved.');
      setIsResolving(false);
      setResolutionText('');
      await fetchTicket();
      if (onTicketUpdated) onTicketUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to resolve ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  // Close Ticket (HR / Admin)
  const handleCloseTicket = async () => {
    try {
      setActionLoading(true);
      await helpdeskService.closeTicket(ticket.id);
      toast.showSuccess('Ticket marked as Closed.');
      await fetchTicket();
      if (onTicketUpdated) onTicketUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to close ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ticket ? `Ticket ${ticket.ticketNumber}` : 'Ticket Details'}
      subtitle={ticket ? `Opened on ${new Date(ticket.createdAt).toLocaleString()}` : ''}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
            Loading ticket thread...
          </p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-sm">
          {error}
        </div>
      ) : ticket ? (
        <div className="space-y-6">
          {/* Header Overview Card */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {getTicketStatusBadge(ticket.status)}
                {getTicketPriorityBadge(ticket.priority)}
                <Badge variant="secondary">{ticket.category}</Badge>
              </div>

              {/* Status Action Buttons for Employee or HR */}
              <div className="flex items-center gap-2">
                {/* Employee Cancel */}
                {['OPEN', 'IN_PROGRESS'].includes(ticket.status) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={Ban}
                    loading={actionLoading}
                    onClick={handleCancelTicket}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Cancel Ticket
                  </Button>
                )}

                {/* HR/Admin Close button */}
                {canManage && ticket.status === 'RESOLVED' && (
                  <Button
                    variant="secondary"
                    size="xs"
                    icon={CheckCheck}
                    loading={actionLoading}
                    onClick={handleCloseTicket}
                  >
                    Close Ticket
                  </Button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {ticket.subject}
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mt-2 leading-relaxed bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                {ticket.description}
              </p>
            </div>

            {/* Requester & Assignment Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Requester
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {ticket.requester?.fullName || 'Employee'}
                </span>
                {ticket.requester?.employeeCode && (
                  <span className="text-slate-400 block">
                    {ticket.requester.employeeCode} • {ticket.requester.department || 'Staff'}
                  </span>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Assigned Staff
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {ticket.assignee?.fullName || ticket.assignedTeam || 'Unassigned'}
                </span>
                {ticket.assignee?.email && (
                  <span className="text-slate-400 block">{ticket.assignee.email}</span>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Last Activity
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {new Date(ticket.updatedAt || ticket.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Resolution Banner if Resolved */}
            {ticket.resolution && (
              <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Official Resolution
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{ticket.resolution}</p>
                {ticket.resolver && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                    Resolved by {ticket.resolver.fullName}{' '}
                    {ticket.resolvedAt && `on ${new Date(ticket.resolvedAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* HR / Admin Management Controls Card */}
          {canManage && (
            <div className="bg-brand-50/40 dark:bg-brand-950/20 rounded-2xl p-4 border border-brand-200/60 dark:border-brand-900/40 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-900 dark:text-brand-300">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                Staff Ticket Operations
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                {/* Assignment Dropdown */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Assign To
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedAssignee}
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-2.5 text-slate-900 dark:text-white"
                    >
                      <option value="">Unassigned</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.role?.name || 'Staff'})
                        </option>
                      ))}
                    </select>
                    <Button
                      size="xs"
                      variant="outline"
                      loading={actionLoading}
                      onClick={handleAssignTicket}
                    >
                      Assign
                    </Button>
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Change Status
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={actionLoading}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-2.5 text-slate-900 dark:text-white"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Resolution Form inline (when user selects Resolved or clicks Resolve) */}
              {isResolving && (
                <form onSubmit={handleResolveTicket} className="pt-3 border-t border-brand-200/50 space-y-2">
                  <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                    Provide Resolution Summary <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="Describe how the issue was fixed, policy clarified, or request completed..."
                    className="w-full text-xs rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 p-2.5"
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="xs" variant="secondary" onClick={() => setIsResolving(false)}>
                      Cancel
                    </Button>
                    <Button size="xs" variant="success" type="submit" loading={actionLoading} icon={Check}>
                      Save Resolution
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Conversation & Comments Thread */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-brand-600" />
                Discussion Thread ({ticket.comments?.length || 0})
              </h4>
            </div>

            {ticket.comments && ticket.comments.length > 0 ? (
              <div className="space-y-3">
                {ticket.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-3.5 rounded-xl text-xs space-y-1 ${
                      comment.isInternal
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50'
                        : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {comment.author?.fullName || 'User'}
                        </span>
                        {comment.author?.roleName && (
                          <Badge variant="outline" size="xs">
                            {comment.author.roleName}
                          </Badge>
                        )}
                        {comment.isInternal && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <Lock className="w-2.5 h-2.5" /> Internal Note
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pt-1">
                      {comment.comment}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                No replies posted yet. Post a response below to communicate with the support team.
              </div>
            )}

            {/* Comment Form (if ticket is not closed or cancelled) */}
            {ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED' ? (
              <form onSubmit={handleAddComment} className="pt-2 space-y-2">
                <textarea
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a response or update to this ticket..."
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  required
                />
                <div className="flex items-center justify-between">
                  {canManage ? (
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span>Internal staff note (invisible to employee)</span>
                    </label>
                  ) : (
                    <span />
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="xs"
                    icon={Send}
                    loading={submittingComment}
                  >
                    Post Response
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-2">
                This ticket is {ticket.status.toLowerCase()} and cannot receive further comments.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default TicketDetailModal;
