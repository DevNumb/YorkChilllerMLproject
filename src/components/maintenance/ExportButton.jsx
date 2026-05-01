import React from 'react';
import { getHistory } from '../../services/maintenanceDatabase';

export default function ExportButton({ tasks }) {
  const exportCSV = async () => {
    const allHistory = await getHistory(null, 0);

    const headers = ['Date', 'Task', 'Category', 'Completed By', 'Duration (min)', 'Notes', 'Parts Replaced', 'Cost ($)'];
    const rows = allHistory.map((h) => {
      const task = tasks.find((t) => t.id === h.taskId);
      return [
        h.completedDate ? new Date(h.completedDate).toLocaleDateString() : '',
        task?.name || h.taskId,
        task?.category || '',
        h.completedBy || '',
        h.durationMinutes || '',
        `"${(h.notes || '').replace(/"/g, '""')}"`,
        `"${(h.partsReplaced || '').replace(/"/g, '""')}"`,
        h.cost || 0,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printSchedule = () => {
    window.print();
  };

  return (
    <div className="maintenance-export-group">
      <button className="maintenance-btn-export" onClick={exportCSV} title="Export history to CSV">
        📥 Export CSV
      </button>
      <button className="maintenance-btn-export" onClick={printSchedule} title="Print maintenance schedule">
        🖨️ Print
      </button>
    </div>
  );
}
