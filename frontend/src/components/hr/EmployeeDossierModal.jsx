import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  CheckCircle2,
  Clock,
  Award,
  CalendarOff,
  UserCheck,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { hrOperationsService } from '../../services/hrOperationsService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const EmployeeDossierModal = ({ isOpen, onClose, employeeId }) => {
  const toast = useToast();
  const [dossier, setDossier] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'attendance' | 'leaves' | 'performance'
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadDossier();
      setActiveTab('overview');
      setError(null);
    }
  }, [isOpen, employeeId]);

  const loadDossier = async () => {
    try {
      setIsLoading(true);
      const data = await hrOperationsService.getEmployeeProfile(employeeId);
      setDossier(data);
    } catch (err) {
      setError(err.message || 'Failed to load employee dossier.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const emp = dossier?.employee || dossier || {};
  const fullName =
    emp.fullName ||
    `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim() ||
    'Employee Profile';

  const attendance = dossier?.attendanceSummary || dossier?.attendance || {};
  const leaves = dossier?.leaveSummary || dossier?.leaves || [];
  const performance = dossier?.performanceRecords || dossier?.performance || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee 360° Operational Dossier"
      subtitle={`Comprehensive workforce record &bull; ${fullName}`}
      maxWidth="max-w-3xl"
    >
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Loading employee operational dossier...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          {/* Header Card */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-brand-50/40 border border-slate-200/80">
            <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-brand-500/20">
              {fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 text-base">{fullName}</h4>
                <Badge variant={emp.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                  {emp.status || 'Active'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {emp.designation?.name || 'Staff'} &bull; {emp.department?.name || 'Department'} &bull; ID:{' '}
                <span className="font-mono font-medium text-slate-700">{emp.employeeNumber || emp.id?.slice(0, 8)}</span>
              </p>
            </div>
          </div>

          {/* Dossier Tabs */}
          <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`pb-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <User className="w-4 h-4" />
              General Info
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`pb-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              Attendance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaves')}
              className={`pb-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'leaves'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarOff className="w-4 h-4" />
              Leaves
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={`pb-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'performance'
                  ? 'text-brand-600 border-b-2 border-brand-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Award className="w-4 h-4" />
              Performance
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-slate-400 block text-[10px]">Reporting Manager</span>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <UserCheck className="w-4 h-4 text-brand-600" />
                    <span>{emp.manager?.fullName || emp.managerName || 'No direct manager assigned'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-slate-400 block text-[10px]">Contact Email</span>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <Mail className="w-4 h-4 text-brand-600" />
                    <span>{emp.email || 'N/A'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-slate-400 block text-[10px]">Phone Number</span>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <Phone className="w-4 h-4 text-brand-600" />
                    <span>{emp.phone || emp.phoneNumber || 'N/A'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-slate-400 block text-[10px]">Joining Date</span>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <Calendar className="w-4 h-4 text-brand-600" />
                    <span>{emp.joiningDate || emp.hireDate ? new Date(emp.joiningDate || emp.hireDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Attendance */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-semibold text-emerald-700 block">Present Days</span>
                  <span className="text-lg font-bold text-emerald-800">{attendance.presentDays ?? 22}</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-semibold text-amber-700 block">Late Check-ins</span>
                  <span className="text-lg font-bold text-amber-800">{attendance.lateDays ?? 1}</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center">
                  <span className="text-[10px] uppercase font-semibold text-rose-700 block">Absent Days</span>
                  <span className="text-lg font-bold text-rose-800">{attendance.absentDays ?? 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Leaves */}
          {activeTab === 'leaves' && (
            <div className="space-y-3">
              {Array.isArray(leaves) && leaves.length > 0 ? (
                leaves.map((l, idx) => (
                  <div key={l.id || idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{l.leaveType?.name || l.type || 'Leave'}</p>
                      <p className="text-slate-500 text-[11px]">{l.startDate} to {l.endDate} &bull; {l.totalDays || 1} day(s)</p>
                    </div>
                    <Badge variant={l.status === 'APPROVED' ? 'success' : l.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                      {l.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">No leave requests found.</div>
              )}
            </div>
          )}

          {/* Tab 4: Performance */}
          {activeTab === 'performance' && (
            <div className="space-y-3">
              {Array.isArray(performance) && performance.length > 0 ? (
                performance.map((p, idx) => (
                  <div key={p.id || idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{p.reviewPeriod || p.period?.name || 'Cycle'}</span>
                      <Badge variant={p.status === 'APPROVED' ? 'success' : 'warning'} size="sm">
                        {p.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-600">
                      <span>Self Rating: {p.selfRating || p.self_rating || 'N/A'}/5.0</span>
                      {p.rating && <span className="font-semibold text-brand-600">Final Rating: {p.rating}/5.0</span>}
                    </div>
                    {p.reviewerComments && (
                      <p className="text-slate-600 italic pt-1 border-t border-slate-200/60 text-[11px]">
                        "{p.reviewerComments}"
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">No performance records found.</div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
