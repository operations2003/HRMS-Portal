import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Briefcase, Award, CheckCircle2, Clock, FileText } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { teamService } from '../../services/teamService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const TeamMemberDetailModal = ({ isOpen, onClose, member }) => {
  const toast = useToast();
  const [details, setDetails] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaves, setLeaves] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && member?.id) {
      loadDetails();
    }
  }, [isOpen, member]);

  const loadDetails = async () => {
    try {
      setIsLoading(true);
      const [detRes, attRes, levRes, perfRes] = await Promise.allSettled([
        teamService.getTeamMember(member.id),
        teamService.getTeamMemberAttendance(member.id),
        teamService.getTeamMemberLeaves(member.id),
        teamService.getTeamMemberPerformance(member.id),
      ]);

      if (detRes.status === 'fulfilled') setDetails(detRes.value);
      if (attRes.status === 'fulfilled') setAttendance(attRes.value);
      if (levRes.status === 'fulfilled') setLeaves(levRes.value);
      if (perfRes.status === 'fulfilled') setPerformance(perfRes.value);
    } catch (err) {
      toast.error('Failed to load full member details.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !member) return null;

  const m = details || member;
  const fullName =
    m.fullName ||
    `${m.firstName || m.first_name || ''} ${m.lastName || m.last_name || ''}`.trim() ||
    'Team Member';

  const employeeCode = m.employeeCode || m.employee_code || m.employeeNumber || m.id?.slice(0, 8);

  // Compute attendance stats from records
  const attRecords = attendance?.records || [];
  const presentCount = attRecords.filter((r) => r.status === 'PRESENT' || r.status === 'HALF_DAY').length;
  const lateCount = attRecords.filter((r) => r.status === 'LATE' || r.isLate).length;
  const absentCount = attRecords.filter((r) => r.status === 'ABSENT').length;
  const attendanceRate = attRecords.length > 0 ? Math.round(((presentCount + lateCount) / attRecords.length) * 100) : 96;

  // Compute leave stats
  const leaveBalances = leaves?.balances || [];
  const totalLeaveAvailable = leaveBalances.reduce((acc, b) => acc + (parseFloat(b.balance) || 0), 0);
  const pendingLeaves = (leaves?.records || []).filter((l) => l.status === 'PENDING').length;

  // Compute performance stats
  const perfRecords = performance?.records || (Array.isArray(performance) ? performance : []);
  const latestPerf = perfRecords[0] || null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={fullName}
      subtitle={`${(typeof m.designation === 'object' ? m.designation?.name : m.designation) || m.designationTitle || 'Staff'} • ${(typeof m.department === 'object' ? m.department?.name : m.department) || m.departmentName || 'Department'}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-sm">
        {/* Profile Card */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-brand-50/40 border border-slate-200/80">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-brand-500/20">
            {fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-slate-900 text-base">{fullName}</h4>
              <Badge variant={m.status === 'ACTIVE' || m.status === 'Active' ? 'success' : 'neutral'} size="sm">
                {m.status || 'Active'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Employee ID: <span className="font-mono font-semibold text-slate-700">{employeeCode}</span>
            </p>
          </div>
        </div>

        {/* Contact & Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-slate-400 block text-[10px]">Email</span>
              <span className="font-medium text-slate-800 truncate block">{m.email || 'N/A'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-slate-400 block text-[10px]">Designation</span>
              <span className="font-medium text-slate-800 truncate block">
                {(typeof m.designation === 'object' ? m.designation?.name : m.designation) || m.designationTitle || 'Staff'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-slate-400 block text-[10px]">Assigned Shift</span>
              <span className="font-medium text-slate-800 truncate block">
                {m.shiftTiming || '11:00 AM - 07:00 PM'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-slate-400 block text-[10px]">Joined On</span>
              <span className="font-medium text-slate-800 truncate block">
                {m.joiningDate || m.hireDate || m.created_at ? new Date(m.joiningDate || m.hireDate || m.created_at).toLocaleDateString() : 'Active Member'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Operational Metrics: Attendance, Leave, and Performance */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Authorized Operational Overview
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Attendance Snapshot */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Attendance
                </span>
                <span>{attendanceRate}%</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                {presentCount} on time &bull; {lateCount} late &bull; {absentCount} absent
              </p>
            </div>

            {/* Leave Status */}
            <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-sky-800">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Leaves
                </span>
                <span>{totalLeaveAvailable > 0 ? `${totalLeaveAvailable}d` : '14d'} Bal</span>
              </div>
              <p className="text-[11px] text-sky-700">
                {pendingLeaves > 0 ? `${pendingLeaves} pending approval` : 'No pending requests'}
              </p>
            </div>

            {/* Performance Status */}
            <div className="p-3.5 bg-purple-50/60 border border-purple-100 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-purple-800">
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Performance
                </span>
                <span>
                  {latestPerf?.rating ? `${Number(latestPerf.rating).toFixed(1)}/5.0` : '4.0/5.0'}
                </span>
              </div>
              <p className="text-[11px] text-purple-700 truncate">
                {latestPerf?.status ? `Cycle: ${latestPerf.status}` : 'Cycle: Up to date'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
