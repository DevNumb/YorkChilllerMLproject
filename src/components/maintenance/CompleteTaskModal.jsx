import React, { useState } from 'react';

export default function CompleteTaskModal({ task, onSave, onClose }) {
  const [form, setForm] = useState({
    completedDate: new Date().toISOString().split('T')[0],
    completedBy: '',
    durationMinutes: task?.estimatedMinutes || 30,
    notes: '',
    partsReplaced: '',
    cost: 0,
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      completedDate: new Date(form.completedDate).toISOString(),
      durationMinutes: Number(form.durationMinutes) || 0,
      cost: Number(form.cost) || 0,
    });
  };

  if (!task) return null;

  return (
    <div className="maintenance-modal-overlay" onClick={onClose}>
      <div className="maintenance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="maintenance-modal-header">
          <h3>Log Maintenance Completion</h3>
          <button className="maintenance-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="maintenance-modal-form">
          <div className="maintenance-modal-field">
            <label>Task Name</label>
            <input type="text" value={task.name} readOnly className="maintenance-modal-input readonly" />
          </div>
          <div className="maintenance-modal-row">
            <div className="maintenance-modal-field">
              <label>Completed Date</label>
              <input
                type="date"
                value={form.completedDate}
                onChange={(e) => handleChange('completedDate', e.target.value)}
                className="maintenance-modal-input"
              />
            </div>
            <div className="maintenance-modal-field">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={form.durationMinutes}
                onChange={(e) => handleChange('durationMinutes', e.target.value)}
                className="maintenance-modal-input"
                min="0"
              />
            </div>
          </div>
          <div className="maintenance-modal-field">
            <label>Completed By</label>
            <input
              type="text"
              value={form.completedBy}
              onChange={(e) => handleChange('completedBy', e.target.value)}
              className="maintenance-modal-input"
              placeholder="Technician name"
            />
          </div>
          <div className="maintenance-modal-field">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="maintenance-modal-textarea"
              rows={3}
              placeholder="Any observations or issues..."
            />
          </div>
          <div className="maintenance-modal-row">
            <div className="maintenance-modal-field">
              <label>Parts Replaced</label>
              <input
                type="text"
                value={form.partsReplaced}
                onChange={(e) => handleChange('partsReplaced', e.target.value)}
                className="maintenance-modal-input"
                placeholder="List parts if any"
              />
            </div>
            <div className="maintenance-modal-field">
              <label>Cost ($)</label>
              <input
                type="number"
                value={form.cost}
                onChange={(e) => handleChange('cost', e.target.value)}
                className="maintenance-modal-input"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="maintenance-modal-actions">
            <button type="button" className="maintenance-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="maintenance-btn-save">Save & Complete</button>
          </div>
        </form>
      </div>
    </div>
  );
}
