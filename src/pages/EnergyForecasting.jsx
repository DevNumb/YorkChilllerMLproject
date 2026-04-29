// NEW PAGE 1: EnergyForecasting.jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import React from 'react';

// Mock data for 24 hours
const data = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  energy: Math.round(120 + 30 * Math.sin(i / 3) + Math.random() * 10),
  weather: Math.round(18 + 6 * Math.sin(i / 4) + Math.random() * 2),
  load: Math.round(100 + 20 * Math.cos(i / 2) + Math.random() * 5),
  setpoint: Math.round(6 + Math.sin(i / 6) * 0.5 + Math.random() * 0.2 * 10) / 10,
}));

export default function EnergyForecasting() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Energy Forecast (Next 24 Hours)</h2>
      <p className="mb-4 text-gray-500">Predicted energy, weather, load, and optimal setpoints</p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" />
          <YAxis yAxisId="left" label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: '°C', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="energy" stroke="#64d6ff" name="Energy (kWh)" strokeWidth={2} />
          <Line yAxisId="left" type="monotone" dataKey="load" stroke="#53f2a8" name="Load (tons)" strokeDasharray="5 2" />
          <Line yAxisId="right" type="monotone" dataKey="weather" stroke="#f7df72" name="Weather (°C)" />
          <Line yAxisId="right" type="monotone" dataKey="setpoint" stroke="#ff6b7d" name="Setpoint (°C)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
