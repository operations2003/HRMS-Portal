import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckSquare,
  Square,
  Search,
  Check,
  Layers,
  Save,
  Info,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Alert } from '../common/Alert.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const RolePermissionsMatrixModal = ({ isOpen, onClose, onSuccess, role }) => {
  const toast = useToast();

  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && role) {
      loadPermissions();
    }
  }, [isOpen, role]);

  const loadPermissions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [permList, roleDetail] = await Promise.all([
        adminService.listPermissions(),
        adminService.getRoleById(role.id),
      ]);

      const perms = Array.isArray(permList) ? permList : permList.permissions || [];
      setAllPermissions(perms);

      const assigned = roleDetail?.permissions || role?.permissions || [];
      const assignedIds = new Set(
        assigned.map((p) => (typeof p === 'string' ? p : p.id || p.name || p.code))
      );
      setSelectedIds(assignedIds);
    } catch (err) {
      setError(err.message || 'Failed to load permissions catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  // Group permissions by category or prefix
  const getCategory = (perm) => {
    const code = (perm.code || perm.name || '').toLowerCase();
    if (code.startsWith('exit') || code.startsWith('fnf') || code.startsWith('deprovision')) return 'Exit & Offboarding';
    if (code.startsWith('payroll') || code.startsWith('payslip')) return 'Payroll & Compensation';
    if (code.startsWith('leave')) return 'Leave Management';
    if (code.startsWith('attendance')) return 'Attendance & Time';
    if (code.startsWith('onboarding')) return 'Onboarding';
    if (code.startsWith('employee')) return 'Employee Directory';
    if (code.startsWith('user') || code.startsWith('admin') || code.startsWith('role')) return 'Security & Administration';
    if (code.startsWith('performance')) return 'Performance & Appraisal';
    if (code.startsWith('org') || code.startsWith('dept') || code.startsWith('designation')) return 'Organization Structure';
    if (code.startsWith('document')) return 'Document Vault';
    if (code.startsWith('helpdesk') || code.startsWith('request')) return 'Requests & Helpdesk';
    return 'General Module';
  };

  const grouped = allPermissions.reduce((acc, perm) => {
    const cat = getCategory(perm);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {});

  const togglePermission = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModuleAll = (perms) => {
    const allChecked = perms.every((p) => selectedIds.has(p.id || p.code || p.name));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => {
        const id = p.id || p.code || p.name;
        if (allChecked) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set(allPermissions.map((p) => p.id || p.code || p.name));
    setSelectedIds(next);
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleSaveClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const res = await adminService.assignRolePermissions(role.id, Array.from(selectedIds));
      toast.success(`Updated permissions matrix for role "${role.name}".`);
      setIsConfirmOpen(false);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save role permissions.');
      setIsConfirmOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Permissions Matrix — ${role?.name || 'Role'}`}
      subtitle={`Configure granular access authorizations for this system role (${selectedIds.size} granted)`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Global Controls & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleSelectAll}>
              Grant All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              Revoke All
            </Button>
            <span className="text-xs text-slate-500 font-medium ml-2">
              <span className="font-bold text-slate-900">{selectedIds.size}</span> of{' '}
              {allPermissions.length} permissions assigned
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 w-full sm:w-48"
            />
          </div>
        </div>

        {/* Modules Grid */}
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, perms]) => {
            const filtered = perms.filter((p) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                (p.name || '').toLowerCase().includes(q) ||
                (p.code || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q)
              );
            });

            if (filtered.length === 0) return null;

            const allChecked = filtered.every((p) => selectedIds.has(p.id || p.code || p.name));
            const someChecked = filtered.some((p) => selectedIds.has(p.id || p.code || p.name));

            return (
              <div key={category} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleModuleAll(filtered)}
                      className="p-1 rounded text-brand-600 hover:bg-slate-100 transition-colors"
                    >
                      {allChecked ? (
                        <CheckSquare className="w-4 h-4 text-brand-600" />
                      ) : someChecked ? (
                        <CheckSquare className="w-4 h-4 text-brand-400 opacity-70" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                    <h5 className="text-xs font-bold text-slate-900">{category}</h5>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {filtered.filter((p) => selectedIds.has(p.id || p.code || p.name)).length} / {filtered.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
                  {filtered.map((perm) => {
                    const id = perm.id || perm.code || perm.name;
                    const isChecked = selectedIds.has(id);

                    return (
                      <label
                        key={id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-brand-50/50 border-brand-200 text-slate-900'
                            : 'bg-white border-slate-100 hover:bg-slate-50/60 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(id)}
                          className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold leading-snug">{perm.name || perm.code}</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                            {perm.code || perm.name}
                          </p>
                          {perm.description && (
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{perm.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" variant="primary" icon={Save} isLoading={isSaving} onClick={handleSaveClick}>
            Save Permissions Matrix
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title="Apply Permissions Matrix Changes?"
        message={`Are you sure you want to update the permissions for role "${role?.name}" to ${selectedIds.size} granted permissions? All users assigned to this role will immediately inherit these authorization scopes.`}
        confirmText="Confirm & Save Permissions"
        confirmVariant="primary"
        isLoading={isSaving}
      />
    </Modal>
  );
};
