import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getOptimizationStats, getOptimizationHistory } from '../services/supabaseDashboardService';

const COLORS = ['#64d6ff', '#4be4a4', '#ff6b7d'];

export default function CostSavingsDashboard() {
  const [stats, setStats] = useState({
    totalRecommendations: 0,
    totalPowerSaved: 0,
    totalCostSaved: 0,
    totalCo2Reduced: 0,
    averageImprovement: 0,
  });
  const [weeklyProjected, setWeeklyProjected] = useState(0);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load stats for last 30 days
        const data = await getOptimizationStats(30);
        setStats(data);

        // Load history to build a trend
        const history = await getOptimizationHistory(100);
        
        // Calculate weekly projection based on last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const lastWeekSavings = history
          .filter(h => new Date(h.timestamp) > sevenDaysAgo)
          .reduce((sum, h) => sum + h.result.costSavingsUsd, 0);
        
        // If we have history for last week, use it; otherwise estimate from average
        if (lastWeekSavings > 0) {
          setWeeklyProjected(lastWeekSavings);
        } else {
          setWeeklyProjected((data.totalCostSaved / 30) * 7);
        }

        // Group by month for the chart
        const months = {};
        history.forEach(h => {
          const date = new Date(h.timestamp);
          const key = date.toLocaleString('default', { month: 'short' });
          months[key] = (months[key] || 0) + h.result.costSavingsUsd;
        });

        const chartData = Object.entries(months).map(([month, savings]) => ({
          month,
          savings: Number(savings.toFixed(2))
        })).reverse();
        
        setMonthlyData(chartData);
      } catch (err) {
        console.error('Failed to load savings stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const breakdownData = [
    { name: 'Optimization', value: stats.totalCostSaved },
    { name: 'CO2 Value Offset', value: stats.totalCo2Reduced * 0.05 }, // Nominal $0.05 per kg CO2
  ];

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading savings data...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="background-grid" />
      <header className="hero-card glass-card">
        <div>
          <p className="eyebrow">Financial Impact</p>
          <h1>Cost Savings Dashboard</h1>
          <p className="hero-copy">Realized and projected savings based on AI-driven chiller optimization history.</p>
        </div>
      </header>

      <main className="dashboard-grid-redesign">
        <div className="grid-row row-3-cols">
          <div className="glass-card panel-stack">
            <p className="section-label">Lifetime Total</p>
            <div className="text-4xl font-bold text-accent">${stats.totalCostSaved.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <small className="text-muted">Total USD saved since deployment</small>
          </div>
          
          <div className="glass-card panel-stack">
            <p className="section-label">1-Week Estimate</p>
            <div className="text-4xl font-bold text-accent-strong">${weeklyProjected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <small className="text-muted">Based on recent optimization frequency</small>
          </div>

          <div className="glass-card panel-stack">
            <p className="section-label">CO2 Reduction</p>
            <div className="text-4xl font-bold text-danger">{stats.totalCo2Reduced.toLocaleString()} kg</div>
            <small className="text-muted">Environmental footprint avoided</small>
          </div>
        </div>

        <div className="grid-row row-2-cols">
          <section className="glass-card panel-stack">
            <div className="section-title-row"><h2>Savings Trend</h2></div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" stroke="#9ab2c8" />
                  <YAxis stroke="#9ab2c8" />
                  <Tooltip 
                    contentStyle={{ background: '#0a1422', border: '1px solid rgba(163, 201, 255, 0.18)', borderRadius: '12px' }}
                    itemStyle={{ color: '#f5fbff' }}
                  />
                  <Bar dataKey="savings" fill="#64d6ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="glass-card panel-stack">
            <div className="section-title-row"><h2>Impact Breakdown</h2></div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    stroke="none"
                  >
                    {breakdownData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#0a1422', border: '1px solid rgba(163, 201, 255, 0.18)', borderRadius: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
