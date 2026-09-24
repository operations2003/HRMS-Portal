import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  Users,
  Building2,
  Briefcase,
  Calendar,
  Lock,
  CreditCard,
  ShieldCheck,
  Edit2,
  RefreshCw,
  ExternalLink,
  Save,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  File,
  Eye,
} from 'lucide-react';
import { profileService } from '../../services/profileService.js';
import { documentService } from '../../services/documentService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, updateUser } = useAuth();

  const isAdmin = ['admin', 'superadmin', 'orgadmin'].includes(
    (user?.roleName || user?.role?.name || '').toLowerCase()
  );

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Employee Documents State (for non-admin users)
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('IDENTITY');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const docFileInputRef = React.useRef(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    emergencyContact: '',
    address: '',
    fatherName: '',
    motherName: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Photo Upload State
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = React.useRef(null);

  const fetchProfile = async (isBackground = false) => {
    try {
      if (isBackground) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await profileService.getMyProfile();
      setProfile(res);
      setFormData({
        phone: res.phone || '',
        emergencyContact: res.emergencyContact || '',
        address: res.address || '',
        fatherName: res.fatherName || '',
        motherName: res.motherName || '',
      });
    } catch (err) {
      console.error('Failed to load employee profile:', err);
      setError(err.message || 'Unable to load profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMyDocs = async () => {
    try {
      setLoadingDocs(true);
      const docs = await documentService.getMyDocuments();
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Failed to load my documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    if (!isAdmin) {
      fetchMyDocs();
    }
  }, [isAdmin]);

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file to upload.');
      return;
    }
    try {
      setUploadingDoc(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('category', uploadCategory);
      formData.append('title', uploadTitle || uploadFile.name);
      formData.append('documentType', uploadCategory === 'IDENTITY' ? 'AADHAAR' : 'CERTIFICATE');

      await documentService.uploadMyDocument(formData);
      toast.success('Document uploaded successfully.');
      setUploadFile(null);
      setUploadTitle('');
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      fetchMyDocs();
    } catch (err) {
      const msg = err.message || 'Failed to upload document.';
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleOpenEdit = () => {
    setFormData({
      phone: profile?.phone || '',
      emergencyContact: profile?.emergencyContact || '',
      address: profile?.address || '',
      fatherName: profile?.fatherName || '',
      motherName: profile?.motherName || '',
    });
    setSaveError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveError(null);
      await profileService.updateMyProfile(formData);
      toast.success('Personal details updated successfully.');
      setIsEditModalOpen(false);
      fetchProfile(true);
    } catch (err) {
      setSaveError(err.message || 'Failed to update personal details.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPhotoModal = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setIsPhotoModalOpen(true);
  };

  const handleClosePhotoModal = () => {
    if (uploadingPhoto || removingPhoto) return;
    setIsPhotoModalOpen(false);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
  };

  const handleSelectPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setPhotoError('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image size exceeds maximum limit of 5MB.');
      return;
    }

    setPhotoError(null);
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) return;
    try {
      setUploadingPhoto(true);
      setPhotoError(null);
      const res = await profileService.uploadAvatar(photoFile);
      const newUrl = res.avatarUrl;
      setProfile((prev) => ({ ...prev, avatarUrl: newUrl }));
      updateUser?.({ avatarUrl: newUrl });
      toast.success('Profile photo updated successfully.');
      handleClosePhotoModal();
    } catch (err) {
      console.error('Failed to upload photo:', err);
      setPhotoError(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setRemovingPhoto(true);
      setPhotoError(null);
      await profileService.removeAvatar();
      setProfile((prev) => ({ ...prev, avatarUrl: null }));
      updateUser?.({ avatarUrl: null });
      toast.success('Profile photo removed.');
      handleClosePhotoModal();
    } catch (err) {
      console.error('Failed to remove photo:', err);
      setPhotoError(err.message || 'Failed to remove photo.');
    } finally {
      setRemovingPhoto(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Loading employee profile..." />;
  }

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Alert
          variant="danger"
          title="Profile Load Error"
          message={error}
          action={
            <Button size="sm" variant="outline" onClick={() => fetchProfile()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const initials = `${profile?.firstName?.[0] || 'E'}${profile?.lastName?.[0] || 'P'}`.toUpperCase();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Professional Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              My Profile
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your personal information, view reporting structure, and review statutory records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchProfile(true)}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Edit2}
            onClick={handleOpenEdit}
          >
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Identity Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar with Photo Upload Trigger */}
          <div className="relative group shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold text-2xl flex items-center justify-center border border-brand-200/60 dark:border-brand-800/60 overflow-hidden shadow-xs relative">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile?.fullName || 'Profile photo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}

              {/* Hover overlay for quick change */}
              <button
                type="button"
                onClick={handleOpenPhotoModal}
                className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-2xl text-[10px] font-semibold"
                aria-label="Change photo"
              >
                <Camera className="w-4 h-4 mb-0.5" />
                <span>Change</span>
              </button>
            </div>

            {/* Camera badge action button */}
            <button
              type="button"
              onClick={handleOpenPhotoModal}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 transition-transform hover:scale-110 focus:outline-none"
              title="Add or update photo"
              aria-label="Add or update photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {profile?.fullName || 'Employee'}
              </h2>
              <Badge variant="outline" size="sm" className="font-mono">
                {profile?.employeeCode || 'EMP-000'}
              </Badge>
              <Badge variant="success" size="sm">
                {profile?.status || 'Active'}
              </Badge>
              <button
                type="button"
                onClick={handleOpenPhotoModal}
                className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium inline-flex items-center gap-1 transition-colors ml-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{profile?.avatarUrl ? 'Change photo' : 'Add photo'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {profile?.designation}
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {profile?.department}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Reports to: <strong className="text-slate-700 dark:text-slate-200 font-medium">{profile?.manager}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Joined: {profile?.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Personal Details & Contact Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal & Family Information */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Personal & Family Information
              </h3>
            </div>
            <button
              type="button"
              onClick={handleOpenEdit}
              className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Father's Name</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {profile?.fatherName || <span className="text-slate-400 font-normal italic">Not specified</span>}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Mother's Name</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {profile?.motherName || <span className="text-slate-400 font-normal italic">Not specified</span>}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Gender</span>
              <span className="font-semibold text-slate-900 dark:text-white capitalize">
                {profile?.gender || 'Not specified'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Employment Type</span>
              <span className="font-semibold text-slate-900 dark:text-white capitalize">
                {profile?.employmentType || 'Full-Time'}
              </span>
            </div>
          </div>
        </div>

        {/* Contact & Residential Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Contact & Address
              </h3>
            </div>
            <button
              type="button"
              onClick={handleOpenEdit}
              className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Official Email
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{profile?.email}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Mobile Phone
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {profile?.phone || <span className="text-slate-400 font-normal italic">Not specified</span>}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-rose-500" />
                Emergency Contact
              </span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {profile?.emergencyContact || <span className="text-slate-400 font-normal italic">Not specified</span>}
              </span>
            </div>

            <div className="pt-1">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Residential Address
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
                {profile?.address || <span className="text-slate-400 italic">No residential address recorded.</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Banking Details (Protected) - Hidden for Admin */}
      {!isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Banking &amp; Account Details
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              <Lock className="w-3 h-3 text-slate-400" />
              Protected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 block">Salary Bank</span>
              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                {profile?.bankName || 'HDFC Bank'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 block">Account Number</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white text-sm tracking-wider">
                {profile?.bankAccountMasked}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 block">IFSC Code</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white text-sm">
                {profile?.bankIfsc || 'HDFC0001234'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 block">PF / UAN Number</span>
              <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-sm">
                {profile?.uanNumber || '101294820194'}
              </span>
            </div>
          </div>

          {/* Change Request Callout */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Need to update your bank details or UAN? Please submit a request to HR via the Help Desk.
            </p>
            <Button
              size="sm"
              variant="outline"
              icon={ExternalLink}
              onClick={() => navigate('/helpdesk?tab=requests')}
              className="shrink-0"
            >
              Submit Request
            </Button>
          </div>
        </div>
      )}

      {/* Employee Documents Upload & Verification Section (Hidden for Admin) */}
      {!isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center ring-1 ring-brand-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  My Documents
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Upload your ID proofs, educational certificates, or address documents for verification.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </span>
          </div>

          {/* Upload Document Box */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-brand-600" />
              Upload a New Document
            </h4>

            <form onSubmit={handleUploadDocument} className="space-y-4">
              {uploadError && <Alert variant="danger" message={uploadError} />}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Document Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="IDENTITY">ID Proof (Aadhaar, PAN, Passport)</option>
                    <option value="EDUCATION">Degree & Education Certificates</option>
                    <option value="EXPERIENCE">Past Experience & Relieving Letters</option>
                    <option value="TAX">Tax Forms & Declarations</option>
                    <option value="MEDICAL">Medical & Fitness Certificates</option>
                    <option value="OTHER">Other Documents</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Document Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aadhaar Card Copy"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select File (PDF, PNG, JPG up to 10MB) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setUploadFile(e.target.files[0]);
                        if (!uploadTitle) {
                          const nameWithoutExt = e.target.files[0].name.replace(/\.[^/.]+$/, '');
                          setUploadTitle(nameWithoutExt);
                        }
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                  />
                </div>
              </div>

              {uploadFile && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    Selected file: <strong className="text-slate-700 dark:text-slate-200">{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(0)} KB)
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={uploadingDoc}
                    icon={Upload}
                  >
                    Confirm &amp; Upload
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* List of Uploaded Documents */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Uploaded Documents
            </h4>

            {loadingDocs ? (
              <div className="py-8 flex flex-col items-center justify-center">
                <LoadingSpinner size="md" />
                <p className="text-xs text-slate-500 mt-2">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <File className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No documents uploaded yet
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Use the upload section above to submit your documents.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                {documents.map((doc) => {
                  const status = (doc.verificationStatus || 'PENDING').toUpperCase();
                  const catMap = {
                    IDENTITY: 'ID Proof',
                    OFFER: 'Offer Letter',
                    EDUCATION: 'Education',
                    EXPERIENCE: 'Experience',
                    TAX: 'Tax Form',
                    MEDICAL: 'Medical',
                    OTHER: 'Other',
                  };
                  return (
                    <div
                      key={doc.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                              {doc.title}
                            </h5>
                            {status === 'VERIFIED' || status === 'APPROVED' ? (
                              <Badge variant="success" size="sm">
                                Approved
                              </Badge>
                            ) : status === 'REJECTED' ? (
                              <Badge variant="danger" size="sm">
                                Rejected
                              </Badge>
                            ) : (
                              <Badge variant="warning" size="sm">
                                Pending Review
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              {catMap[doc.category] || doc.category || 'General'}
                            </span>
                            <span>•</span>
                            <span>
                              Uploaded on{' '}
                              {doc.createdAt
                                ? new Date(doc.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Recent'}
                            </span>
                          </div>

                          {status === 'REJECTED' && doc.rejectionReason && (
                            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-0.5 mt-1.5">
                              <strong>Reason:</strong> {doc.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={Download}
                          onClick={() => documentService.downloadDocument(doc.id, doc.title)}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Personal Information Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Personal Information"
        subtitle="Update your contact phone, emergency contacts, parents' names, and residential address."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {saveError && <Alert variant="danger" message={saveError} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Father's Name
              </label>
              <Input
                type="text"
                placeholder="Father's Full Name"
                value={formData.fatherName}
                onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mother's Name
              </label>
              <Input
                type="text"
                placeholder="Mother's Full Name"
                value={formData.motherName}
                onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mobile Phone
              </label>
              <Input
                type="text"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Emergency Contact Number
              </label>
              <Input
                type="text"
                placeholder="Emergency Contact"
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Residential Address
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              placeholder="Door No, Apartment, Street, City, State, Pincode"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400">
            Note: Bank account and UAN updates cannot be edited directly and must be submitted through Help Desk Service Requests.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={saving}
              icon={Save}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Photo Upload Modal */}
      <Modal
        isOpen={isPhotoModalOpen}
        onClose={handleClosePhotoModal}
        title={profile?.avatarUrl ? 'Update Profile Photo' : 'Add Profile Photo'}
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          {photoError && (
            <Alert variant="danger" message={photoError} />
          )}

          {/* Current & Preview display */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            <div className="text-center space-y-2">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold text-3xl flex items-center justify-center border-2 border-dashed border-brand-300 dark:border-brand-700 overflow-hidden shadow-inner mx-auto">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Current profile" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {photoPreview ? 'New Preview' : 'Current Photo'}
              </p>
            </div>

            {/* Circular mini preview when previewing */}
            {photoPreview && (
              <div className="text-center space-y-2">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-brand-500 overflow-hidden shadow-md mx-auto">
                  <img src={photoPreview} alt="Round Preview" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Avatar View
                </p>
              </div>
            )}
          </div>

          {/* File Picker / Dropzone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            onChange={handleSelectPhoto}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-800/40 hover:bg-brand-50/30 group"
          >
            <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {photoFile ? photoFile.name : 'Click to select a photo from your device'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports JPEG, PNG, WEBP up to 5MB
            </p>
            {photoFile && (
              <p className="text-[11px] text-brand-600 font-semibold mt-1">
                {(photoFile.size / 1024).toFixed(1)} KB — Selected
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {profile?.avatarUrl && !photoPreview ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={Trash2}
                isLoading={removingPhoto}
                disabled={uploadingPhoto}
                onClick={handleRemovePhoto}
              >
                Remove Photo
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2 self-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClosePhotoModal}
                disabled={uploadingPhoto || removingPhoto}
              >
                Cancel
              </Button>
              {photoPreview ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Save}
                  isLoading={uploadingPhoto}
                  onClick={handleUploadPhoto}
                >
                  Save Photo
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Camera}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfilePage;


