import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Select } from '../common/Select.jsx';
import { Input } from '../common/Input.jsx';
import { Alert } from '../common/Alert.jsx';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export const UserRoleAssignModal = ({ isOpen, onClose, onSuccess, targetUser, roles = [] }) => {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSelf = currentUser && targetUser && (currentUser.id === targetUser.id);

  useEffect(() => {
    if (targetUser) {
      setSelectedRoleId(targetUser.roleId || (roles.find(r => r.name === targetUser.roleName)?.id) || '');
      setReason('');
      setError(null);
    }
  }, [targetUser, roles, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUser) return;
    if (!selectedRoleId) {
      setError('Please select a system role.');
      return;
    }

    if (isSelf) {
      setError('Security Violation: Administrators cannot modify their own assigned role.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await adminService.assignUserRole(targetUser.id, {
        roleId: selectedRoleId,
        reason: reason.trim() || 'Administrative role reassignment',
      });

      toast.success('User role assigned successfully.');
      onSuccess?.(result);
      onClose();
    } catch (err) {
      console.error('Assign user role error:', err);
      setError(err.message || 'Failed to reassign user role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userName = targetUser
    ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email
    : 'User';

  const roleOptions = roles.map((r) => ({
    value: r.id,
    label: `${r.name} (${r.permissionsCount || r.permissions?.length || 0} permissions)`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign System Role"
      subtitle={`Configure RBAC role assignment for ${userName}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {isSelf && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Self-Escalation Guard:</strong> You are modifying your own account.
              Administrators cannot modify their own assigned role.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Select
            label="Target System Role"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            options={[
              { value: '', label: '-- Select a Role --' },
              ...roleOptions,
            ]}
            disabled={isSelf}
            required
          />

          <Input
            label="Audit Justification / Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Promotion to Management, Transfer, etc."
            helperText="Recorded in the permanent administrative audit log"
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
            disabled={isSelf}
          >
            Assign Role
          </Button>
        </div>
      </form>
    </Modal>
  );
};
