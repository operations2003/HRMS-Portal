import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Calendar,
  MapPin,
  Camera,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  Upload,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Avatar } from '../common/Avatar.jsx';
import { Alert } from '../common/Alert.jsx';
import { employeeService } from '../../services/employeeService.js';
import { profileService } from '../../services/profileService.js';
import { exitService } from '../../services/exitService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const EditExitedEmployeeModal = ({
  isOpen,
  onClose,
  checklist,
  onSuccess,
}) => {
  const toast = useToast();
  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    personalEmail: '',
    phone: '',
    employeeCode: '',
    deptId: '',
    desigId: '',
    departmentName: '',
    designationTitle: '',
    employmentType: 'Full-Time',
    resignationDate: '',
    lastWorkingDay: '',
    address: '',
    emergencyContact: '',
    notes: '',
  });

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(false);
  const [error, setError] = useState(null);

  // Metadata for Department & Designation options
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  // Initialize and load full employee details
  useEffect(() => {
    if (!isOpen || !checklist) return;

    setError(null);
    const names = (checklist.employeeName || '').trim().split(' ');
    const initialFirst = names[0] || '';
    const initialLast = names.slice(1).join(' ') || '';

    setFormData({
      firstName: initialFirst,
      lastName: initialLast,
      email: checklist.employeeEmail || '',
      personalEmail: '',
      phone: '',
      employeeCode: checklist.employeeCode || '',
      deptId: '',
      desigId: '',
      departmentName: checklist.department || '',
      designationTitle: checklist.designation || '',
      employmentType: 'Full-Time',
      resignationDate: checklist.resignationDate || '',
      lastWorkingDay: checklist.lastWorkingDay || '',
      address: '',
      emergencyContact: '',
      notes: checklist.notes || '',
    });

    setAvatarUrl(checklist.avatarUrl || null);

    // Fetch metadata (departments and designations)
    const loadMetadataAndDetails = async () => {
      try {
        setIsLoadingEmployee(true);
        const [metaRes, empRes] = await Promise.allSettled([
          employeeService.getMetadata(),
          checklist.employeeId ? employeeService.getEmployeeById(checklist.employeeId) : Promise.reject(),
        ]);

        if (metaRes.status === 'fulfilled' && metaRes.value) {
          const meta = metaRes.value;
          setDepartments(meta.departments || []);
          setDesignations(meta.designations || []);
        }

        if (empRes.status === 'fulfilled' && empRes.value) {
          const emp = empRes.value;
          setFormData((prev) => ({
            ...prev,
            firstName: emp.firstName || prev.firstName,
            lastName: emp.lastName || prev.lastName,
            email: emp.email || prev.email,
            personalEmail: emp.personalEmail || emp.personal_email || '',
            phone: emp.phone || '',
            employeeCode: emp.employeeCode || prev.employeeCode,
            deptId: emp.deptId || '',
            desigId: emp.desigId || '',
            departmentName: emp.department || emp.departmentName || prev.departmentName,
            designationTitle: emp.designation || emp.designationTitle || prev.designationTitle,
            employmentType: emp.employmentType || prev.employmentType || 'Full-Time',
            address: emp.address || '',
            emergencyContact: emp.emergencyContact || '',
          }));

          if (emp.avatarUrl || emp.avatar_url) {
            setAvatarUrl(emp.avatarUrl || emp.avatar_url);
          }
        }
      } catch (err) {
        console.warn('Could not load detailed employee attributes:', err);
      } finally {
        setIsLoadingEmployee(false);
      }
    };

    loadMetadataAndDetails();
  }, [isOpen, checklist]);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle Photo Selection and Upload
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !checklist?.employeeId) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be less than 5MB.');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setError(null);
      const res = await profileService.uploadAvatarForEmployee(checklist.employeeId, file);
      const newUrl = res?.avatarUrl || res?.data?.avatarUrl || '';
      if (newUrl) {
        setAvatarUrl(newUrl);
        toast.success('Profile picture uploaded successfully!');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload profile picture.';
      toast.error(msg);
      setError(msg);
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle Photo Removal
  const handlePhotoRemove = async () => {
    if (!checklist?.employeeId || !avatarUrl) return;

    try {
      setIsUploadingPhoto(true);
      setError(null);
      await profileService.removeAvatarForEmployee(checklist.employeeId);
      setAvatarUrl(null);
      toast.success('Profile picture removed.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to remove profile picture.';
      toast.error(msg);
      setError(msg);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Submit and Save Details
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Work / Login email is required.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // 1. Prepare Employee Payload
      const empPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        personalEmail: formData.personalEmail.trim() || null,
        phone: formData.phone.trim(),
        employeeCode: formData.employeeCode.trim(),
        employmentType: formData.employmentType,
        address: formData.address.trim(),
        emergencyContact: formData.emergencyContact.trim(),
      };

      if (formData.deptId) {
        empPayload.deptId = formData.deptId;
      }
      if (formData.desigId) {
        empPayload.desigId = formData.desigId;
      }

      // Update Employee record
      if (checklist.employeeId) {
        await employeeService.updateEmployee(checklist.employeeId, empPayload);
      }

      // 2. Update Exit Checklist dates & notes
      if (checklist.id) {
        await exitService.updateExitChecklist(checklist.id, {
          resignationDate: formData.resignationDate || null,
          lastWorkingDay: formData.lastWorkingDay || null,
          notes: formData.notes || '',
        });
      }

      toast.success('Exited employee details updated successfully.');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update employee details.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!checklist) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Exited Employee Details"
      subtitle={`Update profile photo, contact parameters, and exit records for ${checklist.employeeName}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <Alert
            type="error"
            title="Update Error"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {/* =================================================================== */}
        {/* 1. Profile Picture Upload / Management Section                      */}
        {/* =================================================================== */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-800/60 dark:via-slate-850 dark:to-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <Avatar
                src={avatarUrl}
                name={`${formData.firstName} ${formData.lastName}`}
                size="xl"
                shape="rounded-2xl"
                className="w-16 h-16 min-w-[4rem] min-h-[4rem] border-2 border-white dark:border-slate-700 shadow-md ring-2 ring-brand-500/20"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 bg-brand-600 hover:bg-brand-700 text-white p-1.5 rounded-full shadow-md transition-all hover:scale-105"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Profile Photo
                {avatarUrl && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    Uploaded
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload JPG, PNG, WEBP (Max 5MB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Upload}
              isLoading={isUploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs"
            >
              {avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Trash2}
                disabled={isUploadingPhoto}
                onClick={handlePhotoRemove}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. Personal & Contact Details                                       */}
        {/* =================================================================== */}
        <div className="space-y-3.5">
          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-brand-500" />
            Personal & Identification
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              placeholder="e.g. Aditya"
            />
            <Input
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              placeholder="e.g. Gandhi"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Employee ID / Code"
              name="employeeCode"
              value={formData.employeeCode}
              onChange={handleChange}
              placeholder="e.g. 013"
              helperText="Unique organizational identifier"
            />
            <Select
              label="Employment Type"
              name="employmentType"
              value={formData.employmentType}
              onChange={handleChange}
              options={[
                { value: 'Full-Time', label: 'Full-Time' },
                { value: 'Part-Time', label: 'Part-Time' },
                { value: 'Intern', label: 'Intern' },
                { value: 'Contract', label: 'Contract' },
                { value: 'Consultant', label: 'Consultant' },
              ]}
            />
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. Communication & Emails                                           */}
        {/* =================================================================== */}
        <div className="space-y-3.5 pt-1">
          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-brand-500" />
            Contact & Communication
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Official / Work Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              icon={Mail}
              placeholder="name@tasknera.com"
            />
            <Input
              label="Personal Email"
              name="personalEmail"
              type="email"
              value={formData.personalEmail}
              onChange={handleChange}
              icon={Mail}
              placeholder="personal@gmail.com"
              helperText="For post-exit correspondence & F&F delivery"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              icon={Phone}
              placeholder="+91 98765 43210"
            />
            <Input
              label="Emergency Contact"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleChange}
              placeholder="e.g. +91 91234 56789"
            />
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. Department & Designation                                         */}
        {/* =================================================================== */}
        <div className="space-y-3.5 pt-1">
          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-brand-500" />
            Organizational Role
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {departments.length > 0 ? (
              <Select
                label="Department"
                name="deptId"
                value={formData.deptId}
                onChange={handleChange}
                placeholder="Select Department"
                options={departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
              />
            ) : (
              <Input
                label="Department"
                name="departmentName"
                value={formData.departmentName}
                onChange={handleChange}
                placeholder="e.g. Talent Acquisition"
                disabled
              />
            )}

            {designations.length > 0 ? (
              <Select
                label="Designation"
                name="desigId"
                value={formData.desigId}
                onChange={handleChange}
                placeholder="Select Designation"
                options={designations.map((ds) => ({
                  value: ds.id,
                  label: ds.title,
                }))}
              />
            ) : (
              <Input
                label="Designation"
                name="designationTitle"
                value={formData.designationTitle}
                onChange={handleChange}
                placeholder="e.g. Talent Acquisition Intern"
                disabled
              />
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 5. Exit Dates & Records                                             */}
        {/* =================================================================== */}
        <div className="space-y-3.5 pt-1">
          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-500" />
            Exit Dates & Notes
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Resignation Date"
              name="resignationDate"
              type="date"
              value={formData.resignationDate}
              onChange={handleChange}
              icon={Calendar}
            />
            <Input
              label="Last Working Day"
              name="lastWorkingDay"
              type="date"
              value={formData.lastWorkingDay}
              onChange={handleChange}
              icon={Calendar}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Exit Notes / Reason for Leaving
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Add any additional remarks or clearance notes regarding the employee's exit..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            isLoading={isSaving}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditExitedEmployeeModal;
