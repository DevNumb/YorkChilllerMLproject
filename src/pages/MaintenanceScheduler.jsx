import React, { useState, useEffect, useCallback } from 'react';
import '../maintenance.css';
import MaintenanceStats from '../components/maintenance/MaintenanceStats';
import MaintenanceFilters from '../components/maintenance/MaintenanceFilters';
import TaskItem from '../components/maintenance/TaskItem';
import CompleteTaskModal from '../components/maintenance/CompleteTaskModal';
import TaskHistory from '../components/maintenance/TaskHistory';
import YearlyTracker from '../components/maintenance/YearlyTracker';
import ExportButton from '../components/maintenance/ExportButton';
import {
  getAllTasks,
  completeTask,
  getHistory,
  refreshTaskStatuses,
  addNewTask,
} from '../services/maintenanceDatabase';

const ORIGINAL_TASKS = [
  { id: 1, label: 'Clean condenser', status: 'Due Soon' },
  { id: 2, label: 'Check refrigerant', status: 'Overdue' },
  { id: 3, label: 'Inspect filters', status: 'Due Soon' },
  { id: 4, label: 'Calibrate sensors', status: 'Completed' },
];

const STATUS_COLORS_ORIGINAL = {
  'Due Soon': 'bg-yellow-200 text-yellow-800',
  'Overdue': 'bg-red-200 text-red-800',
  'Completed': 'bg-green-200 text-green-800',
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function MaintenanceScheduler() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dueDate');
  const [checkedOriginal, setCheckedOriginal] = useState(() => {
    const saved = localStorage.getItem('maintenance-tasks');
    return saved ? JSON.parse(saved) : {};
  });
  const [completingTask, setCompletingTask] = useState(null);
  const [historyTask, setHistoryTask] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showYearly, setShowYearly] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [toast, setToast] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    name: '',
    category: 'inspection',
    frequencyDays: 30,
    priority: 'medium',
    estimatedMinutes: 30,
  });

  useEffect(() => {
    localStorage.setItem('maintenance-tasks', JSON.stringify(checkedOriginal));
  }, [checkedOriginal]);

  const handleOriginalCheck = (id) => {
    setCheckedOriginal((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const refreshed = await refreshTaskStatuses();
      setTasks(refreshed);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleComplete = async (completionData) => {
    if (!completingTask) return;
    try {
      await completeTask(completingTask.id, completionData);
      showToast(`"${completingTask.name}" marked as completed!`);
      setCompletingTask(null);
      await loadTasks();
    } catch (err) {
      showToast('Failed to save completion: ' + err.message, 'error');
    }
  };

  const handleViewHistory = async (task) => {
    setHistoryTask(task);
    setHistoryExpanded(true);
    const entries = await getHistory(task.id, 10);
    setHistoryEntries(entries);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskForm.name.trim()) return;
    try {
      await addNewTask(newTaskForm);
      showToast(`Task "${newTaskForm.name}" added!`);
      setShowAddTask(false);
      setNewTaskForm({ name: '', category: 'inspection', frequencyDays: 30, priority: 'medium', estimatedMinutes: 30 });
      await loadTasks();
    } catch (err) {
      showToast('Failed to add task: ' + err.message, 'error');
    }
  };

  const filteredTasks = tasks
    .filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority] || 1) - (PRIORITY_ORDER[b.priority] || 1);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const aDue = a.nextDue ? new Date(a.nextDue).getTime() : Infinity;
      const bDue = b.nextDue ? new Date(b.nextDue).getTime() : Infinity;
      return aDue - bDue;
    });

  return (
    <div className="maintenance-page">
      {toast && (
        <div className={`maintenance-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* PROFESSIONAL HEADER */}
      <div className="maintenance-header glass-card">
        <div className="maintenance-header-title">
          <p className="section-label">Maintenance</p>
          <h1>Maintenance Management System</h1>
          <p className="hero-copy">Track, schedule, and manage chiller plant maintenance tasks with full history and reporting.</p>
        </div>
        <div className="maintenance-header-actions">
          <button className="primary-button" onClick={() => setShowAddTask(true)}>+ Log Maintenance</button>
          <button className="secondary-button" onClick={() => setShowYearly(!showYearly)}>
            📊 Yearly Report
          </button>
          <ExportButton tasks={tasks} />
        </div>
      </div>

      {/* STATS CARDS */}
      <MaintenanceStats tasks={tasks} />

      {/* FILTERS */}
      <MaintenanceFilters
        search={search}
        onSearchChange={setSearch}
        category={categoryFilter}
        onCategoryChange={setCategoryFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        sort={sortBy}
        onSortChange={setSortBy}
      />

      {/* ORIGINAL CHECKLIST (PRESERVED) */}
      <div className="maintenance-original-section glass-card">
        <h3 className="maintenance-section-title">Quick Checklist</h3>
        <ul className="maintenance-original-list">
          {ORIGINAL_TASKS.map((task) => (
            <li key={task.id} className="maintenance-original-item">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!checkedOriginal[task.id]}
                  onChange={() => handleOriginalCheck(task.id)}
                  className="accent-blue-500 w-5 h-5"
                />
                <span className={checkedOriginal[task.id] ? 'line-through text-gray-400' : ''}>{task.label}</span>
              </label>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS_ORIGINAL[task.status]}`}>{task.status}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ENHANCED TASK LIST */}
      <div className="maintenance-tasks-section">
        <h3 className="maintenance-section-title">Tracked Tasks ({filteredTasks.length})</h3>
        {loading ? (
          <div className="maintenance-loading-state">
            <div className="spinner" />
            <span>Loading tasks from database...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="maintenance-empty-state glass-card">
            No tasks match your filters. Try adjusting search or filters.
          </div>
        ) : (
          <div className="maintenance-tasks-list">
            {filteredTasks.map((task) => (
              <div key={task.id}>
                <TaskItem
                  task={task}
                  onComplete={setCompletingTask}
                  onViewHistory={handleViewHistory}
                  isChecked={false}
                  onCheck={() => {}}
                />
                {historyTask?.id === task.id && (
                  <TaskHistory
                    entries={historyEntries}
                    taskName={task.name}
                    expanded={historyExpanded}
                    onToggle={() => setHistoryExpanded(!historyExpanded)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* YEARLY TRACKER */}
      {showYearly && (
        <div className="maintenance-yearly-section glass-card">
          <div className="maintenance-yearly-header">
            <h3 className="maintenance-section-title">Yearly Report</h3>
            <select
              className="maintenance-filter-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <YearlyTracker year={selectedYear} />
        </div>
      )}

      {/* COMPLETE TASK MODAL */}
      {completingTask && (
        <CompleteTaskModal
          task={completingTask}
          onSave={handleComplete}
          onClose={() => setCompletingTask(null)}
        />
      )}

      {/* ADD TASK MODAL */}
      {showAddTask && (
        <div className="maintenance-modal-overlay" onClick={() => setShowAddTask(false)}>
          <div className="maintenance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="maintenance-modal-header">
              <h3>Add New Maintenance Task</h3>
              <button className="maintenance-modal-close" onClick={() => setShowAddTask(false)}>✕</button>
            </div>
            <form onSubmit={handleAddTask} className="maintenance-modal-form">
              <div className="maintenance-modal-field">
                <label>Task Name</label>
                <input
                  type="text"
                  value={newTaskForm.name}
                  onChange={(e) => setNewTaskForm((p) => ({ ...p, name: e.target.value }))}
                  className="maintenance-modal-input"
                  placeholder="e.g., Inspect cooling tower"
                  required
                />
              </div>
              <div className="maintenance-modal-row">
                <div className="maintenance-modal-field">
                  <label>Category</label>
                  <select
                    value={newTaskForm.category}
                    onChange={(e) => setNewTaskForm((p) => ({ ...p, category: e.target.value }))}
                    className="maintenance-modal-input"
                  >
                    <option value="cleaning">Cleaning</option>
                    <option value="refrigerant">Refrigerant</option>
                    <option value="filters">Filters</option>
                    <option value="calibration">Calibration</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </div>
                <div className="maintenance-modal-field">
                  <label>Frequency (days)</label>
                  <input
                    type="number"
                    value={newTaskForm.frequencyDays}
                    onChange={(e) => setNewTaskForm((p) => ({ ...p, frequencyDays: Number(e.target.value) || 30 }))}
                    className="maintenance-modal-input"
                    min="1"
                  />
                </div>
              </div>
              <div className="maintenance-modal-row">
                <div className="maintenance-modal-field">
                  <label>Priority</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={(e) => setNewTaskForm((p) => ({ ...p, priority: e.target.value }))}
                    className="maintenance-modal-input"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="maintenance-modal-field">
                  <label>Est. Duration (min)</label>
                  <input
                    type="number"
                    value={newTaskForm.estimatedMinutes}
                    onChange={(e) => setNewTaskForm((p) => ({ ...p, estimatedMinutes: Number(e.target.value) || 30 }))}
                    className="maintenance-modal-input"
                    min="1"
                  />
                </div>
              </div>
              <div className="maintenance-modal-actions">
                <button type="button" className="maintenance-btn-cancel" onClick={() => setShowAddTask(false)}>Cancel</button>
                <button type="submit" className="maintenance-btn-save">Add Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
