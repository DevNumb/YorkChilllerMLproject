// NEW PAGE 3: CostSavingsDashboard.jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const savingsData = [
  { month: 'Nov', savings: 1200 },
  { month: 'Dec', savings: 1500 },
  { month: 'Jan', savings: 1800 },
  { month: 'Feb', savings: 1700 },
  { month: 'Mar', savings: 2100 },
  { month: 'Apr', savings: 2300 },
];

const breakdownData = [
  { name: 'Optimization', value: 7800 },
  { name: 'Fault Detection', value: 3300 },
];

const COLORS = ['#64d6ff', '#ff6b7d'];

export default function CostSavingsDashboard() {
  const totalSavings = savingsData.reduce((sum, d) => sum + d.savings, 0) + 3300;
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Cost Savings Dashboard</h2>
      <div className="mb-6">
        <span className="text-lg text-gray-500">Total Savings</span>
        <div className="text-5xl font-extrabold text-green-500">${totalSavings.toLocaleString()}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold mb-2">Monthly Savings (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={savingsData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="savings" fill="#64d6ff" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Savings Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={breakdownData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {breakdownData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
