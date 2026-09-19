import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  UserCheck,
  Star,
  X,
} from 'lucide-react';
import { trainingService } from '../../services/trainingService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';

export const TrainingPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'my-trainings' | 'skills'
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);

  // Form states
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    category: 'TECHNICAL',
    durationHours: 2,
    isMandatory: false,
  });

  const [skillForm, setSkillForm] = useState({
    skillName: '',
    proficiencyLevel: 'INTERMEDIATE',
  });

  const isHrOrAdmin = hasRole(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'courses') {
        const res = await trainingService.getCourses();
        setCourses(res.data || []);
      } else if (activeTab === 'my-trainings') {
        const res = await trainingService.getEnrollments();
        setEnrollments(res.data || []);
      } else if (activeTab === 'skills') {
        const res = await trainingService.getSkills();
        setSkills(res.data || []);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load training data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await trainingService.createCourse(courseForm);
      toast.success('Course created successfully.');
      setShowCreateCourseModal(false);
      setCourseForm({
        title: '',
        description: '',
        category: 'TECHNICAL',
        durationHours: 2,
        isMandatory: false,
      });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to create course.');
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      await trainingService.enroll({ courseId, enrollmentType: 'OPTIONAL' });
      toast.success('Enrolled successfully. Access training under "My Learning" tab.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Enrollment failed.');
    }
  };

  const handleUpdateProgress = async (enrollmentId, currentProgress) => {
    const newProgress = Math.min(100, currentProgress + 25);
    try {
      await trainingService.updateProgress(enrollmentId, {
        progressPercentage: newProgress,
        status: newProgress === 100 ? 'COMPLETED' : 'IN_PROGRESS',
      });
      toast.success(`Progress updated to ${newProgress}%`);
      loadData();
    } catch (err) {
      toast.error('Failed to update progress.');
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    try {
      await trainingService.upsertSkill(skillForm);
      toast.success('Skill recorded successfully.');
      setShowSkillModal(false);
      setSkillForm({ skillName: '', proficiencyLevel: 'INTERMEDIATE' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save skill.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            Learning & Development
          </h1>
          <p className="text-sm text-slate-500">
            Course catalogue, employee skill matrix, certification tracking, and compliance training
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'skills' && (
            <Button onClick={() => setShowSkillModal(true)} icon={Plus}>
              Add Skill
            </Button>
          )}
          {isHrOrAdmin && activeTab === 'courses' && (
            <Button onClick={() => setShowCreateCourseModal(true)} icon={Plus}>
              New Course
            </Button>
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
          My Learning & Enrollments
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'skills'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" />
          Employee Skill Matrix
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingSpinner message="Loading learning modules..." />
      ) : activeTab === 'courses' ? (
        /* COURSE CATALOGUE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <div
              key={c.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={c.is_mandatory ? 'danger' : 'info'}>
                    {c.is_mandatory ? 'Mandatory' : 'Optional'}
                  </Badge>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    {c.category}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-800">{c.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {c.description || 'Comprehensive training curriculum designed to elevate core workplace capabilities.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.duration_hours} hr(s)</span>
                </div>

                <Button size="sm" onClick={() => handleEnroll(c.id)}>
                  Enroll Now
                </Button>
              </div>
            </div>
          ))}

          {courses.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              No courses found in catalogue.
            </div>
          )}
        </div>
      ) : activeTab === 'my-trainings' ? (
        /* ENROLLMENTS */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Course</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Employee</th>
                <th className="p-3.5">Progress</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map((enr) => (
                <tr key={enr.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-bold text-slate-800">{enr.course_title}</td>
                  <td className="p-3.5 text-slate-500">{enr.course_category}</td>
                  <td className="p-3.5">
                    <span className="font-semibold text-slate-700 block">
                      {enr.first_name} {enr.last_name}
                    </span>
                    <span className="text-[10px] text-slate-400">{enr.employee_code}</span>
                  </td>
                  <td className="p-3.5 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${enr.progress_percentage}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">
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
                      <button
                        onClick={() => handleUpdateProgress(enr.id, enr.progress_percentage)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        +25% Progress
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-bold flex items-center justify-end gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Certified
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* SKILL MATRIX */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((sk) => (
            <div
              key={sk.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-800">{sk.skill_name}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {sk.first_name} {sk.last_name} ({sk.employee_code})
                </p>
              </div>
              <Badge
                variant={
                  sk.proficiency_level === 'EXPERT'
                    ? 'purple'
                    : sk.proficiency_level === 'ADVANCED'
                    ? 'success'
                    : 'info'
                }
              >
                {sk.proficiency_level}
              </Badge>
            </div>
          ))}

          {skills.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              No skills registered in the matrix.
            </div>
          )}
        </div>
      )}

      {/* CREATE COURSE MODAL */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Add New Training Course</h3>
              <button onClick={() => setShowCreateCourseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Information Security & GDPR Compliance"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={courseForm.category}
                  onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
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
                  value={courseForm.durationHours}
                  onChange={(e) => setCourseForm({ ...courseForm, durationHours: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Syllabus, key takeaways, and learning objectives..."
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isMandatory"
                  checked={courseForm.isMandatory}
                  onChange={(e) => setCourseForm({ ...courseForm, isMandatory: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="isMandatory" className="text-xs font-semibold text-slate-700">
                  Mandatory for all staff
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setShowCreateCourseModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Course</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SKILL MODAL */}
      {showSkillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Add Professional Skill</h3>
              <button onClick={() => setShowSkillModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSkill} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Skill Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., PostgreSQL, Project Management, React"
                  value={skillForm.skillName}
                  onChange={(e) => setSkillForm({ ...skillForm, skillName: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Proficiency Level</label>
                <select
                  value={skillForm.proficiencyLevel}
                  onChange={(e) => setSkillForm({ ...skillForm, proficiencyLevel: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="EXPERT">Expert</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setShowSkillModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Record Skill</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

