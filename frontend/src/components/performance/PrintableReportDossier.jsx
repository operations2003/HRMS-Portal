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

  const numBgStyle = isOps
    ? { backgroundColor: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }
    : isIt
    ? { backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }
    : { backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' };

  const scoreBadgeStyle = isOps
    ? { backgroundColor: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }
    : isIt
    ? { backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }
    : { backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' };

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
      colorHex: '#059669',
      bgHex: '#ecfdf5',
      borderHex: '#10b981',
      textHex: '#064e3b',
    },
    {
      val: 4,
      title: 'Exceeds Expectations',
      desc: 'Frequently goes beyond role demands',
      colorHex: '#0284c7',
      bgHex: '#f0f9ff',
      borderHex: '#0ea5e9',
      textHex: '#075985',
    },
    {
      val: 3,
      title: 'Meets Expectations',
      desc: 'Consistently achieves core deliverables',
      colorHex: '#4f46e5',
      bgHex: '#eef2ff',
      borderHex: '#6366f1',
      textHex: '#3730a3',
    },
    {
      val: 2,
      title: 'Needs Improvement',
      desc: 'Fails to meet expected benchmarks',
      colorHex: '#d97706',
      bgHex: '#fffbeb',
      borderHex: '#f59e0b',
      textHex: '#92400e',
    },
    {
      val: 1,
      title: 'Unsatisfactory',
      desc: 'Critical performance deficiency',
      colorHex: '#e11d48',
      bgHex: '#fff1f2',
      borderHex: '#f43f5e',
      textHex: '#9f1239',
    },
  ];

  const overallRatingOptions = [
    { label: 'Exceptional', icon: '⭐', colorHex: '#059669', bgHex: '#ecfdf5', borderHex: '#10b981', textHex: '#065f46' },
    { label: 'Exceeds Expectations', icon: '✨', colorHex: '#0284c7', bgHex: '#f0f9ff', borderHex: '#0ea5e9', textHex: '#075985' },
    { label: 'Meets Expectations', icon: '👍', colorHex: '#4f46e5', bgHex: '#eef2ff', borderHex: '#6366f1', textHex: '#3730a3' },
    { label: 'Needs Improvement', icon: '⚠️', colorHex: '#d97706', bgHex: '#fffbeb', borderHex: '#f59e0b', textHex: '#92400e' },
    { label: 'Unsatisfactory', icon: '❌', colorHex: '#e11d48', bgHex: '#fff1f2', borderHex: '#f43f5e', textHex: '#9f1239' },
  ];

  // Clean Flexbox Section Header - Border line stays neatly UNDER both Title and Right Badge
  const renderSectionHeader = (num, title, rightElement = null) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1.5px solid #e2e8f0',
        paddingBottom: '5px',
        marginBottom: '7px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 800,
            boxSizing: 'border-box',
            ...numBgStyle,
          }}
        >
          {num}
        </span>
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </span>
      </div>
      {rightElement && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {rightElement}
        </div>
      )}
    </div>
  );

  const infoRow1 = [
    { label: 'Employee Name', value: data.employeeName || '—' },
    { label: 'Employee ID', value: data.employeeId || '—', isMono: true },
    { label: 'Department', value: data.department || (isOps ? 'Operations Team' : isIt ? 'IT Team' : 'TA Team') },
    { label: 'Designation', value: data.designation || 'Team Member' },
  ];

  const infoRow2 = [
    { label: 'Reporting Manager', value: data.manager || '—' },
    { label: 'Review Date', value: data.reviewDate || '—', isMono: true },
    { label: 'Review Period', value: data.reviewPeriod || '—' },
    { label: 'L&D Executive', value: data.ldExecutive || 'Swati Batabyal' },
  ];

  return (
    <div
      ref={ref}
      className="pdf-export-container font-sans text-slate-800 bg-white"
      style={{
        width: '794px',
        backgroundColor: '#ffffff',
        color: '#0f172a',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {/* Executive Header Banner - Sleek High Contrast */}
          <div
            style={{
              backgroundColor: '#0f172a',
              backgroundImage: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 60%, #0f172a 100%)',
              borderRadius: '10px',
              padding: '13px 18px',
              border: '1px solid #1e293b',
              borderBottom: '3px solid #6366f1',
              boxSizing: 'border-box',
              position: 'relative',
              overflow: 'hidden',
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
              <div style={{ maxWidth: '500px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#f8fafc',
                    }}
                  >
                    <Icon className="w-3 h-3 text-indigo-300" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    {deptTag}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    TaskNera HRMS
                  </span>
                </div>
                <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
                  {deptTitle}
                </h1>
                <p style={{ fontSize: '9.5px', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.3, fontWeight: 400 }}>
                  {deptSubtitle}
                </p>
              </div>

              {/* Header Right Status Determination Card */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  textAlign: 'right',
                  minWidth: '160px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Review Determination
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#ffffff', lineHeight: 1.2, marginTop: '2px' }}>
                  {data.overallRating || 'Meets Expectations'}
                </div>
                <div style={{ fontSize: '9.5px', color: '#cbd5e1', marginTop: '2px' }}>
                  Cycle: {data.reviewCycle || 'Quarterly Review'}
                </div>
              </div>
            </div>
          </div>

          {/* 01: Employee & Review Information (Generous Height to Prevent Text Clipping) */}
          <section>
            {renderSectionHeader('01', 'Employee & Review Information')}

            {/* Row 1 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '7px', width: '100%', boxSizing: 'border-box' }}>
              {infoRow1.map((item, i) => (
                <div
                  key={i}
                  style={{
                    flex: '1 1 25%',
                    width: '25%',
                    minWidth: 0,
                    minHeight: '50px',
                    padding: '6px 10px',
                    boxSizing: 'border-box',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '12px', marginBottom: '2px' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: item.isMono ? 'monospace' : 'inherit', color: '#0f172a', lineHeight: '16px' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2 */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
              {infoRow2.map((item, i) => (
                <div
                  key={i}
                  style={{
                    flex: '1 1 25%',
                    width: '25%',
                    minWidth: 0,
                    minHeight: '50px',
                    padding: '6px 10px',
                    boxSizing: 'border-box',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '12px', marginBottom: '2px' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, fontFamily: item.isMono ? 'monospace' : 'inherit', color: '#0f172a', lineHeight: '16px' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 02: Rating Scale Reference (5 Rubrics in 1 Row - No Border Line Crossing) */}
          <section>
            {renderSectionHeader(
              '02',
              'Rating Scale Reference',
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  ...scoreBadgeStyle,
                }}
              >
                Average Score: <span style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '11px' }}>{averageScore} / 5.0</span>
              </span>
            )}

            <div style={{ display: 'flex', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
              {ratingRubric.map((item) => {
                const isSelected = data.overallRating?.toLowerCase().includes(item.title.toLowerCase());
                return (
                  <div
                    key={item.val}
                    style={{
                      flex: '1 1 20%',
                      width: '20%',
                      minWidth: 0,
                      height: '72px',
                      padding: '6px 4px',
                      boxSizing: 'border-box',
                      borderRadius: '6px',
                      border: isSelected ? `2px solid ${item.borderHex}` : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? item.bgHex : '#ffffff',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        width: '22px',
                        height: '22px',
                        lineHeight: '22px',
                        textAlign: 'center',
                        margin: '0 auto 3px auto',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 900,
                        color: '#ffffff',
                        backgroundColor: item.colorHex,
                        boxSizing: 'border-box',
                      }}
                    >
                      {item.val}
                    </span>
                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: isSelected ? item.textHex : '#1e293b', lineHeight: '13px', marginBottom: '1px' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '7.5px', color: '#64748b', lineHeight: '10px' }}>
                      {item.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 03: Performance Competency Evaluation Table */}
          <section>
            {renderSectionHeader(
              '03',
              isOps
                ? 'Operations Performance Evaluation'
                : isIt
                ? 'Technical Competency Evaluation'
                : 'Functional Competency Evaluation',
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '9px',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  ...scoreBadgeStyle,
                }}
              >
                Calibrated Competency Assessment
              </span>
            )}

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', height: '26px' }}>
                    <th style={{ width: '32px', textAlign: 'center', padding: '4px 6px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>#</th>
                    <th style={{ width: '220px', textAlign: 'left', padding: '4px 8px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Performance Area / Metric</th>
                    <th style={{ width: '105px', textAlign: 'center', padding: '4px 6px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Rating (1-5)</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Evaluator Comments &amp; Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competencies &&
                    data.competencies.map((comp, idx) => {
                      const numScore = parseFloat(comp.score) || 0;
                      const badgeStyle =
                        numScore >= 4.5
                          ? { backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }
                          : numScore >= 3.5
                          ? { backgroundColor: '#f0f9ff', color: '#075985', border: '1px solid #bae6fd' }
                          : numScore >= 2.5
                          ? { backgroundColor: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe' }
                          : { backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' };

                      return (
                        <tr
                          key={idx}
                          style={{
                            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            borderBottom: '1px solid #f1f5f9',
                            height: '32px',
                          }}
                        >
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '9.5px', verticalAlign: 'middle' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '4px 8px', fontWeight: 700, color: '#0f172a', fontSize: '10px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {comp.area}
                          </td>
                          <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '2px 4px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                minWidth: '72px',
                                height: '22px',
                                lineHeight: '20px',
                                borderRadius: '4px',
                                boxSizing: 'border-box',
                                verticalAlign: 'middle',
                                fontSize: '9.5px',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                ...badgeStyle,
                              }}
                            >
                              {numScore.toFixed(1)} / 5.0
                            </span>
                          </td>
                          <td style={{ padding: '4px 8px', color: '#334155', fontSize: '9.5px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', fontWeight: 500, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 inline" />
            <span>TaskNera HRMS • Performance Appraisal Record • Confidential</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#334155', fontSize: '9.5px' }}>Page 1 of 2</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Top Page 2 Header Running Strip */}
          <div style={{ paddingBottom: '6px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '8.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px', borderRadius: '4px', border: '1px solid #c7d2fe', backgroundColor: '#eef2ff', color: '#3730a3', marginRight: '8px' }}>
                {deptTag}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', marginRight: '6px' }}>
                {deptTitle}
              </span>
              {data.employeeName && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                  • {data.employeeName}
                </span>
              )}
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#475569' }}>
              {data.employeeId ? `ID: ${data.employeeId} • ` : ''}Review Date: {data.reviewDate || '—'}
            </div>
          </div>

          {/* 04 & 05: Accomplishments & Development Areas (Generous Padding & Line Height) */}
          <div style={{ display: 'flex', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ flex: '1 1 50%', width: '50%', minWidth: 0 }}>
              {renderSectionHeader('04', 'Key Accomplishments')}
              <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '54px', fontSize: '9.5px', color: '#1e293b', lineHeight: 1.45, whiteSpace: 'pre-line', boxSizing: 'border-box' }}>
                {data.achievements || 'No specific accomplishments recorded for this cycle.'}
              </div>
            </div>
            <div style={{ flex: '1 1 50%', width: '50%', minWidth: 0 }}>
              {renderSectionHeader('05', 'Areas for Development')}
              <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '54px', fontSize: '9.5px', color: '#1e293b', lineHeight: 1.45, whiteSpace: 'pre-line', boxSizing: 'border-box' }}>
                {data.improvements || 'Continue scaling performance according to quarterly deliverables.'}
              </div>
            </div>
          </div>

          {/* 06: Goals & Key Performance Objectives Table */}
          <section>
            {renderSectionHeader(
              '06',
              'Goals & Performance Objectives',
              <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 600 }}>Agreed Target Deliverables</span>
            )}

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', height: '24px' }}>
                    <th style={{ width: '180px', textAlign: 'left', padding: '3px 8px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Goal Objective</th>
                    <th style={{ textAlign: 'left', padding: '3px 8px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Target / Key Result</th>
                    <th style={{ width: '85px', textAlign: 'center', padding: '3px 6px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Deadline</th>
                    <th style={{ width: '80px', textAlign: 'center', padding: '3px 6px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.goals &&
                    data.goals.map((g, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', height: '26px' }}>
                        <td style={{ padding: '3px 8px', fontWeight: 700, color: '#0f172a', fontSize: '9px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.goal || '—'}
                        </td>
                        <td style={{ padding: '3px 8px', color: '#334155', fontSize: '9px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.target || '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', color: '#475569', fontSize: '8.5px', verticalAlign: 'middle' }}>
                          {g.deadline || '—'}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 700, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
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
          <section>
            {renderSectionHeader(
              '07',
              'Training & Skill Development Plan',
              <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 600 }}>Development Roadmaps</span>
            )}

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', height: '24px' }}>
                    <th style={{ width: '200px', textAlign: 'left', padding: '3px 8px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Skill / Operational Area</th>
                    <th style={{ textAlign: 'left', padding: '3px 8px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Training Required / Workshop</th>
                    <th style={{ width: '80px', textAlign: 'center', padding: '3px 6px', fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {data.training &&
                    data.training.map((t, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', height: '26px' }}>
                        <td style={{ padding: '3px 8px', fontWeight: 700, color: '#0f172a', fontSize: '9px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.skill || '—'}
                        </td>
                        <td style={{ padding: '3px 8px', color: '#334155', fontSize: '9px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.training || '—'}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '8px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              border: t.priority === 'High' ? '1px solid #fecdd3' : '1px solid #c7d2fe',
                              backgroundColor: t.priority === 'High' ? '#fff1f2' : '#eef2ff',
                              color: t.priority === 'High' ? '#be123c' : '#4338ca',
                            }}
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

          {/* 08 & 09: Feedback Comments (Generous Padding & Line Height) */}
          <div style={{ display: 'flex', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ flex: '1 1 50%', width: '50%', minWidth: 0 }}>
              {renderSectionHeader('08', 'Employee Comments')}
              <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '48px', fontSize: '9.5px', color: '#1e293b', lineHeight: 1.45, whiteSpace: 'pre-line', boxSizing: 'border-box' }}>
                {data.employeeComments || 'Employee self-reflection confirmed and submitted.'}
              </div>
            </div>
            <div style={{ flex: '1 1 50%', width: '50%', minWidth: 0 }}>
              {renderSectionHeader('09', 'Manager Comments')}
              <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '48px', fontSize: '9.5px', color: '#1e293b', lineHeight: 1.45, whiteSpace: 'pre-line', boxSizing: 'border-box' }}>
                {data.managerComments || 'Performance evaluation completed in accordance with quarterly standards.'}
              </div>
            </div>
          </div>

          {/* 10: Overall Performance Rating (5 Horizontal Pills) */}
          <section>
            {renderSectionHeader('10', 'Overall Performance Rating')}

            <div style={{ display: 'flex', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
              {overallRatingOptions.map((rating) => {
                const isSelected = data.overallRating?.toLowerCase() === rating.label.toLowerCase();
                return (
                  <div
                    key={rating.label}
                    style={{
                      flex: '1 1 20%',
                      width: '20%',
                      minWidth: 0,
                      height: '34px',
                      lineHeight: '32px',
                      textAlign: 'center',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      border: isSelected ? `2px solid ${rating.borderHex}` : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? rating.bgHex : '#f8fafc',
                      color: isSelected ? rating.textHex : '#475569',
                      fontWeight: isSelected ? 800 : 600,
                    }}
                  >
                    <span style={{ fontSize: '12px', verticalAlign: 'middle', marginRight: '4px' }}>{rating.icon}</span>
                    <span style={{ fontSize: '9.5px', verticalAlign: 'middle' }}>{rating.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 11: Final Actions & Recommendations (No Text Clipping / Generous Height & Line-Height) */}
          <section>
            {renderSectionHeader('11', 'Final Actions & Recommendations')}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
              {[0, 2, 4].map((startIndex) => (
                <div key={startIndex} style={{ display: 'flex', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                  {actionLabels.slice(startIndex, startIndex + 2).map((act) => {
                    const isChecked = Boolean(data.actions && data.actions[act.id]);
                    return (
                      <div
                        key={act.id}
                        style={{
                          flex: '1 1 50%',
                          width: '50%',
                          minWidth: 0,
                          minHeight: '38px',
                          height: '38px',
                          padding: '0 12px',
                          boxSizing: 'border-box',
                          borderRadius: '6px',
                          border: isChecked ? '1px solid #818cf8' : '1px solid #e2e8f0',
                          backgroundColor: isChecked ? '#f5f3ff' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            lineHeight: '14px',
                            textAlign: 'center',
                            borderRadius: '3px',
                            boxSizing: 'border-box',
                            border: isChecked ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                            backgroundColor: isChecked ? '#4f46e5' : '#ffffff',
                            color: '#ffffff',
                            marginRight: '8px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" style={{ color: '#ffffff' }} />}
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            lineHeight: '20px',
                            fontWeight: isChecked ? 700 : 500,
                            color: isChecked ? '#1e1b4b' : '#334155',
                          }}
                        >
                          {act.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          {/* 12: CEO Signature & Final Authorization */}
          <section>
            {renderSectionHeader('12', 'CEO Approval & Final Authorization')}

            <div
              style={{
                borderRadius: '8px',
                border: '1px solid #c7d2fe',
                background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #eff6ff 100%)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                    CEO Authorization
                  </span>
                  <span style={{ fontSize: '7.5px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>
                    Chief Executive Officer
                  </span>
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                  {data.ceoName || "Sheetal Ma'am"}
                </div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                  Chief Executive Officer • Executive Leadership Approval
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                  Authorization Date
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b', marginTop: '1px' }}>
                  {data.ceoDate || '2026-09-16'}
                </div>
                <div style={{ marginTop: '3px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', fontSize: '8.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                  Officially Authorized
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Page 2 Footer */}
        <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', fontWeight: 500, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 inline" />
            <span>TaskNera HRMS • Performance Appraisal Record • Confidential</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#334155', fontSize: '9.5px' }}>Page 2 of 2</div>
        </div>
      </div>
    </div>
  );
});

PrintableReportDossier.displayName = 'PrintableReportDossier';
