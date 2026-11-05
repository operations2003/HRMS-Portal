import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Heart,
  Pin,
  CheckCircle2,
  Clock,
  Sparkles,
  User,
  X,
  Share2,
  Award,
  Send,
  HelpCircle,
  Star,
  Check,
  Plus,
  Trash2,
  Calendar,
  FileText,
  AlertCircle,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { engagementService } from '../../services/engagementService.js';
import { employeeService } from '../../services/employeeService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';

export const EmployeeEngagementHub = () => {
  const { user, hasPermission } = useAuth();
  const toast = useToast();

  const allRoles = (Array.isArray(user?.roles) ? user.roles : [user?.roleName || user?.role?.name || user?.role || ''])
    .filter(Boolean)
    .map((r) => String(r).toLowerCase().trim());
  const userRoleStr = (user?.roleName || user?.role?.name || user?.role || '').toLowerCase().trim();
  const isEmployeeRole = userRoleStr === 'employee' || userRoleStr === 'staff' || userRoleStr === 'intern';
  const isHrOrAdmin =
    !isEmployeeRole && (
      allRoles.some((r) => ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].some((adm) => r.includes(adm))) ||
      (user?.email || '').toLowerCase() === 'sheetalbedi@tasknera.com'
    );

  const [activeTab, setActiveTab] = useState('announcements'); // 'announcements' | 'kudos'
  const [announcements, setAnnouncements] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals - Announcement
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    category: 'GENERAL',
    content: '',
    isPinned: false,
    expiryDate: '',
  });

  const openNewAnnouncement = (defaultCategory = 'GENERAL') => {
    setAnnouncementForm({
      title: '',
      category: defaultCategory,
      content: '',
      isPinned: false,
      expiryDate: '',
    });
    setShowAnnouncementModal(true);
  };

  const [showKudosModal, setShowKudosModal] = useState(false);
  const [kudosSubmitting, setKudosSubmitting] = useState(false);
  const [kudosForm, setKudosForm] = useState({
    recipientId: '',
    badgeType: 'KUDOS',
    message: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [announceRes, kudosRes] = await Promise.allSettled([
        engagementService.getAnnouncements(),
        engagementService.getRecognitions(),
      ]);

      if (announceRes.status === 'fulfilled') {
        const res = announceRes.value;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setAnnouncements(list);
      }

      if (kudosRes.status === 'fulfilled') {
        const res = kudosRes.value;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setRecognitions(list);
      }
    } catch (err) {
      toast.error('Failed to load engagement updates.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await employeeService.listEmployees({ status: 'Active', limit: 250 });
      const empList = Array.isArray(res?.employees)
        ? res.employees
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setEmployees(empList);
    } catch (err) {
      console.error('Failed to load employees for kudos:', err);
    }
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await engagementService.markAsRead(id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true, read_count: (Number(a.read_count) || 0) + 1 } : a))
      );
      toast.success('Notice marked as read.');
    } catch (err) {
      toast.error('Failed to update read status.');
    }
  };

  const handleGiveKudos = async (e) => {
    e.preventDefault();
    if (!kudosForm.recipientId || !kudosForm.message.trim()) {
      toast.error('Please select a colleague and write a message.');
      return;
    }

    setKudosSubmitting(true);
    try {
      await engagementService.giveRecognition(kudosForm);
      toast.success('Appreciation posted to company Kudos wall!');
      setShowKudosModal(false);
      setKudosForm({ recipientId: '', badgeType: 'KUDOS', message: '' });
      
      // Refresh recognitions
      const res = await engagementService.getRecognitions();
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      setRecognitions(list);
    } catch (err) {
      toast.error(err.message || 'Failed to give recognition.');
    } finally {
      setKudosSubmitting(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim()) {
      toast.error('Please enter an announcement title.');
      return;
    }
    if (!announcementForm.content.trim()) {
      toast.error('Please enter announcement content.');
      return;
    }

    setAnnouncementSubmitting(true);
    try {
      await engagementService.createAnnouncement({
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        category: announcementForm.category,
        isPinned: announcementForm.isPinned,
        expiryDate: announcementForm.expiryDate || null,
        targetType: 'ALL',
      });
      toast.success('Announcement broadcast successfully!');
      setShowAnnouncementModal(false);
      setAnnouncementForm({
        title: '',
        category: 'GENERAL',
        content: '',
        isPinned: false,
        expiryDate: '',
      });
      const freshRes = await engagementService.getAnnouncements();
      const list = Array.isArray(freshRes?.data) ? freshRes.data : Array.isArray(freshRes?.items) ? freshRes.items : Array.isArray(freshRes) ? freshRes : [];
      setAnnouncements(list);
    } catch (err) {
      toast.error(err.message || 'Failed to publish announcement.');
    } finally {
      setAnnouncementSubmitting(false);
    }
  };

  const unreadAnnouncementsCount = announcements.filter((a) => !a.is_read).length;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Top Header & Navigation */}
      <div className="p-6 pb-0 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-4 ring-indigo-50">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Company Notice Board & Hub</h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Workplace
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Official company announcements, notices, and peer recognitions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isHrOrAdmin && activeTab === 'announcements' && (
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => openNewAnnouncement('GENERAL')}
                className="text-sm font-semibold shadow-sm shadow-indigo-500/20"
              >
                Post Announcement
              </Button>
            )}

            <Button
              variant="secondary"
              size="md"
              icon={Heart}
              onClick={() => {
                fetchEmployees();
                setShowKudosModal(true);
              }}
              className="text-sm font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 shadow-sm"
            >
              Give Kudos
            </Button>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`pb-3.5 text-sm font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'announcements'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Announcements & News</span>
            {unreadAnnouncementsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                {unreadAnnouncementsCount} unread
              </span>
            ) : announcements.length > 0 ? (
              <span className="text-xs text-slate-400 font-normal">({announcements.length})</span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('kudos')}
            className={`pb-3.5 text-sm font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'kudos'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Kudos & Wall of Fame</span>
            <span className="text-xs text-slate-400 font-normal">({recognitions.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="p-6">
        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner message="Loading engagement updates..." />
          </div>
        ) : (
          <>
            {/* 1. ANNOUNCEMENTS TAB */}
            {activeTab === 'announcements' && (
              <div className="space-y-4">
                {announcements.length > 0 ? (
                  <div className="space-y-3.5">
                    {announcements.map((item) => {
                      const categoryConfig = {
                        URGENT: {
                          bg: 'bg-rose-50 text-rose-700 border-rose-200',
                          icon: AlertCircle,
                          label: 'Urgent Alert',
                        },
                        POLICY: {
                          bg: 'bg-purple-50 text-purple-700 border-purple-200',
                          icon: FileText,
                          label: 'Policy Bulletin',
                        },
                        EVENT: {
                          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          icon: Sparkles,
                          label: 'Company Event',
                        },
                        GENERAL: {
                          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                          icon: Megaphone,
                          label: 'Company Notice',
                        },
                      };

                      const cfg = categoryConfig[item.category] || categoryConfig.GENERAL;
                      const CatIcon = cfg.icon;

                      return (
                        <div
                          key={item.id}
                          className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                            item.is_pinned
                              ? 'bg-amber-50/30 border-amber-200/90 shadow-xs'
                              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {item.is_pinned && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1 border border-amber-200/60 shadow-2xs">
                                  <Pin className="w-3.5 h-3.5 text-amber-700" /> Pinned
                                </span>
                              )}
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${cfg.bg}`}
                              >
                                <CatIcon className="w-3.5 h-3.5" />
                                {cfg.label}
                              </span>
                              <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                            </div>

                            <span className="text-xs text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(item.publish_date || item.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>

                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
                            {item.content}
                          </p>

                          <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                                {(item.author_first?.[0] || 'A').toUpperCase()}
                              </div>
                              <span>
                                Broadcast by{' '}
                                <strong className="text-slate-800 font-semibold">
                                  {item.author_first} {item.author_last}
                                </strong>
                              </span>
                            </div>

                            {!item.is_read ? (
                              <button
                                onClick={() => handleMarkAsRead(item.id)}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-xl text-xs transition flex items-center gap-1.5 border border-indigo-200/50"
                              >
                                <Check className="w-3.5 h-3.5" /> Mark as Read
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 px-6 text-center rounded-3xl bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-indigo-500/5 text-indigo-600 flex items-center justify-center ring-8 ring-indigo-50/60 mb-4 shadow-xs">
                      <Megaphone className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 tracking-tight">No Company Announcements Yet</h4>
                    <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                      Broadcast official company news, policy updates, and executive bulletins to keep your entire workforce aligned.
                    </p>

                    {isHrOrAdmin ? (
                      <div className="mt-7 w-full max-w-2xl">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                          Quick-start announcement templates
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                          <button
                            type="button"
                            onClick={() => openNewAnnouncement('GENERAL')}
                            className="group p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                              <Megaphone className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                                <span>General Update</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                              </div>
                              <p className="text-xs text-slate-500 mt-1 leading-normal">
                                Company news, milestones & team updates
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => openNewAnnouncement('POLICY')}
                            className="group p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-purple-400 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors flex items-center justify-between">
                                <span>Policy Bulletin</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                              </div>
                              <p className="text-xs text-slate-500 mt-1 leading-normal">
                                HR guidelines, compliance & workplace rules
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => openNewAnnouncement('EVENT')}
                            className="group p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center justify-between">
                                <span>Event & Holiday</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                              </div>
                              <p className="text-xs text-slate-500 mt-1 leading-normal">
                                Offsites, celebrations & holiday schedules
                              </p>
                            </div>
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => openNewAnnouncement('GENERAL')}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Or create a custom announcement from scratch
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        You're all caught up! New bulletins will appear as soon as leadership posts them.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. KUDOS WALL TAB */}
            {activeTab === 'kudos' && (
              <div className="space-y-4">
                {recognitions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {recognitions.map((kudos) => {
                      const badgeColorMap = {
                        KUDOS: 'from-amber-500/10 to-orange-500/10 border-amber-200 text-amber-700',
                        TEAM_PLAYER: 'from-blue-500/10 to-indigo-500/10 border-blue-200 text-blue-700',
                        INNOVATOR: 'from-purple-500/10 to-pink-500/10 border-purple-200 text-purple-700',
                        LEADERSHIP: 'from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-700',
                      };

                      const colorClass = badgeColorMap[kudos.badge_type] || badgeColorMap.KUDOS;

                      return (
                        <div
                          key={kudos.id}
                          className="bg-gradient-to-br from-white via-white to-slate-50 p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow transition flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider flex items-center gap-1.5 ${colorClass}`}>
                                <Sparkles className="w-3.5 h-3.5" />
                                {kudos.badge_type?.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                {new Date(kudos.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <p className="text-sm text-slate-800 italic font-medium leading-relaxed bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
                              "{kudos.message}"
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                            <span className="text-slate-600">
                              To: <strong className="text-slate-900">{kudos.recipient_first} {kudos.recipient_last}</strong>
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              From: {kudos.sender_first}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 px-6 text-center rounded-3xl bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/10 via-pink-500/10 to-rose-500/5 text-rose-500 flex items-center justify-center ring-8 ring-rose-50/60 mb-4 shadow-xs">
                      <Heart className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 tracking-tight">No Kudos Shared Yet</h4>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed mb-5">
                      Be the first to recognize a colleague's great work, extra effort, or teamwork on the company wall of fame!
                    </p>
                    <Button
                      size="md"
                      icon={Heart}
                      onClick={() => {
                        fetchEmployees();
                        setShowKudosModal(true);
                      }}
                      className="text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20"
                    >
                      Send First Kudos
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL 2: GIVE KUDOS */}
      {showKudosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Give Kudos to a Teammate</h3>
                  <p className="text-xs text-slate-500">Celebrate wins and appreciate a colleague</p>
                </div>
              </div>
              <button
                onClick={() => setShowKudosModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGiveKudos} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Select Colleague *</label>
                <select
                  required
                  value={kudosForm.recipientId}
                  onChange={(e) => setKudosForm({ ...kudosForm, recipientId: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="">Search or choose an employee...</option>
                  {employees
                    .filter((emp) => {
                      if (user?.employeeId && emp.id === user.employeeId) return false;
                      if (user?.id && (emp.userId === user.id || emp.user?.id === user.id)) return false;
                      return true;
                    })
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode || emp.designation?.title || 'Team Member'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Appreciation Badge</label>
                <select
                  value={kudosForm.badgeType}
                  onChange={(e) => setKudosForm({ ...kudosForm, badgeType: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="KUDOS">🌟 Kudos (General Excellence)</option>
                  <option value="TEAM_PLAYER">🤝 Team Player & Helper</option>
                  <option value="INNOVATOR">💡 Innovator & Problem Solver</option>
                  <option value="LEADERSHIP">🚀 Exemplary Leadership</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Recognition Message *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="What did they achieve? Thank them for their hard work..."
                  value={kudosForm.message}
                  onChange={(e) => setKudosForm({ ...kudosForm, message: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button variant="neutral" type="button" onClick={() => setShowKudosModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={kudosSubmitting} icon={Heart} className="bg-rose-600 hover:bg-rose-700 text-sm font-semibold">
                  {kudosSubmitting ? 'Posting...' : 'Post Appreciation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: POST ANNOUNCEMENT (HR/Admin) */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 ring-4 ring-indigo-50/50">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Post Company Announcement</h3>
                  <p className="text-xs text-slate-500">Broadcast news, guidelines, or notices to all employees</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    announcementForm.category === 'POLICY'
                      ? 'e.g. Updated Remote Work & Leave Guidelines'
                      : announcementForm.category === 'EVENT'
                      ? 'e.g. Annual Townhall & Team Celebration'
                      : announcementForm.category === 'URGENT'
                      ? 'e.g. Scheduled System Maintenance Notice'
                      : 'e.g. Q4 Company All-Hands & Strategy Update'
                  }
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Category</label>
                  <select
                    value={announcementForm.category}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, category: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="GENERAL">📢 General Notice</option>
                    <option value="POLICY">📋 Policy Bulletin</option>
                    <option value="EVENT">🎉 Company Event</option>
                    <option value="URGENT">🚨 Urgent Announcement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={announcementForm.expiryDate}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, expiryDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Content / Notice Message *</label>
                <textarea
                  rows="4"
                  required
                  placeholder="Write the full announcement or message for the workforce..."
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition">
                <input
                  type="checkbox"
                  checked={announcementForm.isPinned}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-amber-600" /> Pin notice to top of announcements feed
                  </span>
                  <span className="text-slate-500 block mt-0.5">Keeps this notice prominently displayed for all employees</span>
                </div>
              </label>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button variant="neutral" type="button" onClick={() => setShowAnnouncementModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={announcementSubmitting}
                  icon={Megaphone}
                  className="text-sm font-semibold shadow-sm"
                >
                  {announcementSubmitting ? 'Publishing...' : 'Publish Announcement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
