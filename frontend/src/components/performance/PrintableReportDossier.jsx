import React, { forwardRef } from 'react';
import {
  Building2,
  Laptop,
  Target,
  ShieldCheck,
  CheckCircle2,
  Check,
} from 'lucide-react';

export const PrintableReportDossier = forwardRef(({ department, data: rawData, averageScore }, ref) => {
  const data = rawData && typeof rawData === 'object' ? rawData : {};
  const isOps = department === 'operations';
  const isIt = department === 'it';

  // Dynamic Department Theme Tokens matching ReportsPage.jsx
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
    ? 'bg-teal-50 text-teal-800 border-teal-300'
    : isIt
    ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
    : 'bg-purple-50 text-purple-800 border-purple-300';

  const scoreBadgeClass = isOps
    ? 'bg-teal-50 text-teal-800 border-teal-300'
    : isIt
    ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
    : 'bg-purple-50 text-purple-800 border-purple-300';

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
      cardBg: 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold',
      numColor: 'bg-emerald-600 text-white',
    },
    {
      val: 4,
      title: 'Exceeds Expectations',
      desc: 'Frequently goes beyond role demands',
      cardBg: 'bg-sky-50 border-sky-300 text-sky-950 font-bold',
      numColor: 'bg-sky-600 text-white',
    },
    {
      val: 3,
      title: 'Meets Expectations',
      desc: 'Consistently achieves core deliverables',
      cardBg: 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold',
      numColor: 'bg-indigo-600 text-white',
    },
    {
      val: 2,
      title: 'Needs Improvement',
      desc: 'Fails to meet expected benchmarks',
      cardBg: 'bg-amber-50 border-amber-300 text-amber-950 font-bold',
      numColor: 'bg-amber-600 text-white',
    },
    {
      val: 1,
      title: 'Unsatisfactory',
      desc: 'Critical performance deficiency',
      cardBg: 'bg-rose-50 border-rose-300 text-rose-950 font-bold',
      numColor: 'bg-rose-600 text-white',
    },
  ];

  const overallRatingOptions = [
    { label: 'Exceptional', icon: '⭐', color: 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold' },
    { label: 'Exceeds Expectations', icon: '✨', color: 'border-sky-500 bg-sky-50 text-sky-950 font-bold' },
    { label: 'Meets Expectations', icon: '👍', color: 'border-indigo-500 bg-indigo-50 text-indigo-950 font-bold' },
    { label: 'Needs Improvement', icon: '⚠️', color: 'border-amber-500 bg-amber-50 text-amber-950 font-bold' },
    { label: 'Unsatisfactory', icon: '❌', color: 'border-rose-500 bg-rose-50 text-rose-950 font-bold' },
  ];

  const renderSectionHeader = (num, title, rightElement = null) => (
    <div
      style={{
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '3px',
        marginBottom: '6px',
        lineHeight: '24px',
        display: 'block',
        position: 'relative',
      }}
    >
      <span
        className={`rounded font-black text-[11px] border shrink-0 ${numBgClass}`}
        style={{
          display: 'inline-block',
          width: '22px',
          height: '22px',
          lineHeight: '20px',
          textAlign: 'center',
          boxSizing: 'border-box',
          verticalAlign: 'middle',
          marginRight: '6px',
        }}
      >
        {num}
      </span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#0f172a',
          verticalAlign: 'middle',
        }}
      >
        {title}
      </span>
      {rightElement && (
        <span style={{ float: 'right', verticalAlign: 'middle', lineHeight: '22px' }}>
          {rightElement}
        </span>
      )}
      <div style={{ clear: 'both' }} />
    </div>
  );

  return (
    <div
      ref={ref}
      className="pdf-export-container font-sans text-slate-800 bg-white"
      style={{
        width: '794px',
        backgroundColor: '#ffffff',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* ============================================================ */}
      {/* PAGE 1: Identity, Reference Rubric & Competency Table        */}
      {/* ============================================================ */}
      <div
        className="pdf-dossier-page relative bg-white flex flex-col justify-between"
        style={{
          width: '794px',
          height: '1123px',
          padding: '24px 28px 20px 28px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div className="space-y-3">
          {/* Executive Header Banner */}
          <div
            className="rounded-xl text-white p-3.5 px-4 border border-slate-700 relative overflow-hidden"
            style={{
              background:
                'radial-gradient(circle at 85% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 60%), linear-gradient(135deg, #090d16 0%, #1e1b4b 60%, #0f172a 100%)',
            }}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1 max-w-[500px]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/15 border border-white/20 text-slate-100">
                    <Icon className="w-3 h-3 text-indigo-300" />
                    {deptTag}
                  </span>
                  <span className="text-[9px] font-bold text-slate-300 tracking-wider uppercase">
                    TaskNera HRMS
                  </span>
                </div>
                <h1 className="text-lg font-black tracking-tight text-white leading-tight">
                  {deptTitle}
                </h1>
                <p className="text-[10px] text-slate-300 leading-tight font-normal">
                  {deptSubtitle}
                </p>
              </div>

              {/* Header Right Status Determination Card */}
              <div className="text-right space-y-0.5 shrink-0 bg-white/15 px-3.5 py-2 rounded-xl border border-white/20 min-w-[165px]">
                <div className="text-[8.5px] font-bold text-indigo-300 uppercase tracking-wider">
                  Review Determination
                </div>
                <div className="text-sm font-black text-white leading-snug">
                  {data.overallRating || 'Meets Expectations'}
                </div>
                <div className="text-[9.5px] text-slate-300">
                  Cycle: {data.reviewCycle || 'Quarterly Review'}
                </div>
              </div>
            </div>

            {/* Accent color bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-600" />
          </div>

          {/* 01: Employee & Review Information Grid */}
          <section className="space-y-1.5">
            {renderSectionHeader('01', 'Employee & Review Information')}

            <div className="grid grid-cols-4 gap-2">
              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  Employee Name
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.employeeName || '—'}
                </div>
              </div>

              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  Employee ID
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.employeeId || '—'}
                </div>
              </div>

              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  Department
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.department || (isOps ? 'Operations Team' : isIt ? 'IT Team' : 'TA Team')}
                </div>
              </div>

              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  Designation
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.designation || 'Team Member'}
                </div>
              </div>

              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  Reporting Manager
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.manager || '—'}
                </div>
              </div>

              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  Review Date
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.reviewDate || '—'}
                </div>
              </div>

              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  Review Period
                </div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.reviewPeriod || '—'}
                </div>
              </div>

              <div
                className="bg-slate-50 border border-slate-200 rounded-lg"
                style={{ height: '48px', padding: '6px 10px', boxSizing: 'border-box' }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '12px', marginBottom: '3px' }}>
                  L&amp;D Executive
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data.ldExecutive || 'Swati Batabyal'}
                </div>
              </div>
            </div>
          </section>

          {/* 02: Rating Scale Reference */}
          <section className="space-y-1.5">
            {renderSectionHeader(
              '02',
              'Rating Scale Reference',
              <span
                className={`px-3 py-0.5 rounded-full border text-[10px] font-bold inline-block ${scoreBadgeClass}`}
                style={{ height: '22px', lineHeight: '20px', boxSizing: 'border-box' }}
              >
                Average Score: <span className="font-black font-mono text-[11px]">{averageScore} / 5.0</span>
              </span>
            )}

            <div className="grid grid-cols-5 gap-2">
              {ratingRubric.map((item) => {
                const isSelected = data.overallRating?.toLowerCase().includes(item.title.toLowerCase());
                return (
                  <div
                    key={item.val}
                    className={`border rounded-lg text-center ${
                      isSelected
                        ? `${item.cardBg} border-indigo-400 border-2`
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                    style={{ height: '70px', padding: '6px 4px', boxSizing: 'border-box' }}
                  >
                    <span
                      className={`rounded font-black text-[11px] text-white ${item.numColor}`}
                      style={{
                        display: 'block',
                        width: '22px',
                        height: '22px',
                        lineHeight: '22px',
                        textAlign: 'center',
                        margin: '0 auto 4px auto',
                        boxSizing: 'border-box',
                      }}
                    >
                      {item.val}
                    </span>
                    <div style={{ fontSize: '9.5px', fontWeight: 700, lineHeight: '13px', marginBottom: '2px' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '8px', opacity: 0.8, lineHeight: '11px' }}>{item.desc}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 03: Performance Competency Evaluation Table */}
          <section className="space-y-1.5">
            {renderSectionHeader(
              '03',
              isOps
                ? 'Operations Performance Evaluation'
                : isIt
                ? 'Technical Competency Evaluation'
                : 'Functional Competency Evaluation',
              <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border inline-block ${scoreBadgeClass}`}>
                Calibrated Competency Assessment
              </span>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[8.5px] font-bold text-slate-600 uppercase tracking-wider" style={{ height: '26px' }}>
                    <th className="py-1 px-2.5 text-center" style={{ width: '34px', verticalAlign: 'middle' }}>#</th>
                    <th className="py-1 px-2.5" style={{ width: '220px', verticalAlign: 'middle' }}>Performance Area / Metric</th>
                    <th className="py-1 px-2.5 text-center" style={{ width: '110px', verticalAlign: 'middle' }}>Rating (1-5)</th>
                    <th className="py-1 px-3" style={{ verticalAlign: 'middle' }}>Evaluator Comments &amp; Observations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.competencies &&
                    data.competencies.map((comp, idx) => {
                      const numScore = parseFloat(comp.score) || 0;
                      const scoreBadge =
                        numScore >= 4.5
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : numScore >= 3.5
                          ? 'bg-sky-50 text-sky-800 border-sky-300'
                          : numScore >= 2.5
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300';

                      return (
                        <tr
                          key={idx}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                          style={{ height: '34px' }}
                        >
                          <td className="text-center font-bold text-slate-400 text-[10px]" style={{ verticalAlign: 'middle' }}>
                            {idx + 1}
                          </td>
                          <td className="px-2.5 font-bold text-slate-900 text-[10.5px] leading-tight truncate" style={{ verticalAlign: 'middle' }}>
                            {comp.area}
                          </td>
                          <td className="text-center" style={{ verticalAlign: 'middle' }}>
                            <span
                              className={`rounded font-bold font-mono text-center border ${scoreBadge}`}
                              style={{
                                display: 'inline-block',
                                minWidth: '76px',
                                height: '24px',
                                lineHeight: '22px',
                                boxSizing: 'border-box',
                                verticalAlign: 'middle',
                                fontSize: '10px',
                              }}
                            >
                              {numScore.toFixed(1)} / 5.0
                            </span>
                          </td>
                          <td className="px-3 text-slate-700 text-[10px] leading-tight truncate" style={{ verticalAlign: 'middle' }}>
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
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[9.5px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>TaskNera HRMS • Performance Appraisal Record • Confidential</span>
          </div>
          <div className="font-mono font-bold text-slate-700 text-[10px]">Page 1 of 2</div>
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
          padding: '22px 28px 18px 28px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div className="space-y-2">
          {/* Top Page 2 Header Running Strip */}
          <div className="pb-1.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${scoreBadgeClass}`}>
                {deptTag}
              </span>
              <span className="text-xs font-bold text-slate-900">
                {deptTitle}
              </span>
              {data.employeeName && (
                <span className="text-xs font-semibold text-slate-600">
                  • {data.employeeName}
                </span>
              )}
            </div>
            <div className="text-[9.5px] font-mono text-slate-600">
              {data.employeeId ? `ID: ${data.employeeId} • ` : ''}Review Date: {data.reviewDate || '—'}
            </div>
          </div>

          {/* 04 & 05: Accomplishments & Development Areas */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 04: Key Accomplishments */}
            <section className="space-y-1">
              {renderSectionHeader('04', 'Key Accomplishments')}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 min-h-[56px] text-[9.5px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.achievements || 'No specific accomplishments recorded for this cycle.'}
              </div>
            </section>

            {/* 05: Areas for Improvement */}
            <section className="space-y-1">
              {renderSectionHeader('05', 'Areas for Development')}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 min-h-[56px] text-[9.5px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.improvements || 'Continue scaling performance according to quarterly deliverables.'}
              </div>
            </section>
          </div>

          {/* 06: Goals & Key Performance Objectives Table */}
          <section className="space-y-1">
            {renderSectionHeader(
              '06',
              'Goals & Performance Objectives',
              <span className="text-[8.5px] text-slate-500 font-semibold">Agreed Target Deliverables</span>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-1 px-2.5" style={{ width: '190px' }}>Goal Objective</th>
                    <th className="py-1 px-2.5">Target / Key Result</th>
                    <th className="py-1 px-2 text-center" style={{ width: '85px' }}>Deadline</th>
                    <th className="py-1 px-2 text-center" style={{ width: '80px' }}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.goals &&
                    data.goals.map((g, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} style={{ height: '26px' }}>
                        <td className="py-1 px-2.5 font-bold text-slate-900 text-[9.5px] leading-tight truncate">
                          {g.goal || '—'}
                        </td>
                        <td className="py-1 px-2.5 text-slate-700 text-[9.5px] leading-tight truncate">
                          {g.target || '—'}
                        </td>
                        <td className="py-1 px-2 text-center font-mono text-slate-600 text-[9px] leading-tight">
                          {g.deadline || '—'}
                        </td>
                        <td className="py-1 px-2 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[8.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
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
          <section className="space-y-1">
            {renderSectionHeader(
              '07',
              'Training & Skill Development Plan',
              <span className="text-[8.5px] text-slate-500 font-semibold">Development Roadmaps</span>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[8.5px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-1 px-2.5" style={{ width: '220px' }}>Skill / Operational Area</th>
                    <th className="py-1 px-2.5">Training Required / Workshop</th>
                    <th className="py-1 px-2 text-center" style={{ width: '80px' }}>Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.training &&
                    data.training.map((t, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} style={{ height: '26px' }}>
                        <td className="py-1 px-2.5 font-bold text-slate-900 text-[9.5px] leading-tight truncate">
                          {t.skill || '—'}
                        </td>
                        <td className="py-1 px-2.5 text-slate-700 text-[9.5px] leading-tight truncate">
                          {t.training || '—'}
                        </td>
                        <td className="py-1 px-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[8.5px] font-bold border whitespace-nowrap ${
                              t.priority === 'High'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {t.priority || 'Medium'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 08 & 09: Feedback Comments */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 08: Employee Comments */}
            <section className="space-y-1">
              {renderSectionHeader('08', 'Employee Comments')}
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 min-h-[46px] text-[9.5px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.employeeComments || 'Employee self-reflection confirmed and submitted.'}
              </div>
            </section>

            {/* 09: Manager Comments */}
            <section className="space-y-1">
              {renderSectionHeader('09', 'Manager Comments')}
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 min-h-[46px] text-[9.5px] text-slate-800 leading-relaxed whitespace-pre-line">
                {data.managerComments || 'Performance evaluation completed in accordance with quarterly standards.'}
              </div>
            </section>
          </div>

          {/* 10: Overall Performance Rating */}
          <section className="space-y-1">
            {renderSectionHeader('10', 'Overall Performance Rating')}

            <div className="grid grid-cols-5 gap-2">
              {overallRatingOptions.map((rating) => {
                const isSelected = data.overallRating?.toLowerCase() === rating.label.toLowerCase();
                return (
                  <div
                    key={rating.label}
                    className={`rounded-lg border px-2 text-center ${
                      isSelected
                        ? `${rating.color} border-2`
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                    style={{ height: '36px', lineHeight: '34px', boxSizing: 'border-box', textAlign: 'center' }}
                  >
                    <span style={{ fontSize: '13px', verticalAlign: 'middle', marginRight: '5px' }}>{rating.icon}</span>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, verticalAlign: 'middle' }}>{rating.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 11: Final Recommendations / Administrative Actions */}
          <section className="space-y-1">
            {renderSectionHeader('11', 'Final Actions & Recommendations')}

            <div className="grid grid-cols-2 gap-2">
              {actionLabels.map((act) => {
                const isChecked = Boolean(data.actions && data.actions[act.id]);
                return (
                  <div
                    key={act.id}
                    className={`rounded-lg border ${
                      isChecked
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                    style={{
                      height: '36px',
                      padding: '0 10px',
                      boxSizing: 'border-box',
                      display: 'table',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'table-row' }}>
                      <div style={{ display: 'table-cell', verticalAlign: 'middle', width: '20px' }}>
                        <div
                          className={`border ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}
                          style={{
                            width: '14px',
                            height: '14px',
                            lineHeight: '12px',
                            textAlign: 'center',
                            borderRadius: '3px',
                            boxSizing: 'border-box',
                          }}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" style={{ display: 'inline-block', verticalAlign: 'middle' }} />}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'table-cell',
                          verticalAlign: 'middle',
                          paddingLeft: '8px',
                          fontSize: '9.5px',
                          lineHeight: '14px',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {act.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 12: CEO Signature & Final Authorization */}
          <section className="space-y-1">
            {renderSectionHeader('12', 'CEO Approval & Final Authorization')}

            <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/50 p-2.5 px-3.5 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                    CEO Authorization
                  </span>
                  <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Chief Executive Officer
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900 leading-tight">
                  {data.ceoName || "Sheetal Ma'am"}
                </div>
                <div className="text-[9px] text-slate-600 font-semibold leading-tight">
                  Chief Executive Officer • Executive Leadership Approval
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                  Authorization Date
                </div>
                <div className="font-mono font-bold text-xs text-slate-800 leading-tight">
                  {data.ceoDate || '2026-09-16'}
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  Officially Authorized
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Page 2 Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[9.5px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>TaskNera HRMS • Performance Appraisal Record • Confidential</span>
          </div>
          <div className="font-mono font-bold text-slate-700 text-[10px]">Page 2 of 2</div>
        </div>
      </div>
    </div>
  );
});

PrintableReportDossier.displayName = 'PrintableReportDossier';
