import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  Sparkles,
  Calendar,
  AlertTriangle,
  ArrowRight,
  User,
  Clock,
  CheckCircle2,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { ceoTaskService } from '../../services/ceoTaskService.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';

export const TaskAuditTrailModal = ({ isOpen, onClose, task }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && task?.id) {
      loadAuditTrail();
    }
  }, [isOpen, task]);

  const loadAuditTrail = async () => {
    try {
      setLoading(true);
      const res = await ceoTaskService.getTaskAuditTrail(task.id);
      setAuditLogs(Array.isArray(res) ? res : res.data || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Activity & Audit History"
      subtitle={`Immutable audit trail for: ${task.title || 'Task Directive'}`}
      maxWidth="max-w-2xl"
    >
      <div className="p-6 space-y-4">
        {/* Task Header Summary Card */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-mono text-slate-500">{task.id}</span>
            <div className="flex items-center gap-2">
              <Badge variant={task.priority === 'URGENT' ? 'danger' : 'warning'}>
                {task.priority || 'MEDIUM'}
              </Badge>
              <Badge variant={task.status === 'COMPLETED' ? 'success' : 'default'}>
                {task.status || 'TODO'}
              </Badge>
            </div>
          </div>

          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Assignee:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {task.assignee_first ? `${task.assignee_first} ${task.assignee_last || ''}` : task.assigneeName || 'Assigned Staff'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Source:</span>
              <span className="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                {task.assigned_by === 'AI' || task.is_ai_assigned ? (
                  <>
                    <Sparkles className="w-3 h-3" /> AI Allocated
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3 text-amber-500" /> CEO Directive
                  </>
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Due Date:</span>
              <span className="font-semibold">{task.due_date || task.dueDate || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Timeline Stream */}
        <div className="space-y-3 pt-2">
          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Chronological Audit Events ({auditLogs.length})
          </h5>

          {loading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner message="Retrieving verifiable audit trail..." />
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No historical events recorded yet.</p>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {auditLogs.map((log, index) => {
                const isAi = log.actor?.toLowerCase().includes('ai');
                const isCeo = log.actor?.toLowerCase().includes('ceo') || log.actor?.toLowerCase().includes('admin');

                return (
                  <div key={log.id || index} className="relative space-y-1">
                    {/* Timeline Node Icon */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${
                        isAi
                          ? 'bg-purple-600 text-white'
                          : isCeo
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-500 text-white'
                      }`}
                    >
                      {isAi ? <Sparkles className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                    </div>

                    {/* Event Content */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        {log.actor}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                          {log.action}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-400">{log.timestamp}</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {log.details}
                    </p>

                    {/* Diff changes if present */}
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500 pt-0.5">
                        {Object.entries(log.changes).map(([k, v]) => (
                          <span key={k} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                            {k}: <strong>{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Close Audit Log
          </Button>
        </div>
      </div>
    </Modal>
  );
};

