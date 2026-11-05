import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  Users,
  KeyRound,
  Activity,
  FileText,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Plus,
  Edit2,
  Server,
  Database,
  CheckCircle2,
  Lock,
  Search,
  Filter,
  UserCheck,
  Building2,
  Eye,
  Key,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { adminService } from '../../services/adminService.js';
import { orgService } from '../../services/orgService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Avatar } from '../../components/common/Avatar.jsx';
import { SystemOverviewCards } from '../../components/admin/SystemOverviewCards.jsx';
import { ConfigEditorModal } from '../../components/admin/ConfigEditorModal.jsx';
import { AuditLogsTable } from '../../components/admin/AuditLogsTable.jsx';
import { UserStatusModal } from '../../components/admin/UserStatusModal.jsx';
import { UserRoleAssignModal } from '../../components/admin/UserRoleAssignModal.jsx';
import { UserCreateAdminModal } from '../../components/admin/UserCreateAdminModal.jsx';
import { UserPermissionsViewModal } from '../../components/admin/UserPermissionsViewModal.jsx';
import { RoleFormModal } from '../../components/admin/RoleFormModal.jsx';
import { RolePermissionsMatrixModal } from '../../components/admin/RolePermissionsMatrixModal.jsx';

export const AdminSettingsPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();

  const isAdmin = hasRole(['Admin', 'SuperAdmin', 'OrgAdmin']);

  // Active section tab: 'configs' | 'users' | 'roles' | 'overview' | 'audits'
  const [activeTab, setActiveTab] = useState('configs');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // 1. Configurations State
  const [configs, setConfigs] = useState([]);
  const [configCategory, setConfigCategory] = useState('ALL');
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isAddConfigOpen, setIsAddConfigOpen] = useState(false);

  // 2. Users Administration State
  const [usersList, setUsersList] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [orgsList, setOrgsList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [targetUserForStatus, setTargetUserForStatus] = useState(null);
  const [targetUserForRole, setTargetUserForRole] = useState(null);
  const [targetUserForPerms, setTargetUserForPerms] = useState(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  // 3. Roles & RBAC State
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [activeRoleForPerms, setActiveRoleForPerms] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);

  // 4. System Overview State
  const [overview, setOverview] = useState({});
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  // 5. Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);

  // Fetch Configurations
  const fetchConfigs = useCallback(async () => {
    try {
      setIsLoadingConfigs(true);
      setError(null);
      const data = await adminService.getConfigurations(
        configCategory === 'ALL' ? undefined : configCategory
      );
      setConfigs(Array.isArray(data) ? data : data.configurations || []);
    } catch (err) {
      console.error('Failed to load configurations:', err);
      setError(err.message || 'Failed to load configurations.');
    } finally {
      setIsLoadingConfigs(false);
    }
  }, [configCategory]);

  // Fetch Users & Roles
  const fetchUsersAndRoles = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      setError(null);
      const [usersData, rolesData, orgsData] = await Promise.all([
        adminService.listUsers(),
        adminService.listRoles().catch(() => []),
        orgService.listOrganizations().catch(() => []),
      ]);
      setUsersList(Array.isArray(usersData) ? usersData : usersData.users || []);
      setRolesList(Array.isArray(rolesData) ? rolesData : rolesData.roles || []);
      setOrgsList(Array.isArray(orgsData) ? orgsData : []);
    } catch (err) {
      console.error('Failed to load user administration data:', err);
      setError(err.message || 'Failed to load users.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Fetch Roles
  const fetchRoles = useCallback(async () => {
    try {
      setIsLoadingRoles(true);
      const rolesData = await adminService.listRoles();
      setRolesList(Array.isArray(rolesData) ? rolesData : rolesData.roles || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
      toast.error('Failed to load roles.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, [toast]);

  // Fetch Overview
  const fetchOverview = useCallback(async () => {
    try {
      setIsLoadingOverview(true);
      const data = await adminService.getSystemOverview();
      setOverview(data || {});
    } catch (err) {
      console.error('Failed to load system overview:', err);
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  // Fetch Audit Logs
  const fetchAudits = useCallback(async () => {
    try {
      setIsLoadingAudits(true);
      const data = await adminService.getAuditLogs({ limit: 100 });
      setAuditLogs(Array.isArray(data) ? data : data.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudits(false);
    }
  }, []);

  // Initial and tab-based data fetching
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'configs') fetchConfigs();
    if (activeTab === 'users') fetchUsersAndRoles();
    if (activeTab === 'roles') fetchRoles();
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'audits') fetchAudits();
  }, [activeTab, isAdmin, fetchConfigs, fetchUsersAndRoles, fetchRoles, fetchOverview, fetchAudits]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'configs') await fetchConfigs();
    if (activeTab === 'users') await fetchUsersAndRoles();
    if (activeTab === 'roles') await fetchRoles();
    if (activeTab === 'overview') await fetchOverview();
    if (activeTab === 'audits') await fetchAudits();
    setRefreshing(false);
    toast.success('Admin data refreshed.');
  };

  // Security Gate: Non-admin users are blocked from administrative controls
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Administrative controls and system settings are strictly restricted to authorized system administrators.
          Your role does not have elevated privileges to view or modify these resources.
        </p>
      </div>
    );
  }

  // Filtered Users for User Administration tab
  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.toLowerCase().trim();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch = !q || fullName.includes(q) || email.includes(q);

    const matchesRole = !userRoleFilter || u.roleId === userRoleFilter || u.roleName === userRoleFilter;
    const matchesStatus = !userStatusFilter || (u.status || '').toLowerCase() === userStatusFilter.toLowerCase();

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Configuration Category List
  const configCategories = [
    { id: 'ALL', label: 'All Settings' },
    { id: 'SECURITY_RBAC', label: 'Security & Access' },
    { id: 'EXIT_OFFBOARDING', label: 'Exit & Offboarding Rules' },
    { id: 'GENERAL', label: 'General System' },
    { id: 'PAYROLL', label: 'Payroll & Compensation' },
  ];

  // Configuration Table Columns
  const configColumns = [
    {
      header: 'Configuration Key',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">{row.configKey || row.key}</span>
          {row.description && <p className="text-[11px] text-slate-500 mt-0.5">{row.description}</p>}
        </div>
      ),
    },
    {
      header: 'Category',
      render: (row) => (
        <Badge variant={row.category === 'SECURITY_RBAC' ? 'danger' : 'brand'} size="sm">
          {row.category || 'GENERAL'}
        </Badge>
      ),
    },
    {
      header: 'Current Value',
      render: (row) => {
        const val = typeof row.configValue === 'object' ? JSON.stringify(row.configValue) : String(row.configValue);
        return (
          <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded-lg max-w-xs truncate block">
            {val}
          </span>
        );
      },
    },
    {
      header: 'Last Updated',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: 'Action',
      render: (row) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" icon={Edit2} onClick={() => setEditingConfig(row)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Authorized Administration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-7 h-7 text-[#BF6649]" />
            Administrative Settings & Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure platform policies, manage user statuses, oversee system RBAC, and monitor audit trails.
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
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'configs', label: 'Configurations & Policies', icon: Sliders },
          { id: 'users', label: 'User Administration', icon: Users, badge: usersList.length },
          { id: 'roles', label: 'Roles & Permissions', icon: KeyRound, badge: rolesList.length },
          { id: 'overview', label: 'Platform Health', icon: Activity },
          { id: 'audits', label: 'Audit Trail', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors shrink-0 ${
                isActive
                  ? 'border-b-2 border-[#BF6649] text-[#BF6649] bg-orange-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-[#BF6649] text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ADMINISTRATIVE CONFIGURATIONS & POLICIES */}
      {/* ========================================================================= */}
      {activeTab === 'configs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            {/* Category Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              {configCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConfigCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    configCategory === c.id
                      ? 'bg-[#BF6649] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsAddConfigOpen(true)}
            >
              Add Configuration
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <DataTable
              columns={configColumns}
              data={configs}
              isLoading={isLoadingConfigs}
              emptyMessage="No administrative configurations found for this category."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USER ADMINISTRATION & STATUS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
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
                {rolesList.map((r) => (
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

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateUserOpen(true)}
            >
              Provision User
            </Button>
          </div>

          {/* Users Table */}
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
                          {user?.id === row.id && (
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
                  header: 'System Role',
                  render: (row) => (
                    <Badge variant="brand" size="sm">
                      {row.roleName || 'Employee'}
                    </Badge>
                  ),
                },
                {
                  header: 'Status',
                  render: (row) => {
                    const st = (row.status || 'Active').toLowerCase();
                    return (
                      <Badge
                        size="sm"
                        variant={
                          st === 'active' ? 'success' : st === 'suspended' ? 'danger' : 'neutral'
                        }
                      >
                        {row.status || 'Active'}
                      </Badge>
                    );
                  },
                },
                {
                  header: 'Effective Permissions',
                  render: (row) => {
                    const isSuper = row.roleName === 'Admin' || row.roleName === 'SuperAdmin';
                    const permsCount = row.permissions?.length || 0;
                    return (
                      <div className="flex items-center gap-2 text-xs">
                        {isSuper ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Full Scope
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono">
                            {permsCount} permissions
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setTargetUserForPerms(row)}
                          className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                          title="View assigned permissions"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                        onClick={() => setTargetUserForStatus(row)}
                        title="Change user active / suspended status"
                      >
                        Status
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTargetUserForRole(row)}
                        title="Assign new system role"
                      >
                        Role
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={filteredUsers}
              isLoading={isLoadingUsers}
              emptyMessage="No users found matching current filters."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ROLES & PERMISSIONS (RBAC) */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Configured System Roles</h3>
              <p className="text-xs text-slate-500">
                Manage role access levels and configure granular module permissions.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateRoleOpen(true)}
            >
              Create New Role
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <DataTable
              columns={[
                {
                  header: 'Role Name',
                  render: (row) => (
                    <div>
                      <span className="font-bold text-xs text-slate-900">{row.name}</span>
                      {row.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{row.description}</p>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Assigned Users',
                  render: (row) => (
                    <span className="text-xs text-slate-700 font-mono font-medium">
                      {row.userCount || row.usersCount || 0} users
                    </span>
                  ),
                },
                {
                  header: 'Permissions Scope',
                  render: (row) => {
                    const count = row.permissionsCount || row.permissions?.length || 0;
                    return (
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {count} permissions
                      </span>
                    );
                  },
                },
                {
                  header: 'Actions',
                  render: (row) => (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Key}
                        onClick={() => setActiveRoleForPerms(row)}
                      >
                        Permissions Matrix
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit2}
                        onClick={() => setEditingRole(row)}
                      >
                        Edit
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={rolesList}
              isLoading={isLoadingRoles}
              emptyMessage="No system roles defined."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PLATFORM HEALTH & TELEMETRY */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <SystemOverviewCards overview={overview} isLoading={isLoadingOverview} />

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              Runtime Architecture & Security Overview
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              TaskNera runs on a micro-architected Node.js enterprise backend backed by PostgreSQL multi-tenant storage.
              All administrative calls are authenticated with signed JWTs and authorized by strict database-driven RBAC.
              All schema mutations and credential assignments are logged to the immutable audit trail.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: IMMUTABLE AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeTab === 'audits' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Administrative Audit Trail</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable chronological record of administrative actions, user updates, and configuration changes.
            </p>
          </div>

          <AuditLogsTable logs={auditLogs} isLoading={isLoadingAudits} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Edit Config Modal */}
      {(editingConfig || isAddConfigOpen) && (
        <ConfigEditorModal
          isOpen={!!editingConfig || isAddConfigOpen}
          onClose={() => {
            setEditingConfig(null);
            setIsAddConfigOpen(false);
          }}
          config={editingConfig}
          onSuccess={() => {
            fetchConfigs();
            setEditingConfig(null);
            setIsAddConfigOpen(false);
          }}
        />
      )}

      {/* User Status Modal */}
      {targetUserForStatus && (
        <UserStatusModal
          isOpen={!!targetUserForStatus}
          onClose={() => setTargetUserForStatus(null)}
          targetUser={targetUserForStatus}
          onSuccess={() => {
            fetchUsersAndRoles();
            setTargetUserForStatus(null);
          }}
        />
      )}

      {/* User Role Assignment Modal */}
      {targetUserForRole && (
        <UserRoleAssignModal
          isOpen={!!targetUserForRole}
          onClose={() => setTargetUserForRole(null)}
          targetUser={targetUserForRole}
          roles={rolesList}
          onSuccess={() => {
            fetchUsersAndRoles();
            setTargetUserForRole(null);
          }}
        />
      )}

      {/* User Create Modal */}
      {isCreateUserOpen && (
        <UserCreateAdminModal
          isOpen={isCreateUserOpen}
          onClose={() => setIsCreateUserOpen(false)}
          roles={rolesList}
          organizations={orgsList}
          onSuccess={() => {
            fetchUsersAndRoles();
            setIsCreateUserOpen(false);
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

      {/* Role Form Modal (Create / Edit) */}
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
      {activeRoleForPerms && (
        <RolePermissionsMatrixModal
          isOpen={!!activeRoleForPerms}
          onClose={() => setActiveRoleForPerms(null)}
          role={activeRoleForPerms}
          onSuccess={() => {
            fetchRoles();
            setActiveRoleForPerms(null);
          }}
        />
      )}
    </div>
  );
};
