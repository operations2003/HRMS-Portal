import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BarChart3,
  Download,
  UserPlus,
  CheckCircle2,
  Clock,
  AlertCircle,
  GraduationCap,
  Filter,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export const CourseProgressModal = ({
  isOpen,
  onClose,
  course,
  progressData,
  loading,
  onAssignCourse,
  onUpdateProgress,
}) => {
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Extract unique departments from progress data for filter
  const departments = useMemo(() => {
    if (!progressData?.employees) return [];
    const depts = new Set();
    progressData.employees.forEach((emp) => {
      const name = emp.departmentName || emp.department_name;
      if (name) depts.add(name);
    });
    return Array.from(depts).sort();
  }, [progressData]);

  // Normalized summary stats
  const stats = useMemo(() => {
    const raw = progressData?.stats || progressData?.summary || {};
    return {
      totalEmployees: raw.totalEmployees || progressData?.employees?.length || 0,
      enrolledCount: raw.enrolledCount !== undefined ? raw.enrolledCount : (raw.totalEmployees || 0) - (raw.notEnrolledCount || 0),
      completedCount: raw.completedCount || 0,
      inProgressCount: raw.inProgressCount || 0,
      enrolledNotStartedCount: raw.enrolledNotStartedCount || raw.enrolledCount || 0,
      notEnrolledCount: raw.notEnrolledCount || 0,
      completionRate: raw.completionRate || 0,
    };
  }, [progressData]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!progressData?.employees) return [];
    return progressData.employees.filter((emp) => {
      const empStatus = emp.completionStatus || emp.progress_status || emp.status || 'NOT_ENROLLED';
      const matchesStatus = statusFilter === 'ALL' || empStatus === statusFilter;

      const empDept = emp.departmentName || emp.department_name || '';
      const matchesDept = deptFilter === 'ALL' || empDept === deptFilter;

      const term = searchQuery.toLowerCase().trim();
      const firstName = emp.firstName || emp.first_name || '';
      const lastName = emp.lastName || emp.last_name || '';
      const fullName = `${firstName} ${lastName}`.toLowerCase();
      const code = (emp.employeeCode || emp.employee_code || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const desig = (emp.designationTitle || emp.designation_name || '').toLowerCase();

      const matchesSearch =
        !term ||
        fullName.includes(term) ||
        code.includes(term) ||
        email.includes(term) ||
        empDept.toLowerCase().includes(term) ||
        desig.includes(term);

      return matchesStatus && matchesDept && matchesSearch;
    });
  }, [progressData, statusFilter, deptFilter, searchQuery]);

  // Export CSV
  const handleExportCsv = () => {
    if (!progressData?.employees || !course) return;

    const rows = filteredEmployees.map((emp) => [
      `"${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}"`,
      `"${emp.employeeCode || emp.employee_code || ''}"`,
      `"${emp.email || ''}"`,
      `"${emp.departmentName || emp.department_name || '-'}"`,
      `"${emp.designationTitle || emp.designation_name || '-'}"`,
      `"${emp.completionStatus || emp.progress_status || 'NOT_ENROLLED'}"`,
      `"${emp.progressPercentage ?? emp.progress_percentage ?? 0}%"`,
      `"${emp.enrollmentType || emp.enrollment_type || '-'}"`,
      `"${emp.completionDate || emp.completion_date || '-'}"`,
    ]);

    const header = [
      'Employee Name',
      'Employee Code',
      'Email',
      'Department',
      'Designation',
      'Progress Status',
      'Completion %',
      'Enrollment Type',
      'Completion Date',
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Training_Progress_${(course.title || 'Course').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Course progress report exported to CSV.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/90 via-white to-indigo-50/50">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Course Progress Tracker: {course?.title}
              </h3>
              <Badge variant={course?.is_mandatory ? 'danger' : 'info'}>
                {course?.is_mandatory ? 'Mandatory' : 'Optional'}
              </Badge>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {course?.category}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live completion analytics, enrollment tracking, and employee-level audit matrix
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleExportCsv}
              disabled={loading || !progressData?.employees?.length}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              icon={UserPlus}
              onClick={() => onAssignCourse(course)}
            >
              Assign Course
            </Button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16">
              <LoadingSpinner message="Calculating course completion statistics..." />
            </div>
          ) : progressData ? (
            <>
              {/* Summary KPI Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Staff</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-slate-800">{stats.totalEmployees}</span>
                    <span className="text-[11px] text-slate-400">active</span>
                  </div>
                </div>

                <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Completed</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-emerald-700">{stats.completedCount}</span>
                    <span className="text-xs font-bold text-emerald-600">({stats.completionRate}%)</span>
                  </div>
                </div>

                <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">In Progress</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-blue-700">{stats.inProgressCount}</span>
                    <span className="text-[11px] text-blue-500">learning</span>
                  </div>
                </div>

                <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Enrolled, Not Started</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-amber-700">{stats.enrolledNotStartedCount}</span>
                    <span className="text-[11px] text-amber-600">pending</span>
                  </div>
                </div>

                <div className="bg-rose-50/80 p-3.5 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Not Enrolled</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-rose-700">{stats.notEnrolledCount}</span>
                    <span className="text-[11px] text-rose-500">unassigned</span>
                  </div>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, code, dept, designation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="ALL">All Statuses ({progressData.employees?.length || 0})</option>
                    <option value="COMPLETED">Completed ({stats.completedCount})</option>
                    <option value="IN_PROGRESS">In Progress ({stats.inProgressCount})</option>
                    <option value="ENROLLED">Enrolled, Not Started ({stats.enrolledNotStartedCount})</option>
                    <option value="NOT_ENROLLED">Not Enrolled ({stats.notEnrolledCount})</option>
                  </select>
                </div>
              </div>

              {/* Employees Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Designation</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Progress</th>
                      <th className="p-3">Completed On</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => {
                      const empStatus = emp.completionStatus || emp.progress_status || emp.status || 'NOT_ENROLLED';
                      const pct = emp.progressPercentage ?? emp.progress_percentage ?? 0;
                      const completedDate = emp.completionDate || emp.completion_date || emp.completedAt;
                      const empId = emp.employeeId || emp.employee_id;
                      const enrId = emp.enrollmentId || emp.enrollment_id;
                      const fullName = `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim() || 'Employee';

                      return (
                        <tr key={empId} className="hover:bg-slate-50/80 transition">
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block leading-snug">
                              {fullName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {emp.employeeCode || emp.employee_code} • {emp.email}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {emp.departmentName || emp.department_name || '-'}
                          </td>
                          <td className="p-3 text-slate-500">
                            {emp.designationTitle || emp.designation_name || '-'}
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {emp.enrollmentType || emp.enrollment_type || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                empStatus === 'COMPLETED'
                                  ? 'success'
                                  : empStatus === 'IN_PROGRESS'
                                  ? 'info'
                                  : empStatus === 'ENROLLED'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            >
                              {empStatus === 'NOT_ENROLLED' ? 'NOT ENROLLED' : empStatus}
                            </Badge>
                          </td>
                          <td className="p-3 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    empStatus === 'COMPLETED'
                                      ? 'bg-emerald-500'
                                      : empStatus === 'IN_PROGRESS'
                                      ? 'bg-indigo-600'
                                      : 'bg-slate-300'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-600 min-w-[28px]">
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {completedDate ? new Date(completedDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="p-3 text-right">
                            {empStatus === 'NOT_ENROLLED' ? (
                              <button
                                onClick={() => onAssignCourse(course, empId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                                title="Assign this course to this employee"
                              >
                                <UserPlus className="w-3 h-3" />
                                Assign
                              </button>
                            ) : empStatus !== 'COMPLETED' ? (
                              <div className="inline-flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => onUpdateProgress(enrId, pct)}
                                  className="px-2 py-0.5 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded"
                                  title="Add +25% progress"
                                >
                                  +25%
                                </button>
                                <button
                                  onClick={() => onUpdateProgress(enrId, pct, 100)}
                                  className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded flex items-center gap-0.5"
                                  title="Mark 100% Completed"
                                >
                                  <Check className="w-3 h-3" /> Complete
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 justify-end">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Done
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan="8" className="py-12 text-center text-slate-400 text-xs">
                          No employees found matching filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <span className="text-xs text-slate-500">
            Showing <strong>{filteredEmployees.length}</strong> of{' '}
            <strong>{progressData?.employees?.length || 0}</strong> staff members
          </span>

          <Button variant="neutral" onClick={onClose}>
            Close Tracker
          </Button>
        </div>
      </div>
    </div>
  );
};
