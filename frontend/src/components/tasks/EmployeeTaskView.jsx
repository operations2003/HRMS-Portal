import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  Sliders,
  Send,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Link as LinkIcon,
  Search,
  Filter,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { TaskProgressUpdateModal } from './TaskProgressUpdateModal.jsx';
import { DeadlineExtensionModal } from './DeadlineExtensionModal.jsx';

export const EmployeeTaskView = ({
  tasks = [],
  currentUser,
  onUpdateProgress,
  onRequestExtension,
  onAddComment,
  onToggleSubtask,
}) => {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED'
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [progressModalTask, setProgressModalTask] = useState(null);
  const [extensionModalTask, setExtensionModalTask] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter tasks belonging specifically to this employee
  const myTasks = tasks.filter((t) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    const dueDateStr = t.due_date ? String(t.due_date).split('T')[0] : '';
    const isCompleted = t.status === 'COMPLETED';
    const isOverdue = t.is_overdue || (dueDateStr && dueDateStr < todayStr && !isCompleted);
    const isToday = dueDateStr === todayStr && !isCompleted;
    const isUpcoming = dueDateStr > todayStr && !isCompleted;

    if (activeTab === 'ALL') return true;
    if (activeTab === 'TODAY') return isToday;
    if (activeTab === 'UPCOMING') return isUpcoming;
    if (activeTab === 'OVERDUE') return isOverdue;
    if (activeTab === 'COMPLETED') return isCompleted;
    return true;
  });

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedTask) return;
    try {
      setIsCommentSubmitting(true);
      await onAddComment(selectedTask.id, commentText);
      setCommentText('');
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Employee Workspace Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>My Tasks & Daily Workplan</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
              {myTasks.length} Assigned
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track your operational tasks, submit daily deliverables, and coordinate directly with task issuers.
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search my tasks..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
        {[
          { id: 'ALL', label: 'All Tasks' },
          { id: 'TODAY', label: "Today's Tasks" },
          { id: 'UPCOMING', label: 'Upcoming' },
          { id: 'OVERDUE', label: 'Overdue' },
          { id: 'COMPLETED', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myTasks.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-brand-500 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Tasks in this View</h4>
            <p className="text-xs text-slate-400 mt-1">You are up to date on all items for this filter.</p>
          </div>
        ) : (
          myTasks.map((t) => {
            const isCompleted = t.status === 'COMPLETED';
            const isOverdue =
              t.is_overdue ||
              (t.due_date && String(t.due_date).split('T')[0] < todayStr && !isCompleted);
            const isCeo = t.assigned_by === 'CEO' || t.is_official;
            const isAi = t.assigned_by === 'AI' || t.is_ai_assigned;

            return (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3.5 flex flex-col justify-between hover:border-brand-300 dark:hover:border-brand-800 transition-all"
              >
                <div className="space-y-2">
                  {/* Top Origin & Priority Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {isCeo ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <ShieldCheck className="w-3 h-3 text-amber-600" /> CEO Directive
                      </span>
                    ) : isAi ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <Sparkles className="w-3 h-3 text-purple-600" /> AI Engine
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Manager Assigned
                      </span>
                    )}

                    <Badge variant={t.priority === 'URGENT' ? 'danger' : 'warning'}>
                      {t.priority || 'MEDIUM'}
                    </Badge>
                  </div>

                  {/* Title & Desc */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2" title={t.title}>
                      {t.title}
                    </h3>
                    {t.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1" title={t.description}>
                        {t.description}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Progress:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{t.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          (t.progress || 0) >= 100
                            ? 'bg-emerald-500'
                            : (t.progress || 0) >= 50
                            ? 'bg-brand-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${t.progress || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Deadline Info */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3.5 h-3.5" />
                      {t.due_date ? String(t.due_date).split('T')[0] : 'No deadline'}
                    </span>
                    {isOverdue && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions: Update Progress & Request Extension */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    onClick={() => setProgressModalTask(t)}
                    className="flex-1 text-xs py-1.5 inline-flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" /> Update Progress
                  </Button>

                  {!isCompleted && (
                    <Button
                      variant="ghost"
                      onClick={() => setExtensionModalTask(t)}
                      className="text-xs text-amber-600 hover:text-amber-700 py-1.5 px-2"
                      title="Request Deadline Extension"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <TaskProgressUpdateModal
        isOpen={!!progressModalTask}
        onClose={() => setProgressModalTask(null)}
        task={progressModalTask}
        onSubmit={onUpdateProgress}
      />

      <DeadlineExtensionModal
        isOpen={!!extensionModalTask}
        onClose={() => setExtensionModalTask(null)}
        task={extensionModalTask}
        onSubmit={onRequestExtension}
      />
    </div>
  );
};

