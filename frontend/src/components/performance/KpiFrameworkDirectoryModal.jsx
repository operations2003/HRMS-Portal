import React, { useState } from 'react';
import {
  Award,
  Target,
  Briefcase,
  CheckCircle2,
  Star,
  Users,
  ShieldCheck,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import {
  KPI_DESIGNATION_FRAMEWORKS,
  RATING_SCALE,
} from '../../constants/kpiFrameworks.js';

export const KpiFrameworkDirectoryModal = ({ isOpen, onClose, onEvaluateDesignation }) => {
  const [selectedFrameworkId, setSelectedFrameworkId] = useState('operations_manager');

  const selectedFramework =
    KPI_DESIGNATION_FRAMEWORKS.find((f) => f.id === selectedFrameworkId) ||
    KPI_DESIGNATION_FRAMEWORKS[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="TaskNera – Designation-wise KPI Framework"
      subtitle="Standardized performance objectives, weights, monthly targets, and the Common Rating Scale."
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Framework Selection Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {KPI_DESIGNATION_FRAMEWORKS.map((fw) => (
            <button
              key={fw.id}
              type="button"
              onClick={() => setSelectedFrameworkId(fw.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedFrameworkId === fw.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>{fw.title}</span>
            </button>
          ))}
        </div>

        {/* Selected Framework Header Banner */}
        <div className="p-4 bg-gradient-to-r from-brand-50 via-amber-50/50 to-indigo-50/50 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-brand-200/80 dark:border-slate-700 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/60 px-2 py-0.5 rounded-full">
                {selectedFramework.category} &bull; 100% KPI Allocation
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                {selectedFramework.title}
              </h3>
            </div>

            {onEvaluateDesignation && (
              <Button
                size="xs"
                variant="primary"
                icon={Star}
                onClick={() => {
                  onClose();
                  onEvaluateDesignation(selectedFramework.id);
                }}
              >
                Evaluate for this Role
              </Button>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            <strong>Primary Objective:</strong> {selectedFramework.primaryObjective}
          </p>

          {selectedFramework.guidelineNote && (
            <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 p-2 rounded-lg font-medium">
              {selectedFramework.guidelineNote}
            </p>
          )}
        </div>

        {/* Two Column Layout: KPIs on Left, Key Responsibilities on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* KPIs Table (7 cols) */}
          <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                KPI Allocation &amp; Monthly Targets
              </span>
              <span className="text-[10px] font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                Total 100%
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {selectedFramework.kpis.map((kpi, idx) => (
                <div key={kpi.id || idx} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/50">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {idx + 1}. {kpi.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      <strong>Monthly Target:</strong> {kpi.monthlyTarget}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400 shrink-0 bg-brand-50 dark:bg-brand-950/40 px-2 py-1 rounded-lg text-xs">
                    {kpi.weight}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Responsibilities Evaluated (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                Key Responsibilities Evaluated
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {selectedFramework.keyResponsibilities.map((resp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Formula Card */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-brand-600" />
                Weighted KPI Calculation
              </h4>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-center font-mono text-xs text-brand-700 dark:text-brand-300 font-bold">
                Weighted Score = (Achievement % × Weight) ÷ 100
              </div>
              <p className="text-[11px] text-slate-500">
                Each designation uses its specific KPIs, with scores calculated on a uniform 0–100% scale.
              </p>
            </div>
          </div>
        </div>

        {/* 6. Common Performance Rating System */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs space-y-0">
          <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              6. Common Performance Rating Scale (Universal for All Designations)
            </h4>
            <span className="text-[11px] text-slate-500">Standard 1 to 5 scale</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Rating</th>
                  <th className="py-2.5 px-4 font-bold">Score Range</th>
                  <th className="py-2.5 px-4 font-bold">Performance Level</th>
                  <th className="py-2.5 px-4 font-bold">Evaluation Criteria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {RATING_SCALE.map((scale) => (
                  <tr key={scale.rating} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-black font-display text-sm text-slate-900 dark:text-white">
                      {scale.rating}.0
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-brand-600">
                      {scale.rating === 1 ? 'Below 50' : `${scale.minScore}–${Math.floor(scale.maxScore)}%`}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${scale.bgColor}`}>
                        {scale.level}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {scale.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close Framework Reference
          </Button>
        </div>
      </div>
    </Modal>
  );
};

