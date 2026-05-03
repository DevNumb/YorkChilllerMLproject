import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import React, { useState, useEffect, useCallback } from 'react';

const OPTIMIZER_URL = import.meta.env.VITE_OPTIMIZER_URL || 'https://DevNumb-MLYorkchillerOptimzer.hf.space';

function normalizeOptimizerBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

function buildOptimizerCandidates(url) {
  const normalized = normalizeOptimizerBaseUrl(url);
  if (normalized.endsWith('/optimize') || normalized.endsWith('/predict')) {
    return [normalized];
  }
  return [`${normalized}/optimize`, `${normalized}/predict`];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function findNumericField(source, patterns) {
  const flattenEntries = (value, parentKey = '', entries = []) => {
    if (value === null || value === undefined) return entries;
    if (Array.isArray(value)) {
      value.forEach((item, index) => flattenEntries(item, `${parentKey}.${index}`, entries));
      return entries;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => {
        const path = parentKey ? `${parentKey}.${key}` : key;
        flattenEntries(item, path, entries);
      });
      return entries;
    }
    entries.push([parentKey.toLowerCase(), value]);
    return entries;
  };

  const entries = flattenEntries(source);
  const normalizedPatterns = patterns.map((pattern) => pattern.toLowerCase());

  for (const [key, value] of entries) {
    if (typeof value !== 'number' && typeof value !== 'string') continue;
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) continue;
    if (normalizedPatterns.some((pattern) => key.includes(pattern))) {
      return numericValue;
    }
  }
  return null;
}

function generateMockData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    hourLabel: `${i}:00`,
    energy: Math.round(120 + 30 * Math.sin(i / 3) + Math.random() * 10),
    load: Math.round(100 + 20 * Math.cos(i / 2) + Math.random() * 5),
    temperature: Math.round(18 + 6 * Math.sin(i / 4) + Math.random() * 2),
  }));
}

function MetricCard({ label, value, hint, accent }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value" style={{ color: accent || '#f5fbff' }}>
        {value}
      </strong>
      {hint ? <span className="metric-hint">{hint}</span> : null}
    </div>
  );
}

export default function EnergyForecasting() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState('mock');
  const [analysis, setAnalysis] = useState(null);
  const [tomorrowDate, setTomorrowDate] = useState('');

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowMonth = tomorrow.getMonth() + 1;
      const tomorrowDay = tomorrow.getDate();
      const tomorrowYear = tomorrow.getFullYear();
      const isWeekend = [0, 6].includes(tomorrow.getDay()) ? 1 : 0;

      setTomorrowDate(tomorrow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

      const candidates = buildOptimizerCandidates(OPTIMIZER_URL);
      const forecastData = [];
      let successCount = 0;

      for (let hour = 0; hour < 24; hour++) {
        const payload = {
          load_tons: 800 + 200 * Math.sin(hour / 6),
          wet_bulb_c: 18 + 8 * Math.sin(hour / 8),
          current_chw_setpoint_c: 6.5,
          current_limit_pct: 85,
          hour,
          month: tomorrowMonth,
          is_weekend: isWeekend,
          chillers_running: 2 + Math.floor(Math.sin(hour / 6) * 1.5),
        };

        let hourData = {
          hour,
          hourLabel: `${hour}:00`,
          energy: null,
          load: payload.load_tons,
          temperature: payload.wet_bulb_c,
        };

        for (const candidate of candidates) {
          try {
            const response = await fetch(candidate, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
              const result = await response.json();
              const energySavings = findNumericField(result, ['energy_savings_kwh', 'expected_energy_savings', 'savings_kwh']);
              const baselineEnergy = payload.load_tons * 0.55;
              hourData.energy = energySavings ? Math.round(baselineEnergy - energySavings) : Math.round(baselineEnergy);
              successCount++;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (hourData.energy === null) {
          hourData.energy = Math.round(payload.load_tons * 0.55 + Math.random() * 20);
        }

        forecastData.push(hourData);
      }

      if (successCount > 0) {
        setDataSource('api');
      } else {
        setDataSource('mock');
        setError('Using estimated forecast data.');
      }

      setData(forecastData);

      const totalEnergy = forecastData.reduce((sum, d) => sum + d.energy, 0);
      const peakHour = forecastData.reduce((max, d) => d.energy > max.energy ? d : max);
      const minHour = forecastData.reduce((min, d) => d.energy < min.energy ? d : min);
      const avgEnergy = round(totalEnergy / 24, 1);

      const bestHours = forecastData.slice().sort((a, b) => a.energy - b.energy).slice(0, 3);
      const worstHours = forecastData.slice().sort((a, b) => b.energy - a.energy).slice(0, 3);

      setAnalysis({
        totalEnergy: Math.round(totalEnergy),
        peakEnergy: Math.round(peakHour.energy),
        peakHour: peakHour.hourLabel,
        minEnergy: Math.round(minHour.energy),
        minHour: minHour.hourLabel,
        avgEnergy,
        bestHours: bestHours.map(h => `${h.hourLabel} (${Math.round(h.energy)} kWh)`).join(', '),
        worstHours: worstHours.map(h => `${h.hourLabel} (${Math.round(h.energy)} kWh)`).join(', '),
        recommendation: peakHour.energy > avgEnergy * 1.3
          ? `Peak demand at ${peakHour.hourLabel}. Consider pre-cooling or load shifting.`
          : `Balanced load profile. Maintain current setpoints.`,
      });
    } catch (err) {
      console.warn('Forecast API unavailable, using mock data:', err.message);
      const mockData = generateMockData();
      setData(mockData);
      setDataSource('mock');
      setError('Live API unavailable — showing simulated forecast data.');

      const totalEnergy = mockData.reduce((sum, d) => sum + d.energy, 0);
      const peakHour = mockData.reduce((max, d) => d.energy > max.energy ? d : max);
      const minHour = mockData.reduce((min, d) => d.energy < min.energy ? d : min);
      const avgEnergy = round(totalEnergy / 24, 1);

      setAnalysis({
        totalEnergy: Math.round(totalEnergy),
        peakEnergy: Math.round(peakHour.energy),
        peakHour: peakHour.hourLabel,
        minEnergy: Math.round(minHour.energy),
        minHour: minHour.hourLabel,
        avgEnergy,
        bestHours: mockData.slice().sort((a, b) => a.energy - b.energy).slice(0, 3).map(h => `${h.hourLabel} (${Math.round(h.energy)} kWh)`).join(', '),
        worstHours: mockData.slice().sort((a, b) => b.energy - a.energy).slice(0, 3).map(h => `${h.hourLabel} (${Math.round(h.energy)} kWh)`).join(', '),
        recommendation: 'Simulated data — check live API for accurate recommendations.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  return (
    <div className="dashboard-page">
      <div className="background-grid" />

      <header className="hero-card glass-card">
        <div>
          <p className="eyebrow">Energy Planning</p>
          <h1>Tomorrow's Energy Forecast</h1>
          <p className="hero-copy">
            24-hour energy consumption forecast with peak analysis and efficiency recommendations.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-pill">
            <span>Forecast Date</span>
            <strong>{tomorrowDate || 'Loading...'}</strong>
          </div>
          <div className="meta-pill">
            <span>Data Source</span>
            <strong style={{ color: dataSource === 'api' ? '#4be4a4' : '#eab308' }}>
              {dataSource === 'api' ? '● Live' : '● Simulated'}
            </strong>
          </div>
        </div>
      </header>

      <main className="dashboard-grid-redesign">
        <div className="grid-row row-full">
          <section className="glass-card panel-stack">
            <div className="section-title-row">
              <div>
                <p className="section-label">24-Hour Forecast</p>
                <h2>Energy, Load & Temperature</h2>
              </div>
              <button type="button" className="primary-button" onClick={fetchForecast} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh Forecast'}
              </button>
            </div>

            {error && (
              <div style={{ padding: '8px 14px', borderRadius: 12, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308', fontSize: '0.85rem', marginBottom: 16 }}>
                {error}
              </div>
            )}

            {loading ? (
              <div className="loading-state" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
                <span style={{ marginLeft: 16, color: 'var(--muted)' }}>Loading forecast data...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hourLabel" />
                  <YAxis yAxisId="left" label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: '°C', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="energy" stroke="#64d6ff" name="Energy (kWh)" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="load" stroke="#53f2a8" name="Load (tons)" strokeDasharray="5 2" />
                  <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#f7df72" name="Temperature (°C)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>
        </div>

        {analysis && (
          <>
            <div className="grid-row row-3-cols">
              <section className="glass-card panel-stack">
                <div className="section-title-row">
                  <div>
                    <p className="section-label">Energy Summary</p>
                    <h2>Daily Totals</h2>
                  </div>
                </div>
                <div className="weather-grid">
                  <MetricCard
                    label="Total Energy"
                    value={`${analysis.totalEnergy} kWh`}
                    hint="24-hour consumption"
                    accent="#64d6ff"
                  />
                  <MetricCard
                    label="Average Hourly"
                    value={`${analysis.avgEnergy} kWh`}
                    hint="Mean consumption"
                    accent="#7fe6ff"
                  />
                  <MetricCard
                    label="Peak Demand"
                    value={`${analysis.peakEnergy} kWh`}
                    hint={`at ${analysis.peakHour}`}
                    accent="#ff9f5a"
                  />
                </div>
              </section>

              <section className="glass-card panel-stack">
                <div className="section-title-row">
                  <div>
                    <p className="section-label">Efficiency Analysis</p>
                    <h2>Best & Worst Hours</h2>
                  </div>
                </div>
                <div className="weather-grid">
                  <MetricCard
                    label="Best Hours"
                    value="Low Load"
                    hint={analysis.bestHours}
                    accent="#53f2a8"
                  />
                  <MetricCard
                    label="Worst Hours"
                    value="High Load"
                    hint={analysis.worstHours}
                    accent="#ff6b7d"
                  />
                  <MetricCard
                    label="Min Demand"
                    value={`${analysis.minEnergy} kWh`}
                    hint={`at ${analysis.minHour}`}
                    accent="#8ef5bf"
                  />
                </div>
              </section>

              <section className="glass-card panel-stack">
                <div className="section-title-row">
                  <div>
                    <p className="section-label">Recommendations</p>
                    <h2>Setpoint Strategy</h2>
                  </div>
                </div>
                <div className="action-card">
                  <p style={{ margin: 0, lineHeight: 1.6, color: '#f5fbff' }}>
                    {analysis.recommendation}
                  </p>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
