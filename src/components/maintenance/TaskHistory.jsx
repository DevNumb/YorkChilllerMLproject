import React from 'react';

function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TaskHistory({ entries, taskName, expanded, onToggle, onViewAll }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="maintenance-history-section">
        <button className="maintenance-history-toggle" onClick={onToggle}>
          📋 History {expanded ? '▲' : '▼'}
        </button>
        {expanded && (
          <div className="maintenance-history-empty">No history entries for this task yet.</div>
        )}
      </div>
    );
  }

  return (
    <div className="maintenance-history-section">
      <button className="maintenance-history-toggle" onClick={onToggle}>
        📋 History ({entries.length}) {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="maintenance-history-content">
          <div className="maintenance-history-header-row">
            <span>Date</span>
            <span>Completed By</span>
            <span>Duration</span>
            <span>Notes</span>
          </div>
          {entries.map((entry) => (
            <div key={entry.id} className="maintenance-history-row">
              <span>{formatDate(entry.completedDate)}</span>
              <span>{entry.completedBy || '—'}</span>
              <span>{entry.durationMinutes ? `${entry.durationMinutes} min` : '—'}</span>
              <span className="maintenance-history-notes">{entry.notes || '—'}</span>
            </div>
          ))}
          {onViewAll && (
            <button className="maintenance-btn-view-all" onClick={onViewAll}>View Full History</button>
          )}
        </div>
      )}
    </div>
  );
}
