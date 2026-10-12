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
  Filter, PenLine, ThumbsUp, Bell, UserCheck, AlertTriangle, ArrowRight
} from "lucide-react";

import { dailyReportService } from "../../services/dailyReportService.js";

const fmtDate = (d) => {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(d); }
};

const getISODate = (d = new Date()) => {
  return d.toLocaleDateString("en-CA"); // "YYYY-MM-DD"
};

const getYesterdayISODate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
};

const StatusBadge = ({ status }) => {
  if (status === "ACKNOWLEDGED") return <Badge variant="success">Acknowledged</Badge>;
  return <Badge variant="info">Submitted</Badge>;
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, colorClass, iconBgClass, onClick, active }) => (
  <div
    onClick={onClick}
    className={`group bg-white rounded-2xl border p-5 shadow-xs transition-all duration-300 ${
      onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
    } ${
      active
        ? "border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/20"
        : "border-slate-200/80 hover:border-brand-200/80"
    }`}
  >
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
          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1.5">Summary of the Day</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{report.workSummary}</p>
          </div>

          {/* Feedback section */}
          {report.managerFeedback && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Manager Feedback</span>
                {report.reviewer && (
                  <span className="text-xs text-emerald-600">Reviewed by {report.reviewer.name}</span>
                )}
              </div>
              <p className="text-sm text-emerald-900">{report.managerFeedback}</p>
            </div>
          )}

          {/* Feedback Form for Manager */}
          {canFeedback && (
            <div className="pt-2 border-t border-slate-100">
              {!showFeedback ? (
                <button
                  onClick={() => setShowFeedback(true)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {report.managerFeedback ? "Update Feedback" : "Acknowledge & Add Feedback"}
                </button>
              ) : (
                <div className="space-y-3">
                  <FormField
                    id={`feedback-${report.id}`}
                    label="Manager Feedback / Notes"
                    placeholder="Add acknowledgment note or feedback for this report..."
                    value={feedback}
                    onChange={setFeedback}
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="primary" isLoading={submitting} onClick={handleFeedback}>
                      Save Feedback
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowFeedback(false)}>
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

// ── Pending Employee Card ─────────────────────────────────────────────────────
const PendingEmployeeCard = ({ employee, onRemind, isReminding }) => {
  const getAttendanceBadge = () => {
    const att = employee.attendance;
    if (att?.checkedOut) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Shift Ended (Logged Out)
        </span>
      );
    }
    if (att?.checkedIn) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active Shift (Logged In)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        Not Logged In Today
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-sm hover:border-amber-200">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold flex items-center justify-center shrink-0 text-sm">
          {employee.firstName ? employee.firstName.charAt(0).toUpperCase() : "E"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 text-sm truncate">{employee.fullName}</span>
            <span className="text-xs text-slate-400 font-mono">#{employee.employeeCode}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 truncate">
            {employee.departmentName && <span>{employee.departmentName}</span>}
            {employee.designationTitle && (
              <>
                <span className="text-slate-300">·</span>
                <span>{employee.designationTitle}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {getAttendanceBadge()}
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Bell}
          isLoading={isReminding}
          onClick={() => onRemind(employee.id, employee.fullName)}
          className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs font-semibold"
        >
          Remind
        </Button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const DailyReportPage = () => {
  const { hasRole } = useAuth();
  const { addToast } = useToast();

  const isManager = hasRole(["Manager", "HR", "HRManager", "Admin", "SuperAdmin", "OrgAdmin"]);
  const [activeTab, setActiveTab] = useState("my");

  const todayISO = getISODate();
  const yesterdayISO = getYesterdayISODate();

  // Selected date for employee submission
  const [selectedReportDate, setSelectedReportDate] = useState(todayISO);
  const [dateReport, setDateReport] = useState(null);
  const [loadingDateReport, setLoadingDateReport] = useState(true);
  const [form, setForm] = useState({ workSummary: "" });
  const [submitting, setSubmitting] = useState(false);

  // My history
  const [myReports, setMyReports] = useState([]);
  const [loadingMy, setLoadingMy] = useState(false);

  // Team view
  const [teamSubTab, setTeamSubTab] = useState("submitted"); // "submitted" | "pending"
  const [teamReports, setTeamReports] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [summary, setSummary] = useState(null);
  const [teamFilters, setTeamFilters] = useState({ search: "", date: todayISO, status: "" });
  const [teamPage, setTeamPage] = useState(1);
  const [teamTotal, setTeamTotal] = useState(0);
  const TEAM_PAGE_SIZE = 15;

  // Pending view
  const [pendingList, setPendingList] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [remindingId, setRemindingId] = useState(null);
  const [remindingAll, setRemindingAll] = useState(false);

  // ── Fetch Report for Selected Date ──────────────────────────────────────────
  const fetchReportForDate = useCallback(async (targetDate) => {
    setLoadingDateReport(true);
    try {
      const res = await dailyReportService.getMyTodayReport(targetDate);
      const r = res.data?.report || res.report || null;
      setDateReport(r);
      if (r) {
        setForm({ workSummary: r.workSummary || "" });
      } else {
        setForm({ workSummary: "" });
      }
    } catch {
      setDateReport(null);
      setForm({ workSummary: "" });
    } finally {
      setLoadingDateReport(false);
    }
  }, []);

  const handleDateChange = (newDate) => {
    if (!newDate) return;
    setSelectedReportDate(newDate);
    fetchReportForDate(newDate);
  };

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

  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const targetDate = teamFilters.date || todayISO;
      const res = await dailyReportService.getPendingEmployees({ date: targetDate });
      setPendingList(res.data || []);
    } catch {
      addToast("Failed to load pending employees list.", "error");
    } finally {
      setLoadingPending(false);
    }
  }, [teamFilters.date, todayISO, addToast]);

  const handleSubmit = async () => {
    if (!form.workSummary.trim()) {
      addToast("Work summary is required.", "error");
      return;
    }
    if (form.workSummary.trim().length < 10) {
      addToast("Please provide a descriptive work summary (at least 10 characters).", "error");
      return;
    }
    setSubmitting(true);
    try {
      await dailyReportService.submitReport({
        workSummary: form.workSummary.trim(),
        reportDate: selectedReportDate,
      });
      addToast(
        dateReport
          ? `Daily report for ${fmtDate(selectedReportDate)} updated successfully!`
          : `Daily report for ${fmtDate(selectedReportDate)} submitted successfully!`,
        "success"
      );
      fetchReportForDate(selectedReportDate);
      fetchMyHistory();
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

  const handleRemindSingle = async (employeeId, employeeName) => {
    setRemindingId(employeeId);
    try {
      const res = await dailyReportService.sendReminder({
        employeeId,
        date: teamFilters.date || todayISO,
      });
      addToast(res.message || `Reminder sent to ${employeeName}!`, "success");
    } catch (err) {
      addToast(err?.message || "Failed to send reminder.", "error");
    } finally {
      setRemindingId(null);
    }
  };

  const handleRemindAll = async () => {
    setRemindingAll(true);
    try {
      const res = await dailyReportService.sendReminder({
        date: teamFilters.date || todayISO,
      });
      addToast(res.message || `Reminders sent to all pending employees!`, "success");
    } catch (err) {
      addToast(err?.message || "Failed to send reminders.", "error");
    } finally {
      setRemindingAll(false);
    }
  };

  useEffect(() => {
    fetchReportForDate(selectedReportDate);
    fetchMyHistory();
  }, []);

  useEffect(() => {
    if (activeTab === "team" && isManager) {
      fetchTeam(1);
      fetchPending();
    }
  }, [activeTab, teamFilters.date]);

  const updateForm = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const todayDisplayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Tab config
  const TABS = [
    { key: "my", label: "Submit / Edit Report", icon: PenLine },
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
            <p className="text-sm text-slate-500">{todayDisplayStr}</p>
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

      {/* ── SUBMIT / EDIT REPORT TAB ────────────────────────────────────────── */}
      {activeTab === "my" && (
        <div className="space-y-5">
          {/* Date Selector Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Select Workday
                </span>
                <span className="text-xs text-slate-500">
                  Submit for today or backfill missed reports
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleDateChange(todayISO)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedReportDate === todayISO
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDateChange(yesterdayISO)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedReportDate === yesterdayISO
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Yesterday
              </button>
              <div className="relative">
                <input
                  type="date"
                  max={todayISO}
                  value={selectedReportDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {loadingDateReport ? (
            <LoadingSpinner message={`Loading report for ${fmtDate(selectedReportDate)}...`} />
          ) : (
            <>
              {/* Submission Status Banner */}
              {dateReport ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 text-sm text-emerald-700 font-medium">
                    Report already submitted for {fmtDate(selectedReportDate)} — you can make edits below.
                  </div>
                  <StatusBadge status={dateReport.status} />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="flex-1 text-sm text-amber-800 font-medium">
                    No report submitted yet for {fmtDate(selectedReportDate)}. Please write and submit your daily summary.
                  </div>
                </div>
              )}

              {/* Form Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    {dateReport ? `Update Report for ${fmtDate(selectedReportDate)}` : `Submit Report for ${fmtDate(selectedReportDate)}`}
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">
                    {form.workSummary.trim().length} chars
                  </span>
                </div>

                <FormField
                  id="daily-report-summary"
                  label="Summary of the Day"
                  required
                  rows={8}
                  placeholder="Describe what you worked on today, tasks completed, deliverables reached, any challenges faced, and your plan for tomorrow..."
                  value={form.workSummary}
                  onChange={(v) => updateForm("workSummary", v)}
                />

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    * Minimum 10 characters required
                  </span>
                  <Button
                    id="daily-report-submit-btn"
                    variant="primary"
                    icon={Send}
                    isLoading={submitting}
                    disabled={!form.workSummary.trim() || form.workSummary.trim().length < 10}
                    onClick={handleSubmit}
                  >
                    {dateReport ? "Update Report" : "Submit Report"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MY HISTORY TAB ─────────────────────────────────────────────────── */}
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
              description="Start by submitting your first daily work report using the Submit / Edit Report tab."
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

      {/* ── TEAM REPORTS TAB ────────────────────────────────────────────────── */}
      {activeTab === "team" && isManager && (
        <div className="space-y-5">
          {/* Stats Grid */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <StatCard
                icon={Users}
                label="Total"
                value={summary.totalEmployees}
                colorClass="text-brand-600"
                iconBgClass="bg-brand-50"
              />
              <StatCard
                icon={CheckCircle2}
                label="Submitted"
                value={summary.submittedCount}
                colorClass="text-emerald-600"
                iconBgClass="bg-emerald-50"
                onClick={() => setTeamSubTab("submitted")}
                active={teamSubTab === "submitted"}
              />
              <StatCard
                icon={Clock}
                label="Pending"
                value={summary.pendingCount}
                colorClass="text-amber-600"
                iconBgClass="bg-amber-50"
                onClick={() => setTeamSubTab("pending")}
                active={teamSubTab === "pending"}
              />
              <StatCard
                icon={ThumbsUp}
                label="Acknowledged"
                value={summary.acknowledgedCount}
                colorClass="text-blue-600"
                iconBgClass="bg-blue-50"
              />
              <StatCard
                icon={BarChart2}
                label="Compliance"
                value={`${summary.complianceRate}%`}
                colorClass="text-violet-600"
                iconBgClass="bg-violet-50"
              />
            </div>
          )}

          {/* Sub-Tab Navigation: Submitted vs Pending */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTeamSubTab("submitted")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  teamSubTab === "submitted"
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submitted Reports</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  teamSubTab === "submitted" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {summary?.submittedCount ?? teamTotal}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTeamSubTab("pending")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  teamSubTab === "pending"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Employees</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  teamSubTab === "pending" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                }`}>
                  {summary?.pendingCount ?? pendingList.length}
                </span>
              </button>
            </div>

            {/* Quick date indicator */}
            <div className="text-xs text-slate-500 hidden sm:block font-medium">
              Target Date: <span className="font-bold text-slate-700">{fmtDate(teamFilters.date || todayISO)}</span>
            </div>
          </div>

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

              {/* Status (relevant for submitted tab) */}
              <select
                value={teamFilters.status}
                onChange={(e) => setTeamFilters((p) => ({ ...p, status: e.target.value }))}
                className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                disabled={teamSubTab === "pending"}
              >
                <option value="">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
              </select>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  id="team-report-filter-btn"
                  variant="primary"
                  size="sm"
                  icon={Filter}
                  onClick={() => {
                    fetchTeam(1);
                    fetchPending();
                  }}
                  className="flex-1"
                >
                  Apply Filter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => {
                    fetchTeam(1);
                    fetchPending();
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── VIEW 1: SUBMITTED REPORTS ── */}
          {teamSubTab === "submitted" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                {teamTotal} submitted report{teamTotal !== 1 ? "s" : ""} found
              </p>

              {loadingTeam ? (
                <LoadingSpinner message="Loading team reports..." />
              ) : teamReports.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No team reports found"
                  description="Try adjusting your date/search filters or switch to 'Pending Employees' to see who has not submitted yet."
                />
              ) : (
                <div className="space-y-3">
                  {teamReports.map((r) => (
                    <ReportCard
                      key={r.id}
                      report={r}
                      canFeedback={isManager}
                      onFeedback={handleFeedback}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {teamTotal > TEAM_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  {[...Array(Math.ceil(teamTotal / TEAM_PAGE_SIZE))].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setTeamPage(i + 1);
                        fetchTeam(i + 1);
                      }}
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

          {/* ── VIEW 2: PENDING EMPLOYEES ── */}
          {teamSubTab === "pending" && (
            <div className="space-y-4">
              {/* Header Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-950">
                      {pendingList.length} Pending Employee{pendingList.length !== 1 ? "s" : ""}
                    </h3>
                    <p className="text-xs text-amber-800">
                      Employees who have not submitted a daily work report for {fmtDate(teamFilters.date || todayISO)}.
                    </p>
                  </div>
                </div>

                {pendingList.length > 0 && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Bell}
                    isLoading={remindingAll}
                    onClick={handleRemindAll}
                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs shrink-0"
                  >
                    Remind All ({pendingList.length})
                  </Button>
                )}
              </div>

              {loadingPending ? (
                <LoadingSpinner message="Checking pending employees..." />
              ) : pendingList.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="100% Daily Report Compliance!"
                  description={`All active employees have submitted their daily work reports for ${fmtDate(teamFilters.date || todayISO)}.`}
                />
              ) : (
                <div className="space-y-3">
                  {pendingList.map((emp) => (
                    <PendingEmployeeCard
                      key={emp.id}
                      employee={emp}
                      onRemind={handleRemindSingle}
                      isReminding={remindingId === emp.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyReportPage;
