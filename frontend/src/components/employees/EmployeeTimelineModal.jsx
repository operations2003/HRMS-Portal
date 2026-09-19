import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Calendar,
  UserCheck,
  Award,
  LogOut,
  FolderLock,
  Briefcase,
  AlertCircle,
  FileCheck2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { http } from '../../services/api.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { Badge } from '../common/Badge.jsx';

export const EmployeeTimelineModal = ({ isOpen, onClose, employeeId, employeeName }) => {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (!isOpen || !employeeId) return;

    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = filterType ? `?eventType=${filterType}` : '';
        const res = await http.get(`/v1/employees/${employeeId}/timeline${queryParams}`);
        setTimelineData(res.data);
      } catch (err) {
        setError(err.message || 'Failed to load employee timeline.');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [isOpen, employeeId, filterType]);

  if (!isOpen) return null;

  const getEventIcon = (type) => {
    switch (type) {
      case 'ATS_HANDOFF':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      case 'ONBOARDING':
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      case 'JOINING':
        return <Briefcase className="w-4 h-4 text-indigo-600" />;
      case 'PROBATION':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'PERFORMANCE':
        return <Award className="w-4 h-4 text-purple-600" />;
      case 'CAREER_TRANSITION':
        return <FileCheck2 className="w-4 h-4 text-cyan-600" />;
      case 'DOCUMENT':
        return <FolderLock className="w-4 h-4 text-slate-600" />;
      case 'RESIGNATION':
      case 'OFFBOARDING':
        return <LogOut className="w-4 h-4 text-rose-600" />;
      default:
        return <Calendar className="w-4 h-4 text-slate-500" />;
    }
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'ATS_HANDOFF':
        return <Badge variant="success">ATS Recruitment</Badge>;
      case 'ONBOARDING':
        return <Badge variant="info">Onboarding</Badge>;
      case 'JOINING':
        return <Badge variant="primary">Joining</Badge>;
      case 'PROBATION':
        return <Badge variant="warning">Probation</Badge>;
      case 'PERFORMANCE':
        return <Badge variant="purple">Performance</Badge>;
      case 'CAREER_TRANSITION':
        return <Badge variant="neutral">Transition</Badge>;
      case 'DOCUMENT':
        return <Badge variant="neutral">Document</Badge>;
      case 'RESIGNATION':
      case 'OFFBOARDING':
        return <Badge variant="danger">Exit & Offboarding</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Employee Lifecycle Timeline
            </h3>
            <p className="text-xs text-slate-500">
              Reconstructing journey for {employeeName || 'Employee'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Filter Event:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">All Events</option>
              <option value="ATS_HANDOFF">ATS Handoff</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="JOINING">Joining</option>
              <option value="PROBATION">Probation</option>
              <option value="PERFORMANCE">Performance</option>
              <option value="CAREER_TRANSITION">Career Transitions</option>
              <option value="DOCUMENT">Documents</option>
              <option value="RESIGNATION">Resignation & Exit</option>
            </select>
          </div>
          {timelineData && (
            <span className="text-xs font-medium text-slate-500">
              Total Events: {timelineData.totalEvents}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <LoadingSpinner message="Reconstructing lifecycle timeline..." />
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              {error}
            </div>
          ) : timelineData?.events?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No lifecycle events recorded matching filters.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-indigo-100 space-y-6">
              {timelineData?.events?.map((evt) => (
                <div key={evt.id} className="relative group">
                  {/* Dot */}
                  <div className="absolute -left-[31px] top-1.5 w-6 h-6 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center shadow-sm">
                    {getEventIcon(evt.eventType)}
                  </div>

                  {/* Card */}
                  <div className="p-4 bg-slate-50/80 hover:bg-slate-50 rounded-lg border border-slate-200 transition-all shadow-sm hover:shadow">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {getEventBadge(evt.eventType)}
                        <h4 className="text-sm font-bold text-slate-800">{evt.title}</h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(evt.eventDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{evt.description}</p>

                    {/* Metadata footer */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-3">
                        {evt.actor && <span>Actor: <strong className="text-slate-600">{evt.actor}</strong></span>}
                        {evt.approver && <span>Approver: <strong className="text-slate-600">{evt.approver}</strong></span>}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                        Source: {evt.sourceModule}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

