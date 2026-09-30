import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  Upload,
  User,
  Search,
  Calendar,
  FileText,
  CheckCircle2,
  Trash2,
  Download,
  Eye,
  X,
  FileCheck,
  Send,
  AlertCircle,
  Clock,
  Sparkles,
  Building2,
  BookOpen,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { trainingService } from '../../services/trainingService.js';
import { employeeService } from '../../services/employeeService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { Modal } from '../common/Modal.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { filterNonCeoEmployees } from '../../utils/roleUtils.js';

export const CertificationsSection = ({ courses = [] }) => {
  const { user, canManageTraining } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const isTrainingManager = canManageTraining ? canManageTraining() : false;

  // Certificates Data
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Employee options for L&D upload
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Upload Form State (Two Sections: 1. Employee & Course, 2. Certificate Upload)
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedCourseMode, setSelectedCourseMode] = useState('CATALOGUE'); // 'CATALOGUE' | 'CUSTOM'
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [customCourseTitle, setCustomCourseTitle] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Preview Modal
  const [previewCert, setPreviewCert] = useState(null);

  // Delete Confirmation
  const [certToDelete, setCertToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch certificates
  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const res = await trainingService.getCertificates();
      setCertificates(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load certificates.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees for L&D manager upload dropdown
  useEffect(() => {
    if (isTrainingManager) {
      const fetchEmps = async () => {
        try {
          setLoadingEmployees(true);
          const res = await employeeService.getAllEmployees({ status: 'Active' });
          const raw = res.employees || res.data || (Array.isArray(res) ? res : []);
          setEmployees(filterNonCeoEmployees(raw));
        } catch (err) {
          console.error('Failed to load employee list:', err);
        } finally {
          setLoadingEmployees(false);
        }
      };
      fetchEmps();
    }
  }, [isTrainingManager]);

  useEffect(() => {
    fetchCertificates();
  }, []);

  // Handle File Selection
  const handleFileChange = (file) => {
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file format. Please upload a PDF or image (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds the 25MB limit.');
      return;
    }

    setSelectedFile(file);

    // Create object URL for preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit / Send Certificate
  const handleSendCertificate = async (e) => {
    e.preventDefault();

    if (!selectedEmpId) {
      toast.error('Please select an employee name.');
      return;
    }

    let finalTitle = '';
    if (selectedCourseMode === 'CATALOGUE') {
      const matched = courses.find((c) => c.id === selectedCourseId);
      finalTitle = matched ? matched.title : '';
      if (!finalTitle) {
        toast.error('Please select a course from the catalogue.');
        return;
      }
    } else {
      finalTitle = customCourseTitle.trim();
      if (!finalTitle) {
        toast.error('Please enter the course or certification title.');
        return;
      }
    }

    if (!selectedFile) {
      toast.error('Please upload a certificate document or image.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('employeeId', selectedEmpId);
      formData.append('courseTitle', finalTitle);
      if (selectedCourseMode === 'CATALOGUE' && selectedCourseId) {
        formData.append('courseId', selectedCourseId);
      }
      formData.append('issueDate', issueDate);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }
      formData.append('file', selectedFile);

      await trainingService.uploadCertificate(formData);

      toast.success(`Certificate for "${finalTitle}" successfully issued and sent to the employee!`);

      // Reset form
      handleRemoveFile();
      setNotes('');
      setCustomCourseTitle('');
      if (courses.length > 0) {
        setSelectedCourseId(courses[0].id);
      }

      // Refresh certificates
      await fetchCertificates();
    } catch (err) {
      toast.error(err.message || 'Failed to issue certificate.');
    } finally {
      setUploading(false);
    }
  };

  // Delete certificate handler
  const handleConfirmDelete = async () => {
    if (!certToDelete) return;
    setDeleting(true);
    try {
      await trainingService.deleteCertificate(certToDelete.id);
      toast.success('Certificate removed successfully.');
      setCertToDelete(null);
      await fetchCertificates();
    } catch (err) {
      toast.error(err.message || 'Failed to delete certificate.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered certificates list
  const filteredCertificates = useMemo(() => {
    return certificates.filter((cert) => {
      if (deptFilter !== 'ALL' && cert.department !== deptFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (cert.employee_name || '').toLowerCase().includes(q);
        const matchTitle = (cert.course_title || '').toLowerCase().includes(q);
        const matchCode = (cert.employee_code || '').toLowerCase().includes(q);
        return matchName || matchTitle || matchCode;
      }
      return true;
    });
  }, [certificates, searchQuery, deptFilter]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set();
    certificates.forEach((c) => {
      if (c.department) set.add(c.department);
    });
    return Array.from(set);
  }, [certificates]);

  // Selected Employee Details for preview badge
  const activeSelectedEmp = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId);
  }, [employees, selectedEmpId]);

  return (
    <div className="space-y-6">
      {/* 1. L&D CERTIFICATE UPLOAD SECTION (Two Sections: Employee Name & Upload) */}
      {isTrainingManager && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
          {/* Card Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-transparent border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">
                  Issue & Send Course Certificate
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select the recipient employee and upload their verified course certificate.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              L&D Authorized
            </span>
          </div>

          <form onSubmit={handleSendCertificate} className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* SECTION 01: EMPLOYEE NAME & COURSE DETAILS */}
              <div className="space-y-4 p-5 rounded-xl bg-slate-50/70 dark:bg-slate-850/50 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Employee & Course Details
                  </h4>
                </div>

                {/* Employee Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Employee <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-10 py-2.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">
                        {loadingEmployees ? 'Loading active employees...' : '-- Select Employee Name --'}
                      </option>
                      {employees.map((emp) => {
                        const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                        const code = emp.employeeCode || emp.employeeId || '';
                        const dept = emp.departmentName || emp.department?.name || '';
                        return (
                          <option key={emp.id} value={emp.id}>
                            {name} {code ? `(${code})` : ''} {dept ? `• ${dept}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {activeSelectedEmp && (
                    <div className="mt-2.5 flex items-center gap-2.5 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                      <Avatar
                        name={`${activeSelectedEmp.firstName} ${activeSelectedEmp.lastName}`}
                        url={activeSelectedEmp.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {activeSelectedEmp.firstName} {activeSelectedEmp.lastName}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                          {activeSelectedEmp.email} • {activeSelectedEmp.departmentName || activeSelectedEmp.department?.name || 'Staff'}
                        </span>
                      </div>
                      <Badge variant="brand" size="sm">
                        {activeSelectedEmp.employeeCode || 'ACTIVE'}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Course Selection Mode */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Course / Certification Title <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedCourseMode('CATALOGUE')}
                        className={`font-semibold transition ${
                          selectedCourseMode === 'CATALOGUE'
                            ? 'text-indigo-600 dark:text-indigo-400 underline underline-offset-4'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Catalogue Course
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseMode('CUSTOM')}
                        className={`font-semibold transition ${
                          selectedCourseMode === 'CUSTOM'
                            ? 'text-indigo-600 dark:text-indigo-400 underline underline-offset-4'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Custom / External
                      </button>
                    </div>
                  </div>

                  {selectedCourseMode === 'CATALOGUE' ? (
                    <div className="relative">
                      <select
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        className="w-full appearance-none pl-3.5 pr-10 py-2.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required={selectedCourseMode === 'CATALOGUE'}
                      >
                        <option value="">-- Select Completed Course --</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title} ({course.category || 'Course'})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. Advanced Excel & Operations Analytics Masterclass"
                      value={customCourseTitle}
                      onChange={(e) => setCustomCourseTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required={selectedCourseMode === 'CUSTOM'}
                    />
                  )}
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Completion / Issue Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Optional Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Evaluator Remarks / Distinction (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Completed with 100% attendance & Distinction"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* SECTION 02: UPLOAD CERTIFICATE SECTION */}
              <div className="space-y-4 p-5 rounded-xl bg-slate-50/70 dark:bg-slate-850/50 border border-slate-200/70 dark:border-slate-800 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Upload Certificate Document
                    </h4>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload the manually issued certificate (PDF or Image). The file will be delivered directly to the employee's credentials section.
                  </p>

                  {/* Dropzone */}
                  {!selectedFile ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                        isDragging
                          ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 scale-[1.01]'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFileChange(e.target.files?.[0])}
                        accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        Drag & drop certificate here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-1">
                        Supported formats: PDF, PNG, JPG, WEBP (Max 25MB)
                      </span>
                    </div>
                  ) : (
                    /* Selected File Card */
                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            {selectedFile.type === 'application/pdf' ? (
                              <FileText className="w-5 h-5" />
                            ) : (
                              <FileCheck className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                              {selectedFile.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                              {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Image Thumbnail Preview if applicable */}
                      {filePreviewUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-emerald-200/80 dark:border-emerald-900/60 max-h-36 flex items-center justify-center bg-black/5">
                          <img
                            src={filePreviewUrl}
                            alt="Certificate Preview"
                            className="max-h-36 object-contain"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready to dispatch to recipient</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3 mt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={Send}
                    loading={uploading}
                    disabled={uploading || !selectedFile || !selectedEmpId}
                    className="w-full sm:w-auto font-bold text-xs"
                  >
                    {uploading ? 'Uploading & Sending...' : 'Send Certificate to Employee'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 2. DIRECTORY / LIST OF CERTIFICATES */}
      <div className="space-y-4">
        {/* Header & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isTrainingManager ? 'Delivered Certificates' : 'My Certificates'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isTrainingManager
                  ? `Total ${filteredCertificates.length} verified certificate${filteredCertificates.length === 1 ? '' : 's'} issued across organization`
                  : `You have earned ${filteredCertificates.length} course certificate${filteredCertificates.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isTrainingManager ? 'Search by employee or course...' : 'Search my certificates...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Department Filter (For Managers) */}
            {isTrainingManager && departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Certificates Grid / Gallery */}
        {loading ? (
          <LoadingSpinner message="Loading certificates..." />
        ) : filteredCertificates.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 mx-auto flex items-center justify-center shadow-xs">
              <Award className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white">
              No Certificates Found
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {isTrainingManager
                ? 'No certificates have been issued yet. Use the upload section above to send certificates to employees.'
                : 'No course certificates have been issued to your profile yet. Once you complete assigned courses, the L&D team will upload your verified certificates here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCertificates.map((cert) => (
              <div
                key={cert.id}
                className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md transition-all hover:border-amber-300 dark:hover:border-amber-700/60 flex flex-col justify-between"
              >
                {/* Top Badge & Date */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                      <Award className="w-4 h-4" />
                    </span>
                    <Badge variant="warning" size="sm">
                      Certified
                    </Badge>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(cert.issue_date).toLocaleDateString()}
                  </span>
                </div>

                {/* Course Title */}
                <div className="space-y-1 mb-4">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {cert.course_title}
                  </h4>
                  {cert.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-1">
                      "{cert.notes}"
                    </p>
                  )}
                </div>

                {/* Employee / Recipient Info (Always clear) */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      name={cert.employee_name}
                      url={cert.employee_avatar}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {cert.employee_name}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {cert.employee_code ? `${cert.employee_code} • ` : ''}{cert.department || 'Staff'}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {cert.file_size || 'PDF'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Eye}
                    onClick={() => setPreviewCert(cert)}
                    className="flex-1 text-xs font-semibold"
                  >
                    View
                  </Button>

                  <a
                    href={cert.certificate_url}
                    download={cert.file_name || `${cert.course_title}_certificate.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    title="Download certificate file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>

                  {isTrainingManager && (
                    <button
                      type="button"
                      onClick={() => setCertToDelete(cert)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Delete certificate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. CERTIFICATE PREVIEW MODAL */}
      {previewCert && (
        <Modal
          isOpen={Boolean(previewCert)}
          onClose={() => setPreviewCert(null)}
          title={previewCert.course_title}
          subtitle={`Issued to ${previewCert.employee_name} on ${new Date(previewCert.issue_date).toLocaleDateString()}`}
          maxWidth="max-w-4xl"
        >
          <div className="p-6 space-y-4">
            {/* Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Recipient</span>
                <span className="font-semibold text-slate-900 dark:text-white block truncate">{previewCert.employee_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Department</span>
                <span className="font-semibold text-slate-900 dark:text-white block truncate">{previewCert.department || 'General'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Issue Date</span>
                <span className="font-semibold text-slate-900 dark:text-white block font-mono">{new Date(previewCert.issue_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Issued By</span>
                <span className="font-semibold text-slate-900 dark:text-white block truncate">{previewCert.issued_by_name || 'L&D Team'}</span>
              </div>
            </div>

            {/* Document Viewer Frame */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-950 min-h-[420px] max-h-[600px] flex items-center justify-center">
              {previewCert.file_type && previewCert.file_type.startsWith('image/') ? (
                <img
                  src={previewCert.certificate_url}
                  alt={previewCert.course_title}
                  className="max-h-[550px] w-auto object-contain mx-auto"
                />
              ) : (
                <iframe
                  src={previewCert.certificate_url}
                  title="Certificate PDF Viewer"
                  className="w-full h-[550px] border-none"
                />
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewCert(null)}
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                <a
                  href={previewCert.certificate_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <a
                  href={previewCert.certificate_url}
                  download={previewCert.file_name || `${previewCert.course_title}_certificate.pdf`}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Certificate</span>
                </a>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(certToDelete)}
        onClose={() => setCertToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Certificate"
        message={`Are you sure you want to remove the certificate "${certToDelete?.course_title}" for ${certToDelete?.employee_name}? This action cannot be undone.`}
        confirmText="Delete Certificate"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
};

export default CertificationsSection;
