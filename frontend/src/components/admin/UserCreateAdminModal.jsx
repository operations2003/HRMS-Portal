import React, { useState } from 'react';
import { UserPlus, Lock, Mail, Building2, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { PasswordInput } from '../common/PasswordInput.jsx';
import { Select } from '../common/Select.jsx';
import { Alert } from '../common/Alert.jsx';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const UserCreateAdminModal = ({ isOpen, onClose, onSuccess, roles = [], organizations = [] }) => {
  const toast = useToast();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: roles[0]?.id || '',
    orgId: organizations[0]?.id || '',
    status: 'Active',
    reason: 'Initial administrator user creation',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!formData.roleId) {
      setError('A system role must be selected.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const newUser = await adminService.createUser({
        ...formData,
        email: formData.email.trim().toLowerCase(),
      });

      toast.success(`User ${newUser.email} created successfully.`);
      onSuccess?.(newUser);
      onClose();
    } catch (err) {
      console.error('Create admin user error:', err);
      setError(err.message || 'Failed to create user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create User Account"
      subtitle="Provision an authorized user with designated system role"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            required
          />
          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            required
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="user@example.com"
          required
        />

        <PasswordInput
          label="Initial Password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          helperText="Minimum 6 characters"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="System Role"
            value={formData.roleId}
            onChange={(e) => handleChange('roleId', e.target.value)}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            required
          />

          <Select
            label="Initial Status"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />
        </div>

        <Input
          label="Audit Creation Reason"
          value={formData.reason}
          onChange={(e) => handleChange('reason', e.target.value)}
          placeholder="e.g. New employee onboarded"
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={UserPlus}
            isLoading={isSubmitting}
          >
            Create User Account
          </Button>
        </div>
      </form>
    </Modal>
  );
};
