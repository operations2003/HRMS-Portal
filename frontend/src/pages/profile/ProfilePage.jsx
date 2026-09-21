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
  CheckCircle2,
  Save,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { profileService } from '../../services/profileService.js';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Edit personal details mode
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    emergencyContact: '',
    address: '',
    fatherName: '',
    motherName: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

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

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveError(null);
      await profileService.updateMyProfile(formData);
      toast.success('Personal contact details updated successfully.');
      setIsEditing(false);
      fetchProfile(true);
    } catch (err) {
      setSaveError(err.message || 'Failed to update personal details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Loading personal employee profile..." />;
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Alert
          variant="danger"
          title="Profile Error"
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Profile Card */}
      <div className="bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-800 text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md text-white flex items-center justify-center text-2xl font-black border border-white/20 shadow-inner">
            {profile?.firstName?.[0] || 'E'}
            {profile?.lastName?.[0] || 'P'}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">
                {profile?.fullName || 'Employee Profile'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 font-mono">
                {profile?.employeeCode || 'EMP-001'}
              </span>
            </div>
            <p className="text-sm text-brand-100 font-medium">
              {profile?.designation} • {profile?.department}
            </p>
            <p className="text-xs text-brand-200">
              Reporting to: <strong>{profile?.manager}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => fetchProfile(true)}
            loading={refreshing}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1" /> {isEditing ? 'Cancel' : 'Edit Personal Info'}
          </Button>
        </div>
      </div>

      {/* Edit Form or Display Grid */}
      {isEditing ? (
        <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Edit Personal & Contact Information
            </h2>
            <span className="text-xs text-slate-400">
              Bank and UAN changes require Service Request verification.
            </span>
          </div>

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
                Phone Number
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
              Current Residential Address
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              placeholder="Door No, Apartment, Street, City, State, Pincode"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              icon={Save}
            >
              Save Profile Updates
            </Button>
          </div>
        </form>
      ) : null}

      {/* Profile Details Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal & Family Information */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Heart className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Personal & Family Information
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Father's Name</span>
              <span className="text-slate-900 dark:text-white font-bold">{profile?.fatherName || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Mother's Name</span>
              <span className="text-slate-900 dark:text-white font-bold">{profile?.motherName || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Gender</span>
              <span className="text-slate-900 dark:text-white font-medium">{profile?.gender || 'Not Specified'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Date of Joining</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {profile?.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Contact & Residential Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Phone className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Contact & Address
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Official Email</span>
              <span className="text-slate-900 dark:text-white font-bold font-mono">{profile?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Mobile Phone</span>
              <span className="text-slate-900 dark:text-white font-bold">{profile?.phone || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Emergency Contact</span>
              <span className="text-slate-900 dark:text-white font-bold text-rose-600">{profile?.emergencyContact || '—'}</span>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block font-medium mb-1">Residential Address</span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {profile?.address || 'No residential address recorded.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bank & Statutory Registration Overview (View-Only) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Verified Banking & Statutory Registrations
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            Read-Only Protection
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Salary Bank</span>
            <span className="text-slate-900 dark:text-white font-bold">{profile?.bankName || 'HDFC Bank'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Account Number</span>
            <span className="text-slate-900 dark:text-white font-mono font-bold tracking-wider">{profile?.bankAccountMasked}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">IFSC Code</span>
            <span className="text-slate-900 dark:text-white font-mono font-bold">{profile?.bankIfsc || 'HDFC0001234'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Universal Account No. (UAN)</span>
            <span className="text-brand-600 dark:text-brand-400 font-mono font-black text-sm">{profile?.uanNumber || '101294820194'}</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span>
            Need to update your bank account or UAN registration? Official changes are securely handled by HR through the service desk.
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => navigate('/helpdesk?tab=requests')}
            className="shrink-0"
          >
            Submit Service Request
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
