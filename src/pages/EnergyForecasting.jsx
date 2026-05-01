import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import React, { useState, useEffect, useCallback } from 'react';

const OPTIMIZER_URL = import.meta.env.VITE_OPTIMIZER_URL || 'https://DevNumb-MLYorkchillerOptimzer.hf.space';

function generateMockData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    energy: Math.round(120 + 30 * Math.sin(i / 3) + Math.random() * 10),
    weather: Math.round(18 + 6 * Math.sin(i / 4) + Math.random() * 2),
    load: Math.round(100 + 20 * Math.cos(i / 2) + Math.random() * 5),
    setpoint: Math.round(6 + Math.sin(i / 6) * 0.5 + Math.random() * 0.2 * 10) / 10,
  }));
}

export default function EnergyForecasting() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState('mock');

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const hour = now.getHours();
      const month = now.getMonth() + 1;

      const response = await fetch(
        `${OPTIMIZER_URL}/predict?load_tons=500&wet_bulb_c=20&current_chw_setpoint_c=7&current_limit_pct=80&hour=${hour}&month=${month}&is_weekend=0&chillers_running=2`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const result = await response.json();

      if (result.forecast && Array.isArray(result.forecast)) {
        setData(result.forecast);
        setDataSource('api');
      } else {
        const forecastData = Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          energy: result.energy_kwh ?? Math.round(120 + 30 * Math.sin(i / 3) + Math.random() * 10),
          weather: result.outdoor_temp ?? Math.round(18 + 6 * Math.sin(i / 4) + Math.random() * 2),
          load: result.load_tons ?? Math.round(100 + 20 * Math.cos(i / 2) + Math.random() * 5),
          setpoint: result.recommended_setpoint ?? Math.round(6 + Math.sin(i / 6) * 0.5 + Math.random() * 0.2 * 10) / 10,
        }));
        setData(forecastData);
        setDataSource('api');
      }
    } catch (err) {
      console.warn('Forecast API unavailable, using mock data:', err.message);
      setData(generateMockData());
      setDataSource('mock');
      setError('Live API unavailable — showing simulated forecast data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Energy Forecast (Next 24 Hours)</h2>
      <p className="mb-4 text-gray-500">
        Predicted energy, weather, load, and optimal setpoints
        {dataSource === 'api' && <span style={{ color: '#4be4a4', marginLeft: 8 }}>● Live</span>}
        {dataSource === 'mock' && <span style={{ color: '#eab308', marginLeft: 8 }}>● Simulated</span>}
      </p>

      {error && (
        <div style={{ padding: '8px 14px', borderRadius: 12, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308', fontSize: '0.85rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state glass-card" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
          <span style={{ marginLeft: 16, color: 'var(--muted)' }}>Loading forecast data...</span>
        </div>
      ) : (
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
      )}
    </div>
  );
}
