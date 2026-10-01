import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  FileText, Send, CheckCircle, Clock, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, Calendar, BarChart2, Users, Search,
  Filter, X, Edit3, ThumbsUp, Smile, Frown, Meh, Zap,
} from "lucide-react";

const API_BASE = "/api/v1";

const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const apiFetch = async (url, opts = {}) => {
  const res = await fetch(url, { headers: getAuthHeaders(), ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

const fmtDate = (d) => {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};

const MOOD_OPTIONS = [
  { value: "PRODUCTIVE", label: "Productive", icon: Zap, color: "#10b981" },
  { value: "GOOD", label: "Good", icon: Smile, color: "#3b82f6" },
  { value: "AVERAGE", label: "Average", icon: Meh, color: "#f59e0b" },
  { value: "CHALLENGING", label: "Challenging", icon: Frown, color: "#ef4444" },
];

const STATUS_COLORS = {
  SUBMITTED: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", label: "Submitted" },
  ACKNOWLEDGED: { bg: "rgba(16,185,129,0.15)", text: "#34d399", label: "Acknowledged" },
};

const getMoodMeta = (mood) => MOOD_OPTIONS.find((m) => m.value === mood) || MOOD_OPTIONS[0];

const StatusBadge = ({ status }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.SUBMITTED;
  return (
    <span style={{ background: s.bg, color: s.text, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{ background: `${color}22`, borderRadius: 10, padding: 10, display: "flex" }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>{label}</div>
    </div>
  </div>
);

const ReportCard = ({ report, canFeedback, onFeedback }) => {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState(report.managerFeedback || "");
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();
  const mood = getMoodMeta(report.moodOrStatus);
  const MoodIcon = mood.icon;

  const handleFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await onFeedback(report.id, feedback);
      setShowFeedback(false);
      addToast("Feedback submitted!", "success");
    } catch (e) {
      addToast(e.message || "Failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, userSelect: "none" }}>
        <div style={{ background: `${mood.color}22`, borderRadius: 8, padding: 8, display: "flex", flexShrink: 0 }}>
          <MoodIcon size={16} color={mood.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {report.employee && <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{report.employee.fullName}</span>}
            <span style={{ fontSize: 12, color: "#64748b" }}>•</span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>{fmtDate(report.reportDate)}</span>
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {report.workSummary}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <StatusBadge status={report.status} />
          {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Work Summary</div>
              <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.7 }}>{report.workSummary}</p>
            </div>
            {report.tasksCompleted && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Tasks Completed</div>
                <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.7 }}>{report.tasksCompleted}</p>
              </div>
            )}
            {report.blockers && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Blockers</div>
                <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.7 }}>{report.blockers}</p>
              </div>
            )}
            {report.planForTomorrow && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Plan for Tomorrow</div>
                <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.7 }}>{report.planForTomorrow}</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Hours: <strong style={{ color: "#e2e8f0" }}>{report.hoursWorked}h</strong></div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Mood: <strong style={{ color: mood.color }}>{mood.label}</strong></div>
            </div>
            {report.managerFeedback && (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399", marginBottom: 5 }}>MANAGER FEEDBACK</div>
                <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0 }}>{report.managerFeedback}</p>
                {report.reviewer && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>— {report.reviewer.name}, {fmtDate(report.reviewedAt)}</div>}
              </div>
            )}
            {canFeedback && report.status !== "ACKNOWLEDGED" && (
              <div>
                {!showFeedback ? (
                  <button onClick={() => setShowFeedback(true)} style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <ThumbsUp size={14} /> Acknowledge & Feedback
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Write your feedback..." rows={3}
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 14, resize: "vertical", outline: "none", width: "100%", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleFeedback} disabled={submitting} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        {submitting ? "Submitting..." : "Submit Feedback"}
                      </button>
                      <button onClick={() => setShowFeedback(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const DailyReportPage = () => {
  const { hasRole } = useAuth();
  const { addToast } = useToast();
  const isManager = hasRole(["Manager", "HR", "HRManager", "Admin", "SuperAdmin", "OrgAdmin"]);
  const [activeTab, setActiveTab] = useState("my");
  const [todayReport, setTodayReport] = useState(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [form, setForm] = useState({ workSummary: "", tasksCompleted: "", blockers: "", planForTomorrow: "", hoursWorked: 8, moodOrStatus: "PRODUCTIVE" });
  const [submitting, setSubmitting] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [teamReports, setTeamReports] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [summary, setSummary] = useState(null);
  const [teamFilters, setTeamFilters] = useState({ search: "", date: "", status: "", hasBlocker: false });
  const [teamPage, setTeamPage] = useState(1);
  const [teamTotal, setTeamTotal] = useState(0);

  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const data = await apiFetch(`${API_BASE}/daily-reports/my/today`);
      const r = data.data?.report || null;
      setTodayReport(r);
      if (r) setForm({ workSummary: r.workSummary || "", tasksCompleted: r.tasksCompleted || "", blockers: r.blockers || "", planForTomorrow: r.planForTomorrow || "", hoursWorked: r.hoursWorked || 8, moodOrStatus: r.moodOrStatus || "PRODUCTIVE" });
    } catch { /* no report yet */ } finally { setLoadingToday(false); }
  }, []);

  const fetchMyHistory = useCallback(async () => {
    setLoadingMy(true);
    try { const data = await apiFetch(`${API_BASE}/daily-reports/my?limit=20`); setMyReports(data.data || []); }
    catch { addToast("Failed to load history.", "error"); } finally { setLoadingMy(false); }
  }, [addToast]);

  const fetchTeam = useCallback(async (page = 1) => {
    setLoadingTeam(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (teamFilters.search) params.set("search", teamFilters.search);
      if (teamFilters.date) params.set("date", teamFilters.date);
      if (teamFilters.status) params.set("status", teamFilters.status);
      if (teamFilters.hasBlocker) params.set("hasBlocker", "true");
      const [teamData, sumData] = await Promise.all([
        apiFetch(`${API_BASE}/daily-reports/team?${params}`),
        apiFetch(`${API_BASE}/daily-reports/summary${teamFilters.date ? `?date=${teamFilters.date}` : ""}`),
      ]);
      setTeamReports(teamData.data || []);
      setTeamTotal(teamData.meta?.pagination?.total || 0);
      setSummary(sumData.data || null);
    } catch { addToast("Failed to load team reports.", "error"); } finally { setLoadingTeam(false); }
  }, [teamFilters, addToast]);

  const handleSubmit = async () => {
    if (!form.workSummary.trim()) { addToast("Work summary is required.", "error"); return; }
    setSubmitting(true);
    try {
      await apiFetch(`${API_BASE}/daily-reports`, { method: "POST", body: JSON.stringify(form) });
      addToast("Daily report submitted!", "success");
      fetchToday(); fetchMyHistory();
    } catch (e) { addToast(e.message || "Failed to submit.", "error"); } finally { setSubmitting(false); }
  };

  const handleFeedback = async (id, feedbackText) => {
    await apiFetch(`${API_BASE}/daily-reports/${id}/feedback`, { method: "POST", body: JSON.stringify({ feedback: feedbackText }) });
    fetchTeam(teamPage);
  };

  useEffect(() => { fetchToday(); fetchMyHistory(); }, []);
  useEffect(() => { if (activeTab === "team" && isManager) fetchTeam(1); }, [activeTab]);

  const updateForm = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", color: "#e2e8f0", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7 };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.8 };

  return (
    <div style={{ minHeight: "100vh", padding: "24px", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 12, padding: 10, display: "flex" }}>
            <FileText size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>Daily Work Reports</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{todayStr}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
        {[{ key: "my", label: "Today's Report", icon: Edit3 }, { key: "history", label: "My History", icon: Clock }, ...(isManager ? [{ key: "team", label: "Team Reports", icon: Users }] : [])].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ background: activeTab === key ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", color: activeTab === key ? "#fff" : "#94a3b8", fontSize: 14, fontWeight: activeTab === key ? 600 : 400, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "my" && (
        <div style={{ maxWidth: 780 }}>
          {loadingToday ? <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}><RefreshCw size={28} /></div> : (
            <>
              {todayReport && (
                <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle size={18} color="#34d399" />
                  <span style={{ color: "#34d399", fontSize: 14, fontWeight: 500 }}>Report submitted — update it below anytime.</span>
                  <StatusBadge status={todayReport.status} />
                </div>
              )}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                <h2 style={{ margin: "0 0 22px", fontSize: 17, fontWeight: 600, color: "#f1f5f9" }}>{todayReport ? "Update Today's Report" : "Submit Today's Report"}</h2>
                <div style={{ marginBottom: 18 }}><label style={labelStyle}>Work Summary <span style={{ color: "#ef4444" }}>*</span></label>
                  <textarea id="daily-report-summary" value={form.workSummary} onChange={(e) => updateForm("workSummary", e.target.value)} placeholder="Describe what you worked on today..." rows={5} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }} onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }} /></div>
                <div style={{ marginBottom: 18 }}><label style={labelStyle}>Tasks Completed</label>
                  <textarea id="daily-report-tasks" value={form.tasksCompleted} onChange={(e) => updateForm("tasksCompleted", e.target.value)} placeholder="List tasks or ticket numbers completed..." rows={3} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }} onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }} /></div>
                <div style={{ marginBottom: 18 }}><label style={labelStyle}>Blockers / Challenges</label>
                  <textarea id="daily-report-blockers" value={form.blockers} onChange={(e) => updateForm("blockers", e.target.value)} placeholder="Any blockers? (type 'None' if none)" rows={2} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }} onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }} /></div>
                <div style={{ marginBottom: 18 }}><label style={labelStyle}>Plan for Tomorrow</label>
                  <textarea id="daily-report-plan" value={form.planForTomorrow} onChange={(e) => updateForm("planForTomorrow", e.target.value)} placeholder="What do you plan to work on tomorrow?" rows={2} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }} onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }} /></div>
                <div style={{ display: "flex", gap: 24, marginBottom: 26, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ flex: "0 0 160px" }}><label style={labelStyle}>Hours Worked</label>
                    <input id="daily-report-hours" type="number" min={0} max={24} step={0.5} value={form.hoursWorked} onChange={(e) => updateForm("hoursWorked", parseFloat(e.target.value) || 8)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Day Mood</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {MOOD_OPTIONS.map((m) => { const MIcon = m.icon; const sel = form.moodOrStatus === m.value; return (
                        <button key={m.value} onClick={() => updateForm("moodOrStatus", m.value)}
                          style={{ background: sel ? `${m.color}22` : "rgba(255,255,255,0.04)", border: `1.5px solid ${sel ? m.color : "rgba(255,255,255,0.1)"}`, borderRadius: 9, padding: "7px 14px", cursor: "pointer", color: sel ? m.color : "#94a3b8", fontSize: 13, fontWeight: sel ? 600 : 400, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
                          <MIcon size={14} /> {m.label}
                        </button>); })}
                    </div>
                  </div>
                </div>
                <button id="daily-report-submit-btn" onClick={handleSubmit} disabled={submitting || !form.workSummary.trim()}
                  style={{ background: submitting || !form.workSummary.trim() ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, padding: "12px 28px", cursor: submitting || !form.workSummary.trim() ? "not-allowed" : "pointer", color: "#fff", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <Send size={16} /> {submitting ? "Submitting..." : todayReport ? "Update Report" : "Submit Report"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div style={{ maxWidth: 780 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#f1f5f9" }}>My Past Reports</h2>
            <button onClick={fetchMyHistory} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {loadingMy ? <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Loading...</div>
            : myReports.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}><FileText size={44} style={{ opacity: 0.25, marginBottom: 14 }} /><p style={{ margin: 0 }}>No past reports yet.</p></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{myReports.map((r) => <ReportCard key={r.id} report={r} canFeedback={false} onFeedback={() => {}} />)}</div>}
        </div>
      )}

      {activeTab === "team" && isManager && (
        <div>
          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 14, marginBottom: 26 }}>
              <StatCard icon={Users} label="Total Employees" value={summary.totalEmployees} color="#6366f1" />
              <StatCard icon={CheckCircle} label="Submitted" value={summary.submittedCount} color="#10b981" />
              <StatCard icon={Clock} label="Pending" value={summary.pendingCount} color="#f59e0b" />
              <StatCard icon={ThumbsUp} label="Acknowledged" value={summary.acknowledgedCount} color="#3b82f6" />
              <StatCard icon={AlertTriangle} label="Blockers" value={summary.blockersCount} color="#ef4444" />
              <StatCard icon={BarChart2} label="Compliance" value={`${summary.complianceRate}%`} color="#8b5cf6" />
            </div>
          )}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px" }}>
              <Search size={15} color="#64748b" />
              <input value={teamFilters.search} onChange={(e) => setTeamFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search by name or summary..." style={{ border: "none", background: "transparent", color: "#e2e8f0", fontSize: 14, outline: "none", flex: 1 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px" }}>
              <Calendar size={15} color="#64748b" />
              <input type="date" value={teamFilters.date} onChange={(e) => setTeamFilters((p) => ({ ...p, date: e.target.value }))} style={{ border: "none", background: "transparent", color: "#e2e8f0", fontSize: 14, outline: "none" }} />
              {teamFilters.date && <button onClick={() => setTeamFilters((p) => ({ ...p, date: "" }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 0 }}><X size={14} /></button>}
            </div>
            <select value={teamFilters.status} onChange={(e) => setTeamFilters((p) => ({ ...p, status: e.target.value }))} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 14, outline: "none" }}>
              <option value="">All Statuses</option><option value="SUBMITTED">Submitted</option><option value="ACKNOWLEDGED">Acknowledged</option>
            </select>
            <button onClick={() => setTeamFilters((p) => ({ ...p, hasBlocker: !p.hasBlocker }))}
              style={{ background: teamFilters.hasBlocker ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${teamFilters.hasBlocker ? "#ef4444" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: teamFilters.hasBlocker ? "#f87171" : "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={14} /> Has Blockers
            </button>
            <button id="team-report-filter-btn" onClick={() => fetchTeam(1)} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} /> Apply
            </button>
          </div>
          <div style={{ marginBottom: 8, color: "#64748b", fontSize: 13 }}>{teamTotal} report{teamTotal !== 1 ? "s" : ""} found</div>
          {loadingTeam ? <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Loading...</div>
            : teamReports.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}><Users size={44} style={{ opacity: 0.25, marginBottom: 14 }} /><p style={{ margin: 0 }}>No reports found.</p></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{teamReports.map((r) => <ReportCard key={r.id} report={r} canFeedback={isManager} onFeedback={handleFeedback} />)}</div>}
          {teamTotal > 15 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
              {[...Array(Math.ceil(teamTotal / 15))].map((_, i) => (
                <button key={i} onClick={() => { setTeamPage(i + 1); fetchTeam(i + 1); }}
                  style={{ background: teamPage === i + 1 ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: teamPage === i + 1 ? "#fff" : "#94a3b8", fontSize: 13 }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyReportPage;
