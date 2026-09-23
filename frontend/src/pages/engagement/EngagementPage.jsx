import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Vote,
  Heart,
  Pin,
  CheckCircle2,
  Clock,
  Sparkles,
  User,
  X,
  Share2,
  Star,
  Send,
  Trash2,
} from 'lucide-react';
import { engagementService } from '../../services/engagementService.js';
import { employeeService } from '../../services/employeeService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';

export const EngagementPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('announcements'); // 'announcements' | 'surveys' | 'kudos'
  const [announcements, setAnnouncements] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);

  // Forms
  const [announceForm, setAnnounceForm] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    targetType: 'ALL',
    isPinned: false,
  });

  const [kudosForm, setKudosForm] = useState({
    recipientId: '',
    badgeType: 'KUDOS',
    message: '',
  });

  const [surveyForm, setSurveyForm] = useState({
    title: '',
    description: '',
    isAnonymous: true,
    targetType: 'ALL',
    questions: [
      { id: 'q1', text: 'How satisfied are you with team collaboration and support?', type: 'rating' },
      { id: 'q2', text: 'What is one suggestion you have to improve our workflow?', type: 'text' },
    ],
  });

  const [answeringSurvey, setAnsweringSurvey] = useState(null);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

  const isHrOrAdmin = hasRole(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'announcements') {
        const res = await engagementService.getAnnouncements();
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setAnnouncements(list);
      } else if (activeTab === 'surveys') {
        const res = await engagementService.getSurveys();
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setSurveys(list);
      } else if (activeTab === 'kudos') {
        const res = await engagementService.getRecognitions();
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setRecognitions(list);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load engagement data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

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
      console.error('Failed to load employees for engagement:', err);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await engagementService.createAnnouncement(announceForm);
      toast.success('Announcement published successfully.');
      setShowAnnounceModal(false);
      setAnnounceForm({ title: '', content: '', category: 'GENERAL', targetType: 'ALL', isPinned: false });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to publish announcement.');
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await engagementService.markAsRead(id);
      toast.success('Acknowledged announcement.');
      loadData();
    } catch (err) {
      // Ignore
    }
  };

  const handleGiveKudos = async (e) => {
    e.preventDefault();
    try {
      await engagementService.giveRecognition(kudosForm);
      toast.success('Recognition posted to company Kudos wall!');
      setShowKudosModal(false);
      setKudosForm({ recipientId: '', badgeType: 'KUDOS', message: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to give recognition.');
    }
  };

  const handleCreateSurvey = async (e) => {
    e.preventDefault();
    if (!surveyForm.title.trim()) {
      toast.error('Survey title is required.');
      return;
    }
    try {
      await engagementService.createSurvey(surveyForm);
      toast.success('Survey launched successfully!');
      setShowSurveyModal(false);
      setSurveyForm({
        title: '',
        description: '',
        isAnonymous: true,
        targetType: 'ALL',
        questions: [
          { id: 'q1', text: 'How satisfied are you with team collaboration and support?', type: 'rating' },
          { id: 'q2', text: 'What is one suggestion you have to improve our workflow?', type: 'text' },
        ],
      });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to create survey.');
    }
  };

  const handleSubmitSurveyResponse = async (e) => {
    e.preventDefault();
    if (!answeringSurvey) return;
    setSubmittingSurvey(true);
    try {
      await engagementService.submitSurveyResponse(answeringSurvey.id, surveyAnswers);
      toast.success('Survey response submitted!');
      setAnsweringSurvey(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit survey response.');
    } finally {
      setSubmittingSurvey(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-indigo-600" />
            Employee Engagement & Communication
          </h1>
          <p className="text-sm text-slate-500">
            Company-wide broadcasts, interactive polls, feedback, and peer recognition Kudos wall
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'kudos' && (
            <Button
              onClick={() => {
                fetchEmployees();
                setShowKudosModal(true);
              }}
              icon={Heart}
            >
              Give Kudos
            </Button>
          )}
          {isHrOrAdmin && activeTab === 'announcements' && (
            <Button onClick={() => setShowAnnounceModal(true)} icon={Plus}>
              Broadcast Notice
            </Button>
          )}
          {isHrOrAdmin && activeTab === 'surveys' && (
            <Button onClick={() => setShowSurveyModal(true)} icon={Plus}>
              Launch Survey & Poll
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'announcements'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Announcements & News
        </button>
        <button
          onClick={() => setActiveTab('surveys')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'surveys'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Vote className="w-4 h-4" />
          Surveys & Polls
        </button>
        <button
          onClick={() => setActiveTab('kudos')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'kudos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Heart className="w-4 h-4" />
          Peer Recognition (Kudos Wall)
        </button>
      </div>

      {/* Content */}
      {(() => {
        const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
        const safeSurveys = Array.isArray(surveys) ? surveys : [];
        const safeRecognitions = Array.isArray(recognitions) ? recognitions : [];

        if (loading) {
          return <LoadingSpinner message="Loading engagement feed..." />;
        }

        if (activeTab === 'announcements') {
          return (
            /* ANNOUNCEMENTS FEED */
            <div className="space-y-4 max-w-4xl">
              {safeAnnouncements.map((a) => (
                <div
                  key={a.id}
                  className={`bg-white p-5 rounded-xl border transition shadow-sm ${
                    a.is_pinned ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                  }`}
                >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  {a.is_pinned && (
                    <span className="p-1 bg-amber-100 text-amber-700 rounded-md">
                      <Pin className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <Badge variant={a.category === 'URGENT' ? 'danger' : a.category === 'POLICY' ? 'purple' : 'info'}>
                    {a.category}
                  </Badge>
                  <h3 className="text-base font-bold text-slate-800">{a.title}</h3>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(a.publish_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">
                {a.content}
              </p>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Published by <strong className="text-slate-600">{a.author_first} {a.author_last}</strong> • {a.read_count} read(s)
                </span>

                {!a.is_read ? (
                  <button
                    onClick={() => handleMarkAsRead(a.id)}
                    className="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold rounded-lg text-xs transition"
                  >
                    Mark as Read
                  </button>
                ) : (
                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Read
                  </span>
                )}
              </div>
            </div>
          ))}

            {safeAnnouncements.length === 0 && (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
                No announcements published.
              </div>
            )}
          </div>
        );
      }

      if (activeTab === 'surveys') {
        return (
          /* SURVEYS & POLLS */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {safeSurveys.map((s) => (
              <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="info">Active Survey</Badge>
                  <span className="text-[11px] text-slate-400">{s.total_responses} response(s)</span>
                </div>

                <h3 className="text-sm font-bold text-slate-800">{s.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{s.description || 'Anonymous pulse survey.'}</p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {s.is_anonymous ? '🔒 Anonymous' : 'Named survey'}
                  </span>
                  {s.has_responded ? (
                    <Badge variant="success">Submitted</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setAnsweringSurvey(s);
                        setSurveyAnswers({});
                      }}
                    >
                      Participate
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {safeSurveys.length === 0 && (
              <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
                No active surveys or polls.
              </div>
            )}
          </div>
        );
      }

      return (
        /* KUDOS WALL */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {safeRecognitions.map((r) => (
            <div
              key={r.id}
              className="bg-gradient-to-br from-white to-amber-50/30 p-5 rounded-xl border border-amber-200/70 shadow-sm hover:shadow transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  {r.badge_type}
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>

              <p className="text-xs text-slate-700 italic font-medium leading-relaxed">
                "{r.message}"
              </p>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  To: <strong className="text-slate-800">{r.recipient_first} {r.recipient_last}</strong>
                </span>
                <span className="text-[11px] text-slate-400">
                  From: {r.sender_first}
                </span>
              </div>
            </div>
          ))}

          {safeRecognitions.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
              No Kudos posted yet. Be the first to recognize a colleague!
            </div>
          )}
        </div>
      );
    })()}

      {/* BROADCAST MODAL */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Publish Company Announcement</h3>
              <button onClick={() => setShowAnnounceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Annual Townhall Meeting 2026"
                  value={announceForm.title}
                  onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={announceForm.category}
                  onChange={(e) => setAnnounceForm({ ...announceForm, category: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="GENERAL">General Notice</option>
                  <option value="POLICY">Policy Update</option>
                  <option value="EVENT">Company Event</option>
                  <option value="URGENT">Urgent Alert</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Announcement Body *</label>
                <textarea
                  rows="4"
                  required
                  placeholder="Full announcement text..."
                  value={announceForm.content}
                  onChange={(e) => setAnnounceForm({ ...announceForm, content: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={announceForm.isPinned}
                  onChange={(e) => setAnnounceForm({ ...announceForm, isPinned: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="isPinned" className="text-xs font-semibold text-slate-700">
                  Pin to top of news feed
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setShowAnnounceModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Broadcast</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GIVE KUDOS MODAL */}
      {showKudosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Give Kudos to a Colleague</h3>
              <button onClick={() => setShowKudosModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGiveKudos} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient *</label>
                <select
                  required
                  value={kudosForm.recipientId}
                  onChange={(e) => setKudosForm({ ...kudosForm, recipientId: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="">Select an employee...</option>
                  {employees
                    .filter((emp) => {
                      if (user?.employeeId && emp.id === user.employeeId) return false;
                      if (user?.id && (emp.userId === user.id || emp.user?.id === user.id)) return false;
                      return true;
                    })
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode || emp.designation?.title || 'Employee'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Badge</label>
                <select
                  value={kudosForm.badgeType}
                  onChange={(e) => setKudosForm({ ...kudosForm, badgeType: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                >
                  <option value="KUDOS">🌟 Kudos (General Excellence)</option>
                  <option value="TEAM_PLAYER">🤝 Team Player</option>
                  <option value="INNOVATOR">💡 Innovator & Problem Solver</option>
                  <option value="LEADERSHIP">🚀 Exemplary Leadership</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recognition Message *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="What did they accomplish? How did they help?"
                  value={kudosForm.message}
                  onChange={(e) => setKudosForm({ ...kudosForm, message: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setShowKudosModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Post Kudos</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SURVEY MODAL (HR / ADMIN) */}
      {showSurveyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Vote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Launch New Survey / Poll</h3>
                  <p className="text-xs text-slate-400">Gather company feedback and pulse metrics</p>
                </div>
              </div>
              <button onClick={() => setShowSurveyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSurvey} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Survey Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Q1 Workplace & Culture Pulse"
                  value={surveyForm.title}
                  onChange={(e) => setSurveyForm({ ...surveyForm, title: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Briefly explain the purpose of this survey..."
                  value={surveyForm.description}
                  onChange={(e) => setSurveyForm({ ...surveyForm, description: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-800">Anonymous Participation</div>
                  <div className="text-[11px] text-slate-500">Protect employee identity on responses</div>
                </div>
                <input
                  type="checkbox"
                  checked={surveyForm.isAnonymous}
                  onChange={(e) => setSurveyForm({ ...surveyForm, isAnonymous: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Survey Questions</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSurveyForm({
                        ...surveyForm,
                        questions: [
                          ...surveyForm.questions,
                          { id: `q_${Date.now()}`, text: '', type: 'rating' },
                        ],
                      })
                    }
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Question
                  </button>
                </div>

                {surveyForm.questions.map((q, idx) => (
                  <div key={q.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Question {idx + 1}</span>
                      {surveyForm.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSurveyForm({
                              ...surveyForm,
                              questions: surveyForm.questions.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="Enter question text..."
                      value={q.text}
                      onChange={(e) => {
                        const updated = [...surveyForm.questions];
                        updated[idx].text = e.target.value;
                        setSurveyForm({ ...surveyForm, questions: updated });
                      }}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white focus:outline-none"
                    />

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`type_${idx}`}
                          value="rating"
                          checked={q.type === 'rating'}
                          onChange={() => {
                            const updated = [...surveyForm.questions];
                            updated[idx].type = 'rating';
                            setSurveyForm({ ...surveyForm, questions: updated });
                          }}
                        />
                        <span>1-5 Rating Scale</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`type_${idx}`}
                          value="text"
                          checked={q.type === 'text'}
                          onChange={() => {
                            const updated = [...surveyForm.questions];
                            updated[idx].type = 'text';
                            setSurveyForm({ ...surveyForm, questions: updated });
                          }}
                        />
                        <span>Open Text Response</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="neutral" type="button" onClick={() => setShowSurveyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Launch Survey</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANSWER SURVEY MODAL */}
      {answeringSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">{answeringSurvey.title}</h3>
                <p className="text-xs text-slate-500">{answeringSurvey.description || 'Employee pulse survey'}</p>
              </div>
              <button onClick={() => setAnsweringSurvey(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSurveyResponse} className="space-y-4">
              {(() => {
                const questions = Array.isArray(answeringSurvey.questions)
                  ? answeringSurvey.questions
                  : typeof answeringSurvey.questions === 'string'
                  ? JSON.parse(answeringSurvey.questions || '[]')
                  : [];

                if (questions.length === 0) {
                  return (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        How satisfied are you with work environment and culture?
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            type="button"
                            key={val}
                            onClick={() => setSurveyAnswers({ ...surveyAnswers, rating: val })}
                            className={`py-2 rounded-lg border text-xs font-bold transition ${
                              surveyAnswers.rating === val
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                return questions.map((q, idx) => {
                  const qId = q.id || `q_${idx}`;
                  return (
                    <div key={qId} className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <label className="block text-xs font-bold text-slate-800">
                        {idx + 1}. {q.text || 'Question'}
                      </label>
                      {q.type === 'rating' ? (
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              type="button"
                              key={val}
                              onClick={() => setSurveyAnswers({ ...surveyAnswers, [qId]: val })}
                              className={`py-2 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1 ${
                                surveyAnswers[qId] === val
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${surveyAnswers[qId] === val ? 'fill-white' : ''}`} />
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
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                        />
                      )}
                    </div>
                  );
                });
              })()}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="neutral" type="button" onClick={() => setAnsweringSurvey(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingSurvey}>
                  {submittingSurvey ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

