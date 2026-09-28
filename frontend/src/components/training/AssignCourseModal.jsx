import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  UserPlus,
  Users,
  Building2,
  Globe,
  Search,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { trainingService } from '../../services/trainingService.js';
import { employeeService } from '../../services/employeeService.js';
import { departmentService } from '../../services/departmentService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';

export const AssignCourseModal = ({
  isOpen,
  onClose,
  course,
  courses = [],
  preselectedEmployeeId = null,
  onAssignmentSuccess,
}) => {
  const toast = useToast();

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [targetMode, setTargetMode] = useState('EMPLOYEES'); // 'EMPLOYEES' | 'DEPARTMENT' | 'ALL'
  const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [enrollmentType, setEnrollmentType] = useState('MANDATORY');
  const [notes, setNotes] = useState('');

  // Data
  const [allEmployees, setAllEmployees] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters for employee selection
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Existing enrollments for the selected course to mark already enrolled employees
  const [existingEnrolledEmpIds, setExistingEnrolledEmpIds] = useState(new Set());

  // Initialize selected course
  useEffect(() => {
    if (course?.id) {
      setSelectedCourseId(course.id);
    } else if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [course, courses, selectedCourseId]);

  // Set default enrollment type based on course
  useEffect(() => {
    const activeCourse = course || courses.find((c) => c.id === selectedCourseId);
    if (activeCourse?.is_mandatory) {
      setEnrollmentType('MANDATORY');
    }
  }, [course, selectedCourseId, courses]);

  // Reset or initialize preselected employee
  useEffect(() => {
    if (preselectedEmployeeId) {
      setSelectedEmpIds(new Set([preselectedEmployeeId]));
    } else {
      setSelectedEmpIds(new Set());
    }
  }, [preselectedEmployeeId, isOpen]);

  // Load active employees and departments
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchMetadata = async () => {
      setLoadingOptions(true);
      try {
        const [empRes, deptRes] = await Promise.all([
          employeeService.getAllEmployees({ status: 'Active' }),
          departmentService.getAllDepartments(),
        ]);
        if (isMounted) {
          const emps = empRes.employees || empRes.data || (Array.isArray(empRes) ? empRes : []);
          setAllEmployees(emps);
          setAllDepartments(Array.isArray(deptRes) ? deptRes : []);
        }
      } catch (err) {
        console.error('Failed to load employee list for assignment:', err);
      } finally {
        if (isMounted) setLoadingOptions(false);
      }
    };

    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Load existing enrollments for the selected course to tag them in UI
  useEffect(() => {
    if (!isOpen || !selectedCourseId) return;

    let isMounted = true;
    const fetchEnrollments = async () => {
      try {
        const res = await trainingService.getEnrollments({ courseId: selectedCourseId });
        if (isMounted && res.data) {
          const ids = new Set(res.data.map((enr) => enr.employee_id || enr.employeeId));
          setExistingEnrolledEmpIds(ids);
        }
      } catch (err) {
        console.warn('Could not check existing course enrollments', err);
      }
    };

    fetchEnrollments();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedCourseId]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return allEmployees.filter((emp) => {
      const matchesDept = deptFilter === 'ALL' || emp.deptId === deptFilter || emp.dept_id === deptFilter;
      const term = searchQuery.toLowerCase().trim();
      const fullName = `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.toLowerCase();
      const code = (emp.employeeCode || emp.employee_code || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const matchesSearch = !term || fullName.includes(term) || code.includes(term) || email.includes(term);
      return matchesDept && matchesSearch;
    });
  }, [allEmployees, deptFilter, searchQuery]);

  // Toggle single employee selection
  const handleToggleEmployee = (empId) => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  // Toggle Select All Filtered
  const areAllFilteredSelected = useMemo(() => {
    if (filteredEmployees.length === 0) return false;
    return filteredEmployees.every((emp) => selectedEmpIds.has(emp.id));
  }, [filteredEmployees, selectedEmpIds]);

  const handleToggleSelectAllFiltered = () => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (areAllFilteredSelected) {
        filteredEmployees.forEach((emp) => next.delete(emp.id));
      } else {
        filteredEmployees.forEach((emp) => next.add(emp.id));
      }
      return next;
    });
  };

  // Target count calculation
  const calculatedTargetCount = useMemo(() => {
    if (targetMode === 'ALL') {
      return allEmployees.length;
    }
    if (targetMode === 'DEPARTMENT') {
      if (!selectedDeptId) return 0;
      return allEmployees.filter((e) => e.deptId === selectedDeptId || e.dept_id === selectedDeptId).length;
    }
    return selectedEmpIds.size;
  }, [targetMode, allEmployees, selectedDeptId, selectedEmpIds]);

  // Active target course details
  const currentCourse = useMemo(() => {
    return course || courses.find((c) => c.id === selectedCourseId);
  }, [course, courses, selectedCourseId]);

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      toast.error('Please select a course to assign.');
      return;
    }

    if (targetMode === 'EMPLOYEES' && selectedEmpIds.size === 0) {
      toast.error('Please select at least one employee to assign.');
      return;
    }

    if (targetMode === 'DEPARTMENT' && !selectedDeptId) {
      toast.error('Please select a department for assignment.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        courseId: selectedCourseId,
        enrollmentType,
        notes: notes.trim() || undefined,
      };

      if (targetMode === 'ALL') {
        payload.targetAll = true;
      } else if (targetMode === 'DEPARTMENT') {
        payload.departmentId = selectedDeptId;
      } else {
        payload.employeeIds = Array.from(selectedEmpIds);
      }

      const res = await trainingService.assignCourse(selectedCourseId, payload);
      toast.success(res.message || `Course successfully assigned to ${calculatedTargetCount} employee(s)!`);
      if (onAssignmentSuccess) {
        onAssignmentSuccess(res);
      }
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to assign course.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-white to-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Assign Training Course
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full border border-indigo-200">
                  L&D Authority
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign courses to specific staff, departments, or company-wide with progress monitoring
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Course Selection (or displayed if locked) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Course To Assign *
            </label>
            {course ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{course.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {course.description || 'Curated workplace training module'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge variant={course.is_mandatory ? 'danger' : 'info'}>
                    {course.is_mandatory ? 'Mandatory' : 'Optional'}
                  </Badge>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                    {course.category}
                  </span>
                </div>
              </div>
            ) : (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="" disabled>
                  Select a training course...
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.category}) — {c.is_mandatory ? 'Mandatory' : 'Optional'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Assignment Mode Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Assignment Target
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTargetMode('EMPLOYEES')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  targetMode === 'EMPLOYEES'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Specific Staff
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('DEPARTMENT')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  targetMode === 'DEPARTMENT'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                By Department
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('ALL')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  targetMode === 'ALL'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                All Company Staff
              </button>
            </div>
          </div>

          {/* Mode 1: Specific Employees Picker */}
          {targetMode === 'EMPLOYEES' && (
            <div className="space-y-3 p-4 bg-slate-50/70 border border-slate-200 rounded-xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search employee by name, code, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Departments</option>
                    {allDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleToggleSelectAllFiltered}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap shadow-2xs transition"
                  >
                    {areAllFilteredSelected ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                        Deselect ({filteredEmployees.length})
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                        Select All ({filteredEmployees.length})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Employee selection count badge */}
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                <span>
                  Showing {filteredEmployees.length} of {allEmployees.length} active employees
                </span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {selectedEmpIds.size} Selected
                </span>
              </div>

              {/* Scrollable employee list */}
              {loadingOptions ? (
                <div className="py-8">
                  <LoadingSpinner message="Loading employee directory..." />
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-200 bg-white rounded-xl">
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedEmpIds.has(emp.id);
                    const isEnrolled = existingEnrolledEmpIds.has(emp.id);
                    const fullName = `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim() || 'Employee';
                    const code = emp.employeeCode || emp.employee_code || '';
                    const dept = emp.departmentName || emp.department?.name || emp.dept_name || '-';

                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleToggleEmployee(emp.id)}
                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                          isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent div
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-800 block truncate leading-tight">
                              {fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {code} • {dept}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isEnrolled && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Already Enrolled
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredEmployees.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No employees found matching filter criteria.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: By Department */}
          {targetMode === 'DEPARTMENT' && (
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Choose Department to Assign All Active Members:
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="" disabled>
                  -- Select target department --
                </option>
                {allDepartments.map((d) => {
                  const count = allEmployees.filter((e) => e.deptId === d.id || e.dept_id === d.id).length;
                  return (
                    <option key={d.id} value={d.id}>
                      {d.name} ({count} active employees)
                    </option>
                  );
                })}
              </select>

              {selectedDeptId && (
                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-lg flex items-center gap-2 text-xs text-indigo-800">
                  <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>
                    Will assign this course to all <strong>{calculatedTargetCount}</strong> active employees in the selected department.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: All Staff */}
          {targetMode === 'ALL' && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Company-Wide Mandatory / Recommended Rollout</span>
              </div>
              <p className="leading-relaxed">
                This will assign the course to all <strong>{allEmployees.length}</strong> active staff members across every department. Each employee will receive a direct notification in their portal.
              </p>
            </div>
          )}

          {/* Enrollment Type & Requirements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Enrollment Priority / Type
              </label>
              <select
                value={enrollmentType}
                onChange={(e) => setEnrollmentType(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="MANDATORY">Mandatory — Compliance / Required</option>
                <option value="NOMINATED">Nominated — L&D Nominated Learning</option>
                <option value="OPTIONAL">Optional — Recommended Self-Paced</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Completion Summary
              </label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Duration / Commitment:</span>
                <span className="text-indigo-600 font-bold">
                  {currentCourse?.duration_hours || 1} hr(s)
                </span>
              </div>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Instructions or Assignment Note (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please complete by end of Q3. Contact L&D for queries."
              className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 text-slate-700"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="text-xs font-medium text-slate-500">
            Targeting: <strong className="text-slate-800">{calculatedTargetCount}</strong> employee(s)
          </div>

          <div className="flex items-center gap-2">
            <Button variant="neutral" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || calculatedTargetCount === 0 || !selectedCourseId}
              icon={UserPlus}
            >
              {submitting ? 'Assigning...' : `Assign Course (${calculatedTargetCount})`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
