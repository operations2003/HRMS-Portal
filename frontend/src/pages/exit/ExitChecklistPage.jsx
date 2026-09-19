import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Plus,
  Shield,
  User,
  Building2,
  Calendar,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { exitService } from '../../services/exitService.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ClearanceChecklistTable } from '../../components/exit/ClearanceChecklistTable.jsx';
import { AddClearanceTaskModal } from '../../components/exit/AddClearanceTaskModal.jsx';

export const ExitChecklistPage = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();

  const isHrOrAdmin =
    hasRole('HR') ||
    hasRole('HRManager') ||
    hasRole('Admin') ||
    hasRole('SuperAdmin') ||
    hasRole('OrgAdmin');

  const isManager = hasRole('Manager') || isHrOrAdmin;
  const canUpdateClearance = isManager || hasPermission('exit:write') || hasPermission('exit:admin');

  // Mode: 'my' | 'manage'
  const [viewMode, setViewMode] = useState('my');

  // Employee's own exit state
  const [myExit, setMyExit] = useState(null);
  const [myClearances, setMyClearances] = useState([]);
  const [isLoadingMy, setIsLoadingMy] = useState(true);

  // Management state (For HR / Managers)
  const [allExits, setAllExits] = useState([]);
  const [selectedExitId, setSelectedExitId] = useState('');
  const [selectedExit, setSelectedExit] = useState(null);
  const [selectedClearances, setSelectedClearances] = useState([]);
  const [isLoadingManage, setIsLoadingManage] = useState(false);

  // Modals
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const fetchMyExit = async () => {
    try {
      setIsLoadingMy(true);
      const data = await exitService.getMyExit();
      setMyExit(data);
      if (data?.id) {
        const clRes = await exitService.getClearances(data.id);
        setMyClearances(Array.isArray(clRes) ? clRes : clRes.clearances || []);
      }
    } catch {
      setMyExit(null);
      setMyClearances([]);
    } finally {
      setIsLoadingMy(false);
    }
  };

  const fetchManageableExits = async () => {
    if (!isManager) return;
    try {
      setIsLoadingManage(true);
      const res = await exitService.getAllExits({ limit: 50 });
      const items = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      // Prioritize exits that are in progress / clearance stage
      const activeExits = items.filter((e) =>
        ['APPROVED', 'NOTICE_PERIOD', 'CLEARANCE_IN_PROGRESS', 'EXIT_PROCESSING', 'SUBMITTED', 'UNDER_REVIEW'].includes(
          e.status
        )
      );
      setAllExits(activeExits.length > 0 ? activeExits : items);
      if (activeExits[0]?.id && !selectedExitId) {
        setSelectedExitId(activeExits[0].id);
      }
    } catch (err) {
      toast.error('Failed to load active exits for clearance management.');
    } finally {
      setIsLoadingManage(false);
    }
  };

  const fetchSelectedClearances = async (exitId) => {
    if (!exitId) return;
    try {
      setIsLoadingManage(true);
      const [dossier, clRes] = await Promise.all([
        exitService.getExitById(exitId),
        exitService.getClearances(exitId),
      ]);
      setSelectedExit(dossier);
      setSelectedClearances(Array.isArray(clRes) ? clRes : clRes.clearances || []);
    } catch (err) {
      toast.error('Failed to fetch clearance tasks for selected exit.');
    } finally {
      setIsLoadingManage(false);
    }
  };

  useEffect(() => {
    fetchMyExit();
    if (isManager) {
      fetchManageableExits();
    }
  }, [isManager]);

  useEffect(() => {
    if (selectedExitId) {
      fetchSelectedClearances(selectedExitId);
    }
  }, [selectedExitId]);

  const displayedClearances = viewMode === 'my' ? myClearances : selectedClearances;
  const targetExit = viewMode === 'my' ? myExit : selectedExit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Exit & Clearance Checklist</h1>
          <p className="text-xs text-slate-500 mt-1">
            Departmental sign-offs, manager handover, asset returns, IT revocations, and finance settlements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            size="sm"
            onClick={() => {
              if (viewMode === 'my') fetchMyExit();
              else if (selectedExitId) fetchSelectedClearances(selectedExitId);
            }}
          >
            Refresh
          </Button>

          {canUpdateClearance && viewMode === 'manage' && selectedExitId && (
            <Button
              variant="primary"
              icon={Plus}
              size="sm"
              onClick={() => setIsAddTaskOpen(true)}
            >
              Add Clearance Task
            </Button>
          )}
        </div>
      </div>

      {/* View Switcher for Managers / HR */}
      {isManager && (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setViewMode('my')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              viewMode === 'my'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            My Exit Checklist {myExit ? `(${myClearances.length})` : ''}
          </button>

          <button
            onClick={() => setViewMode('manage')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              viewMode === 'manage'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Manage Departmental Clearances ({allExits.length})
          </button>
        </div>
      )}

      {/* Employee Own View */}
      {viewMode === 'my' && (
        <div className="space-y-6">
          {isLoadingMy ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
              <LoadingSpinner message="Loading your departmental clearance items..." />
            </div>
          ) : myExit ? (
            <ClearanceChecklistTable
              clearances={myClearances}
              dueDateFallback={myExit.approvedLastWorkingDay || myExit.requestedLastWorkingDay}
              canManage={false}
              onTaskUpdated={fetchMyExit}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center max-w-xl mx-auto shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <FileCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">No Active Clearance Checklist</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Clearance checklists are automatically initialized once a resignation is approved by HR. You
                  currently have no active separation process.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manager / HR Management View */}
      {viewMode === 'manage' && isManager && (
        <div className="space-y-6">
          {/* Employee Exit Selector Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Exiting Employee to Review Clearances:
              </label>
              <select
                value={selectedExitId}
                onChange={(e) => setSelectedExitId(e.target.value)}
                className="w-full sm:w-96 px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-900"
              >
                {allExits.map((e) => {
                  const empName =
                    e.employee?.fullName || `${e.employee?.firstName || ''} ${e.employee?.lastName || ''}`.trim() || e.employeeName;
                  return (
                    <option key={e.id} value={e.id}>
                      {empName} ({e.employee?.empCode || 'EMP'}) — LWD: {e.approvedLastWorkingDay || e.requestedLastWorkingDay || 'Pending'} [{e.status}]
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedExit && (
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="brand" size="sm">
                  Status: {selectedExit.status}
                </Badge>
                <Badge variant="neutral" size="sm">
                  Stage: {selectedExit.currentStage || 'CLEARANCE'}
                </Badge>
              </div>
            )}
          </div>

          {isLoadingManage ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
              <LoadingSpinner message="Loading departmental clearance checklist for selected employee..." />
            </div>
          ) : selectedExitId ? (
            <ClearanceChecklistTable
              clearances={selectedClearances}
              dueDateFallback={selectedExit?.approvedLastWorkingDay || selectedExit?.requestedLastWorkingDay}
              canManage={canUpdateClearance}
              onTaskUpdated={() => fetchSelectedClearances(selectedExitId)}
              onOpenAddTask={() => setIsAddTaskOpen(true)}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
              <EmptyState
                icon={FileCheck}
                title="No Exit Records in Progress"
                description="There are currently no employees undergoing exit clearance."
              />
            </div>
          )}
        </div>
      )}

      {/* Add Clearance Task Modal */}
      {isAddTaskOpen && selectedExitId && (
        <AddClearanceTaskModal
          isOpen={isAddTaskOpen}
          onClose={() => setIsAddTaskOpen(false)}
          onSuccess={() => fetchSelectedClearances(selectedExitId)}
          exitRequestId={selectedExitId}
        />
      )}
    </div>
  );
};
