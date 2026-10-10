import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { LoadingSpinner } from "../../components/common/LoadingSpinner.jsx";
import {
  FileText, Send, CheckCircle2, Clock, RefreshCw,
  ChevronDown, ChevronUp, Calendar, BarChart2, Users, Search,
  Filter, PenLine, ThumbsUp,
} from "lucide-react";

import { dailyReportService } from "../../services/dailyReportService.js";

const fmtDate = (d) => {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(d); }
};

const StatusBadge = ({ status }) => {
  if (status === "ACKNOWLEDGED") return <Badge variant="success">Acknowledged</Badge>;
  return <Badge variant="info">Submitted</Badge>;
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, colorClass, iconBgClass }) => (
  <div className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-brand-200/80">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${iconBgClass}`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
    </div>
    <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
  </div>
);

// ── Form textarea helper ───────────────────────────────────────────────────────
const FormField = ({ id, label, required, placeholder, value, onChange, rows = 4 }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 placeholder:text-slate-400 transition-all"
    />
  </div>
);

// ── Report Card (expandable) ──────────────────────────────────────────────────
const ReportCard = ({ report, canFeedback, onFeedback }) => {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState(report.managerFeedback || "");
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const handleFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await onFeedback(report.id, feedback);
      setShowFeedback(false);
      addToast("Feedback submitted and report acknowledged!", "success");
    } catch (e) {
      const msg = e?.message || (typeof e === "string" ? e : "Failed to submit feedback.");
      addToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md hover:border-brand-200/60">
      {/* Card Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors"
      >
        {/* Calendar icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-brand-50 border border-brand-200">
          <Calendar className="w-4 h-4 text-brand-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {report.employee && (
              <span className="font-semibold text-slate-900 text-sm">{report.employee.fullName}</span>
            )}
            {report.employee?.departmentName && (
              <span className="text-xs text-slate-400">{report.employee.departmentName}</span>
            )}
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              {fmtDate(report.reportDate)}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5 truncate pr-4">{report.workSummary}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={report.status} />
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4 animate-fade-in">
          {/* Work Summary */}
          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1.5">Summary of the Day</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{report.workSummary}</p>
          </div>

          {/* Manager Feedback */}
          {report.managerFeedback && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" /> Manager Feedback
              </p>
              <p className="text-sm text-slate-700">{report.managerFeedback}</p>
              {report.reviewer && (
                <p className="text-xs text-slate-400 mt-2">— {report.reviewer.name}, {fmtDate(report.reviewedAt)}</p>
              )}
            </div>
          )}

          {/* Acknowledge & Feedback button (for managers) */}
          {canFeedback && report.status !== "ACKNOWLEDGED" && (
            <div>
              {!showFeedback ? (
                <Button variant="outline" size="sm" icon={ThumbsUp} onClick={() => setShowFeedback(true)}>
                  Acknowledge &amp; Add Feedback
                </Button>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Write your feedback or acknowledgment..."
                    rows={3}
                    className="w-full px-4 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400 placeholder:text-slate-400 transition-all"
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" isLoading={submitting} onClick={handleFeedback}>
                      Submit Feedback
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowFeedback(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const DailyReportPage = () => {
  const { hasRole } = useAuth();
  const { addToast } = useToast();

  const isManager = hasRole(["Manager", "HR", "HRManager", "Admin", "SuperAdmin", "OrgAdmin"]);
  const [activeTab, setActiveTab] = useState("my");

  // Form state
  const [todayReport, setTodayReport] = useState(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [form, setForm] = useState({ workSummary: "" });
  const [submitting, setSubmitting] = useState(false);

  // My history
  const [myReports, setMyReports] = useState([]);
  const [loadingMy, setLoadingMy] = useState(false);

  // Team view
  const [teamReports, setTeamReports] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [summary, setSummary] = useState(null);
  const [teamFilters, setTeamFilters] = useState({ search: "", date: "", status: "" });
  const [teamPage, setTeamPage] = useState(1);
  const [teamTotal, setTeamTotal] = useState(0);
  const TEAM_PAGE_SIZE = 15;

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const todayDate = new Date().toLocaleDateString("en-CA");
      const res = await dailyReportService.getMyTodayReport(todayDate);
      const r = res.data?.report || res.report || null;
      setTodayReport(r);
      if (r) setForm({ workSummary: r.workSummary || "" });
    } catch { /* no report yet */ } finally { setLoadingToday(false); }
  }, []);

  const fetchMyHistory = useCallback(async () => {
    setLoadingMy(true);
    try {
      const res = await dailyReportService.getMyReports({ limit: 20 });
      setMyReports(res.data || []);
    } catch {
      addToast("Failed to load report history.", "error");
    } finally {
      setLoadingMy(false);
    }
  }, [addToast]);

  const fetchTeam = useCallback(async (page = 1) => {
    setLoadingTeam(true);
    try {
      const params = { page, limit: TEAM_PAGE_SIZE };
      if (teamFilters.search) params.search = teamFilters.search;
      if (teamFilters.date) params.date = teamFilters.date;
      if (teamFilters.status) params.status = teamFilters.status;
      const [teamData, sumData] = await Promise.all([
        dailyReportService.getTeamReports(params),
        dailyReportService.getSummary(teamFilters.date),
      ]);
      setTeamReports(teamData.data || []);
      setTeamTotal(teamData.meta?.pagination?.total || 0);
      setSummary(sumData.data || null);
    } catch {
      addToast("Failed to load team reports.", "error");
    } finally {
      setLoadingTeam(false);
    }
  }, [teamFilters, addToast]);

  const handleSubmit = async () => {
    if (!form.workSummary.trim()) { addToast("Work summary is required.", "error"); return; }
    setSubmitting(true);
    try {
      const todayDate = new Date().toLocaleDateString("en-CA");
      await dailyReportService.submitReport({
        workSummary: form.workSummary.trim(),
        reportDate: todayReport?.reportDate || todayDate,
      });
      addToast(todayReport ? "Daily report updated successfully!" : "Daily report submitted successfully!", "success");
      fetchToday(); fetchMyHistory();
    } catch (e) {
      const msg = e?.message || (typeof e === "string" ? e : "Failed to submit report.");
      addToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedback = async (id, feedbackText) => {
    await dailyReportService.addFeedback(id, feedbackText);
    fetchTeam(teamPage);
  };

  useEffect(() => { fetchToday(); fetchMyHistory(); }, []);
  useEffect(() => { if (activeTab === "team" && isManager) fetchTeam(1); }, [activeTab]);

  const updateForm = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  // Tab config
  const TABS = [
    { key: "my", label: "Today's Report", icon: PenLine },
    { key: "history", label: "My History", icon: Clock },
    ...(isManager ? [{ key: "team", label: "Team Reports", icon: Users }] : []),
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Daily Work Reports</h1>
            <p className="text-sm text-slate-500">{todayStr}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === key
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TODAY'S REPORT ──────────────────────────────────────────────────── */}
      {activeTab === "my" && (
        <div className="space-y-5">
          {loadingToday ? (
            <LoadingSpinner message="Loading today's report..." />
          ) : (
            <>
              {/* Already submitted banner */}
              {todayReport && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 text-sm text-emerald-700 font-medium">
                    Report submitted for today — you can update it anytime below.
                  </div>
                  <StatusBadge status={todayReport.status} />
                </div>
              )}

              {/* Form Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-900">
                  {todayReport ? "Update Today's Report" : "Submit Today's Report"}
                </h2>

                <FormField
                  id="daily-report-summary"
                  label="Summary of the Day"
                  required
                  rows={8}
                  placeholder="Describe what you worked on today, tasks completed, any challenges faced, and your plan for tomorrow..."
                  value={form.workSummary}
                  onChange={(v) => updateForm("workSummary", v)}
                />

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    id="daily-report-submit-btn"
                    variant="primary"
                    icon={Send}
                    isLoading={submitting}
                    disabled={!form.workSummary.trim()}
                    onClick={handleSubmit}
                  >
                    {todayReport ? "Update Report" : "Submit Report"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MY HISTORY ─────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">My Past Reports</h2>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchMyHistory}>
              Refresh
            </Button>
          </div>

          {loadingMy ? (
            <LoadingSpinner message="Loading report history..." />
          ) : myReports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Start by submitting your first daily work report using the Today's Report tab."
            />
          ) : (
            <div className="space-y-3">
              {myReports.map((r) => (
                <ReportCard key={r.id} report={r} canFeedback={false} onFeedback={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEAM REPORTS ───────────────────────────────────────────────────── */}
      {activeTab === "team" && isManager && (
        <div className="space-y-5">
          {/* Stats Grid */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <StatCard icon={Users}         label="Total"       value={summary.totalEmployees}  colorClass="text-brand-600"   iconBgClass="bg-brand-50" />
              <StatCard icon={CheckCircle2}  label="Submitted"   value={summary.submittedCount}   colorClass="text-emerald-600" iconBgClass="bg-emerald-50" />
              <StatCard icon={Clock}         label="Pending"     value={summary.pendingCount}     colorClass="text-amber-600"   iconBgClass="bg-amber-50" />
              <StatCard icon={ThumbsUp}      label="Acknowledged" value={summary.acknowledgedCount} colorClass="text-blue-600"  iconBgClass="bg-blue-50" />
              <StatCard icon={BarChart2}     label="Compliance"  value={`${summary.complianceRate}%`} colorClass="text-violet-600" iconBgClass="bg-violet-50" />
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative sm:col-span-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name or summary..."
                  value={teamFilters.search}
                  onChange={(e) => setTeamFilters((p) => ({ ...p, search: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Date */}
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={teamFilters.date}
                  onChange={(e) => setTeamFilters((p) => ({ ...p, date: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Status */}
              <select
                value={teamFilters.status}
                onChange={(e) => setTeamFilters((p) => ({ ...p, status: e.target.value }))}
                className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
              </select>

              {/* Filter button */}
              <div className="flex items-center gap-2">
                <Button
                  id="team-report-filter-btn"
                  variant="primary"
                  size="sm"
                  icon={Filter}
                  onClick={() => fetchTeam(1)}
                  className="flex-1"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-slate-500 font-medium">
            {teamTotal} report{teamTotal !== 1 ? "s" : ""} found
          </p>

          {/* Reports List */}
          {loadingTeam ? (
            <LoadingSpinner message="Loading team reports..." />
          ) : teamReports.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team reports found"
              description="Try adjusting your filters or wait for team members to submit their daily reports."
            />
          ) : (
            <div className="space-y-3">
              {teamReports.map((r) => (
                <ReportCard key={r.id} report={r} canFeedback={isManager} onFeedback={handleFeedback} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {teamTotal > TEAM_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {[...Array(Math.ceil(teamTotal / TEAM_PAGE_SIZE))].map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setTeamPage(i + 1); fetchTeam(i + 1); }}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                    teamPage === i + 1
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
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
