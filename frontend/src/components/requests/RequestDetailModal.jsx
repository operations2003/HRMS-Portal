import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Ban,
  Send,
  MessageSquare,
  ShieldCheck,
  Building2,
  FileText,
  User,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { requestService } from '../../services/requestService.js';
import { userService } from '../../services/userService.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';

export const getRequestStatusBadge = (status) => {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5" />
          Pending
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
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
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <XCircle className="w-3.5 h-3.5" />
          Rejected
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <Ban className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const formatRequestType = (type) => {
  switch (type) {
    case 'DOCUMENT_REQUEST':
      return 'Document Request';
    case 'BANK_DETAILS_CHANGE':
      return 'Bank Details Change';
    case 'UAN_CHANGE':
      return 'UAN Change';
    case 'HR_REQUEST':
      return 'HR Request';
    case 'PAYROLL_CLARIFICATION':
      return 'Payroll Clarification';
    case 'EMPLOYEE_SERVICE':
      return 'Employee Service';
    default:
      return type || 'Service Request';
  }
};

export const RequestDetailModal = ({
  isOpen,
  onClose,
  requestId,
  onRequestUpdated,
}) => {
  const { user, hasPermission, hasRole } = useAuth();
  const toast = useToast();

  const canManage =
    hasPermission('request:manage') ||
    hasRole(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']);

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Message State
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState(false);

  // Management State
  const [usersList, setUsersList] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Resolution & Rejection Modals/Forms inline
  const [isResolving, setIsResolving] = useState(false);
  const [responseNotes, setResponseNotes] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRequest = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await requestService.getRequestById(requestId);
      setRequest(data);
      if (data.assignedTo) {
        setSelectedAssignee(data.assignedTo);
      }
    } catch (err) {
      console.error('Failed to load request details:', err);
      setError(err.message || 'Failed to retrieve request.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (canManage && isOpen) {
      userService
        .listUsers()
        .then((res) => {
          const list = res.data || res.users || (Array.isArray(res) ? res : []);
          setUsersList(list);
        })
        .catch((err) => console.error('Error fetching users:', err));
    }
  }, [canManage, isOpen]);

  useEffect(() => {
    if (isOpen && requestId) {
      fetchRequest();
    } else {
      setRequest(null);
      setNewMessage('');
      setIsResolving(false);
      setIsRejecting(false);
      setResponseNotes('');
      setRejectionReason('');
    }
  }, [isOpen, requestId, fetchRequest]);

  // Post update message
  const handleAddUpdate = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      setSubmittingMessage(true);
      await requestService.addUpdate(request.id, {
        message: newMessage.trim(),
        isInternal: canManage ? isInternal : false,
      });

      toast.showSuccess('Update recorded.');
      setNewMessage('');
      setIsInternal(false);
      await fetchRequest();
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to post update.');
    } finally {
      setSubmittingMessage(false);
    }
  };

  // Cancel Request (Employee or Admin)
  const handleCancelRequest = async () => {
    if (!window.confirm('Are you sure you want to cancel this service request?')) return;
    try {
      setActionLoading(true);
      await requestService.cancelRequest(request.id);
      toast.showSuccess('Request cancelled.');
      await fetchRequest();
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to cancel request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Assign Request
  const handleAssignRequest = async () => {
    try {
      setActionLoading(true);
      await requestService.assignRequest(request.id, {
        assignedTo: selectedAssignee || null,
      });
      toast.showSuccess('Request assignment updated.');
      await fetchRequest();
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to assign request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Status
  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'RESOLVED') {
      setIsResolving(true);
      setIsRejecting(false);
      return;
    }
    if (newStatus === 'REJECTED') {
      setIsRejecting(true);
      setIsResolving(false);
      return;
    }

    try {
      setActionLoading(true);
      await requestService.updateStatus(request.id, newStatus);
      toast.showSuccess(`Request status updated to ${newStatus}.`);
      await fetchRequest();
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve Request
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!responseNotes.trim()) {
      toast.showError('Response notes are required to resolve request.');
      return;
    }

    try {
      setActionLoading(true);
      await requestService.resolveRequest(request.id, {
        responseNotes: responseNotes.trim(),
      });
      toast.showSuccess('Request marked as Resolved.');
      setIsResolving(false);
      setResponseNotes('');
      await fetchRequest();
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to resolve request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Request
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.showError('Rejection reason is required.');
      return;
    }

    try {
      setActionLoading(true);
      await requestService.rejectRequest(request.id, {
        rejectionReason: rejectionReason.trim(),
      });
      toast.showSuccess('Request marked as Rejected.');
      setIsRejecting(false);
      setRejectionReason('');
      await fetchRequest();
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      toast.showError(err.message || 'Failed to reject request.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={request ? `Request ${request.requestNumber}` : 'Request Details'}
      subtitle={request ? `Submitted on ${new Date(request.createdAt).toLocaleString()}` : ''}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
            Loading request details...
          </p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-sm">
          {error}
        </div>
      ) : request ? (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {getRequestStatusBadge(request.status)}
                <Badge variant="secondary">{formatRequestType(request.requestType)}</Badge>
                <Badge variant="outline">{request.priority}</Badge>
              </div>

              {/* Employee Cancel button */}
              {['PENDING', 'IN_PROGRESS'].includes(request.status) && (
                <Button
                  variant="ghost"
                  size="xs"
                  icon={Ban}
                  loading={actionLoading}
                  onClick={handleCancelRequest}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 self-start sm:self-auto"
                >
                  Cancel Request
                </Button>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {request.subject}
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mt-2 leading-relaxed bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                {request.description}
              </p>
            </div>

            {/* Requester & Timestamp Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Employee
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {request.requester?.fullName || 'Employee'}
                </span>
                {request.requester?.employeeCode && (
                  <span className="text-slate-400 block">
                    {request.requester.employeeCode} • {(typeof request.requester.department === 'object' ? request.requester.department?.name : request.requester.department) || 'Department'}
                  </span>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Assigned Staff
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {request.assignee?.fullName || request.assignedTeam || 'Unassigned'}
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Timeline
                </span>
                <span className="text-slate-500 block">
                  Created: {new Date(request.createdAt).toLocaleDateString()}
                </span>
                <span className="text-slate-500 block">
                  Updated: {new Date(request.updatedAt || request.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Resolution Banner if Resolved */}
            {request.responseNotes && (
              <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Resolution & Fulfillment Note
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{request.responseNotes}</p>
                {request.resolver && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                    Resolved by {request.resolver.fullName}{' '}
                    {request.resolvedAt && `on ${new Date(request.resolvedAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            )}

            {/* Rejection Banner if Rejected */}
            {request.status === 'REJECTED' && request.rejectionReason && (
              <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-900 dark:text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                  Rejection Reason
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{request.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* HR Management Bar */}
          {canManage && (
            <div className="bg-brand-50/40 dark:bg-brand-950/20 rounded-2xl p-4 border border-brand-200/60 dark:border-brand-900/40 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-900 dark:text-brand-300">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                HR Operations & Processing
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                {/* Assign */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Assign Specialist
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
                      onClick={handleAssignRequest}
                    >
                      Assign
                    </Button>
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Update Request Status
                  </label>
                  <select
                    value={request.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={actionLoading}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              {/* Resolve Inline Form */}
              {isResolving && (
                <form onSubmit={handleResolveSubmit} className="pt-3 border-t border-brand-200/50 space-y-2">
                  <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                    Fulfillment / Resolution Response Notes <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Describe how the request was satisfied, documents generated, or details provided..."
                    className="w-full text-xs rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 p-2.5"
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="xs" variant="secondary" onClick={() => setIsResolving(false)}>
                      Cancel
                    </Button>
                    <Button size="xs" variant="success" type="submit" loading={actionLoading} icon={Check}>
                      Complete & Resolve
                    </Button>
                  </div>
                </form>
              )}

              {/* Reject Inline Form */}
              {isRejecting && (
                <form onSubmit={handleRejectSubmit} className="pt-3 border-t border-brand-200/50 space-y-2">
                  <label className="block text-xs font-semibold text-rose-800 dark:text-rose-400">
                    Reason for Rejection <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Specify why this service request cannot be fulfilled..."
                    className="w-full text-xs rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 p-2.5"
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="xs" variant="secondary" onClick={() => setIsRejecting(false)}>
                      Cancel
                    </Button>
                    <Button size="xs" variant="danger" type="submit" loading={actionLoading} icon={X}>
                      Confirm Rejection
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Updates / Conversation Thread */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              Clarification & Updates Log ({request.updates?.length || 0})
            </h4>

            {request.updates && request.updates.length > 0 ? (
              <div className="space-y-3">
                {request.updates.map((update) => (
                  <div
                    key={update.id}
                    className={`p-3.5 rounded-xl text-xs space-y-1 ${
                      update.isInternal
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50'
                        : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {update.author?.fullName || 'User'}
                        </span>
                        {update.author?.roleName && (
                          <Badge variant="outline" size="xs">
                            {update.author.roleName}
                          </Badge>
                        )}
                        {update.isInternal && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <Lock className="w-2.5 h-2.5" /> Internal Staff Note
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(update.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pt-1">
                      {update.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                No updates or messages posted yet.
              </div>
            )}

            {/* Add update message */}
            {request.status !== 'CANCELLED' && (
              <form onSubmit={handleAddUpdate} className="pt-2 space-y-2">
                <textarea
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Post a clarification or update on this request..."
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
                      <span>Internal staff note</span>
                    </label>
                  ) : (
                    <span />
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="xs"
                    icon={Send}
                    loading={submittingMessage}
                  >
                    Post Message
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default RequestDetailModal;
