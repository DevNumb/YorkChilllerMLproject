import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import React, { useState, useEffect, useCallback } from 'react';
import { getAllChillerCombinations, getAllSetpoints, buildPredictionInput, predictKwPerTr, calculateSavings } from '../services/chillerOptimizer';

const OPTIMIZER_URL = import.meta.env.VITE_OPTIMIZER_URL || 'https://DevNumb-MLYorkchillerOptimzer.hf.space';
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

      setTomorrowDate(tomorrow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));

      const schedule = [];
      let totalEnergy = 0;
      const chillerUsage = {};
      const setpointUsage = {};

      for (let hour = 0; hour < 24; hour++) {
        const load = 800 + 300 * Math.sin(hour / 6);
        const wetBulb = 18 + 8 * Math.sin(hour / 8);
        const setpoint = 6.5;
        const chillerCount = load < 600 ? 1 : load < 900 ? 2 : load < 1200 ? 3 : 4;

        try {
          const avgOutsideTemp = Math.max(32, wetBulb * 1.5 + 12);
          const avgDewPoint = Math.max(20, wetBulb + 2);
          const avgChilledWaterRate = Math.max(50, load / 20);

          const predictionInput = {
            total_building_load: load,
            avg_chilled_water_rate: avgChilledWaterRate,
            avg_cooling_water_temp: setpoint + 1,
            avg_outside_temp: avgOutsideTemp,
            avg_dew_point: avgDewPoint,
            avg_humidity: 60,
            avg_wind_speed: 5,
            avg_pressure: 30,
            hour,
            day_of_week: isWeekend ? 0 : 1,
            month: tomorrowMonth,
            day_of_year: Math.round((tomorrowMonth - 1) * 30 + 15),
          };

          const response = await fetch(`${OPTIMIZER_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(predictionInput),
          });

          let kwPerTr = 0.6;
          if (response.ok) {
            const data = await response.json();
            kwPerTr = data.kw_per_tr || 0.6;
          }

          const stageFactor = 1 + (Math.abs(load / chillerCount - 500) / 500) * 0.1;
          const hourTotalPower = load * kwPerTr * stageFactor;

          const hourData = {
            hour: `${String(hour).padStart(2, '0')}:00`,
            load: round(load, 0),
            wetBulb: round(wetBulb, 1),
            recChillers: chillerCount,
            recSetpoint: setpoint,
            kwPerTr: round(kwPerTr, 3),
            totalPower: round(hourTotalPower, 1),
          };

          schedule.push(hourData);
          totalEnergy += hourTotalPower;

          const chillerKey = String(chillerCount);
          chillerUsage[chillerKey] = (chillerUsage[chillerKey] || 0) + 1;
          setpointUsage[setpoint] = (setpointUsage[setpoint] || 0) + 1;
        } catch (hourError) {
          console.warn(`Hour ${hour} prediction failed:`, hourError);
          const kwPerTr = 0.6;
          const stageFactor = 1 + (Math.abs(load / chillerCount - 500) / 500) * 0.1;
          const hourTotalPower = load * kwPerTr * stageFactor;

          schedule.push({
            hour: `${String(hour).padStart(2, '0')}:00`,
            load: round(load, 0),
            wetBulb: round(wetBulb, 1),
            recChillers: chillerCount,
            recSetpoint: setpoint,
            kwPerTr: round(kwPerTr, 3),
            totalPower: round(hourTotalPower, 1),
          });
          totalEnergy += hourTotalPower;
        }
      }

      setSchedule24h(schedule);

      const mostUsedChiller = Object.entries(chillerUsage).sort((a, b) => b[1] - a[1])[0];
      const setpointRange = Object.keys(setpointUsage).map(Number).sort();

      const nextSummary = {
        totalEnergy: round(totalEnergy, 0),
        avgKwPerTr: round(totalEnergy / 24 / 800, 3),
        mostUsedChillers: mostUsedChiller ? mostUsedChiller[0] : '2',
        setpointMin: setpointRange[0] || 6.5,
        setpointMax: setpointRange[setpointRange.length - 1] || 6.5,
        peakHour: schedule.reduce((max, h) => (h.totalPower > max.totalPower ? h : max), schedule[0] || {}),
      };

      setDailySummary(nextSummary);
      writeForecastCache({
        tomorrowDate: tomorrow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
        schedule24h: schedule,
        dailySummary: nextSummary,
        cachedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Schedule generation failed:', err);
      const fallback = readForecastCache();
      if (fallback?.schedule24h?.length) {
        setTomorrowDate(fallback.tomorrowDate || tomorrowDate);
        setSchedule24h(fallback.schedule24h);
        setDailySummary(fallback.dailySummary || null);
        setError('Failed to refresh schedule. Showing the last successful forecast.');
      } else {
        setError('Failed to generate 24-hour schedule');
      }
    } finally {
      setLoading(false);
    }
  }, [tomorrowDate]);

  const runManualOptimization = useCallback(async () => {
    setManualLoading(true);
    try {
      const now = new Date();
      const avgOutsideTemp = Math.max(32, manualInputs.wet_bulb_c * 1.5 + 12);
      const avgDewPoint = Math.max(20, manualInputs.wet_bulb_c + 2);
      const avgChilledWaterRate = Math.max(50, manualInputs.load_tons / 20);

      const predictionInput = {
        total_building_load: manualInputs.load_tons,
        avg_chilled_water_rate: avgChilledWaterRate,
        avg_cooling_water_temp: manualInputs.current_chw_setpoint_c + 1,
        avg_outside_temp: avgOutsideTemp,
        avg_dew_point: avgDewPoint,
        avg_humidity: 60,
        avg_wind_speed: 5,
        avg_pressure: 30,
        hour: now.getHours(),
        day_of_week: [0, 6].includes(now.getDay()) ? 0 : 1,
        month: now.getMonth() + 1,
        day_of_year: Math.round((now.getMonth() * 30) + now.getDate()),
      };

      const response = await fetch(`${OPTIMIZER_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictionInput),
      });

      if (response.ok) {
        const data = await response.json();
        const kwPerTr = data.kw_per_tr || 0.6;
        const totalPower = manualInputs.load_tons * kwPerTr;

        setManualOptimization({
          kwPerTr,
          totalPower: round(totalPower, 1),
          efficiency: round(1 / (kwPerTr / 0.6), 2),
          timestamp: new Date().toISOString(),
        });

        writeManualOptimizationCache({
          inputs: manualInputs,
          result: { kwPerTr, totalPower: round(totalPower, 1) },
          cachedAt: new Date().toISOString(),
        });
      } else {
        throw new Error(`HTTP ${response.status}`);\n      }\n    } catch (err) {\n      console.warn('Manual optimization failed:', err);\n      const fallback = readManualOptimizationCache();\n      if (fallback?.result) {\n        setManualOptimization(fallback.result);\n      }\n    } finally {\n      setManualLoading(false);\n    }\n  }, [manualInputs]);\n\n  useEffect(() => {\n    generateTomorrow24hSchedule();\n  }, [generateTomorrow24hSchedule]);\n\n  const updateManualInput = (name, value) => {\n    setManualInputs((current) => ({\n      ...current,\n      [name]: value,\n    }));\n  };\n\n  return (\n    <div className=\"page-container\">\n      <header className="page-header">\n        <h1>📊 Energy Forecasting</h1>\n        <p>24-hour optimization predictions and manual scenario analysis</p>\n      </header>\n\n      {error ? <div className="error-message">{error}</div> : null}\n\n      <section className="section-card">\n        <div className="section-header">\n          <h2>Tomorrow's 24-Hour Schedule: {tomorrowDate}</h2>\n          <button type="button" className="primary-button" onClick={generateTomorrow24hSchedule} disabled={loading}>\n            {loading ? 'Generating...' : '🔄 Refresh Schedule'}\n          </button>\n        </div>\n\n        {dailySummary ? (\n          <div className="metrics-grid">\n            <MetricCard label="Total Energy" value={`${dailySummary.totalEnergy} kWh`} accent="#4CAF50" />\n            <MetricCard label="Avg Efficiency" value={`${dailySummary.avgKwPerTr} kW/tr`} />\n            <MetricCard label="Most Used Chillers\" value={dailySummary.mostUsedChillers} />\n            <MetricCard label=\"Setpoint Range\" value={`${dailySummary.setpointMin}°C - ${dailySummary.setpointMax}°C`} />\n            <MetricCard\n              label=\"Peak Hour\"\n              value={`${dailySummary.peakHour?.hour || 'N/A'} (${dailySummary.peakHour?.totalPower || 0} kW)`}\n              accent=\"#FF9800\"\n            />\n          </div>\n        ) : null}\n\n        {schedule24h.length > 0 ? (\n          <ResponsiveContainer width=\"100%\" height={400}>\n            <LineChart data={schedule24h}>\n              <CartesianGrid strokeDasharray=\"3 3\" />\n              <XAxis dataKey=\"hour\" />\n              <YAxis />\n              <Tooltip />\n              <Legend />\n              <Line type=\"monotone\" dataKey=\"totalPower\" stroke=\"#2196F3\" name=\"Total Power (kW)\" />\n              <Line type=\"monotone\" dataKey=\"load\" stroke=\"#FF9800\" name=\"Load (tons)\" />\n            </LineChart>\n          </ResponsiveContainer>\n        ) : null}\n      </section>\n\n      <section className="section-card">\n        <h2>Manual Optimization Test</h2>\n        <div className="inputs-grid">\n          <RangeField\n            label=\"Building Load\"\n            name=\"load_tons\"\n            value={manualInputs.load_tons}\n            min={100}\n            max={2000}\n            step={50}\n            suffix=\" tons\"\n            onChange={updateManualInput}\n          />\n          <RangeField\n            label=\"Wet Bulb Temperature\"\n            name=\"wet_bulb_c\"\n            value={manualInputs.wet_bulb_c}\n            min={5}\n            max={30}\n            step={0.5}\n            suffix=\"°C\"\n            onChange={updateManualInput}\n          />\n          <RangeField\n            label=\"CHW Setpoint\"\n            name=\"current_chw_setpoint_c\"\n            value={manualInputs.current_chw_setpoint_c}\n            min={5}\n            max={10}\n            step={0.5}\n            suffix=\"°C\"\n            onChange={updateManualInput}\n          />\n          <RangeField\n            label=\"Current Limit\"\n            name=\"current_limit_pct\"\n            value={manualInputs.current_limit_pct}\n            min={50}\n            max={100}\n            step={5}\n            suffix=\"%\"\n            onChange={updateManualInput}\n          />\n          <RangeField\n            label=\"Chillers Running\"\n            name=\"chillers_running\"\n            value={manualInputs.chillers_running}\n            min={1}\n            max={4}\n            step={1}\n            suffix=\"\"\n            onChange={updateManualInput}\n          />\n        </div>\n\n        <button type=\"button\" className=\"primary-button\" onClick={runManualOptimization} disabled={manualLoading}>\n          {manualLoading ? 'Optimizing...' : '⚡ Optimize'}\n        </button>\n\n        {manualOptimization ? (\n          <div className="metrics-grid">\n            <MetricCard label=\"kW/ton\" value={manualOptimization.kwPerTr} />\n            <MetricCard label=\"Total Power\" value={`${manualOptimization.totalPower} kW`} />\n            <MetricCard label=\"Efficiency\" value={manualOptimization.efficiency} />\n          </div>\n        ) : null}\n      </section>\n    </div>\n  );\n}
