import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  User,
  Building,
  FileCheck,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { exitService } from '../../services/exitService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { InitiateExitModal } from '../../components/exit/InitiateExitModal.jsx';
import { ExitChecklistDetailCard } from '../../components/exit/ExitChecklistDetailCard.jsx';

export const ExitChecklistPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();

  const isHrOrAdmin =
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  // Mode: 'manage' (for HR/Admin) or 'my' (for employees or HR viewing own)
  const [viewMode, setViewMode] = useState(isHrOrAdmin ? 'manage' : 'my');

  // HR/Admin Management State
  const [allChecklists, setAllChecklists] = useState([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);

  // Employee Self-Service State
  const [myChecklist, setMyChecklist] = useState(null);
  const [isLoadingMy, setIsLoadingMy] = useState(false);

  // Load employee's own checklist
  const fetchMyChecklist = async () => {
    try {
      setIsLoadingMy(true);
      const res = await exitService.getMyExitChecklist();
      setMyChecklist(res?.checklist || null);
    } catch (err) {
      setMyChecklist(null);
    } finally {
      setIsLoadingMy(false);
    }
  };

  // Load all checklists (HR & Admin only)
  const fetchAllChecklists = async () => {
    if (!isHrOrAdmin) return;
    try {
      setIsLoadingAll(true);
      const res = await exitService.getAllExitChecklists({ limit: 100 });
      const items = Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [];
      setAllChecklists(items);

      if (items.length > 0) {
        // Keep current selected if still present, else pick first
        const currentStillExists = items.some((c) => c.id === selectedChecklistId);
        if (!selectedChecklistId || !currentStillExists) {
          setSelectedChecklistId(items[0].id);
          setSelectedChecklist(items[0]);
        } else {
          const fresh = items.find((c) => c.id === selectedChecklistId);
          setSelectedChecklist(fresh || items[0]);
        }
      } else {
        setSelectedChecklistId('');
        setSelectedChecklist(null);
      }
    } catch (err) {
      toast.error('Failed to load exit checklists.');
    } finally {
      setIsLoadingAll(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    if (isHrOrAdmin) {
      fetchAllChecklists();
      fetchMyChecklist();
    } else {
      fetchMyChecklist();
    }
  }, [isHrOrAdmin]);

  // Sync selected checklist details when ID changes
  useEffect(() => {
    if (selectedChecklistId && allChecklists.length > 0) {
      const found = allChecklists.find((c) => c.id === selectedChecklistId);
      if (found) setSelectedChecklist(found);
    }
  }, [selectedChecklistId, allChecklists]);

  // Filtered checklists for HR management
  const filteredChecklists = allChecklists.filter((chk) => {
    if (statusFilter !== 'ALL' && chk.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (chk.employeeName || '').toLowerCase();
      const code = (chk.employeeCode || '').toLowerCase();
      const dept = (chk.department || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center shadow-sm">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Exit Checklist
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isHrOrAdmin
                  ? 'Manage and track the 5 mandatory exit checklist items for departing employees.'
                  : 'View the progress of your mandatory exit formalities and checklist items.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            icon={RefreshCw}
            size="sm"
            onClick={() => {
              if (viewMode === 'my') fetchMyChecklist();
              else fetchAllChecklists();
            }}
          >
            Refresh
          </Button>

          {isHrOrAdmin && (
            <Button
              variant="primary"
              icon={Plus}
              size="sm"
              onClick={() => setIsInitiateModalOpen(true)}
            >
              Initiate Exit Process
            </Button>
          )}
        </div>
      </div>

      {/* Tabs for HR / Admin (Manage All vs My Checklist) */}
      {isHrOrAdmin && (
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setViewMode('manage')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              viewMode === 'manage'
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Manage All Exit Checklists ({allChecklists.length})
          </button>

          <button
            onClick={() => setViewMode('my')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              viewMode === 'my'
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            My Exit Checklist {myChecklist ? '(Active)' : ''}
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. EMPLOYEE VIEW: Self-service View-Only Checklist                  */}
      {/* =================================================================== */}
      {viewMode === 'my' && (
        <div className="space-y-6">
          {isLoadingMy ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 shadow-sm">
              <LoadingSpinner message="Loading your exit checklist details..." />
            </div>
          ) : myChecklist ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
                <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Employee Portal:</strong> This is your official exit checklist. You can view
                  the status of each item as HR and department leads complete clearances.
                </span>
              </div>

              <ExitChecklistDetailCard
                checklist={myChecklist}
                canManage={false}
                onRefresh={fetchMyChecklist}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center max-w-xl mx-auto shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <FileCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Active Exit Checklist
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Your exit process has not been initiated. Exit checklists are created by HR or Admin
                  when a resignation or separation is officially processed.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. HR / ADMIN VIEW: Manage All Employees Exit Checklists             */}
      {/* =================================================================== */}
      {viewMode === 'manage' && isHrOrAdmin && (
        <div className="space-y-6">
          {isLoadingAll ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 shadow-sm">
              <LoadingSpinner message="Loading organization exit checklists..." />
            </div>
          ) : allChecklists.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                <ClipboardList className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Exit Checklists Found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  There are currently no active or completed exit checklists in the system. Click
                  below to initiate an exit process for an employee.
                </p>
              </div>
              <Button
                variant="primary"
                icon={Plus}
                size="sm"
                onClick={() => setIsInitiateModalOpen(true)}
              >
                Initiate Exit Process
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Selector & Filter (4 cols) */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Exiting Employees ({filteredChecklists.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-brand-600 p-0 h-auto font-semibold"
                    onClick={() => setIsInitiateModalOpen(true)}
                  >
                    + New Exit
                  </Button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, code, dept..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs">
                  {['ALL', 'In Progress', 'Completed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`flex-1 py-1 px-2 rounded-lg font-medium transition-all ${
                        statusFilter === st
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {st === 'ALL' ? 'All' : st}
                    </button>
                  ))}
                </div>

                {/* Employee List */}
                <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                  {filteredChecklists.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No matching exit checklists found.
                    </div>
                  ) : (
                    filteredChecklists.map((chk) => {
                      const isSelected = chk.id === selectedChecklistId;
                      const completedCount = chk.completedItemsCount || 0;
                      const totalCount = chk.totalItems || 5;

                      return (
                        <button
                          key={chk.id}
                          onClick={() => setSelectedChecklistId(chk.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-500/60 shadow-xs ring-1 ring-brand-500/30'
                              : 'bg-white dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {chk.employeeName}
                            </span>
                            <Badge
                              variant={chk.status === 'Completed' ? 'success' : 'brand'}
                              size="sm"
                            >
                              {chk.status}
                            </Badge>
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-between">
                            <span>{chk.employeeCode || 'EMP'}</span>
                            <span>{chk.department || 'Staff'}</span>
                          </div>

                          {/* Progress bar preview */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  chk.status === 'Completed' ? 'bg-emerald-500' : 'bg-brand-500'
                                }`}
                                style={{
                                  width: `${Math.round((completedCount / totalCount) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {completedCount}/{totalCount}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Selected Checklist Detail Card (8 cols) */}
              <div className="lg:col-span-8">
                {selectedChecklist ? (
                  <ExitChecklistDetailCard
                    checklist={selectedChecklist}
                    canManage={true}
                    onRefresh={fetchAllChecklists}
                  />
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-sm text-slate-400 text-xs">
                    Select an employee from the left list to view and manage their exit checklist.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initiate Exit Process Modal (HR & Admin) */}
      {isInitiateModalOpen && (
        <InitiateExitModal
          isOpen={isInitiateModalOpen}
          onClose={() => setIsInitiateModalOpen(false)}
          onSuccess={() => {
            fetchAllChecklists();
            setViewMode('manage');
          }}
        />
      )}
    </div>
  );
};

export default ExitChecklistPage;
