// NEW PAGE 2: MaintenanceScheduler.jsx
import React, { useState, useEffect } from 'react';

const TASKS = [
  { id: 1, label: 'Clean condenser', status: 'Due Soon' },
  { id: 2, label: 'Check refrigerant', status: 'Overdue' },
  { id: 3, label: 'Inspect filters', status: 'Due Soon' },
  { id: 4, label: 'Calibrate sensors', status: 'Completed' },
];

const STATUS_COLORS = {
  'Due Soon': 'bg-yellow-200 text-yellow-800',
  'Overdue': 'bg-red-200 text-red-800',
  'Completed': 'bg-green-200 text-green-800',
};

export default function MaintenanceScheduler() {
  const [checked, setChecked] = useState(() => {
    const saved = localStorage.getItem('maintenance-tasks');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('maintenance-tasks', JSON.stringify(checked));
  }, [checked]);

  const handleCheck = (id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Maintenance Scheduler</h2>
      <ul className="space-y-4">
        {TASKS.map((task) => (
          <li key={task.id} className="flex items-center justify-between bg-white/5 rounded-lg p-4 shadow">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!checked[task.id]}
                onChange={() => handleCheck(task.id)}
                className="accent-blue-500 w-5 h-5"
              />
              <span className={checked[task.id] ? 'line-through text-gray-400' : ''}>{task.label}</span>
            </label>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[task.status]}`}>{task.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
