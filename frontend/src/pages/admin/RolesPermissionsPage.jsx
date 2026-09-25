import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Plus,
  Edit,
  Search,
  CheckCircle2,
  Lock,
  RefreshCw,
  Eye,
  Key,
  Layers,
  ChevronRight,
  Filter,
  UserCheck,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { adminService } from '../../services/adminService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Input } from '../../components/common/Input.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Avatar } from '../../components/common/Avatar.jsx';
import { RoleFormModal } from '../../components/admin/RoleFormModal.jsx';
import { RolePermissionsMatrixModal } from '../../components/admin/RolePermissionsMatrixModal.jsx';
import { UserRoleAssignModal } from '../../components/admin/UserRoleAssignModal.jsx';
import { UserPermissionsViewModal } from '../../components/admin/UserPermissionsViewModal.jsx';

export const RolesPermissionsPage = () => {
  const { user: currentUser, hasRole } = useAuth();
  const toast = useToast();

  const isAdmin = hasRole(['Admin', 'SuperAdmin', 'OrgAdmin']);

  // Active Tab: 'role-perms' (Role → Permissions) | 'user-roles' (User → Role)
  const [activeTab, setActiveTab] = useState('role-perms');

  // 1. Roles & Permissions State
  const [roles, setRoles] = useState([]);
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState(null);
  const [roleSearch, setRoleSearch] = useState('');
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  // 2. User → Role State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Common UI states
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Modals State
  const [editingRole, setEditingRole] = useState(null);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [matrixRole, setMatrixRole] = useState(null);
  const [targetUserForRole, setTargetUserForRole] = useState(null);
  const [targetUserForPerms, setTargetUserForPerms] = useState(null);

  // Fetch System Roles
  const fetchRoles = useCallback(async () => {
    try {
      setIsLoadingRoles(true);
      setError(null);
      const data = await adminService.listRoles();
      const list = Array.isArray(data) ? data : data.roles || [];
      setRoles(list);

      // Auto-select first role for details if none selected
      if (list.length > 0) {
        setSelectedRoleForDetail((prev) => (prev ? list.find((r) => r.id === prev.id) || list[0] : list[0]));
      }
    } catch (err) {
      console.error('Failed to load system roles:', err);
      setError(err.message || 'Failed to load system roles.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  // Fetch Users for User → Role mapping
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      setError(null);
      const data = await adminService.listUsers();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      console.error('Failed to load user accounts:', err);
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchRoles();
    fetchUsers();
  }, [isAdmin, fetchRoles, fetchUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRoles(), fetchUsers()]);
    setRefreshing(false);
    toast.success('RBAC definitions refreshed.');
  };

  // Helper: check if role is system-protected built-in
  const isSystemProtectedRole = (name) => {
    return ['SuperAdmin', 'Admin', 'OrgAdmin'].includes(name);
  };

  // Security Gate: Non-admin users are blocked unconditionally
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Roles & Permissions governance is restricted to authorized system administrators.
          Employees and Managers are not permitted to inspect or modify access control policies.
        </p>
      </div>
    );
  }

  // Filtered Roles
  const filteredRoles = roles.filter((r) => {
    const q = roleSearch.toLowerCase().trim();
    if (!q) return true;
    const name = (r.name || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  // Filtered Users for User → Role tab
  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase().trim();
    const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch = !q || name.includes(q) || email.includes(q);

    const matchesRole = !userRoleFilter || u.roleId === userRoleFilter || u.roleName === userRoleFilter;
    const matchesStatus = !userStatusFilter || (u.status || '').toLowerCase() === userStatusFilter.toLowerCase();

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Helper: group role permissions by category for detail view
  const getCategorizedPerms = (role) => {
    const perms = role?.permissions || [];
    const grouped = {};
    perms.forEach((p) => {
      const code = typeof p === 'string' ? p : p.code || p.name || '';
      let cat = 'General';
      if (code.startsWith('exit') || code.startsWith('fnf') || code.startsWith('deprovision')) cat = 'Exit & Offboarding';
      else if (code.startsWith('payroll') || code.startsWith('payslip')) cat = 'Payroll & Compensation';
      else if (code.startsWith('leave')) cat = 'Leave Management';
      else if (code.startsWith('attendance')) cat = 'Attendance & Time';
      else if (code.startsWith('employee')) cat = 'Employee Directory';
      else if (code.startsWith('admin') || code.startsWith('user') || code.startsWith('role')) cat = 'Security & Administration';
      else if (code.startsWith('performance')) cat = 'Performance & Appraisal';
      else if (code.startsWith('document')) cat = 'Document Vault';
      else if (code.startsWith('helpdesk') || code.startsWith('request')) cat = 'Requests & Helpdesk';

      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(code);
    });
    return grouped;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
              <KeyRound className="w-3.5 h-3.5" /> RBAC Security Governance
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#BF6649]" />
            Roles & Permissions Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure authorization privilege tiers, map granular module permissions, and inspect user role assignments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            isLoading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
          {activeTab === 'role-perms' && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateRoleOpen(true)}
            >
              Create Role
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Tab Switcher: Role → Permissions vs User → Role */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('role-perms')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${
            activeTab === 'role-perms'
              ? 'border-b-2 border-[#BF6649] text-[#BF6649] bg-orange-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Role → Permissions</span>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('user-roles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${
            activeTab === 'user-roles'
              ? 'border-b-2 border-[#BF6649] text-[#BF6649] bg-orange-50/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>User → Role</span>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
            {users.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ROLE → PERMISSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'role-perms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Roles List (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search roles by name or description..."
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                />
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredRoles.length} roles
              </span>
            </div>

            {isLoadingRoles ? (
              <div className="py-16">
                <LoadingSpinner message="Loading system roles..." />
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                No matching system roles found.
              </div>
            ) : (
              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {filteredRoles.map((r) => {
                  const isSelected = selectedRoleForDetail?.id === r.id;
                  const isProtected = isSystemProtectedRole(r.name);
                  const permsCount = r.permissionsCount ?? (Array.isArray(r.permissions) ? r.permissions.length : 0);

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRoleForDetail(r)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs ${
                        isSelected
                          ? 'border-[#BF6649] bg-orange-50/40 shadow-sm'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                              isProtected
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-brand-50 text-brand-700'
                            }`}
                          >
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{r.name}</span>
                              {isProtected && (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-medium">
                                  System Role
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {r.description || 'Custom organizational permission role.'}
                            </p>
                          </div>
                        </div>

                        <Badge
                          size="sm"
                          variant={r.status === 'Active' || !r.status ? 'success' : 'neutral'}
                        >
                          {r.status || 'Active'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <strong>{r.userCount ?? r.usersCount ?? 0}</strong> users
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Key className="w-3 h-3 text-slate-400" />
                            <strong>{isProtected && (r.name === 'Admin' || r.name === 'SuperAdmin') ? 'All' : permsCount}</strong> permissions
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={KeyRound}
                            onClick={() => setMatrixRole(r)}
                            title="Configure Permissions Matrix"
                          >
                            Matrix
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit}
                            onClick={() => setEditingRole(r)}
                            title="Edit Role Definition"
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Role Details & Permissions Breakdown (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            {selectedRoleForDetail ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                      Role Detail & Granted Scopes
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                      {selectedRoleForDetail.name}
                      {isSystemProtectedRole(selectedRoleForDetail.name) && (
                        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-medium">
                          Built-in
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedRoleForDetail.description || 'Custom organizational permission role.'}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={KeyRound}
                    onClick={() => setMatrixRole(selectedRoleForDetail)}
                  >
                    Edit Matrix
                  </Button>
                </div>

                {/* Scope Stats */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Assigned Users</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedRoleForDetail.userCount ?? selectedRoleForDetail.usersCount ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Granted Permissions</span>
                    <span className="font-bold text-brand-600 text-sm">
                      {isSystemProtectedRole(selectedRoleForDetail.name) &&
                      (selectedRoleForDetail.name === 'Admin' || selectedRoleForDetail.name === 'SuperAdmin')
                        ? 'Full Unrestricted'
                        : `${selectedRoleForDetail.permissionsCount ?? (selectedRoleForDetail.permissions?.length || 0)} Scopes`}
                    </span>
                  </div>
                </div>

                {/* Categorized Permissions Breakdown */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-2">
                    Authorized Module Capabilities
                  </h4>

                  {isSystemProtectedRole(selectedRoleForDetail.name) &&
                  (selectedRoleForDetail.name === 'Admin' || selectedRoleForDetail.name === 'SuperAdmin') ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Admin Full Privilege:</strong> This role possesses unrestricted root access
                        across all modules including Exit, Payroll, Leave, Attendance, and Administration.
                      </div>
                    </div>
                  ) : Object.keys(getCategorizedPerms(selectedRoleForDetail)).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      No permissions currently assigned to this role. Click "Edit Matrix" to grant capabilities.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {Object.entries(getCategorizedPerms(selectedRoleForDetail)).map(([cat, perms]) => (
                        <div key={cat} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                          <span className="font-bold text-slate-800 text-[11px] block">{cat} ({perms.length})</span>
                          <div className="flex flex-wrap gap-1">
                            {perms.map((p) => (
                              <span
                                key={p}
                                className="text-[10px] font-mono bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-xs text-slate-400">
                Select a role from the list to view its authorized permissions breakdown.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USER → ROLE */}
      {/* ========================================================================= */}
      {activeTab === 'user-roles' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by user name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              {filteredUsers.length} user mappings
            </div>
          </div>

          {/* User → Role Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <DataTable
              columns={[
                {
                  header: 'User Account',
                  render: (row) => (
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={row.avatarUrl}
                        firstName={row.firstName}
                        lastName={row.lastName}
                        size="md"
                        shape="rounded"
                        fallbackGradient="bg-slate-800 text-white"
                      />
                      <div>
                        <div className="font-semibold text-slate-900 text-xs">
                          {row.firstName} {row.lastName}
                          {currentUser?.id === row.id && (
                            <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {row.email}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Assigned Role',
                  render: (row) => (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="brand" size="sm">
                        {row.roleName || 'Employee'}
                      </Badge>
                      {isSystemProtectedRole(row.roleName) && (
                        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-medium">
                          Admin Tier
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Privilege Scope',
                  render: (row) => {
                    const isSuper = row.roleName === 'Admin' || row.roleName === 'SuperAdmin';
                    const permsCount = row.permissions?.length || 0;
                    return (
                      <div className="text-xs">
                        {isSuper ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Full Administrative Scope
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono">
                            {permsCount} granted permissions
                          </span>
                        )}
                      </div>
                    );
                  },
                },
                {
                  header: 'Account Status',
                  render: (row) => {
                    const st = (row.status || 'Active').toLowerCase();
                    return (
                      <Badge
                        size="sm"
                        variant={st === 'active' ? 'success' : st === 'suspended' ? 'danger' : 'neutral'}
                      >
                        {row.status || 'Active'}
                      </Badge>
                    );
                  },
                },
                {
                  header: 'Actions',
                  render: (row) => (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => setTargetUserForPerms(row)}
                        title="View effective permissions"
                      >
                        Permissions
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={KeyRound}
                        onClick={() => setTargetUserForRole(row)}
                        title="Reassign user's system role"
                      >
                        Reassign Role
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={filteredUsers}
              isLoading={isLoadingUsers}
              emptyMessage="No users found matching current criteria."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Create / Edit Role Modal */}
      {(editingRole || isCreateRoleOpen) && (
        <RoleFormModal
          isOpen={!!editingRole || isCreateRoleOpen}
          onClose={() => {
            setEditingRole(null);
            setIsCreateRoleOpen(false);
          }}
          role={editingRole}
          onSuccess={() => {
            fetchRoles();
            setEditingRole(null);
            setIsCreateRoleOpen(false);
          }}
        />
      )}

      {/* Role Permissions Matrix Modal */}
      {matrixRole && (
        <RolePermissionsMatrixModal
          isOpen={!!matrixRole}
          onClose={() => setMatrixRole(null)}
          role={matrixRole}
          onSuccess={() => {
            fetchRoles();
            setMatrixRole(null);
          }}
        />
      )}

      {/* User Role Assignment Modal */}
      {targetUserForRole && (
        <UserRoleAssignModal
          isOpen={!!targetUserForRole}
          onClose={() => setTargetUserForRole(null)}
          targetUser={targetUserForRole}
          roles={roles}
          onSuccess={() => {
            fetchUsers();
            fetchRoles();
            setTargetUserForRole(null);
          }}
        />
      )}

      {/* User Permissions View Modal */}
      {targetUserForPerms && (
        <UserPermissionsViewModal
          isOpen={!!targetUserForPerms}
          onClose={() => setTargetUserForPerms(null)}
          user={targetUserForPerms}
        />
      )}
    </div>
  );
};
