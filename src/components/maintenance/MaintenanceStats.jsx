import React from 'react';

export default function MaintenanceStats({ tasks }) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  const overdue = tasks.filter((t) => t.status === 'overdue').length;
  const dueThisWeek = tasks.filter((t) => {
    if (t.status === 'overdue') return false;
    if (!t.nextDue) return false;
    const due = new Date(t.nextDue);
    return due.getTime() - now.getTime() <= oneWeekMs && due.getTime() >= now.getTime();
  }).length;
  const completedThisMonth = tasks.filter((t) => {
    if (!t.lastCompleted) return false;
    const d = new Date(t.lastCompleted);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;
  const completionRate = tasks.length > 0 ? Math.round((completedThisMonth / tasks.length) * 100) : 0;

  const cards = [
    { label: 'Overdue', value: overdue, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    { label: 'Due This Week', value: dueThisWeek, color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
    { label: 'Completed This Month', value: completedThisMonth, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    { label: 'Completion Rate', value: `${completionRate}%`, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  ];

  return (
    <div className="maintenance-stats-grid">
      {cards.map((card) => (
        <div key={card.label} className="maintenance-stat-card" style={{ borderColor: card.color + '44', background: card.bg }}>
          <div className="maintenance-stat-label" style={{ color: card.color }}>{card.label}</div>
          <div className="maintenance-stat-value" style={{ color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
