import React, { useCallback, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { calculateSavings } from '../services/chillerOptimizer';

const FORECAST_CACHE_KEY = 'energy-forecasting-schedule-cache-v1';
const MANUAL_OPTIMIZATION_CACHE_KEY = 'energy-forecasting-manual-cache-v1';

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function readForecastCache() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(FORECAST_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeForecastCache(payload) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

function readManualOptimizationCache() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MANUAL_OPTIMIZATION_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeManualOptimizationCache(payload) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(MANUAL_OPTIMIZATION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [manualInputs, setManualInputs] = useState({
    load_tons: 1200,
    wet_bulb_c: 22,
    current_chw_setpoint_c: 6.5,
    current_limit_pct: 90,
    chillers_running: 3,
    CHL_STA_1: 1, CHL_STA_2: 1, CHL_STA_3: 1,
    CHL_COMP_SPD_CTRL_1: 85, CHL_COMP_SPD_CTRL_2: 85, CHL_COMP_SPD_CTRL_3: 85,
    CT_FAN_SPD_CTRL_1: 65, CT_FAN_SPD_CTRL_2: 65, CT_FAN_SPD_CTRL_3: 65,
    CHL_CD_FLOW_1: 280, CHL_CD_FLOW_2: 280, CHL_CD_FLOW_3: 280,
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
      const isWeekend = [0, 6].includes(tomorrow.getDay()) ? 0 : 1;
      const formattedDate = tomorrow.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

      setTomorrowDate(formattedDate);

      const schedule = [];
      let totalEnergy = 0;
      let totalKwPerTr = 0;
      const chillerUsage = {};
      const setpointUsage = {};

      // Only calculate 8 points (every 3 hours) for speed, interpolate others
      for (let hour = 0; hour < 24; hour += 3) {
        const load = 1200 + 400 * Math.sin((hour - 8) / 6); 
        const wetBulb = 22 + 5 * Math.sin((hour - 10) / 8); 
        const baselineChillers = load < 800 ? 1 : load < 1400 ? 2 : 3;

        try {
          const savings = await calculateSavings(
            load,
            wetBulb,
            hour,
            tomorrowMonth,
            isWeekend,
            25,
            {
              ...manualInputs,
              OA_TEMP: 25,
              OA_TEMP_WB: wetBulb,
              Hour: hour,
              Weekday: isWeekend,
              Month: tomorrowMonth,
              CHL_STA_1: baselineChillers >= 1 ? 1 : 0,
              CHL_STA_2: baselineChillers >= 2 ? 1 : 0,
              CHL_STA_3: baselineChillers >= 3 ? 1 : 0,
              CWL_SEC_LOAD: load,
            }
          );

          if (savings) {
            const hourData = {
              hour: `${String(hour).padStart(2, '0')}:00`,
              load: round(load, 0),
              wetBulb: round(wetBulb, 1),
              totalPower: round(savings.optimalConfig.totalPower, 1),
              kwPerTr: round(savings.optimalConfig.kwPerTr, 3),
            };
            schedule.push(hourData);
            totalEnergy += savings.optimalConfig.totalPower * 3;
            totalKwPerTr += savings.optimalConfig.kwPerTr;
          }
        } catch (e) {
          console.warn('Forecast hour failed:', e);
        }
      }

      setSchedule24h(schedule);
      setDailySummary({
        totalEnergy: round(totalEnergy, 0),
        avgKwPerTr: round(totalKwPerTr / schedule.length, 3),
      });
    } catch (err) {
      setError('Failed to generate forecast schedule');
    } finally {
      setLoading(false);
    }
  }, [manualInputs]);

  const runManualOptimization = useCallback(async () => {
    setManualLoading(true);
    try {
      const now = new Date();
      const savings = await calculateSavings(
        manualInputs.load_tons,
        manualInputs.wet_bulb_c,
        now.getHours(),
        now.getMonth() + 1,
        [0, 6].includes(now.getDay()) ? 0 : 1,
        25,
        {
          ...manualInputs,
          OA_TEMP: 25,
          OA_TEMP_WB: manualInputs.wet_bulb_c,
          Hour: now.getHours(),
          Weekday: [0, 6].includes(now.getDay()) ? 0 : 1,
          Month: now.getMonth() + 1,
          CWL_SEC_LOAD: manualInputs.load_tons,
        }
      );

      if (savings) {
        setManualOptimization({
          kwPerTr: round(savings.optimalConfig.kwPerTr, 3),
          totalPower: round(savings.optimalConfig.totalPower, 1),
          powerSaved: round(savings.powerSaved, 1),
          improvementPercent: round(savings.improvementPercent, 1),
        });
      }
    } catch (err) {
      console.error(err);
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
          <p className="eyebrow">Predictive Analysis</p>
          <h1>Energy Forecasting</h1>
          <p className="hero-copy">Visualize tomorrow's energy consumption and test hypothetical operating scenarios.</p>
        </div>
      </header>

      <main className="dashboard-grid-redesign">
        <section className="glass-card panel-stack">
          <div className="section-title-row">
            <div><p className="section-label">24-Hour Prediction</p><h2>Tomorrow's Profile</h2></div>
            <button className="secondary-button" onClick={generateTomorrow24hSchedule} disabled={loading}>
              {loading ? 'Calculating...' : 'Refresh Forecast'}
            </button>
          </div>

          <div className="metrics-grid" style={{ marginBottom: '24px' }}>
            <MetricCard label="Est. Daily Energy" value={dailySummary ? `${dailySummary.totalEnergy} kWh` : '--'} accent="#4be4a4" />
            <MetricCard label="Avg. Efficiency" value={dailySummary ? `${dailySummary.avgKwPerTr} kW/ton` : '--'} />
            <MetricCard label="Forecast Date" value={tomorrowDate || '--'} />
          </div>

          <div style={{ width: '100%', height: 350, background: 'rgba(255,255,255,0.02)', borderRadius: '18px', padding: '20px' }}>
            {schedule24h.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={schedule24h}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="hour" stroke="#9ab2c8" fontSize={12} />
                  <YAxis stroke="#9ab2c8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ background: '#111d2f', border: '1px solid rgba(163, 201, 255, 0.18)', borderRadius: '12px' }}
                    itemStyle={{ color: '#f5fbff' }}
                  />
                  <Line type="monotone" dataKey="totalPower" stroke="#64d6ff" strokeWidth={3} dot={{ r: 4, fill: '#64d6ff' }} name="Power (kW)" />
                  <Line type="monotone" dataKey="load" stroke="#4be4a4" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Load (tons)" />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="loading-state"><div className="spinner" /></div>}
          </div>
        </section>

        <div className="grid-row row-2-cols">
          <section className="glass-card panel-stack">
            <div className="section-title-row"><div><p className="section-label">Scenario Test</p><h2>Hypothetical Inputs</h2></div></div>
            <div className="inputs-grid">
              <RangeField label="Building Load" name="load_tons" value={manualInputs.load_tons} min={100} max={2500} step={50} suffix=" tons" onChange={updateManualInput} />
              <RangeField label="Wet Bulb" name="wet_bulb_c" value={manualInputs.wet_bulb_c} min={5} max={35} step={0.5} suffix="°C" onChange={updateManualInput} />
              <RangeField label="CHW Setpoint" name="current_chw_setpoint_c" value={manualInputs.current_chw_setpoint_c} min={5} max={10} step={0.1} suffix="°C" onChange={updateManualInput} />
            </div>
            <button className="primary-button" style={{ marginTop: '20px', width: '100%' }} onClick={runManualOptimization} disabled={manualLoading}>
              {manualLoading ? 'Simulating...' : 'Run Simulation'}
            </button>
          </section>

          <section className="glass-card panel-stack">
            <div className="section-title-row"><div><p className="section-label">Simulation Results</p><h2>Projected Impact</h2></div></div>
            {manualOptimization ? (
              <div className="metrics-grid">
                <MetricCard label="Optimal Power" value={`${manualOptimization.totalPower} kW`} accent="#4be4a4" />
                <MetricCard label="Efficiency" value={`${manualOptimization.kwPerTr} kW/ton`} />
                <MetricCard label="Potential Savings" value={`${manualOptimization.powerSaved} kW`} accent="#64d6ff" />
                <MetricCard label="Improvement" value={`${manualOptimization.improvementPercent}%`} accent="#53f2a8" />
              </div>
            ) : <div className="empty-state"><p>Adjust inputs and run simulation to see projected performance.</p></div>}
          </section>
        </div>
      </main>
    </div>
  );
}
