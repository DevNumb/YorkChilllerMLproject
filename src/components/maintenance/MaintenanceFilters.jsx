import React from 'react';

const CATEGORIES = ['all', 'cleaning', 'refrigerant', 'filters', 'calibration', 'inspection'];
const STATUSES = ['all', 'pending', 'overdue', 'completed'];
const SORT_OPTIONS = ['dueDate', 'priority', 'name'];

export default function MaintenanceFilters({ search, onSearchChange, category, onCategoryChange, status, onStatusChange, sort, onSortChange }) {
  return (
    <div className="maintenance-filters">
      <div className="maintenance-filter-group">
        <input
          type="text"
          className="maintenance-search-input"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="maintenance-filter-group">
        <label className="maintenance-filter-label">Status</label>
        <select className="maintenance-filter-select" value={status} onChange={(e) => onStatusChange(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
      <div className="maintenance-filter-group">
        <label className="maintenance-filter-label">Category</label>
        <select className="maintenance-filter-select" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>
      <div className="maintenance-filter-group">
        <label className="maintenance-filter-label">Sort</label>
        <select className="maintenance-filter-select" value={sort} onChange={(e) => onSortChange(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === 'dueDate' ? 'Due Date' : o === 'priority' ? 'Priority' : 'Name'}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
