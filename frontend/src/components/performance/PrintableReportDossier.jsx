import React, { forwardRef } from 'react';
import {
  Building2,
  Laptop,
  Target,
  ShieldCheck,
  CheckCircle2,
  Check,
} from 'lucide-react';

export const PrintableReportDossier = forwardRef(({ department, data, averageScore }, ref) => {
  const isOps = department === 'operations';
  const isIt = department === 'it';

  const deptTitle = isOps
    ? 'Operations Team Performance Review'
    : isIt
    ? 'IT Team Performance Review'
    : 'TA Team Performance Review';

  const deptSubtitle = isOps
    ? 'Operations & Fulfillment | Performance Calibration & Progression Review'
    : isIt
    ? 'Information Technology | Software & Infrastructure Calibration Review'
    : 'Talent Acquisition | Recruiting & Talent Sourcing Calibration Review';

  const deptTag = isOps ? 'Operations Team • L&D' : isIt ? 'IT Team • Engineering' : 'TA Team • Talent & People';
  const Icon = isOps ? Building2 : isIt ? Laptop : Target;

  const actionLabels = [
    { id: 'action1', text: 'Continue in Current Role' },
    { id: 'action2', text: 'Promotion / Role Advancement Recommended' },
    { id: 'action3', text: 'Performance Improvement Plan (PIP) Required' },
    { id: 'action4', text: 'Additional / Advanced Training Required' },
    { id: 'action5', text: 'Salary Revision Recommended' },
    { id: 'action6', text: 'Role / Responsibility Change Recommended' },
  ];

  const ratingScales = [
    { score: 5, label: 'Exceptional', color: 'bg-emerald-500 text-white', border: 'border-emerald-500' },
    { score: 4, label: 'Exceeds Expectations', color: 'bg-blue-500 text-white', border: 'border-blue-500' },
    { score: 3, label: 'Meets Expectations', color: 'bg-indigo-500 text-white', border: 'border-indigo-500' },
    { score: 2, label: 'Needs Improvement', color: 'bg-amber-500 text-white', border: 'border-amber-500' },
    { score: 1, label: 'Unsatisfactory', color: 'bg-rose-500 text-white', border: 'border-rose-500' },
  ];

  return (
    <div ref={ref} className="pdf-export-container font-sans text-slate-800 bg-white">
      {/* ============================================================ */}
      {/* PAGE 1: Core Identification, Calibration & Competencies      */}
      {/* ============================================================ */}
      <div
        className="pdf-dossier-page relative bg-white flex flex-col justify-between"
        style={{
          width: '794px',
          height: '1123px',
          padding: '28px 32px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
      >
        <div className="space-y-4">
          {/* Executive Header Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 shadow-sm border border-slate-700 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="space-y-1 max-w-[540px]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-indigo-200 border border-white/20">
                    <Icon className="w-3 h-3 text-indigo-300" />
                    {deptTag}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-300 tracking-wider uppercase">
                    Official Executive Dossier
                  </span>
                </div>
                <h1 className="text-xl font-black tracking-tight text-white">{deptTitle}</h1>
                <p className="text-[11px] text-slate-300 leading-snug">{deptSubtitle}</p>
              </div>

              <div className="text-right space-y-1 shrink-0 bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/15">
                <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                  Determination
                </div>
                <div className="text-xs font-black text-white">{data.overallRating || 'Meets Expectations'}</div>
                <div className="text-[10px] text-slate-300 font-mono">Cycle: {data.reviewCycle || 'Quarterly Review'}</div>
              </div>
            </div>
          </div>

          {/* 01: Employee & Review Information Grid */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  01
                </span>
                Employee &amp; Review Parameters
              </span>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                ID: {data.employeeId || '—'}
              </span>
            </div>

            <div className="grid grid-cols-4 divide-x divide-y divide-slate-200 text-xs">
              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Employee Name</div>
                <div className="font-bold text-slate-900 mt-0.5 text-[11px]">
                  {data.employeeName || '—'}
                </div>
              </div>

              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Employee Code</div>
                <div className="font-mono font-semibold text-slate-800 mt-0.5 text-[11px]">
                  {data.employeeId || '—'}
                </div>
              </div>

              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Department</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-[11px]">
                  {data.department || (isOps ? 'Operations Team' : isIt ? 'IT Team' : 'TA Team')}
                </div>
              </div>

              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Designation</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-[11px]">
                  {data.designation || 'Team Member'}
                </div>
              </div>

              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Reporting Manager</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-[11px]">
                  {data.manager || '—'}
                </div>
              </div>

              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Review Date</div>
                <div className="font-mono text-slate-800 mt-0.5 text-[11px]">
                  {data.reviewDate || '—'}
                </div>
              </div>

              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Review Period</div>
                <div className="font-mono text-slate-800 mt-0.5 text-[11px]">
                  {data.reviewPeriod || '—'}
                </div>
              </div>

              <div className="p-2.5">
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">L&amp;D Executive</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-[11px]">
                  {data.ldExecutive || 'Swati Batabyal'}
                </div>
              </div>
            </div>
          </div>

          {/* 02: Performance Calibration & Benchmark */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center font-black">
                <span className="text-[13px] leading-none">{averageScore}</span>
                <span className="text-[7px] uppercase tracking-wider opacity-90">/ 5.0</span>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Consolidated Performance Score
                </div>
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <span>Determination: {data.overallRating || 'Meets Expectations'}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Validated &amp; Calibrated
                  </span>
                </div>
              </div>
            </div>

            {/* Rating benchmark scale */}
            <div className="flex items-center gap-1.5">
              {ratingScales.map((s) => (
                <div
                  key={s.score}
                  className={`px-2 py-1 rounded-lg text-center border ${
                    data.overallRating?.toLowerCase().includes(s.label.toLowerCase())
                      ? `${s.color} ${s.border} ring-2 ring-indigo-400 font-black`
                      : 'bg-white border-slate-200 text-slate-600 opacity-70 font-semibold'
                  }`}
                  style={{ minWidth: '60px' }}
                >
                  <div className="text-[10px] leading-tight">{s.score}★</div>
                  <div className="text-[8px] truncate">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 03: Performance Competency Evaluation Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  03
                </span>
                Competency Scoring &amp; Evaluator Observations
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                10-Point Core Evaluation
              </span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-[9px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-1.5 px-3 w-8 text-center">#</th>
                  <th className="py-1.5 px-3 w-[220px]">Performance Metric</th>
                  <th className="py-1.5 px-3 w-[85px] text-center">Score</th>
                  <th className="py-1.5 px-3">Evaluator Comments &amp; Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.competencies && data.competencies.map((comp, idx) => {
                  const numScore = parseFloat(comp.score) || 0;
                  const scoreBadge =
                    numScore >= 4.5
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : numScore >= 3.5
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : numScore >= 2.5
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200';

                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="py-2 px-3 text-center font-bold text-slate-500 text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 text-[11px]">
                        {comp.area}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-black border font-mono ${scoreBadge}`}>
                          {numScore.toFixed(1)} / 5.0
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 text-[11px] leading-relaxed">
                        {comp.comment || 'Performance aligned with established team benchmark.'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Page 1 Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Human Resources Performance Management System • Confidential Appraisal Record</span>
          </div>
          <div className="font-mono font-bold text-slate-700">Page 1 of 2</div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PAGE 2: Goals, Training, Feedback & Sign-Off Authorization   */}
      {/* ============================================================ */}
      <div
        className="pdf-dossier-page relative bg-white flex flex-col justify-between"
        style={{
          width: '794px',
          height: '1123px',
          padding: '28px 32px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
      >
        <div className="space-y-3.5">
          {/* Top Page 2 Header Strip */}
          <div className="pb-2 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {data.department || 'Operations Team'}
              </span>
              <span className="text-xs font-bold text-slate-800">
                {deptTitle} — {data.employeeName}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-600">
              ID: {data.employeeId} • Review Date: {data.reviewDate}
            </div>
          </div>

          {/* 04 & 05: Accomplishments & Development Areas */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-1.5">
                <span className="w-4 h-4 rounded bg-emerald-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  04
                </span>
                Major Accomplishments &amp; Milestones
              </div>
              <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 min-h-[75px]">
                {data.achievements || 'No specific accomplishments recorded for this cycle.'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-1.5">
                <span className="w-4 h-4 rounded bg-amber-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  05
                </span>
                Areas for Development &amp; Focus
              </div>
              <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 min-h-[75px]">
                {data.improvements || 'Continue scaling performance according to quarterly deliverables.'}
              </div>
            </div>
          </div>

          {/* 06: Goals & Key Performance Objectives Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  06
                </span>
                Goals &amp; Performance Objectives
              </span>
              <span className="text-[9px] text-slate-600 font-semibold">Agreed Target Deliverables</span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-[9px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-1.5 px-3 w-[220px]">Goal Objective</th>
                  <th className="py-1.5 px-3">Target / Key Result</th>
                  <th className="py-1.5 px-3 w-[90px]">Deadline</th>
                  <th className="py-1.5 px-3 w-[85px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.goals && data.goals.map((g, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="py-2 px-3 font-bold text-slate-900 text-[11px]">{g.goal || '—'}</td>
                    <td className="py-2 px-3 text-slate-700 text-[11px]">{g.target || '—'}</td>
                    <td className="py-2 px-3 font-mono text-slate-700 text-[10px]">{g.deadline || '—'}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {g.status || 'Planned'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 07: Training & Skill Development Needs Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-indigo-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  07
                </span>
                Training &amp; Skill Development Plan
              </span>
              <span className="text-[9px] text-slate-600 font-semibold">Identified Competency Upgrades</span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-[9px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-1.5 px-3 w-[220px]">Skill / Competency Area</th>
                  <th className="py-1.5 px-3">Recommended Program / Workshop</th>
                  <th className="py-1.5 px-3 w-[85px] text-center">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.training && data.training.map((t, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="py-2 px-3 font-bold text-slate-900 text-[11px]">{t.skill || '—'}</td>
                    <td className="py-2 px-3 text-slate-700 text-[11px]">{t.training || '—'}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                        t.priority === 'High'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {t.priority || 'Medium'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 08 & 09: Feedback Comments */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-1.5">
                <span className="w-4 h-4 rounded bg-indigo-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  08
                </span>
                Employee Self-Reflection
              </div>
              <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 min-h-[60px]">
                {data.employeeComments || 'Employee self-reflection confirmed and submitted.'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-1.5">
                <span className="w-4 h-4 rounded bg-indigo-600 text-white inline-flex items-center justify-center text-[9px] font-black">
                  09
                </span>
                Manager Evaluation Summary
              </div>
              <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 min-h-[60px]">
                {data.managerComments || 'Performance evaluation completed in accordance with quarterly standards.'}
              </div>
            </div>
          </div>

          {/* 10: Administrative Decisions & HR Recommendations */}
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/40">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2">
              <span className="w-4 h-4 rounded bg-slate-800 text-white inline-flex items-center justify-center text-[9px] font-black">
                10
              </span>
              Final Actions &amp; HR Recommendations
            </div>
            <div className="grid grid-cols-3 gap-2">
              {actionLabels.map((act) => {
                const isChecked = Boolean(data.actions && data.actions[act.id]);
                return (
                  <div
                    key={act.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-semibold ${
                      isChecked
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <span className="truncate">{act.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 11: Executive Authorization & Seal */}
          <div className="rounded-xl border border-slate-300 bg-gradient-to-r from-slate-50 to-indigo-50/40 p-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Official Authorization &amp; Sign-off
              </div>
              <div className="text-sm font-black text-slate-900">
                {data.ceoName || "Sheetal Ma'am"}
              </div>
              <div className="text-[10px] text-slate-600 font-semibold">
                Chief Executive Officer • Executive Leadership Approval
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Authorization Date
              </div>
              <div className="font-mono font-bold text-xs text-slate-800">
                {data.ceoDate || '2026-09-16'}
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                Officially Authorized
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Human Resources Performance Management System • Confidential Appraisal Record</span>
          </div>
          <div className="font-mono font-bold text-slate-700">Page 2 of 2</div>
        </div>
      </div>
    </div>
  );
});

PrintableReportDossier.displayName = 'PrintableReportDossier';
