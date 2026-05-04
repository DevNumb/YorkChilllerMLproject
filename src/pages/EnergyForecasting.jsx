import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import React, { useState, useEffect, useCallback } from 'react';
import { getAllChillerCombinations, getAllSetpoints, buildPredictionInput, predictKwPerTr, calculateSavings } from '../services/chillerOptimizer';

const OPTIMIZER_URL = import.meta.env.VITE_OPTIMIZER_URL || 'https://DevNumb-MLYorkchillerOptimzer.hf.space';

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
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

function RangeField({ label, name, value, min, max, step, suffix, onChange }) {
  return (
    <label className="field-card">
      <div className="field-heading">
        <span>{label}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(name, Number(event.target.value))}
      />
      <input
        className="number-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(name, Number(event.target.value))}
      />
    </label>
  );
}

export default function EnergyForecasting() {
  const [tomorrowDate, setTomorrowDate] = useState('');
  const [schedule24h, setSchedule24h] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [manualInputs, setManualInputs] = useState({
    load_tons: 800,
    wet_bulb_c: 20,
    current_chw_setpoint_c: 6.5,
    current_limit_pct: 85,
    chillers_running: 2,
  });

  const [manualOptimization, setManualOptimization] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);

  const generateTomorrow24hSchedule = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowMonth = tomorrow.getMonth() + 1;
      const isWeekend = [0, 6].includes(tomorrow.getDay()) ? 1 : 0;

      setTomorrowDate(tomorrow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

      const schedule = [];
      let totalEnergy = 0;
      let totalPower = 0;
      const chillerUsage = {};
      const setpointUsage = {};

      for (let hour = 0; hour < 24; hour++) {
        const load = 800 + 300 * Math.sin(hour / 6);
        const wetBulb = 18 + 8 * Math.sin(hour / 8);

        const savings = await calculateSavings(
          load,
          wetBulb,
          hour,
          tomorrowMonth,
          isWeekend,
          85,
          [2],
          6.5
        );

        if (savings) {
          const hourData = {
            hour: `${String(hour).padStart(2, '0')}:00`,
            load: round(load, 0),
            wetBulb: round(wetBulb, 1),
            recChillers: savings.optimalConfig.chillers.join(','),
            recSetpoint: savings.optimalConfig.setpoint,
            kwPerTr: savings.optimalConfig.kwPerTr,
            totalPower: savings.optimalConfig.totalPower,
          };

          schedule.push(hourData);
          totalEnergy += savings.optimalConfig.totalPower;
          totalPower += savings.optimalConfig.totalPower;

          const chillerKey = savings.optimalConfig.chillers.join(',');
          chillerUsage[chillerKey] = (chillerUsage[chillerKey] || 0) + 1;
          setpointUsage[savings.optimalConfig.setpoint] = (setpointUsage[savings.optimalConfig.setpoint] || 0) + 1;
        }
      }

      setSchedule24h(schedule);

      const mostUsedChiller = Object.entries(chillerUsage).sort((a, b) => b[1] - a[1])[0];
      const setpointRange = Object.keys(setpointUsage).map(Number).sort();

      setDailySummary({
        totalEnergy: round(totalEnergy, 0),
        avgKwPerTr: round(totalPower / 24 / 800, 3),
        mostUsedChillers: mostUsedChiller ? mostUsedChiller[0] : 'N/A',
        setpointMin: setpointRange[0] || 6.5,
        setpointMax: setpointRange[setpointRange.length - 1] || 6.5,
        peakHour: schedule.reduce((max, h) => h.totalPower > max.totalPower ? h : max, schedule[0]),
      });
    } catch (err) {
      console.warn('Schedule generation failed:', err);
      setError('Failed to generate 24-hour schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  const runManualOptimization = useCallback(async () => {
    setManualLoading(true);
    try {
      const now = new Date();
      const savings = await calculateSavings(
        manualInputs.load_tons,
        manualInputs.wet_bulb_c,
        now.getHours(),
        now.getMonth() + 1,
        [0, 6].includes(now.getDay()) ? 1 : 0,
        manualInputs.current_limit_pct,
        [manualInputs.chillers_running],
        manualInputs.current_chw_setpoint_c
      );

      if (savings) {
        setManualOptimization(savings);
      }
    } catch (err) {
      console.warn('Manual optimization failed:', err);
    } finally {
      setManualLoading(false);
    }
  }, [manualInputs]);

  useEffect(() => {
    generateTomorrow24hSchedule();
  }, [generateTomorrow24hSchedule]);

  const updateManualInput = (name, value) => {
    setManualInputs((current) => ({
      ...current,
      [name]: value,
    }));
  };

  return (
    <div className="dashboard-page">
      <div className="background-grid" />

      <header className="hero-card glass-card">
        <div>
          <p className="eyebrow">Energy Planning</p>
          <h1>Tomorrow's Optimal Schedule</h1>
          <p className="hero-copy">
            24-hour chiller staging and setpoint optimization with real-time analysis tool.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-pill">
            <span>Forecast Date</span>
            <strong>{tomorrowDate || 'Loading...'}</strong>
          </div>
          <div className="meta-pill">
            <span>Status</span>
            <strong style={{ color: loading ? '#eab308' : '#4be4a4' }}>
              {loading ? '● Generating' : '● Ready'}
            </strong>
          </div>
        </div>
      </header>

      <main className="dashboard-grid-redesign">
        {/* 24-HOUR SCHEDULE TABLE */}
        <div className="grid-row row-full">
          <section className="glass-card panel-stack">
            <div className="section-title-row">
              <div>
                <p className="section-label">24-Hour Optimal Schedule</p>
                <h2>Recommended Chiller Staging & Setpoints</h2>
              </div>
              <button type="button" className="primary-button" onClick={generateTomorrow24hSchedule} disabled={loading}>
                {loading ? 'Generating...' : 'Refresh Schedule'}
              </button>
            </div>

            {error && (
              <div style={{ padding: '8px 14px', borderRadius: 12, background: 'rgba(255,107,125,0.1)', border: '1px solid rgba(255,107,125,0.2)', color: '#ff6b7d', fontSize: '0.85rem', marginBottom: 16 }}>
                {error}
              </div>
            )}

            {loading ? (
              <div className="loading-state" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
                <span style={{ marginLeft: 16, color: 'var(--muted)' }}>Generating 24-hour schedule...</span>
              </div>
            ) : schedule24h.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7fe6ff' }}>Hour</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7fe6ff' }}>Load (tons)</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7fe6ff' }}>Wet Bulb (°C)</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7fe6ff' }}>Rec Chillers</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7fe6ff' }}>Setpoint (°C)</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7fe6ff' }}>kW/TR</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7fe6ff' }}>Total Power (kW)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule24h.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px', color: '#f5fbff' }}>{row.hour}</td>
                        <td style={{ padding: '8px', color: '#f5fbff' }}>{row.load}</td>
                        <td style={{ padding: '8px', color: '#f5fbff' }}>{row.wetBulb}</td>
                        <td style={{ padding: '8px', color: '#53f2a8', fontWeight: 'bold' }}>[{row.recChillers}]</td>
                        <td style={{ padding: '8px', color: '#f7df72' }}>{row.recSetpoint}</td>
                        <td style={{ padding: '8px', color: '#7fe6ff' }}>{row.kwPerTr.toFixed(3)}</td>
                        <td style={{ padding: '8px', color: '#81f5b6', fontWeight: 'bold' }}>{row.totalPower.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>

        {/* DAILY SUMMARY */}
        {dailySummary && (
          <div className="grid-row row-3-cols">
            <section className="glass-card panel-stack">
              <div className="section-title-row">
                <div>
                  <p className="section-label">Daily Summary</p>
                  <h2>Tomorrow's Totals</h2>
                </div>
              </div>
              <div className="weather-grid">
                <MetricCard
                  label="Total Energy"
                  value={`${dailySummary.totalEnergy} kWh`}
                  hint="24-hour consumption"
                  accent="#64d6ff"
                />
                <MetricCard
                  label="Average kW/TR"
                  value={`${dailySummary.avgKwPerTr.toFixed(3)}`}
                  hint="Mean efficiency"
                  accent="#7fe6ff"
                />
                <MetricCard
                  label="Peak Hour"
                  value={dailySummary.peakHour.hour}
                  hint={`${dailySummary.peakHour.totalPower.toFixed(0)} kW`}
                  accent="#ff9f5a"
                />
              </div>
            </section>

            <section className="glass-card panel-stack">
              <div className="section-title-row">
                <div>
                  <p className="section-label">Chiller Strategy</p>
                  <h2>Configuration</h2>
                </div>
              </div>
              <div className="weather-grid">
                <MetricCard
                  label="Most Used"
                  value={`[${dailySummary.mostUsedChillers}]`}
                  hint="Primary configuration"
                  accent="#53f2a8"
                />
                <MetricCard
                  label="Setpoint Range"
                  value={`${dailySummary.setpointMin}–${dailySummary.setpointMax}°C`}
                  hint="Temperature variation"
                  accent="#8ef5bf"
                />
                <MetricCard
                  label="Optimization"
                  value="Active"
                  hint="Real-time scheduling"
                  accent="#4be4a4"
                />
              </div>
            </section>

            <section className="glass-card panel-stack">
              <div className="section-title-row">
                <div>
                  <p className="section-label">Power Profile</p>
                  <h2>Expected Load</h2>
                </div>
              </div>
              <div className="weather-grid">
                <MetricCard
                  label="Min Power"
                  value={`${Math.min(...schedule24h.map(h => h.totalPower)).toFixed(0)} kW`}
                  hint="Lowest hour"
                  accent="#81f5b6"
                />
                <MetricCard
                  label="Max Power"
                  value={`${Math.max(...schedule24h.map(h => h.totalPower)).toFixed(0)} kW`}
                  hint="Peak hour"
                  accent="#ff6b7d"
                />
                <MetricCard
                  label="Avg Power"
                  value={`${(dailySummary.totalEnergy / 24).toFixed(0)} kW`}
                  hint="Mean power draw"
                  accent="#7fe6ff"
                />
              </div>
            </section>
          </div>
        )}

        {/* POWER PROFILE CHART */}
        {schedule24h.length > 0 && (
          <div className="grid-row row-full">
            <section className="glass-card panel-stack">
              <div className="section-title-row">
                <div>
                  <p className="section-label">Power Profile</p>
                  <h2>Expected Total Power by Hour</h2>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={schedule24h} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis label={{ value: 'kW', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalPower" fill="#64d6ff" name="Total Power (kW)" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>
        )}

        {/* REAL-TIME OPTIMIZATION TOOL */}
        <div className="grid-row row-2-cols">
          <section className="glass-card panel-stack input-panel">
            <div className="section-title-row">
              <div>
                <p className="section-label">Real-Time Optimization</p>
                <h2>Manual Analysis Tool</h2>
              </div>
              <button type="button" className="primary-button" onClick={runManualOptimization} disabled={manualLoading}>
                {manualLoading ? 'Optimizing...' : 'Optimize Now'}
              </button>
            </div>

            <div className="inputs-grid">
              <RangeField
                label="Cooling Load"
                name="load_tons"
                value={manualInputs.load_tons}
                min={200}
                max={2000}
                step={50}
                suffix=" tons"
                onChange={updateManualInput}
              />
              <RangeField
                label="Wet Bulb Temp"
                name="wet_bulb_c"
                value={manualInputs.wet_bulb_c}
                min={10}
                max={30}
                step={0.5}
                suffix="°C"
                onChange={updateManualInput}
              />
              <RangeField
                label="Current Setpoint"
                name="current_chw_setpoint_c"
                value={manualInputs.current_chw_setpoint_c}
                min={5}
                max={10}
                step={0.1}
                suffix="°C"
                onChange={updateManualInput}
              />
              <RangeField
                label="Current Limit"
                name="current_limit_pct"
                value={manualInputs.current_limit_pct}
                min={50}
                max={100}
                step={1}
                suffix="%"
                onChange={updateManualInput}
              />
            </div>

            <div className="compact-grid">
              <div className="field-card">
                <div className="field-heading">
                  <span>Chillers Running</span>
                  <strong>{manualInputs.chillers_running}</strong>
                </div>
                <div className="toggle-group">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={count === manualInputs.chillers_running ? 'choice-button active' : 'choice-button'}
                      onClick={() => updateManualInput('chillers_running', count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {manualOptimization && (
            <section className="glass-card panel-stack result-panel">
              <div className="section-title-row">
                <div>
                  <p className="section-label">Optimization Result</p>
                  <h2>Recommended Configuration</h2>
                </div>
                <span className="status-pill" style={{ backgroundColor: manualOptimization.powerSaved > 0 ? '#53f2a822' : '#ff6b7d22', color: manualOptimization.powerSaved > 0 ? '#53f2a8' : '#ff6b7d' }}>
                  {manualOptimization.powerSaved > 0 ? '✓ Savings' : '✗ No Savings'}
                </span>
              </div>

              <div className="weather-grid">
                <MetricCard
                  label="Optimal Chillers"
                  value={`[${manualOptimization.optimalConfig.chillers.join(', ')}]`}
                  hint="Recommended units"
                  accent="#53f2a8"
                />
                <MetricCard
                  label="Optimal Setpoint"
                  value={`${manualOptimization.optimalConfig.setpoint.toFixed(1)}°C`}
                  hint="Recommended temperature"
                  accent="#81f5b6"
                />
                <MetricCard
                  label="Expected kW/TR"
                  value={`${manualOptimization.optimalConfig.kwPerTr.toFixed(3)}`}
                  hint="Optimized efficiency"
                  accent="#8ef5bf"
                />
                <MetricCard
                  label="Expected Power"
                  value={`${manualOptimization.optimalConfig.totalPower.toFixed(0)} kW`}
                  hint="Optimized power draw"
                  accent="#4be4a4"
                />
              </div>

              {manualOptimization.powerSaved > 0 && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(83,242,168,0.1)', border: '1px solid rgba(83,242,168,0.2)' }}>
                  <div className="weather-grid">
                    <MetricCard
                      label="Power Saved"
                      value={`${manualOptimization.powerSaved.toFixed(1)} kW`}
                      hint="Reduction"
                      accent="#53f2a8"
                    />
                    <MetricCard
                      label="Improvement"
                      value={`${manualOptimization.improvementPercent.toFixed(1)}%`}
                      hint="Efficiency gain"
                      accent="#81f5b6"
                    />
                    <MetricCard
                      label="Cost/Hour"
                      value={`$${manualOptimization.costSavingsPerHour.toFixed(2)}`}
                      hint="Hourly savings"
                      accent="#7fe6ff"
                    />
                    <MetricCard
                      label="CO2/Hour"
                      value={`${manualOptimization.co2ReductionPerHour.toFixed(1)} kg`}
                      hint="Emissions avoided"
                      accent="#f7df72"
                    />
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
