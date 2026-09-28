import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  ArrowRight,
  Search,
  Filter,
  Layers,
  List,
  CheckCircle2,
  Clock,
  AlertCircle,
  Star,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Building2,
  Calendar,
  Sparkles,
  ArrowRightLeft,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';

export const TaskAssignmentsSection = ({
  tasks = [],
  currentUser = null,
  canAssign = false,
  onSelectTask,
}) => {
  const [search, setSearch] = useState('');
  const [selectedAssigner, setSelectedAssigner] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState(canAssign ? 'all' : 'mine'); // 'all' | 'mine'
  const [groupingView, setGroupingView] = useState('by_assigner'); // 'by_assigner' | 'by_assignee' | 'ledger' | 'pairs'
  const [expandedGroups, setExpandedGroups] = useState({});

  // Compute distinct assigners & assignees from tasks
  const assignersList = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.creator_id && !map.has(t.creator_id)) {
        map.set(t.creator_id, {
          id: t.creator_id,
          name: `${t.creator_first || ''} ${t.creator_last || ''}`.trim() || 'Unknown Assigner',
          code: t.creator_code || '',
          designation: t.creator_designation || 'Staff',
          dept: t.creator_dept_name || '',
          avatar: t.creator_avatar || null,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const assigneesList = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.assignee_id && !map.has(t.assignee_id)) {
        map.set(t.assignee_id, {
          id: t.assignee_id,
          name: `${t.assignee_first || ''} ${t.assignee_last || ''}`.trim() || 'Unknown Assignee',
          code: t.assignee_code || '',
          designation: t.assignee_designation || 'Staff',
          dept: t.assignee_dept_name || '',
          avatar: t.assignee_avatar || null,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // For standard employees, strictly enforce visibility of their own tasks only
      if (!canAssign && currentUser?.employeeId) {
        const isMine = t.assignee_id === currentUser.employeeId || t.creator_id === currentUser.employeeId;
        if (!isMine) return false;
      }

      // Scope filter for assigners/managers
      if (scopeFilter === 'mine' && currentUser?.employeeId) {
        const isMine = t.assignee_id === currentUser.employeeId || t.creator_id === currentUser.employeeId;
        if (!isMine) return false;
      }

      // Assigner filter
      if (selectedAssigner && t.creator_id !== selectedAssigner) return false;

      // Assignee filter
      if (selectedAssignee && t.assignee_id !== selectedAssignee) return false;

      // Status filter
      if (statusFilter && t.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter && t.priority !== priorityFilter) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const assignerName = `${t.creator_first || ''} ${t.creator_last || ''}`.toLowerCase();
        const assigneeName = `${t.assignee_first || ''} ${t.assignee_last || ''}`.toLowerCase();
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const desig = (t.assignee_designation || '').toLowerCase();

        return (
          assignerName.includes(q) ||
          assigneeName.includes(q) ||
          title.includes(q) ||
          desc.includes(q) ||
          desig.includes(q)
        );
      }

      return true;
    });
  }, [tasks, scopeFilter, selectedAssigner, selectedAssignee, statusFilter, priorityFilter, search, currentUser]);

  // Key KPI stats computed from filtered tasks
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgress = filteredTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const blocked = filteredTasks.filter((t) => t.status === 'BLOCKED').length;
    const overdue = filteredTasks.filter((t) => t.is_overdue).length;

    const uniqueAssigners = new Set(filteredTasks.map((t) => t.creator_id)).size;
    const uniqueAssignees = new Set(filteredTasks.map((t) => t.assignee_id)).size;

    // Unique pairs
    const pairs = new Set(filteredTasks.map((t) => `${t.creator_id}->${t.assignee_id}`)).size;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, blocked, overdue, uniqueAssigners, uniqueAssignees, pairs, completionRate };
  }, [filteredTasks]);

  // Group by Assigner
  const groupedByAssigner = useMemo(() => {
    const map = new Map();
    filteredTasks.forEach((t) => {
      const key = t.creator_id || 'unassigned_creator';
      if (!map.has(key)) {
        map.set(key, {
          id: t.creator_id,
          name: `${t.creator_first || ''} ${t.creator_last || ''}`.trim() || 'Unknown Assigner',
          code: t.creator_code || '',
          designation: t.creator_designation || 'Manager / Leader',
          dept: t.creator_dept_name || '',
          avatar: t.creator_avatar || null,
          tasks: [],
        });
      }
      map.get(key).tasks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [filteredTasks]);

  // Group by Assignee
  const groupedByAssignee = useMemo(() => {
    const map = new Map();
    filteredTasks.forEach((t) => {
      const key = t.assignee_id || 'unassigned_assignee';
      if (!map.has(key)) {
        map.set(key, {
          id: t.assignee_id,
          name: `${t.assignee_first || ''} ${t.assignee_last || ''}`.trim() || 'Unknown Assignee',
          code: t.assignee_code || '',
          designation: t.assignee_designation || 'Staff / Employee',
          dept: t.assignee_dept_name || '',
          avatar: t.assignee_avatar || null,
          tasks: [],
        });
      }
      map.get(key).tasks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [filteredTasks]);

  // Group by Pair (Assigner -> Assignee)
  const groupedPairs = useMemo(() => {
    const map = new Map();
    filteredTasks.forEach((t) => {
      const pairKey = `${t.creator_id}->${t.assignee_id}`;
      if (!map.has(pairKey)) {
        map.set(pairKey, {
          pairKey,
          assignerId: t.creator_id,
          assignerName: `${t.creator_first || ''} ${t.creator_last || ''}`.trim(),
          assignerCode: t.creator_code || '',
          assignerDesignation: t.creator_designation || '',
          assignerAvatar: t.creator_avatar,
          assigneeId: t.assignee_id,
          assigneeName: `${t.assignee_first || ''} ${t.assignee_last || ''}`.trim(),
          assigneeCode: t.assignee_code || '',
          assigneeDesignation: t.assignee_designation || '',
          assigneeAvatar: t.assignee_avatar,
          tasks: [],
        });
      }
      map.get(pairKey).tasks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [filteredTasks]);

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isGroupExpanded = (id) => expandedGroups[id] !== false; // Default expanded

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'URGENT':
        return <Badge variant="danger">Urgent</Badge>;
      case 'HIGH':
        return <Badge variant="warning">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="info">Medium</Badge>;
      case 'LOW':
      default:
        return <Badge variant="neutral">Low</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="info">In Progress</Badge>;
      case 'BLOCKED':
        return <Badge variant="warning">Blocked</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      case 'TODO':
      default:
        return <Badge variant="neutral">To Do</Badge>;
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedAssigner('');
    setSelectedAssignee('');
    setStatusFilter('');
    setPriorityFilter('');
    setScopeFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Context Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-indigo-800/40">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-200 text-xs font-semibold backdrop-blur-sm">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Work Delegation Transparency Network
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Who Is Assigning Tasks to Whom
            </h2>
            <p className="text-sm text-indigo-200 leading-relaxed">
              {canAssign
                ? 'Complete organizational visibility into who creates and assigns tasks, delegation workflows, and active task ownership across all departments and team members.'
                : 'Track who assigned tasks to you, review deadlines, and monitor your delivery progress.'}
            </p>
          </div>

          {/* Quick Scope Switcher */}
          {canAssign ? (
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl backdrop-blur-md border border-white/10 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  scopeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                All Org Tasks ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('mine')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  scopeFilter === 'mine'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                My Involvements
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-md border border-white/10 text-white text-xs font-bold self-start lg:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              My Tasks & Delegations
            </div>
          )}
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider block">
              Active Delegators
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-white">{stats.uniqueAssigners}</span>
              <Users className="w-5 h-5 text-indigo-300 opacity-80" />
            </div>
            <span className="text-[10px] text-indigo-300 mt-0.5 block">Assigning leaders & leads</span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider block">
              Task Assignees
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-emerald-300">{stats.uniqueAssignees}</span>
              <UserCheck className="w-5 h-5 text-emerald-300 opacity-80" />
            </div>
            <span className="text-[10px] text-indigo-300 mt-0.5 block">Team members receiving work</span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider block">
              Delegation Pairs
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-amber-300">{stats.pairs}</span>
              <ArrowRightLeft className="w-5 h-5 text-amber-300 opacity-80" />
            </div>
            <span className="text-[10px] text-indigo-300 mt-0.5 block">Active collaborative pairs</span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider block">
              Completion Rate
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-black text-brand-300">{stats.completionRate}%</span>
              <CheckCircle2 className="w-5 h-5 text-brand-300 opacity-80" />
            </div>
            <span className="text-[10px] text-indigo-300 mt-0.5 block">{stats.completed} of {stats.total} delivered</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Search & Filtering Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by task title, assigner (who), or assignee (whom)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setGroupingView('by_assigner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                groupingView === 'by_assigner'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              By Assigner ({groupedByAssigner.length})
            </button>

            <button
              type="button"
              onClick={() => setGroupingView('by_assignee')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                groupingView === 'by_assignee'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              By Assignee ({groupedByAssignee.length})
            </button>

            <button
              type="button"
              onClick={() => setGroupingView('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                groupingView === 'ledger'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Live Ledger
            </button>

            <button
              type="button"
              onClick={() => setGroupingView('pairs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                groupingView === 'pairs'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Delegation Pairs ({groupedPairs.length})
            </button>
          </div>
        </div>

        {/* Filter dropdowns row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5 text-brand-500" />
            Filters:
          </div>

          {/* Assigned By Dropdown */}
          <select
            value={selectedAssigner}
            onChange={(e) => setSelectedAssigner(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Assigners (Who Assigned)</option>
            {assignersList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.designation})
              </option>
            ))}
          </select>

          {/* Assigned To Dropdown (Assigners / Managers only) */}
          {canAssign && (
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Assignees (Assigned To)</option>
              {assigneesList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.designation})
                </option>
              ))}
            </select>
          )}

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {(search || selectedAssigner || selectedAssignee || statusFilter || priorityFilter || scopeFilter !== 'all') && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 underline px-2 py-1 cursor-pointer"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto text-xs font-semibold text-slate-500">
            Showing <span className="font-bold text-slate-900 dark:text-white">{filteredTasks.length}</span> task(s)
          </div>
        </div>
      </div>

      {/* 3. Empty State */}
      {filteredTasks.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No Task Assignments Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No tasks matched your current search and filter criteria. Try resetting the filters or switching views.
          </p>
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      )}

      {/* 4. VIEW A: Grouped By Assigner (Who Assigned) */}
      {filteredTasks.length > 0 && groupingView === 'by_assigner' && (
        <div className="space-y-4">
          {groupedByAssigner.map((assigner) => {
            const isExpanded = isGroupExpanded(assigner.id);
            const totalAssigned = assigner.tasks.length;
            const completedCount = assigner.tasks.filter((t) => t.status === 'COMPLETED').length;
            const compPercent = Math.round((completedCount / totalAssigned) * 100);
            const uniqueRecipients = new Set(assigner.tasks.map((t) => t.assignee_id)).size;

            return (
              <div
                key={assigner.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition"
              >
                {/* Assigner Header Card */}
                <div
                  onClick={() => toggleGroup(assigner.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition cursor-pointer select-none border-b border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                      {getInitials(assigner.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {assigner.name}
                        </h3>
                        {assigner.code && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {assigner.code}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">
                          Delegator / Assigner
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{assigner.designation}</span>
                        {assigner.dept && <span>• {assigner.dept}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {totalAssigned} task{totalAssigned > 1 ? 's' : ''} assigned
                      </div>
                      <div className="text-[11px] text-slate-500">
                        to {uniqueRecipients} team member{uniqueRecipients > 1 ? 's' : ''} • {compPercent}% completed
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Subtask Cards Grid */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50/20 dark:bg-slate-950/20">
                    {assigner.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task)}
                        className="bg-white dark:bg-slate-800/90 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:shadow-md hover:border-brand-400 transition cursor-pointer space-y-3 group"
                      >
                        {/* Delegation Target Line */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-700/60 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {getInitials(`${task.assignee_first} ${task.assignee_last}`)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                Assigned To
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">
                                {task.assignee_first} {task.assignee_last}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(task.status)}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-brand-600 transition">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Footer Badges */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            {getPriorityBadge(task.priority)}
                            {task.rating && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-600" />
                                {Number(task.rating).toFixed(1)}
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 ${task.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            <span>{task.due_date || 'No due date'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. VIEW B: Grouped By Assignee (To Whom Assigned) */}
      {filteredTasks.length > 0 && groupingView === 'by_assignee' && (
        <div className="space-y-4">
          {groupedByAssignee.map((assignee) => {
            const isExpanded = isGroupExpanded(assignee.id);
            const totalTasks = assignee.tasks.length;
            const completedCount = assignee.tasks.filter((t) => t.status === 'COMPLETED').length;
            const compPercent = Math.round((completedCount / totalTasks) * 100);
            const uniqueAssigners = new Set(assignee.tasks.map((t) => t.creator_id)).size;

            return (
              <div
                key={assignee.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition"
              >
                {/* Assignee Header Card */}
                <div
                  onClick={() => toggleGroup(assignee.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition cursor-pointer select-none border-b border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                      {getInitials(assignee.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {assignee.name}
                        </h3>
                        {assignee.code && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {assignee.code}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          Task Owner / Assignee
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{assignee.designation}</span>
                        {assignee.dept && <span>• {assignee.dept}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {totalTasks} task{totalTasks > 1 ? 's' : ''} assigned
                      </div>
                      <div className="text-[11px] text-slate-500">
                        by {uniqueAssigners} leader{uniqueAssigners > 1 ? 's' : ''} • {compPercent}% completed
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Subtask Cards Grid */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50/20 dark:bg-slate-950/20">
                    {assignee.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task)}
                        className="bg-white dark:bg-slate-800/90 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:shadow-md hover:border-brand-400 transition cursor-pointer space-y-3 group"
                      >
                        {/* Delegation Source Line */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-700/60 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {getInitials(`${task.creator_first} ${task.creator_last}`)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                Assigned By
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">
                                {task.creator_first} {task.creator_last}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(task.status)}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-brand-600 transition">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Footer Badges */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            {getPriorityBadge(task.priority)}
                            {task.rating && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-600" />
                                {Number(task.rating).toFixed(1)}
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 ${task.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            <span>{task.due_date || 'No due date'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 6. VIEW C: Live Delegation Ledger Table */}
      {filteredTasks.length > 0 && groupingView === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Assigned By (Who)</th>
                  <th className="p-4 text-center">Flow</th>
                  <th className="p-4">Assigned To (Whom)</th>
                  <th className="p-4">Task Deliverable</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Rating</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTask?.(t)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    {/* Assigned By */}
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {getInitials(`${t.creator_first} ${t.creator_last}`)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-white block">
                            {t.creator_first} {t.creator_last}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {t.creator_designation || t.creator_code || 'Delegator'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Flow arrow */}
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center font-bold">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </td>

                    {/* Assigned To */}
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                          {getInitials(`${t.assignee_first} ${t.assignee_last}`)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-white block">
                            {t.assignee_first} {t.assignee_last}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {t.assignee_designation || t.assignee_code || 'Assignee'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Task Title & Description */}
                    <td className="p-4 max-w-xs">
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(t.priority)}
                        <span className="font-bold text-slate-900 dark:text-white truncate block">
                          {t.title}
                        </span>
                      </div>
                      {t.description && (
                        <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 block">
                          {t.description}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getStatusBadge(t.status)}
                        {t.reopen_count > 0 && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                            Reopened ({t.reopen_count})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rating */}
                    <td className="p-4 whitespace-nowrap">
                      {t.rating ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 text-xs">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          {Number(t.rating).toFixed(1)}/5
                        </span>
                      ) : t.status === 'COMPLETED' ? (
                        <span className="text-[10px] font-semibold text-amber-600 italic">
                          Awaiting rating
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Due Date */}
                    <td className="p-4 whitespace-nowrap">
                      <span className={t.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                        {t.due_date || 'N/A'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTask?.(t);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 rounded-lg cursor-pointer transition"
                      >
                        View Task
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. VIEW D: Delegation Pairs Matrix */}
      {filteredTasks.length > 0 && groupingView === 'pairs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupedPairs.map((pair) => {
            const completedCount = pair.tasks.filter((t) => t.status === 'COMPLETED').length;
            const inProgressCount = pair.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
            const latestTask = pair.tasks[0];

            return (
              <div
                key={pair.pairKey}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-brand-400 transition"
              >
                {/* Pair relationship header */}
                <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  {/* Assigner */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {getInitials(pair.assignerName)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Assigner
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">
                        {pair.assignerName}
                      </span>
                    </div>
                  </div>

                  <div className="px-2 text-brand-600 font-black">➔</div>

                  {/* Assignee */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end text-right">
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Assignee
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">
                        {pair.assigneeName}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                      {getInitials(pair.assigneeName)}
                    </div>
                  </div>
                </div>

                {/* Counts breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 font-semibold block">Total</span>
                    <span className="text-base font-bold text-slate-800 dark:text-white">
                      {pair.tasks.length}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                    <span className="text-[10px] text-blue-600 font-semibold block">In Progress</span>
                    <span className="text-base font-bold text-blue-700 dark:text-blue-400">
                      {inProgressCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
                    <span className="text-[10px] text-emerald-600 font-semibold block">Completed</span>
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                      {completedCount}
                    </span>
                  </div>
                </div>

                {/* Latest Task snippet */}
                {latestTask && (
                  <div
                    onClick={() => onSelectTask?.(latestTask)}
                    className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                      Latest Delegated Task
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">
                        {latestTask.title}
                      </span>
                      {getStatusBadge(latestTask.status)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
