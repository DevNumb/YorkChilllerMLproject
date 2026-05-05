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
    load_tons: 800,
    wet_bulb_c: 18,
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

      for (let hour = 0; hour < 24; hour++) {
        const load = 800 + 300 * Math.sin(hour / 6);
        const wetBulb = 18 + 8 * Math.sin(hour / 8);
        const baselineChillers = load < 600 ? 1 : load < 900 ? 2 : load < 1200 ? 3 : 4;

        try {
          const savings = await calculateSavings(
            load,
            wetBulb,
            hour,
            tomorrowMonth,
            isWeekend,
            100,
            [baselineChillers],
            6.5,
          );

          if (!savings) {
            throw new Error('No forecast recommendation found');
          }

          const hourData = {
            hour: `${String(hour).padStart(2, '0')}:00`,
            load: round(load, 0),
            wetBulb: round(wetBulb, 1),
            recChillers: savings.optimalConfig.chillers.length,
            recSetpoint: round(savings.optimalConfig.setpoint, 1),
            kwPerTr: round(savings.optimalConfig.kwPerTr, 3),
            totalPower: round(savings.optimalConfig.totalPower, 1),
          };

          schedule.push(hourData);
          totalEnergy += savings.optimalConfig.totalPower;
          totalKwPerTr += savings.optimalConfig.kwPerTr;

          const chillerKey = String(savings.optimalConfig.chillers.length);
          chillerUsage[chillerKey] = (chillerUsage[chillerKey] || 0) + 1;
          setpointUsage[hourData.recSetpoint] = (setpointUsage[hourData.recSetpoint] || 0) + 1;
        } catch (hourError) {
          console.warn(`Hour ${hour} prediction failed:`, hourError);

          const fallbackKwPerTr = 0.6;
          const stageFactor = 1 + (Math.abs(load / baselineChillers - 500) / 500) * 0.1;
          const fallbackPower = load * fallbackKwPerTr * stageFactor;

          schedule.push({
            hour: `${String(hour).padStart(2, '0')}:00`,
            load: round(load, 0),
            wetBulb: round(wetBulb, 1),
            recChillers: baselineChillers,
            recSetpoint: 6.5,
            kwPerTr: round(fallbackKwPerTr, 3),
            totalPower: round(fallbackPower, 1),
          });

          totalEnergy += fallbackPower;
          totalKwPerTr += fallbackKwPerTr;
        }
      }

      setSchedule24h(schedule);

      const mostUsedChiller = Object.entries(chillerUsage).sort((a, b) => b[1] - a[1])[0];
      const setpointRange = Object.keys(setpointUsage).map(Number).sort((a, b) => a - b);
      const peakHour = schedule.reduce((max, current) => {
        if (!max || current.totalPower > max.totalPower) {
          return current;
        }
        return max;
      }, null);

      const nextSummary = {
        totalEnergy: round(totalEnergy, 0),
        avgKwPerTr: round(totalKwPerTr / 24, 3),
        mostUsedChillers: mostUsedChiller ? mostUsedChiller[0] : '2',
        setpointMin: setpointRange[0] || 6.5,
        setpointMax: setpointRange[setpointRange.length - 1] || 6.5,
        peakHour,
      };

      setDailySummary(nextSummary);
      writeForecastCache({
        tomorrowDate: formattedDate,
        schedule24h: schedule,
        dailySummary: nextSummary,
        cachedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Schedule generation failed:', err);
      const fallback = readForecastCache();
      if (fallback?.schedule24h?.length) {
        setTomorrowDate(fallback.tomorrowDate || '');
        setSchedule24h(fallback.schedule24h);
        setDailySummary(fallback.dailySummary || null);
        setError('Failed to refresh schedule. Showing the last successful forecast.');
      } else {
        setError('Failed to generate 24-hour schedule');
      }
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
        manualInputs.current_chw_setpoint_c,
      );

      if (!savings) {
        throw new Error('Manual optimization failed');
      }

      const nextManualOptimization = {
        kwPerTr: round(savings.optimalConfig.kwPerTr, 3),
        totalPower: round(savings.optimalConfig.totalPower, 1),
        efficiency: round(1 / (savings.optimalConfig.kwPerTr / 0.6), 2),
        recommendedSetpoint: round(savings.optimalConfig.setpoint, 1),
        recommendedChillers: savings.optimalConfig.chillers.length,
        timestamp: new Date().toISOString(),
      };

      setManualOptimization(nextManualOptimization);
      writeManualOptimizationCache({
        inputs: manualInputs,
        result: nextManualOptimization,
        cachedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Manual optimization failed:', err);
      const fallback = readManualOptimizationCache();
      if (fallback?.result) {
        setManualOptimization(fallback.result);
      }
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
    <div className="page-container">
      <header className="page-header">
        <h1>Energy Forecasting</h1>
        <p>24-hour optimization predictions and manual scenario analysis</p>
      </header>

      {error ? <div className="error-message">{error}</div> : null}

      <section className="section-card">
        <div className="section-header">
          <h2>Tomorrow's 24-Hour Schedule: {tomorrowDate}</h2>
          <button type="button" className="primary-button" onClick={generateTomorrow24hSchedule} disabled={loading}>
            {loading ? 'Generating...' : 'Refresh Schedule'}
          </button>
        </div>

        {dailySummary ? (
          <div className="metrics-grid">
            <MetricCard label="Total Energy" value={`${dailySummary.totalEnergy} kWh`} accent="#4CAF50" />
            <MetricCard label="Avg Efficiency" value={`${dailySummary.avgKwPerTr} kW/tr`} />
            <MetricCard label="Most Used Chillers" value={dailySummary.mostUsedChillers} />
            <MetricCard label="Setpoint Range" value={`${dailySummary.setpointMin}°C - ${dailySummary.setpointMax}°C`} />
            <MetricCard
              label="Peak Hour"
              value={`${dailySummary.peakHour?.hour || 'N/A'} (${dailySummary.peakHour?.totalPower || 0} kW)`}
              accent="#FF9800"
            />
          </div>
        ) : null}

        {schedule24h.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={schedule24h}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="totalPower" stroke="#2196F3" name="Total Power (kW)" />
              <Line type="monotone" dataKey="load" stroke="#FF9800" name="Load (tons)" />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </section>

      <section className="section-card">
        <h2>Manual Optimization Test</h2>
        <div className="inputs-grid">
          <RangeField
            label="Building Load"
            name="load_tons"
            value={manualInputs.load_tons}
            min={100}
            max={2000}
            step={50}
            suffix=" tons"
            onChange={updateManualInput}
          />
          <RangeField
            label="Wet Bulb Temperature"
            name="wet_bulb_c"
            value={manualInputs.wet_bulb_c}
            min={5}
            max={30}
            step={0.5}
            suffix="°C"
            onChange={updateManualInput}
          />
          <RangeField
            label="CHW Setpoint"
            name="current_chw_setpoint_c"
            value={manualInputs.current_chw_setpoint_c}
            min={5}
            max={10}
            step={0.5}
            suffix="°C"
            onChange={updateManualInput}
          />
          <RangeField
            label="Current Limit"
            name="current_limit_pct"
            value={manualInputs.current_limit_pct}
            min={50}
            max={100}
            step={5}
            suffix="%"
            onChange={updateManualInput}
          />
          <RangeField
            label="Chillers Running"
            name="chillers_running"
            value={manualInputs.chillers_running}
            min={1}
            max={4}
            step={1}
            suffix=""
            onChange={updateManualInput}
          />
        </div>

        <button type="button" className="primary-button" onClick={runManualOptimization} disabled={manualLoading}>
          {manualLoading ? 'Optimizing...' : 'Optimize'}
        </button>

        {manualOptimization ? (
          <div className="metrics-grid">
            <MetricCard label="kW/ton" value={manualOptimization.kwPerTr} />
            <MetricCard label="Total Power" value={`${manualOptimization.totalPower} kW`} />
            <MetricCard label="Efficiency" value={manualOptimization.efficiency} />
            <MetricCard label="Best Setpoint" value={`${manualOptimization.recommendedSetpoint}°C`} />
            <MetricCard label="Recommended Chillers" value={manualOptimization.recommendedChillers} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
