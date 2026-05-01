import React from 'react';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function getStatusBadge(status) {
  switch (status) {
    case 'overdue': return { emoji: '🔴', label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
    case 'pending': {
      return { emoji: '🟡', label: 'Due Soon', color: '#eab308', bg: 'rgba(234,179,8,0.15)' };
    }
    case 'completed': return { emoji: '🟢', label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
    default: return { emoji: '⚪', label: 'Pending', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case 'high': return { label: 'HIGH', color: '#ef4444' };
    case 'medium': return { label: 'MEDIUM', color: '#eab308' };
    case 'low': return { label: 'LOW', color: '#3b82f6' };
    default: return { label: 'MEDIUM', color: '#eab308' };
  }
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDueDateStatus(nextDue) {
  if (!nextDue) return { text: 'No due date', urgent: false };
  const now = new Date();
  const due = new Date(nextDue);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, urgent: true };
  if (diffDays === 0) return { text: 'Due today', urgent: true };
  if (diffDays <= 3) return { text: `Due in ${diffDays}d`, urgent: true };
  return { text: `Due in ${diffDays}d`, urgent: false };
}

export default function TaskItem({ task, onComplete, onViewHistory, isChecked, onCheck }) {
  const statusBadge = getStatusBadge(task.status);
  const priorityBadge = getPriorityBadge(task.priority);
  const dueInfo = getDueDateStatus(task.nextDue);

  const progressPct = task.lastCompleted
    ? Math.min(100, Math.round(
        ((Date.now() - new Date(task.lastCompleted).getTime()) / (task.frequencyDays * 24 * 60 * 60 * 1000)) * 100
      ))
    : 0;

  return (
    <div className="maintenance-task-item">
      <div className="maintenance-task-header">
        <label className="maintenance-task-check">
          <input type="checkbox" checked={!!isChecked} onChange={() => onCheck(task.id)} />
          <span className={`maintenance-task-name ${isChecked ? 'completed-text' : ''}`}>{task.name}</span>
        </label>
        <div className="maintenance-task-badges">
          <span className="maintenance-badge" style={{ color: statusBadge.color, background: statusBadge.bg }}>
            {statusBadge.emoji} {statusBadge.label}
          </span>
          <span className="maintenance-priority-badge" style={{ color: priorityBadge.color, borderColor: priorityBadge.color + '66' }}>
            {priorityBadge.label}
          </span>
        </div>
      </div>

      <div className="maintenance-task-meta">
        <span className="maintenance-task-category">{task.category}</span>
        <span className={`maintenance-task-due ${dueInfo.urgent ? 'urgent' : ''}`}>{dueInfo.text}</span>
        <span className="maintenance-task-last">Last: {formatDate(task.lastCompleted)}</span>
        {task.assignedTo && <span className="maintenance-task-assigned">👤 {task.assignedTo}</span>}
      </div>

      {task.frequencyDays > 0 && (
        <div className="maintenance-task-progress">
          <div className="maintenance-progress-bar">
            <div
              className="maintenance-progress-fill"
              style={{ width: `${progressPct}%`, background: progressPct > 85 ? '#ef4444' : progressPct > 60 ? '#eab308' : '#3b82f6' }}
            />
          </div>
          <span className="maintenance-progress-label">{progressPct}% of cycle</span>
        </div>
      )}

      <div className="maintenance-task-actions">
        <button className="maintenance-btn-complete" onClick={() => onComplete(task)}>Complete</button>
        <button className="maintenance-btn-history" onClick={() => onViewHistory(task)}>History</button>
      </div>
    </div>
  );
}
