import React, { forwardRef } from 'react';
import {
  Building2,
  Laptop,
  Target,
  ShieldCheck,
  CheckCircle2,
  Check,
  Award,
  Sparkles,
  Star,
  FileText,
} from 'lucide-react';

export const PrintableReportDossier = forwardRef(({ department, data, averageScore }, ref) => {
  const isOps = department === 'operations';
  const isIt = department === 'it';

  // Dynamic Department Theme Tokens matching ReportsPage.jsx 1-to-1
  const deptTitle = isOps
    ? 'Operations Team Performance Review'
    : isIt
    ? 'IT Team Performance Review Form'
    : 'TA Team Performance Review';

  const deptSubtitle = isOps
    ? 'Learning & Development | Operations Team Performance Calibration & Progression Review'
    : isIt
    ? 'Official periodic performance assessment, technical calibration, and career progression record.'
    : 'Learning & Development | TA Team Performance Calibration & Progression Review';

  const deptTag = isOps ? 'Operations Team • L&D' : isIt ? 'IT Team • L&D' : 'TA Team • L&D';
  const Icon = isOps ? Building2 : isIt ? Laptop : Target;

  const numBgClass = isOps
    ? 'bg-teal-50 text-teal-700 border-teal-200'
    : isIt
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-purple-50 text-purple-700 border-purple-200';

  const scoreBadgeClass = isOps
    ? 'bg-teal-50 text-teal-800 border-teal-200'
    : isIt
    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
    : 'bg-purple-50 text-purple-800 border-purple-200';

  const actionLabels = [
    { id: 'action1', text: 'Continue in Current Role' },
    { id: 'action2', text: 'Salary Revision Recommended' },
    { id: 'action3', text: 'Promotion / Role Advancement Recommended' },
    { id: 'action4', text: 'Additional / Advanced Training Required' },
    { id: 'action5', text: 'Performance Improvement Plan (PIP) Required' },
    { id: 'action6', text: 'Role / Responsibility Change Recommended' },
  ];

  const ratingRubric = [
    {
      val: 5,
      title: 'Exceptional',
      desc: 'Consistently surpasses highest standards',
      cardBg: 'bg-emerald-50/80 border-emerald-300 text-emerald-900',
      numColor: 'bg-emerald-600 text-white',
    },
    {
      val: 4,
      title: 'Exceeds Expectations',
      desc: 'Frequently goes beyond role demands',
      cardBg: 'bg-sky-50/80 border-sky-300 text-sky-900',
      numColor: 'bg-sky-600 text-white',
    },
    {
      val: 3,
      title: 'Meets Expectations',
      desc: 'Consistently achieves core deliverables',
      cardBg: 'bg-indigo-50/80 border-indigo-300 text-indigo-900',
      numColor: 'bg-indigo-600 text-white',
    },
    {
      val: 2,
      title: 'Needs Improvement',
      desc: 'Fails to meet expected benchmarks',
      cardBg: 'bg-amber-50/80 border-amber-300 text-amber-900',
      numColor: 'bg-amber-600 text-white',
    },
    {
      val: 1,
      title: 'Unsatisfactory',
      desc: 'Critical performance deficiency',
      cardBg: 'bg-rose-50/80 border-rose-300 text-rose-900',
      numColor: 'bg-rose-600 text-white',
    },
  ];

  const overallRatingOptions = [
    { label: 'Exceptional', icon: '⭐', color: 'border-emerald-500 bg-emerald-50/90 text-emerald-950 font-bold' },
    { label: 'Exceeds Expectations', icon: '✨', color: 'border-sky-500 bg-sky-50/90 text-sky-950 font-bold' },
    { label: 'Meets Expectations', icon: '👍', color: 'border-indigo-500 bg-indigo-50/90 text-indigo-950 font-bold' },
    { label: 'Needs Improvement', icon: '⚠️', color: 'border-amber-500 bg-amber-50/90 text-amber-950 font-bold' },
    { label: 'Unsatisfactory', icon: '❌', color: 'border-rose-500 bg-rose-50/90 text-rose-950 font-bold' },
  ];

  return (
    <div ref={ref} className="pdf-export-container font-sans text-slate-800 bg-white">
      {/* ============================================================ */}
      {/* PAGE 1: Identity, Reference Rubric & Competency Table        */}
      {/* ============================================================ */}
      <div
        className="pdf-dossier-page relative bg-white flex flex-col justify-between"
        style={{
          width: '794px',
          height: '1123px',
          padding: '24px 30px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
      >
        <div className="space-y-3.5">
          {/* Executive Header Banner - Matches HRMS Portal Form Hero 1-to-1 */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 shadow-sm border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1.5 max-w-[490px]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/20 text-slate-100 shadow-xs">
                    <Icon className="w-3.5 h-3.5 text-indigo-300" />
                    {deptTag}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase">
                    TaskNera HRMS
                  </span>
                </div>
                <h1 className="text-xl font-black tracking-tight text-white leading-tight font-heading">
                  {deptTitle}
                </h1>
                <p className="text-[11px] text-slate-300 leading-snug font-normal">{deptSubtitle}</p>
              </div>

              {/* Header Right Status Determination Card */}
              <div className="text-right space-y-1 shrink-0 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 shadow-xs min-w-[170px]">
                <div className="text-[9.5px] font-bold text-indigo-300 uppercase tracking-wider">
                  Review Determination
                </div>
                <div className="text-sm font-black text-white">{data.overallRating || 'Meets Expectations'}</div>
                <div className="text-[10px] text-slate-300 font-mono">Cycle: {data.reviewCycle || 'Quarterly Review'}</div>
              </div>
            </div>

            {/* Accent color bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-600" />
          </div>

          {/* 01: Employee & Review Information Grid */}
          <section className="space-y-2">
            <div className="flex items-center gap-2.5 pb-1.5 border-b border-slate-200">
              <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shadow-2xs border ${numBgClass}`}>
                01
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 leading-none">
                  Employee &amp; Review Information
                </h3>
                <p className="text-[10px] text-slate-500">Basic details of the team member under review</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Employee Name</div>
                <div className="font-bold text-slate-900 mt-0.5 text-xs leading-tight">
                  {data.employeeName || '—'}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Employee ID</div>
                <div className="font-mono font-bold text-slate-800 mt-0.5 text-xs leading-tight">
                  {data.employeeId || '—'}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Department</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-xs leading-tight">
                  {data.department || (isOps ? 'Operations Team' : isIt ? 'IT Team' : 'TA Team')}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Designation</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-xs leading-tight">
                  {data.designation || 'Team Member'}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Reporting Manager</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-xs leading-tight">
                  {data.manager || '—'}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Review Date</div>
                <div className="font-mono font-medium text-slate-800 mt-0.5 text-xs leading-tight">
                  {data.reviewDate || '—'}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Review Period</div>
                <div className="font-mono font-medium text-slate-800 mt-0.5 text-xs leading-tight">
                  {data.reviewPeriod || '—'}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">L&amp;D Executive</div>
                <div className="font-semibold text-slate-800 mt-0.5 text-xs leading-tight">
                  {data.ldExecutive || 'Swati Batabyal'}
                </div>
              </div>
            </div>
          </section>

          {/* 02: Rating Scale Reference - Matches HRMS Portal Form Rubric 1-to-1 */}
          <section className="space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shadow-2xs border ${numBgClass}`}>
                  02
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-none">
                    Rating Scale Reference
                  </h3>
                  <p className="text-[10px] text-slate-500">Universal evaluation rubric standard applied across competencies</p>
                </div>
              </div>

              <div className={`px-3.5 py-1 rounded-full border text-xs font-bold inline-flex items-center gap-2 shadow-2xs ${scoreBadgeClass}`}>
                <span>Average Score:</span>
                <span className="font-black text-xs font-mono">{averageScore} / 5.0</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              {ratingRubric.map((item) => {
                const isSelected = data.overallRating?.toLowerCase().includes(item.title.toLowerCase());
                return (
                  <div
                    key={item.val}
                    className={`border rounded-xl p-2.5 text-center shadow-2xs transition-all ${
                      isSelected
                        ? `${item.cardBg} ring-2 ring-indigo-400 font-bold`
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center mx-auto mb-1.5 shadow-2xs ${item.numColor}`}
                    >
                      {item.val}
                    </div>
                    <div className="text-[10px] font-bold leading-tight mb-1 whitespace-nowrap overflow-visible">
                      {item.title}
                    </div>
                    <div className="text-[8.5px] opacity-80 leading-tight">{item.desc}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 03: Performance Competency Evaluation Table */}
          <section className="space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shadow-2xs border ${numBgClass}`}>
                  03
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-none">
                    {isOps ? 'Operations Performance Evaluation' : isIt ? 'Technical Competency Evaluation' : 'Functional Competency Evaluation'}
                  </h3>
                  <p className="text-[10px] text-slate-500">Rate individual competencies on scale of 1.0 to 5.0</p>
                </div>
              </div>

              <span className={`text-[9.5px] font-bold px-3 py-0.5 rounded-full border ${scoreBadgeClass}`}>
                10-Point Calibrated Evaluation
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-1.5 px-3 w-8 text-center">#</th>
                    <th className="py-1.5 px-3 w-[220px]">Performance Area / Metric</th>
                    <th className="py-1.5 px-3 w-[110px] text-center">Rating (1-5)</th>
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
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : numScore >= 2.5
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200';

                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-1.5 px-3 text-center font-bold text-slate-400 text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-slate-900 text-[10.5px]">
                          {comp.area}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border font-mono whitespace-nowrap shadow-2xs ${scoreBadge}`}>
                            {numScore.toFixed(1)} / 5.0
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-700 text-[10.5px] leading-tight">
                          {comp.comment || 'Performance aligned with established benchmark.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Page 1 Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>TaskNera HRMS • Performance Appraisal Record • Confidential</span>
          </div>
          <div className="font-mono font-bold text-slate-700">Page 1 of 2</div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PAGE 2: Goals, Training, Comments, Actions & CEO Approval    */}
      {/* ============================================================ */}
      <div
        className="pdf-dossier-page relative bg-white flex flex-col justify-between"
        style={{
          width: '794px',
          height: '1123px',
          padding: '22px 30px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
      >
        <div className="space-y-2.5">
          {/* Top Page 2 Header Running Strip */}
          <div className="pb-2 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[9.5px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border ${scoreBadgeClass}`}>
                {deptTag}
              </span>
              <span className="text-xs font-bold text-slate-900">
                {deptTitle} — {data.employeeName}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              ID: {data.employeeId} • Review Date: {data.reviewDate}
            </div>
          </div>

          {/* 04 & 05: Accomplishments & Development Areas (Side-by-Side) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 04: Key Accomplishments */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                  04
                </span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-none">Key Accomplishments</h4>
                  <p className="text-[8.5px] text-slate-500">Major operational deliverables</p>
                </div>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 min-h-[56px] text-[10px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.achievements || 'No specific accomplishments recorded for this cycle.'}
              </div>
            </section>

            {/* 05: Areas for Improvement */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                  05
                </span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-none">Areas for Development</h4>
                  <p className="text-[8.5px] text-slate-500">Constructive growth focal points</p>
                </div>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 min-h-[56px] text-[10px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.improvements || 'Continue scaling performance according to quarterly deliverables.'}
              </div>
            </section>
          </div>

          {/* 06: Goals & Key Performance Objectives Table */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                  06
                </span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-none">Goals &amp; Performance Objectives</h4>
                  <p className="text-[8.5px] text-slate-500">Key performance deliverables agreed upon for upcoming cycle</p>
                </div>
              </div>
              <span className="text-[9px] text-slate-500 font-semibold">Agreed Target Deliverables</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-1 px-3 w-[220px]">Goal Objective</th>
                    <th className="py-1 px-3">Target / Key Result</th>
                    <th className="py-1 px-3 w-[90px]">Deadline</th>
                    <th className="py-1 px-3 w-[85px] text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.goals && data.goals.map((g, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="py-1.5 px-3 font-bold text-slate-900 text-[10px] leading-tight">{g.goal || '—'}</td>
                      <td className="py-1.5 px-3 text-slate-700 text-[10px] leading-tight">{g.target || '—'}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-600 text-[9.5px] leading-tight">{g.deadline || '—'}</td>
                      <td className="py-1.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shadow-2xs">
                          {g.status || 'Planned'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 07: Training & Skill Development Needs Table */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                  07
                </span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-none">Training &amp; Skill Development Plan</h4>
                  <p className="text-[8.5px] text-slate-500">Identified certifications, workshops, or training</p>
                </div>
              </div>
              <span className="text-[9px] text-slate-500 font-semibold">Development Roadmaps</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-1 px-3 w-[220px]">Skill / Operational Area</th>
                    <th className="py-1 px-3">Training Required / Workshop</th>
                    <th className="py-1 px-3 w-[85px] text-center">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.training && data.training.map((t, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="py-1.5 px-3 font-bold text-slate-900 text-[10px] leading-tight">{t.skill || '—'}</td>
                      <td className="py-1.5 px-3 text-slate-700 text-[10px] leading-tight">{t.training || '—'}</td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap shadow-2xs ${
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
          </section>

          {/* 08 & 09: Feedback Comments (Side-by-Side) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 08: Employee Comments */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                  08
                </span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-none">Employee Comments</h4>
                  <p className="text-[8.5px] text-slate-500">Feedback and self-reflection</p>
                </div>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 min-h-[50px] text-[10px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.employeeComments || 'Employee self-reflection confirmed and submitted.'}
              </div>
            </section>

            {/* 09: Manager Comments */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                  09
                </span>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-none">Manager Comments</h4>
                  <p className="text-[8.5px] text-slate-500">Overall performance summary</p>
                </div>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 min-h-[50px] text-[10px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.managerComments || 'Performance evaluation completed in accordance with quarterly standards.'}
              </div>
            </section>
          </div>

          {/* 10: Overall Performance Rating - Matches Portal Form 5-card Selector 1-to-1 */}
          <section className="space-y-1.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                10
              </span>
              <div>
                <h4 className="text-[11px] font-bold text-slate-900 leading-none">Overall Performance Rating</h4>
                <p className="text-[8.5px] text-slate-500">Consolidated review outcome score</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {overallRatingOptions.map((rating) => {
                const isSelected = data.overallRating?.toLowerCase() === rating.label.toLowerCase();
                return (
                  <div
                    key={rating.label}
                    className={`rounded-2xl border p-2 text-center transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? `${rating.color} shadow-sm border-2 ring-1 ring-offset-1 ring-slate-300`
                        : 'border-slate-200 bg-slate-50/50 text-slate-500 opacity-60'
                    }`}
                  >
                    <span className="text-base leading-none">{rating.icon}</span>
                    <span className="text-[9.5px] font-bold leading-tight">{rating.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 11: Final Recommendations / Administrative Actions */}
          <section className="space-y-1.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                11
              </span>
              <div>
                <h4 className="text-[11px] font-bold text-slate-900 leading-none">Final Actions &amp; Recommendations</h4>
                <p className="text-[8.5px] text-slate-500">Administrative and HR decisions ratified for this review cycle</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {actionLabels.map((act) => {
                const isChecked = Boolean(data.actions && data.actions[act.id]);
                return (
                  <div
                    key={act.id}
                    className={`flex items-start gap-2 p-2 px-2.5 rounded-xl border text-[9.5px] leading-tight min-h-[34px] ${
                      isChecked
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center border mt-0.5 shadow-2xs ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span className="text-[9.5px] leading-tight font-semibold break-words whitespace-normal block flex-1">
                      {act.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 12: CEO Signature & Final Authorization - Matches Portal Form Signature Card */}
          <section className="space-y-1.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-2xs border ${numBgClass}`}>
                12
              </span>
              <div>
                <h4 className="text-[11px] font-bold text-slate-900 leading-none">CEO Approval &amp; Final Authorization</h4>
                <p className="text-[8.5px] text-slate-500">Executive authorization, signature verification, and approval date</p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 p-3 px-4 flex items-center justify-between shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500">
                    CEO Authorization
                  </span>
                  <span className="text-[8.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Chief Executive Officer
                  </span>
                </div>
                <div className="text-base font-black text-slate-900 leading-tight font-heading">
                  {data.ceoName || "Sheetal Ma'am"}
                </div>
                <div className="text-[9.5px] text-slate-600 font-semibold leading-tight">
                  Chief Executive Officer • Executive Leadership Approval
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
                  Authorization Date
                </div>
                <div className="font-mono font-bold text-sm text-slate-800 leading-tight">
                  {data.ceoDate || '2026-09-16'}
                </div>
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  Officially Authorized
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Page 2 Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>TaskNera HRMS • Performance Appraisal Record • Confidential</span>
          </div>
          <div className="font-mono font-bold text-slate-700">Page 2 of 2</div>
        </div>
      </div>
    </div>
  );
});

PrintableReportDossier.displayName = 'PrintableReportDossier';
