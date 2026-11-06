import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Star,
  Target,
  CheckCircle2,
  Calendar,
  User,
  ShieldCheck,
  TrendingUp,
  FileText,
  X,
  Loader2,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { Avatar } from '../common/Avatar.jsx';
import {
  RATING_SCALE,
  getPerformanceRatingFromScore,
} from '../../constants/kpiFrameworks.js';
import { performanceService } from '../../services/performanceService.js';

export const KpiScorecardDetailModal = ({ isOpen, onClose, record }) => {
  const [detailedRecord, setDetailedRecord] = useState(record || null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    setDetailedRecord(record || null);
    if (isOpen && record?.id && (!record.goals || record.goals.length === 0)) {
      setLoadingDetails(true);
      performanceService
        .getRecordById(record.id)
        .then((data) => {
          if (data) {
            setDetailedRecord(data.record || data.data || data);
          }
        })
        .catch((err) => {
          console.error('Failed to load detailed scorecard record:', err);
        })
        .finally(() => {
          setLoadingDetails(false);
        });
    }
  }, [isOpen, record]);

  if (!record && !detailedRecord) return null;

  const currentRec = detailedRecord || record;
  const score = Number(currentRec.score ?? currentRec.rating * 20 ?? 0);
  const rating = Number(currentRec.rating ?? 4);
  const ratingInfo = getPerformanceRatingFromScore(score > 5 ? score : rating * 20);

  const goals = Array.isArray(currentRec.goals) ? currentRec.goals : [];
  const empName = currentRec.employee?.fullName || currentRec.employeeName || 'Staff Member';
  const reviewerName = currentRec.reviewer?.fullName || (typeof currentRec.reviewer === 'string' ? currentRec.reviewer : null) || currentRec.reviewerName || 'Reviewer';

  const desig = typeof currentRec.employee?.designation === 'string'
    ? currentRec.employee.designation
    : (currentRec.employee?.designation?.name || currentRec.employee?.designationTitle || currentRec.employee?.role || 'Designation');
  const dept = typeof currentRec.employee?.department === 'string'
    ? currentRec.employee.department
    : (currentRec.employee?.department?.name || 'Department');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Candidate Performance Scorecard"
      subtitle={`Detailed KPI Breakdown & Evaluation for ${empName} (${currentRec.reviewPeriod || 'Period'})`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Candidate & Review Info Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/90 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={currentRec.employee?.avatarUrl || currentRec.avatarUrl}
              name={empName}
              size="md"
              className="ring-2 ring-brand-500/20"
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{empName}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {desig} &bull; {dept}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Evaluated By</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{reviewerName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Review Cycle</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{currentRec.reviewPeriod}</span>
            </div>
          </div>
        </div>

        {/* Score & Rating Banner */}
        <div className="p-5 bg-gradient-to-r from-brand-50 via-amber-50/40 to-indigo-50/40 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-brand-200/80 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border-2 border-brand-500/40 font-display font-black text-2xl shadow-sm">
              {rating.toFixed(1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  Performance Level:
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${ratingInfo.bgColor}`}>
                  {ratingInfo.level}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                {ratingInfo.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 text-right">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Score</span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {score > 5 ? score : Math.round(rating * 20)}%
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Common Rating</span>
              <div className="flex items-center gap-1 text-amber-500 font-bold text-base">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Goals & KPI Scoring Items */}
        {loadingDetails ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            <span>Loading KPI breakdown...</span>
          </div>
        ) : goals.length > 0 ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <div className="p-3 bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-600" />
                Evaluated KPI Breakdown
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {goals.length} Key Performance Indicators
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {goals.map((g, idx) => {
                const target = g.metricTarget || g.metric_target;
                const achieved = g.metricAchieved || g.metric_achieved;
                return (
                  <div key={g.id || idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {idx + 1}. {g.title}
                        </span>
                        {g.weightage && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600">
                            {g.weightage}% Weight
                          </span>
                        )}
                      </div>
                      {target && (
                        <p className="text-[11px] text-slate-500">
                          <strong>Target:</strong> {target}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      {achieved && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Achievement</span>
                          <span className="font-mono font-bold text-brand-600">
                            {achieved}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                        <Badge variant={g.status === 'ACHIEVED' ? 'success' : 'neutral'} size="sm">
                          {g.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Feedback / Reviewer Comments */}
        {(currentRec.feedback || currentRec.reviewerComments) && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/90 dark:border-slate-700 space-y-1.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              Evaluation Feedback &amp; Reviewer Notes
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {currentRec.feedback || currentRec.reviewerComments}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Scorecard
          </Button>
        </div>
      </div>
    </Modal>
  );
};
