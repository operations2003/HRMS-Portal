import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Select } from '../common/Select.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export const UserStatusModal = ({ isOpen, onClose, onSuccess, targetUser }) => {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [status, setStatus] = useState('Active');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSelf = currentUser && targetUser && (currentUser.id === targetUser.id);

  useEffect(() => {
    if (targetUser) {
      setStatus(targetUser.status || 'Active');
      setReason('');
      setError(null);
    }
  }, [targetUser, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUser) return;

    if (isSelf && status !== 'Active') {
      setError('Security Violation: Administrators cannot deactivate or suspend their own account.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await adminService.setUserStatus(targetUser.id, {
        status,
        reason: reason.trim() || `Administrative status change to ${status}`,
      });

      toast.success(`User status updated to ${status}.`);
      onSuccess?.(result);
      onClose();
    } catch (err) {
      console.error('Set user status error:', err);
      setError(err.message || 'Failed to update user status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userName = targetUser
    ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email
    : 'User';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage User Account Status"
      subtitle={`Configure operational access for ${userName}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {isSelf && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Self-Deactivation Guard:</strong> You are modifying your own account.
              You cannot deactivate or suspend your own session.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Select
            label="Account Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'Active', label: 'Active — Full Authorized Access' },
              { value: 'Inactive', label: 'Inactive — Access Suspended / Disabled' },
              { value: 'Suspended', label: 'Suspended — Temporarily Locked for Audit' },
            ]}
            disabled={isSelf}
          />

          <Input
            label="Audit Justification / Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Employee offboarding completed or security hold"
            helperText="Recorded in the permanent administrative audit trail"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSelf && status !== 'Active'}
          >
            Update User Status
          </Button>
        </div>
      </form>
    </Modal>
  );
};
