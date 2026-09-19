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

  const isHrOrAdmin = hasRole(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'announcements') {
        const res = await engagementService.getAnnouncements();
        setAnnouncements(res.data || []);
      } else if (activeTab === 'surveys') {
        const res = await engagementService.getSurveys();
        setSurveys(res.data || []);
      } else if (activeTab === 'kudos') {
        const res = await engagementService.getRecognitions();
        setRecognitions(res.data || []);
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
      const res = await employeeService.listEmployees({ limit: 100 });
      const empList = res.employees || res.data?.employees || (Array.isArray(res) ? res : []);
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
      {loading ? (
        <LoadingSpinner message="Loading engagement feed..." />
      ) : activeTab === 'announcements' ? (
        /* ANNOUNCEMENTS FEED */
        <div className="space-y-4 max-w-4xl">
          {announcements.map((a) => (
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

          {announcements.length === 0 && (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
              No announcements published.
            </div>
          )}
        </div>
      ) : activeTab === 'surveys' ? (
        /* SURVEYS & POLLS */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {surveys.map((s) => (
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
                  <Button size="sm">Participate</Button>
                )}
              </div>
            </div>
          ))}

          {surveys.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
              No active surveys or polls.
            </div>
          )}
        </div>
      ) : (
        /* KUDOS WALL */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recognitions.map((r) => (
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

          {recognitions.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
              No Kudos posted yet. Be the first to recognize a colleague!
            </div>
          )}
        </div>
      )}

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
    </div>
  );
};

