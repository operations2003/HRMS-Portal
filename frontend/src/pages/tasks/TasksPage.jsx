import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Kanban,
  List,
  Clock,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  Calendar,
  User,
  Tag,
  X,
  TrendingUp,
  Star,
  RotateCcw,
} from 'lucide-react';
import { MyPerformanceSection } from '../../components/tasks/MyPerformanceSection.jsx';
import { taskService } from '../../services/taskService.js';
import { employeeService } from '../../services/employeeService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { isCeoOrAdmin, filterNonCeoEmployees } from '../../utils/roleUtils.js';

const STATUS_COLUMNS = [
  { id: 'TODO', label: 'To Do', color: 'border-slate-300 bg-slate-50' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-300 bg-blue-50/50' },
  { id: 'BLOCKED', label: 'Blocked', color: 'border-amber-300 bg-amber-50/50' },
  { id: 'COMPLETED', label: 'Completed', color: 'border-emerald-300 bg-emerald-50/50' },
];

export const TasksPage = () => {
  const { user, hasRole } = useAuth();
  const toast = useToast();

  // Task assigners and reviewers: Admin, HR, and Manager only
  const canAssign = hasRole(['Admin', 'SuperAdmin', 'OrgAdmin', 'HR', 'HRManager', 'Manager']);

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'board'
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newComment, setNewComment] = useState('');

  // Task Review & Rating state
  const [taskRating, setTaskRating] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigneeId: '',
    priority: 'MEDIUM',
    dueDate: '',
    subtasksText: '',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskService.getTasks({
        search,
        status: statusFilter,
        priority: priorityFilter,
      });
      setTasks(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch tasks.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    // Fetch employees for assignment (excluding CEO/Admin globally)
    employeeService.listEmployees({ limit: 100 }).then((res) => {
      const list = res.employees || res.data?.employees || (Array.isArray(res) ? res : []);
      setEmployees(filterNonCeoEmployees(list));
    }).catch(() => {});
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const isUserAdminCeo = isCeoOrAdmin(user);
      const assigneeId = formData.assigneeId || (!isUserAdminCeo ? user.employeeId : null);
      if (!assigneeId) {
        toast.error('Please select an employee to assign this task to.');
        return;
      }

      const subtasks = formData.subtasksText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((t) => ({ title: t, completed: false }));

      await taskService.createTask({
        title: formData.title,
        description: formData.description,
        assigneeId,
        priority: formData.priority,
        dueDate: formData.dueDate || null,
        subtasks,
      });

      toast.success('Task created successfully.');
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        assigneeId: '',
        priority: 'MEDIUM',
        dueDate: '',
        subtasksText: '',
      });
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to create task.');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskService.updateStatus(taskId, newStatus);
      toast.success(`Task moved to ${newStatus}`);
      fetchTasks();
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;
    try {
      const updated = await taskService.addComment(selectedTask.id, newComment.trim());
      setSelectedTask(updated.data);
      setNewComment('');
      toast.success('Comment added.');
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to add comment.');
    }
  };

  const handleToggleSubtask = async (task, index) => {
    const subtasks = [...(task.subtasks || [])];
    subtasks[index].completed = !subtasks[index].completed;
    try {
      const updated = await taskService.updateSubtasks(task.id, subtasks);
      if (selectedTask?.id === task.id) {
        setSelectedTask(updated.data);
      }
      fetchTasks();
    } catch (err) {
      toast.error('Failed to update subtask.');
    }
  };

  useEffect(() => {
    if (selectedTask) {
      setTaskRating(selectedTask.rating ? Math.round(Number(selectedTask.rating)) : 5);
      setRatingFeedback(selectedTask.rating_feedback || '');
      setShowReopenInput(false);
      setReopenReason('');
    }
  }, [selectedTask]);

  const handleRateTask = async (taskId) => {
    try {
      setIsRatingSubmitting(true);
      const res = await taskService.rateTask(taskId, {
        rating: taskRating,
        feedback: ratingFeedback,
      });
      toast.success(`Task rated ${taskRating}/5 stars successfully!`);
      setSelectedTask(res.data);
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to submit rating.');
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  const handleReopenTask = async (taskId) => {
    try {
      setIsRatingSubmitting(true);
      const res = await taskService.reopenTask(taskId, {
        reason: reopenReason,
      });
      toast.success('Task has been reopened for revisions.');
      setSelectedTask(res.data);
      setShowReopenInput(false);
      setReopenReason('');
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to reopen task.');
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'URGENT':
        return <Badge variant="danger">Urgent</Badge>;
      case 'HIGH':
        return <Badge variant="warning">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="info">Medium</Badge>;
      case 'LOW':
      default:
        return <Badge variant="neutral">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tab Navigation Bar */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('performance')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'performance'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          My Performance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('board')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'board'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Kanban className="w-4 h-4" />
          Task Board & Pipeline
        </button>
      </div>

      {activeTab === 'performance' ? (
        <MyPerformanceSection />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Internal Task & Work Management
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Collaborative task assignment, workload tracking, and Kanban delivery pipeline
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'kanban'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  Kanban
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
              </div>

          {canAssign && (
            <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <span className="text-xs font-semibold text-slate-500">
          Showing {tasks.length} task(s)
        </span>
      </div>

      {/* Main View */}
      {loading ? (
        <LoadingSpinner message="Loading work tasks..." />
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className={`rounded-xl border p-4 flex flex-col min-h-[500px] ${col.color}`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {col.label}
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border shadow-xs">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm hover:shadow transition cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2">{t.title}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.rating && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                              <Star className="w-2.5 h-2.5 text-amber-600 fill-amber-400" />
                              {Number(t.rating).toFixed(1)}
                            </span>
                          )}
                          {t.status === 'COMPLETED' && !t.rating && canAssign && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              Rate ⭐
                            </span>
                          )}
                          {t.reopen_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Reopened
                            </span>
                          )}
                          {getPriorityBadge(t.priority)}
                        </div>
                      </div>

                      {t.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2">{t.description}</p>
                      )}

                      {/* Subtasks summary */}
                      {t.subtasks?.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>
                            {t.subtasks.filter((s) => s.completed).length} / {t.subtasks.length} subtasks
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{t.assignee_first || 'Unassigned'}</span>
                        </div>
                        {t.due_date && (
                          <div
                            className={`flex items-center gap-1 ${
                              t.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-400'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{t.due_date}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                      No tasks in {col.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">Task</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Rating</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Assignee</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className="hover:bg-slate-50/80 cursor-pointer transition"
                >
                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 block">{t.title}</span>
                    <span className="text-[11px] text-slate-400 truncate block max-w-sm">
                      {t.description || 'No description'}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={t.status === 'COMPLETED' ? 'success' : t.status === 'IN_PROGRESS' ? 'info' : t.status === 'BLOCKED' ? 'warning' : 'neutral'}>
                        {t.status}
                      </Badge>
                      {t.reopen_count > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          Reopened ({t.reopen_count})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    {t.rating ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 text-xs">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        {Number(t.rating).toFixed(1)}/5
                      </span>
                    ) : t.status === 'COMPLETED' ? (
                      <span className="text-[10px] font-semibold text-amber-600 italic">
                        {canAssign ? 'Rate task ▾' : 'Pending rating'}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3.5">{getPriorityBadge(t.priority)}</td>
                  <td className="p-3.5 text-slate-600">
                    {t.assignee_first} {t.assignee_last}
                  </td>
                  <td className="p-3.5">
                    <span className={t.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                      {t.due_date || 'N/A'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(t);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
    )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Create New Work Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Finalize security audit review"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Task details and deliverables..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assignee {!isCeoOrAdmin(user) && <span className="font-normal text-slate-400">(Default: You)</span>}
                  </label>
                  <select
                    value={formData.assigneeId}
                    onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                    required={isCeoOrAdmin(user)}
                  >
                    {!isCeoOrAdmin(user) ? (
                      <option value="">Assign to myself</option>
                    ) : (
                      <option value="">Select Employee...</option>
                    )}
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subtasks (one per line)
                </label>
                <textarea
                  rows="2"
                  placeholder="Review schema&#10;Run automated tests"
                  value={formData.subtasksText}
                  onChange={(e) => setFormData({ ...formData, subtasksText: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="neutral" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Task</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAIL / COMMENTS MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getPriorityBadge(selectedTask.priority)}
                  <span className="text-[11px] font-mono text-slate-400">ID: {selectedTask.id}</span>
                </div>
                <h3 className="text-base font-bold text-slate-800">{selectedTask.title}</h3>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {selectedTask.description || 'No detailed description.'}
              </p>

              {/* Status Selector */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Change Status:</span>
                <div className="flex items-center gap-1.5">
                  {['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selectedTask.id, st)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition ${
                        selectedTask.status === st
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Review & Rating Section (For COMPLETED tasks or tasks with existing rating) */}
              {(selectedTask.status === 'COMPLETED' || selectedTask.rating) && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                      Task Quality & Manager Rating
                    </div>
                    {selectedTask.rating && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-950">
                        ★ {Number(selectedTask.rating).toFixed(1)} / 5
                      </span>
                    )}
                  </div>

                  {canAssign && selectedTask.status === 'COMPLETED' ? (
                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block mb-1">
                          {selectedTask.rating ? 'Update Assignee Rating (1 - 5 Stars):' : 'Rate Assignee Completion (1 - 5 Stars):'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setTaskRating(star)}
                              className={`p-1 rounded-lg transition transform hover:scale-110 cursor-pointer ${
                                star <= taskRating
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-slate-300 hover:text-amber-300'
                              }`}
                            >
                              <Star className={`w-6 h-6 ${star <= taskRating ? 'fill-amber-400 text-amber-500' : ''}`} />
                            </button>
                          ))}
                          <span className="text-xs font-bold text-amber-800 ml-2">
                            {taskRating === 5
                              ? '5/5 (Outstanding)'
                              : taskRating === 4
                              ? '4/5 (Great Delivery)'
                              : taskRating === 3
                              ? '3/5 (Met Expectations)'
                              : taskRating === 2
                              ? '2/5 (Needs Work)'
                              : '1/5 (Unsatisfactory)'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Reviewer Feedback & Remarks
                        </label>
                        <textarea
                          rows={2}
                          value={ratingFeedback}
                          onChange={(e) => setRatingFeedback(e.target.value)}
                          placeholder="e.g. Delivered on time with great code quality and thorough test cases..."
                          className="w-full text-xs border border-amber-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isRatingSubmitting}
                          disabled={isRatingSubmitting}
                          onClick={() => handleRateTask(selectedTask.id)}
                          className="!bg-amber-600 hover:!bg-amber-700 text-white font-bold shadow-2xs"
                        >
                          {selectedTask.rating ? 'Update Rating' : `Submit Rating (${taskRating}/5)`}
                        </Button>

                        {!showReopenInput ? (
                          <button
                            type="button"
                            onClick={() => setShowReopenInput(true)}
                            className="text-xs font-semibold text-rose-700 hover:text-rose-800 underline flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Work Not Satisfactory? Reopen Task
                          </button>
                        ) : null}
                      </div>

                      {showReopenInput && (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-2 mt-2">
                          <label className="text-[11px] font-bold text-rose-900 block">
                            Specify Reopen Reason for Assignee
                          </label>
                          <input
                            type="text"
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            placeholder="e.g., Deliverables missing test report, please revise..."
                            className="w-full text-xs border border-rose-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              isLoading={isRatingSubmitting}
                              onClick={() => handleReopenTask(selectedTask.id)}
                            >
                              Confirm Reopen
                            </Button>
                            <button
                              type="button"
                              onClick={() => setShowReopenInput(false)}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs space-y-1.5 text-slate-700 pt-1">
                      {selectedTask.rating ? (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-900">Rated:</span>
                            <span className="font-bold text-amber-800">{Number(selectedTask.rating).toFixed(1)} / 5</span>
                            <div className="flex items-center ml-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${
                                    s <= Math.round(Number(selectedTask.rating))
                                      ? 'text-amber-500 fill-amber-400'
                                      : 'text-slate-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {selectedTask.rater_first && (
                            <div className="text-[11px] text-slate-500">
                              Reviewed by {selectedTask.rater_first} {selectedTask.rater_last || ''}
                              {selectedTask.rated_at && ` on ${new Date(selectedTask.rated_at).toLocaleDateString()}`}
                            </div>
                          )}
                          {selectedTask.rating_feedback && (
                            <p className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs italic text-slate-800 mt-1">
                              "{selectedTask.rating_feedback}"
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-amber-800 text-xs italic">
                          Task completed. Awaiting review and quality rating from manager / assigner.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Subtasks */}
              {selectedTask.subtasks?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                    Subtasks checklist
                  </h4>
                  <div className="space-y-1.5 pl-1">
                    {selectedTask.subtasks.map((st, idx) => (
                      <label
                        key={idx}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => handleToggleSubtask(selectedTask, idx)}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        <span className={st.completed ? 'line-through text-slate-400' : ''}>
                          {st.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  Comments ({selectedTask.comments?.length || 0})
                </h4>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedTask.comments?.map((c) => (
                    <div key={c.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-slate-700">{c.authorName}</span>
                        <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-600">{c.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Button type="submit" size="sm">
                    Post
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

