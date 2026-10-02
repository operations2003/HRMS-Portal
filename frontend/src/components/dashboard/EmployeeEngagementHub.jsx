import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Vote,
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

  const [activeTab, setActiveTab] = useState('surveys'); // 'surveys' | 'announcements' | 'kudos'
  const [announcements, setAnnouncements] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [activeSurveyModal, setActiveSurveyModal] = useState(null);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

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

  // Modals - Survey & Pulse Poll
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyType, setSurveyType] = useState('poll'); // 'poll' | 'rating' | 'feedback'
  const [surveyForm, setSurveyForm] = useState({
    title: '',
    description: '',
    isAnonymous: true,
    endDate: '',
    options: ['', ''],
  });

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
      const [surveysRes, announceRes, kudosRes] = await Promise.allSettled([
        engagementService.getSurveys(),
        engagementService.getAnnouncements(),
        engagementService.getRecognitions(),
      ]);

      if (surveysRes.status === 'fulfilled') {
        const res = surveysRes.value;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setSurveys(list);
      }

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

  const handleOpenSurvey = (survey) => {
    setActiveSurveyModal(survey);
    setSurveyAnswers({});
  };

  const handleSubmitSurvey = async (e) => {
    e.preventDefault();
    if (!activeSurveyModal) return;

    setSubmittingSurvey(true);
    try {
      await engagementService.submitSurveyResponse(activeSurveyModal.id, surveyAnswers);
      toast.success('Thank you! Your response has been recorded.');
      
      // Update local surveys state
      setSurveys((prev) =>
        prev.map((s) =>
          s.id === activeSurveyModal.id
            ? { ...s, has_responded: true, total_responses: (Number(s.total_responses) || 0) + 1 }
            : s
        )
      );
      setActiveSurveyModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to submit survey response.');
    } finally {
      setSubmittingSurvey(false);
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

  const handleAddOption = () => {
    if (surveyForm.options.length >= 6) {
      toast.error('Maximum 6 poll options allowed.');
      return;
    }
    setSurveyForm((prev) => ({ ...prev, options: [...prev.options, ''] }));
  };

  const handleRemoveOption = (index) => {
    if (surveyForm.options.length <= 2) {
      toast.error('Pulse poll requires at least 2 options.');
      return;
    }
    setSurveyForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, idx) => idx !== index),
    }));
  };

  const handleOptionChange = (index, value) => {
    setSurveyForm((prev) => {
      const next = [...prev.options];
      next[index] = value;
      return { ...prev, options: next };
    });
  };

  const handleCreateSurvey = async (e) => {
    e.preventDefault();
    if (!surveyForm.title.trim()) {
      toast.error('Please enter a survey/poll question or title.');
      return;
    }

    let questions = [];
    if (surveyType === 'poll') {
      const validOptions = surveyForm.options.map((o) => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        toast.error('Pulse poll requires at least 2 options.');
        return;
      }
      questions = [
        {
          id: 'q_poll_1',
          type: 'choice',
          question: surveyForm.title.trim(),
          text: surveyForm.title.trim(),
          options: validOptions,
        },
      ];
    } else if (surveyType === 'rating') {
      questions = [
        {
          id: 'q_rating_1',
          type: 'rating',
          question: surveyForm.title.trim(),
          text: surveyForm.title.trim(),
        },
      ];
    } else {
      questions = [
        {
          id: 'q_feedback_1',
          type: 'text',
          question: surveyForm.title.trim(),
          text: surveyForm.title.trim(),
        },
      ];
    }

    setSurveySubmitting(true);
    try {
      await engagementService.createSurvey({
        title: surveyForm.title.trim(),
        description: surveyForm.description.trim(),
        questions,
        isAnonymous: surveyForm.isAnonymous,
        endDate: surveyForm.endDate || null,
        targetType: 'ALL',
      });
      toast.success('Survey & Pulse Poll created successfully!');
      setShowSurveyModal(false);
      setSurveyForm({
        title: '',
        description: '',
        isAnonymous: true,
        endDate: '',
        options: ['', ''],
      });
      const freshRes = await engagementService.getSurveys();
      const list = Array.isArray(freshRes?.data) ? freshRes.data : Array.isArray(freshRes?.items) ? freshRes.items : Array.isArray(freshRes) ? freshRes : [];
      setSurveys(list);
    } catch (err) {
      toast.error(err.message || 'Failed to create survey.');
    } finally {
      setSurveySubmitting(false);
    }
  };

  const pendingSurveysCount = surveys.filter((s) => !s.has_responded).length;
  const unreadAnnouncementsCount = announcements.filter((a) => !a.is_read).length;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Top Header & Tab Navigation */}
      <div className="p-6 pb-0 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Engagement & Community Hub</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Share your voice in active surveys, stay informed with company notices, and celebrate colleagues
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isHrOrAdmin && activeTab === 'announcements' && (
              <Button
                variant="primary"
                size="md"
                icon={Megaphone}
                onClick={() => setShowAnnouncementModal(true)}
                className="text-sm font-semibold shadow-sm"
              >
                Post Announcement
              </Button>
            )}

            {isHrOrAdmin && activeTab === 'surveys' && (
              <Button
                variant="primary"
                size="md"
                icon={Vote}
                onClick={() => setShowSurveyModal(true)}
                className="text-sm font-semibold shadow-sm"
              >
                Create Pulse Poll
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
            onClick={() => setActiveTab('surveys')}
            className={`pb-3.5 text-sm font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'surveys'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Vote className="w-4 h-4" />
            <span>Surveys & Pulse Polls</span>
            {pendingSurveysCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                {pendingSurveysCount} pending
              </span>
            )}
          </button>

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
            {unreadAnnouncementsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                {unreadAnnouncementsCount} unread
              </span>
            )}
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
            {/* 1. SURVEYS & POLLS TAB */}
            {activeTab === 'surveys' && (
              <div className="space-y-4">
                {surveys.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {surveys.map((survey) => {
                      const questions = Array.isArray(survey.questions)
                        ? survey.questions
                        : typeof survey.questions === 'string'
                        ? JSON.parse(survey.questions || '[]')
                        : [];

                      return (
                        <div
                          key={survey.id}
                          className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                            survey.has_responded
                              ? 'bg-slate-50/70 border-slate-200'
                              : 'bg-white border-indigo-200 shadow-sm hover:border-indigo-300 hover:shadow-md'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={survey.has_responded ? 'success' : 'brand'}>
                                {survey.has_responded ? '✓ Response Submitted' : 'Active Pulse'}
                              </Badge>
                              <span className="text-xs text-slate-500 font-semibold">
                                {survey.total_responses || 0} response(s)
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-slate-900 leading-snug">
                              {survey.title}
                            </h3>

                            <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                              {survey.description || 'Quick pulse survey for company feedback and workplace experience.'}
                            </p>
                          </div>

                          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-sm">
                            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                              {survey.is_anonymous ? '🔒 100% Anonymous' : 'Named survey'} • {questions.length || 1} question(s)
                            </span>

                            {survey.has_responded ? (
                              <span className="text-emerald-600 font-bold text-sm flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> Completed
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleOpenSurvey(survey)}
                                className="shadow-sm shadow-indigo-500/20 text-sm font-semibold px-4"
                              >
                                Take Survey
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <Vote className="w-12 h-12 text-slate-300 mx-auto mb-2.5" />
                    <h4 className="text-base font-bold text-slate-800">No active pulse surveys</h4>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                      You are all caught up! New feedback surveys and team polls will appear here when launched.
                    </p>
                    {isHrOrAdmin && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Plus}
                        onClick={() => setShowSurveyModal(true)}
                        className="mt-4 text-sm font-semibold"
                      >
                        Create Pulse Poll
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. ANNOUNCEMENTS TAB */}
            {activeTab === 'announcements' && (
              <div className="space-y-4">
                {announcements.length > 0 ? (
                  <div className="space-y-3.5">
                    {announcements.map((item) => (
                      <div
                        key={item.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          item.is_pinned
                            ? 'bg-amber-50/30 border-amber-200 shadow-sm'
                            : 'bg-white border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-2.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {item.is_pinned && (
                              <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1">
                                <Pin className="w-3.5 h-3.5" /> Pinned Notice
                              </span>
                            )}
                            <Badge
                              variant={
                                item.category === 'URGENT'
                                  ? 'danger'
                                  : item.category === 'POLICY'
                                  ? 'purple'
                                  : item.category === 'EVENT'
                                  ? 'emerald'
                                  : 'info'
                              }
                            >
                              {item.category || 'NOTICE'}
                            </Badge>
                            <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                          </div>

                          <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
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

                        <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                          <span>
                            Broadcast by <strong className="text-slate-800">{item.author_first} {item.author_last}</strong> • {item.read_count || 0} read(s)
                          </span>

                          {!item.is_read ? (
                            <button
                              onClick={() => handleMarkAsRead(item.id)}
                              className="px-3.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl text-sm transition flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" /> Mark as Read
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold flex items-center gap-1.5 text-sm">
                              <CheckCircle2 className="w-4 h-4" /> Acknowledged
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-2.5" />
                    <h4 className="text-base font-bold text-slate-800">No company announcements</h4>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                      General announcements, notices, and policy bulletins will be broadcast here.
                    </p>
                    {isHrOrAdmin && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Plus}
                        onClick={() => setShowAnnouncementModal(true)}
                        className="mt-4 text-sm font-semibold"
                      >
                        Broadcast Announcement
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. KUDOS WALL TAB */}
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
                  <div className="py-12 text-center rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
                    <Heart className="w-12 h-12 text-rose-300 mx-auto mb-2.5" />
                    <h4 className="text-base font-bold text-slate-800">No Kudos posted yet</h4>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto mb-4">
                      Be the first to recognize a colleague's great work and dedication!
                    </p>
                    <Button
                      size="md"
                      icon={Heart}
                      onClick={() => {
                        fetchEmployees();
                        setShowKudosModal(true);
                      }}
                      className="text-sm font-semibold"
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

      {/* MODAL 1: TAKE SURVEY / ANSWER POLL */}
      {activeSurveyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="brand">Active Pulse Survey</Badge>
                  {activeSurveyModal.is_anonymous && (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      🔒 100% Anonymous
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{activeSurveyModal.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{activeSurveyModal.description}</p>
              </div>
              <button
                onClick={() => setActiveSurveyModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSurvey} className="space-y-5">
              {(() => {
                const questions = Array.isArray(activeSurveyModal.questions)
                  ? activeSurveyModal.questions
                  : typeof activeSurveyModal.questions === 'string'
                  ? JSON.parse(activeSurveyModal.questions || '[]')
                  : [];

                if (questions.length === 0) {
                  // Default satisfaction question if no specific questions defined
                  return (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-800 mb-2.5">
                          1. Overall, how satisfied are you with our workplace culture and support?
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              type="button"
                              key={val}
                              onClick={() => setSurveyAnswers({ ...surveyAnswers, rating: val })}
                              className={`py-3.5 rounded-xl border text-sm font-bold transition flex flex-col items-center gap-1.5 ${
                                surveyAnswers.rating === val
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <Star className={`w-4 h-4 ${surveyAnswers.rating === val ? 'fill-white' : ''}`} />
                              <span>{val} {val === 1 ? 'Poor' : val === 5 ? 'Great' : ''}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1.5">
                          2. Any comments or suggestions for leadership? (Optional)
                        </label>
                        <textarea
                          rows="3"
                          placeholder="Your open thoughts..."
                          value={surveyAnswers.comments || ''}
                          onChange={(e) => setSurveyAnswers({ ...surveyAnswers, comments: e.target.value })}
                          className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  );
                }

                return questions.map((q, idx) => {
                  const qId = q.id || `q_${idx}`;
                  const isRating = q.type === 'rating';
                  const options = Array.isArray(q.options) ? q.options : [];

                  return (
                    <div key={qId} className="space-y-2.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                      <label className="block text-sm font-bold text-slate-800">
                        {idx + 1}. {q.text || q.question || 'Survey Question'}
                      </label>

                      {options.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          {options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition text-sm ${
                                surveyAnswers[qId] === opt
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${qId}`}
                                value={opt}
                                checked={surveyAnswers[qId] === opt}
                                onChange={() => setSurveyAnswers({ ...surveyAnswers, [qId]: opt })}
                                className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : isRating ? (
                        <div className="grid grid-cols-5 gap-2 pt-1.5">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              type="button"
                              key={val}
                              onClick={() => setSurveyAnswers({ ...surveyAnswers, [qId]: val })}
                              className={`py-3 rounded-xl border text-sm font-bold transition flex flex-col items-center gap-1 ${
                                surveyAnswers[qId] === val
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <Star className={`w-4 h-4 ${surveyAnswers[qId] === val ? 'fill-white' : ''}`} />
                              <span>{val}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          rows="2"
                          placeholder="Your answer..."
                          value={surveyAnswers[qId] || ''}
                          onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [qId]: e.target.value })}
                          className="w-full text-sm bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      )}
                    </div>
                  );
                });
              })()}

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
                <Button variant="neutral" type="button" onClick={() => setActiveSurveyModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingSurvey} icon={Send} className="text-sm font-semibold">
                  {submittingSurvey ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Broadcast Announcement</h3>
                  <p className="text-xs text-slate-500">Post news, updates, or policy notices to all employees</p>
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
                  placeholder="e.g. Q4 Townhall Meeting / Holiday Schedule / Policy Update"
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
                    <option value="URGENT">🚨 Urgent Announcement</option>
                    <option value="POLICY">📋 Policy Bulletin</option>
                    <option value="EVENT">🎉 Company Event</option>
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
                  icon={Send}
                  className="text-sm font-semibold shadow-sm"
                >
                  {announcementSubmitting ? 'Publishing...' : 'Publish Announcement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE SURVEY & PULSE POLL (HR/Admin) */}
      {showSurveyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <Vote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Create Survey & Pulse Poll</h3>
                  <p className="text-xs text-slate-500">Collect employee feedback or launch a quick team poll</p>
                </div>
              </div>
              <button
                onClick={() => setShowSurveyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSurvey} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Poll Question / Survey Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Which team outing do you prefer this quarter?"
                  value={surveyForm.title}
                  onChange={(e) => setSurveyForm({ ...surveyForm, title: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Brief context or instructions for respondents..."
                  value={surveyForm.description}
                  onChange={(e) => setSurveyForm({ ...surveyForm, description: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Feedback Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSurveyType('poll')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      surveyType === 'poll'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Vote className="w-4 h-4" />
                    <span>Multiple Choice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveyType('rating')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      surveyType === 'rating'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                    <span>1-5 Star Rating</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveyType('feedback')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      surveyType === 'feedback'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>Open Feedback</span>
                  </button>
                </div>
              </div>

              {surveyType === 'poll' && (
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Poll Options (Min 2, Max 6)
                    </label>
                    {surveyForm.options.length < 6 && (
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Option
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {surveyForm.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-6 text-xs font-bold text-slate-400 text-center">{idx + 1}.</span>
                        <input
                          type="text"
                          required
                          placeholder={`Option ${idx + 1}...`}
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          className="flex-1 text-sm border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        {surveyForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">End Date (Optional)</label>
                  <input
                    type="date"
                    value={surveyForm.endDate}
                    onChange={(e) => setSurveyForm({ ...surveyForm, endDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center sm:pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={surveyForm.isAnonymous}
                      onChange={(e) => setSurveyForm({ ...surveyForm, isAnonymous: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700">🔒 100% Anonymous Responses</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button variant="neutral" type="button" onClick={() => setShowSurveyModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={surveySubmitting}
                  icon={Vote}
                  className="text-sm font-semibold shadow-sm"
                >
                  {surveySubmitting ? 'Creating...' : 'Launch Poll / Survey'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
