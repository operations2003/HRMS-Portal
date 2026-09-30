import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  BookOpen,
  CheckCircle2,
  Clock,
  UserCheck,
  UserPlus,
  X,
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Users,
  BarChart3,
  Filter,
  Check,
  AlertCircle,
  ShieldCheck,
  PlayCircle,
  Award,
} from 'lucide-react';
import { trainingService } from '../../services/trainingService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { AssignCourseModal } from '../../components/training/AssignCourseModal.jsx';
import { CourseProgressModal } from '../../components/training/CourseProgressModal.jsx';
import { CertificationsSection } from '../../components/training/CertificationsSection.jsx';

export const TrainingPage = () => {
  const { user, canManageTraining } = useAuth();
  const toast = useToast();

  const isTrainingManager = canManageTraining ? canManageTraining() : false;

  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'my-trainings'
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [courseSearch, setCourseSearch] = useState('');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState('ALL');
  const [enrollmentViewMode, setEnrollmentViewMode] = useState('ALL'); // 'ALL' | 'MINE' for managers
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [enrollmentCourseFilter, setEnrollmentCourseFilter] = useState('ALL');
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('ALL');

  // Course Create / Edit Modal
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    category: 'TECHNICAL',
    durationHours: 2,
    isMandatory: false,
    trainingLink: '',
    status: 'PUBLISHED',
  });
  const [savingCourse, setSavingCourse] = useState(false);

  // Assign Course Modal (L&D Authority)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCourseTarget, setAssignCourseTarget] = useState(null);
  const [preselectedAssignEmpId, setPreselectedAssignEmpId] = useState(null);

  // Course Progress / Completion Matrix Modal
  const [selectedProgressCourse, setSelectedProgressCourse] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'courses') {
        const res = await trainingService.getCourses();
        setCourses(res.data || []);
      } else if (activeTab === 'my-trainings') {
        const params = {};
        // If training manager chose "MINE", pass employeeId of current user
        if (isTrainingManager && enrollmentViewMode === 'MINE' && user?.employeeId) {
          params.employeeId = user.employeeId;
        }
        const res = await trainingService.getEnrollments(params);
        setEnrollments(res.data || []);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load training data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, isTrainingManager, enrollmentViewMode, user?.employeeId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingCourseId(null);
    setCourseForm({
      title: '',
      description: '',
      category: 'TECHNICAL',
      durationHours: 2,
      isMandatory: false,
      trainingLink: '',
      status: 'PUBLISHED',
    });
    setShowCourseModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (course) => {
    setEditingCourseId(course.id);
    setCourseForm({
      title: course.title || '',
      description: course.description || '',
      category: course.category || 'TECHNICAL',
      durationHours: course.duration_hours || 2,
      isMandatory: !!course.is_mandatory,
      trainingLink: course.training_link || '',
      status: course.status || 'PUBLISHED',
    });
    setShowCourseModal(true);
  };

  // Save Course (Create or Update)
  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.title.trim()) {
      toast.error('Course title is required.');
      return;
    }

    setSavingCourse(true);
    try {
      if (editingCourseId) {
        await trainingService.updateCourse(editingCourseId, courseForm);
        toast.success('Course updated successfully.');
      } else {
        await trainingService.createCourse(courseForm);
        toast.success('Course created and added to catalogue.');
      }
      setShowCourseModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save course.');
    } finally {
      setSavingCourse(false);
    }
  };

  // Toggle Publish / Unpublish
  const handleTogglePublish = async (course) => {
    const isCurrentlyPublished = course.status === 'PUBLISHED' || course.status === 'ACTIVE';
    try {
      if (isCurrentlyPublished) {
        await trainingService.unpublishCourse(course.id);
        toast.success(`Course "${course.title}" unpublished.`);
      } else {
        await trainingService.publishCourse(course.id);
        toast.success(`Course "${course.title}" published to catalogue.`);
      }
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update course status.');
    }
  };

  // Delete Course
  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Are you sure you want to delete course "${course.title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await trainingService.deleteCourse(course.id);
      toast.success('Course deleted successfully.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete course.');
    }
  };

  // Open Completion Matrix Modal
  const handleOpenProgressModal = async (course) => {
    setSelectedProgressCourse(course);
    setLoadingProgress(true);
    try {
      const res = await trainingService.getCourseProgress(course.id);
      setProgressData(res.data);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch course progress.');
      setSelectedProgressCourse(null);
    } finally {
      setLoadingProgress(false);
    }
  };

  // Open Assign Course Modal
  const handleOpenAssignModal = (course = null, employeeId = null) => {
    setAssignCourseTarget(course);
    setPreselectedAssignEmpId(employeeId);
    setShowAssignModal(true);
  };

  // Callback when assignment completes
  const handleAssignmentSuccess = () => {
    loadData();
    if (selectedProgressCourse) {
      handleOpenProgressModal(selectedProgressCourse);
    }
  };

  // Self Enroll
  const handleEnroll = async (courseId) => {
    try {
      await trainingService.enroll({ courseId, enrollmentType: 'OPTIONAL' });
      toast.success('Enrolled successfully! Access training under "My Learning" tab.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Enrollment failed.');
    }
  };

  // Update Progress / Mark Completed
  const handleUpdateProgress = async (enrollmentId, currentProgress, targetProgress = null) => {
    const nextProgress = targetProgress !== null ? targetProgress : Math.min(100, currentProgress + 25);
    try {
      await trainingService.updateProgress(enrollmentId, {
        progressPercentage: nextProgress,
        status: nextProgress === 100 ? 'COMPLETED' : 'IN_PROGRESS',
      });
      toast.success(nextProgress === 100 ? 'Training marked as completed!' : `Progress updated to ${nextProgress}%`);
      loadData();
      if (selectedProgressCourse) {
        handleOpenProgressModal(selectedProgressCourse);
      }
    } catch (err) {
      toast.error('Failed to update progress.');
    }
  };

  // Filtered Courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        c.title?.toLowerCase().includes(courseSearch.toLowerCase()) ||
        c.description?.toLowerCase().includes(courseSearch.toLowerCase());
      const matchesCategory = courseCategoryFilter === 'ALL' || c.category === courseCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [courses, courseSearch, courseCategoryFilter]);

  // Filtered Enrollments for Enrollments Tab
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((enr) => {
      const matchesCourse = enrollmentCourseFilter === 'ALL' || enr.course_id === enrollmentCourseFilter;
      const matchesStatus = enrollmentStatusFilter === 'ALL' || enr.status === enrollmentStatusFilter;
      const term = enrollmentSearch.toLowerCase().trim();
      const fullName = `${enr.first_name || ''} ${enr.last_name || ''}`.toLowerCase();
      const code = (enr.employee_code || '').toLowerCase();
      const title = (enr.course_title || '').toLowerCase();
      const dept = (enr.department_name || '').toLowerCase();
      const matchesSearch = !term || fullName.includes(term) || code.includes(term) || title.includes(term) || dept.includes(term);
      return matchesCourse && matchesStatus && matchesSearch;
    });
  }, [enrollments, enrollmentCourseFilter, enrollmentStatusFilter, enrollmentSearch]);

  // Check which courses user is enrolled in
  const enrolledCourseIds = useMemo(() => {
    return new Set(enrollments.map((enr) => enr.course_id));
  }, [enrollments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              Learning & Development
            </h1>
            {isTrainingManager && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                Training Manager Access
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Course catalogue, compliance training, learning paths, and progress analytics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isTrainingManager && (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenAssignModal(null)}
                icon={UserPlus}
              >
                Assign Course
              </Button>
              {activeTab === 'courses' && (
                <Button onClick={handleOpenCreateModal} icon={Plus}>
                  New Course
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'courses'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Course Catalogue
        </button>
        <button
          onClick={() => setActiveTab('my-trainings')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'my-trainings'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          {isTrainingManager ? 'Trainings & Enrollments' : 'My Learning & Enrollments'}
        </button>
        <button
          onClick={() => setActiveTab('certifications')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'certifications'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" />
          {isTrainingManager ? 'Certifications' : 'My Certificates'}
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingSpinner message="Loading learning modules..." />
      ) : activeTab === 'courses' ? (
        /* COURSE CATALOGUE */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search courses by title or keyword..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Category:</span>
              <select
                value={courseCategoryFilter}
                onChange={(e) => setCourseCategoryFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Categories</option>
                <option value="TECHNICAL">Technical Skills</option>
                <option value="COMPLIANCE">Compliance & Regulatory</option>
                <option value="LEADERSHIP">Leadership & Management</option>
                <option value="ONBOARDING">New Hire Onboarding</option>
                <option value="SOFT_SKILLS">Soft Skills & Communication</option>
                <option value="GENERAL">General Workplace</option>
              </select>
            </div>
          </div>

          {/* Course Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((c) => {
              const isEnrolled = enrolledCourseIds.has(c.id);
              const isPublished = c.status === 'PUBLISHED' || c.status === 'ACTIVE';

              return (
                <div
                  key={c.id}
                  className={`bg-white p-5 rounded-xl border shadow-sm transition flex flex-col justify-between space-y-4 ${
                    !isPublished ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={c.is_mandatory ? 'danger' : 'info'}>
                          {c.is_mandatory ? 'Mandatory' : 'Optional'}
                        </Badge>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {c.category}
                        </span>
                      </div>

                      {isTrainingManager ? (
                        <Badge variant={isPublished ? 'success' : 'warning'}>
                          {c.status || 'PUBLISHED'}
                        </Badge>
                      ) : null}
                    </div>

                    <h3 className="text-base font-bold text-slate-800 leading-snug">{c.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                      {c.description || 'Comprehensive training curriculum designed to elevate core workplace capabilities.'}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium pt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.duration_hours} hr(s)</span>
                    </div>
                  </div>

                    {/* Actions Section */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    {/* Training Manager Admin Actions */}
                    {isTrainingManager && (
                      <div className="flex items-center justify-between gap-1 pt-1 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenProgressModal(c)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
                            title="View all employees' completion data"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Track Progress
                          </button>

                          <button
                            onClick={() => handleOpenAssignModal(c)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition border border-emerald-200/60"
                            title="Assign this course to employees or departments"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Assign
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePublish(c)}
                            className={`p-1.5 rounded transition ${
                              isPublished
                                ? 'text-amber-600 hover:bg-amber-100/60'
                                : 'text-emerald-600 hover:bg-emerald-100/60'
                            }`}
                            title={isPublished ? 'Unpublish Course' : 'Publish Course'}
                          >
                            {isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Edit Course"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete Course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Employee Learning Actions */}
                    <div className="flex items-center justify-between gap-2">
                      {c.training_link ? (
                        <a
                          href={c.training_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Open Link
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Self-guided course</span>
                      )}

                      {isEnrolled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Enrolled
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => handleEnroll(c.id)}>
                          Enroll Now
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredCourses.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No courses matching your filter.</p>
                <p className="text-xs text-slate-400 mt-0.5">Try searching with a different term or clearing category filter.</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'my-trainings' ? (
        /* ENROLLMENTS */
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            {isTrainingManager ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Display View:</span>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    onClick={() => setEnrollmentViewMode('ALL')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      enrollmentViewMode === 'ALL'
                        ? 'bg-white text-indigo-600 shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    All Staff Enrollments
                  </button>
                  <button
                    onClick={() => setEnrollmentViewMode('MINE')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      enrollmentViewMode === 'MINE'
                        ? 'bg-white text-indigo-600 shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    My Own Enrollments
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-700">My Enrolled Trainings & Progress</span>
            )}

            {/* Search and Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search course or employee..."
                  value={enrollmentSearch}
                  onChange={(e) => setEnrollmentSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <select
                value={enrollmentCourseFilter}
                onChange={(e) => setEnrollmentCourseFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <select
                value={enrollmentStatusFilter}
                onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ENROLLED">Enrolled (Not Started)</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3.5">Course</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">Assignment</th>
                  <th className="p-3.5">Course Material</th>
                  <th className="p-3.5">Progress</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEnrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 block">{enr.course_title}</span>
                      <span className="text-[10px] text-slate-400">
                        {enr.duration_hours ? `${enr.duration_hours} hr(s)` : ''}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">{enr.course_category}</td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-700 block">
                        {enr.first_name} {enr.last_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {enr.employee_code} • {enr.department_name || '-'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded block w-fit">
                        {enr.enrollment_type || 'OPTIONAL'}
                      </span>
                      {enr.assigned_by_name ? (
                        <span className="text-[10px] text-indigo-600 block mt-0.5 truncate max-w-[130px]">
                          By {enr.assigned_by_name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 block mt-0.5 italic">
                          Self-enrolled
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {enr.training_link ? (
                        <a
                          href={enr.training_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open Link
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="p-3.5 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              enr.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${enr.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 min-w-[32px]">
                          {enr.progress_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge variant={enr.status === 'COMPLETED' ? 'success' : 'info'}>
                        {enr.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      {enr.status !== 'COMPLETED' ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleUpdateProgress(enr.id, enr.progress_percentage)}
                            className="px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded transition"
                          >
                            +25%
                          </button>
                          <button
                            onClick={() => handleUpdateProgress(enr.id, enr.progress_percentage, 100)}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Complete
                          </button>
                        </div>
                      ) : (
                        <span className="text-emerald-600 font-bold flex items-center justify-end gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredEnrollments.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      No enrollments found matching the criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CERTIFICATIONS SECTION */
        <CertificationsSection courses={courses} />
      )}

      {/* COURSE COMPLETION MATRIX / PROGRESS MODAL (Training Managers only) */}
      <CourseProgressModal
        isOpen={!!selectedProgressCourse}
        onClose={() => setSelectedProgressCourse(null)}
        course={selectedProgressCourse}
        progressData={progressData}
        loading={loadingProgress}
        onAssignCourse={(courseToAssign, empId) => {
          handleOpenAssignModal(courseToAssign, empId);
        }}
        onUpdateProgress={handleUpdateProgress}
      />

      {/* ASSIGN COURSE MODAL (L&D Authority) */}
      <AssignCourseModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        course={assignCourseTarget}
        courses={courses}
        preselectedEmployeeId={preselectedAssignEmpId}
        onAssignmentSuccess={handleAssignmentSuccess}
      />

      {/* CREATE / EDIT COURSE MODAL */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingCourseId ? 'Edit Training Course' : 'Create New Training Course'}
              </h3>
              <button onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Information Security & Data Protection 2026"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TECHNICAL">Technical Skills</option>
                    <option value="COMPLIANCE">Compliance & Regulatory</option>
                    <option value="LEADERSHIP">Leadership & Management</option>
                    <option value="ONBOARDING">New Hire Onboarding</option>
                    <option value="SOFT_SKILLS">Soft Skills & Communication</option>
                    <option value="GENERAL">General Workplace Training</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={courseForm.durationHours}
                    onChange={(e) => setCourseForm({ ...courseForm, durationHours: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Training Link (URL)</label>
                <input
                  type="url"
                  placeholder="https://example.com/course-material or Google Drive / LMS link"
                  value={courseForm.trainingLink}
                  onChange={(e) => setCourseForm({ ...courseForm, trainingLink: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Employees and staff can click this link to access course materials, slides, or training video.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Syllabus</label>
                <textarea
                  rows="3"
                  placeholder="Syllabus, key takeaways, and learning objectives..."
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catalogue Status</label>
                  <select
                    value={courseForm.status}
                    onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PUBLISHED">Published (Visible to all staff)</option>
                    <option value="UNPUBLISHED">Unpublished (L&D Draft)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isMandatory"
                    checked={courseForm.isMandatory}
                    onChange={(e) => setCourseForm({ ...courseForm, isMandatory: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                  <label htmlFor="isMandatory" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Mandatory for all staff
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="neutral" type="button" onClick={() => setShowCourseModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingCourse}>
                  {savingCourse ? 'Saving...' : editingCourseId ? 'Update Course' : 'Create Course'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
