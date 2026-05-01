import React, { useState, useEffect, useMemo } from 'react';
import { getYearlyStats } from '../../services/maintenanceDatabase';

function getMonthName(month) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1] || '';
}

export default function YearlyTracker({ year: selectedYear }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await getYearlyStats(selectedYear);
      if (!cancelled) {
        setStats(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: getMonthName(i + 1),
      completedCount: 0,
      totalDuration: 0,
    }));

    stats.forEach((s) => {
      if (s.month >= 1 && s.month <= 12) {
        months[s.month - 1].completedCount += s.completedCount || 0;
        months[s.month - 1].totalDuration += s.totalDurationMinutes || 0;
      }
    });

    return months;
  }, [stats]);

  const maxCount = Math.max(1, ...monthlyData.map((m) => m.completedCount));
  const totalCompleted = stats.reduce((sum, s) => sum + (s.completedCount || 0), 0);
  const totalDuration = stats.reduce((sum, s) => sum + (s.totalDurationMinutes || 0), 0);
  const totalCost = stats.reduce((sum, s) => sum + (s.cost || 0), 0);

  const categoryMap = {};
  stats.forEach((s) => { categoryMap[s.taskId] = (categoryMap[s.taskId] || 0) + (s.completedCount || 0); });
  const mostFrequentTaskId = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const currentMonth = new Date().getMonth();

  return (
    <div className="maintenance-yearly-tracker">
      <div className="maintenance-yearly-summary">
        <div className="maintenance-yearly-stat">
          <span className="maintenance-yearly-stat-label">Total Completed</span>
          <span className="maintenance-yearly-stat-value">{totalCompleted}</span>
        </div>
        <div className="maintenance-yearly-stat">
          <span className="maintenance-yearly-stat-label">Avg Duration</span>
          <span className="maintenance-yearly-stat-value">{totalCompleted > 0 ? Math.round(totalDuration / totalCompleted) : 0} min</span>
        </div>
        <div className="maintenance-yearly-stat">
          <span className="maintenance-yearly-stat-label">Most Active Task</span>
          <span className="maintenance-yearly-stat-value">{mostFrequentTaskId.slice(0, 16)}</span>
        </div>
      </div>

      <div className="maintenance-yearly-chart">
        <div className="maintenance-yearly-bars">
          {monthlyData.map((m) => (
            <div key={m.month} className="maintenance-yearly-bar-col">
              <div
                className="maintenance-yearly-bar"
                style={{
                  height: `${(m.completedCount / maxCount) * 100}%`,
                  background: m.month === currentMonth + 1
                    ? 'linear-gradient(180deg, #64d6ff, #4be4a4)'
                    : 'rgba(100,214,255,0.3)',
                  minHeight: m.completedCount > 0 ? '4px' : '0px',
                }}
                title={`${m.label}: ${m.completedCount} completions`}
              />
              <span className="maintenance-yearly-bar-label">{m.label}</span>
              {m.completedCount > 0 && <span className="maintenance-yearly-bar-count">{m.completedCount}</span>}
            </div>
          ))}
        </div>
      </div>

      {loading && <div className="maintenance-loading-overlay">Loading yearly data...</div>}
    </div>
  );
}
