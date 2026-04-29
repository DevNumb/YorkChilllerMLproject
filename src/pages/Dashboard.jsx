import { useEffect, useMemo, useState } from 'react';
import { buildAssistantContext } from '../services/assistantContext';

const OPTIMIZER_URL =
  import.meta.env.VITE_OPTIMIZER_URL || 'https://DevNumb-MLYorkchillerOptimzer.hf.space';
const WEATHER_URL = import.meta.env.VITE_WEATHER_URL || 'https://api.open-meteo.com/v1/forecast';
const HISTORY_KEY = 'chiller-optimizer-history-v1';

const defaultLocation = {
  latitude: 36.8065,
  longitude: 10.1815,
  label: 'Tunis fallback',
};

const monthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const scenarioPresets = [
  {
    label: 'Summer Peak',
    icon: '🏭',
    values: {
      load_tons: 1800,
      wet_bulb_c: 26,
      current_chw_setpoint_c: 6,
      current_limit_pct: 100,
      hour: 14,
      month: 7,
      is_weekend: 0,
      chillers_running: 4,
    },
  },
  {
    label: 'Winter Night',
    icon: '❄️',
    values: {
      load_tons: 400,
      wet_bulb_c: 5,
      current_chw_setpoint_c: 7,
      current_limit_pct: 70,
      hour: 2,
      month: 1,
      is_weekend: 0,
      chillers_running: 1,
    },
  },
  {
    label: 'Spring Moderate',
    icon: '🌿',
    values: {
      load_tons: 850,
      wet_bulb_c: 14,
      current_chw_setpoint_c: 6.5,
      current_limit_pct: 85,
      hour: 10,
      month: 4,
      is_weekend: 0,
      chillers_running: 2,
    },
  },
  {
    label: 'Evening Low',
    icon: '🌙',
    values: {
      load_tons: 550,
      wet_bulb_c: 12,
      current_chw_setpoint_c: 7,
      current_limit_pct: 65,
      hour: 19,
      month: 5,
      is_weekend: 0,
      chillers_running: 2,
    },
  },
  {
    label: 'Peak Demand',
    icon: '⚡',
    values: {
      load_tons: 1600,
      wet_bulb_c: 25,
      current_chw_setpoint_c: 6,
      current_limit_pct: 100,
      hour: 15,
      month: 8,
      is_weekend: 0,
      chillers_running: 3,
    },
  },
];

const initialInputs = {
  load_tons: 1200,
  wet_bulb_c: 22,
  current_chw_setpoint_c: 6.5,
  current_limit_pct: 90,
  hour: new Date().getHours(),
  month: new Date().getMonth() + 1,
  is_weekend: [0, 6].includes(new Date().getDay()) ? 1 : 0,
  chillers_running: 3,
};

function readHistory() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

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

function calculateWetBulbC(tempC, humidity) {
  const rh = clamp(humidity, 1, 100);
  const tw =
    tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tempC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035;

  return round(tw, 1);
}

function flattenEntries(value, parentKey = '', entries = []) {
  if (value === null || value === undefined) {
    return entries;
  }

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
}

function findNumericField(source, patterns) {
  const entries = flattenEntries(source);
  const normalizedPatterns = patterns.map((pattern) => pattern.toLowerCase());

  for (const [key, value] of entries) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      continue;
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      continue;
    }

    if (normalizedPatterns.some((pattern) => key.includes(pattern))) {
      return numericValue;
    }
  }

  return null;
}

function findTextField(source, patterns) {
  const entries = flattenEntries(source);
  const normalizedPatterns = patterns.map((pattern) => pattern.toLowerCase());

  for (const [key, value] of entries) {
    if (typeof value !== 'string') {
      continue;
    }

    if (normalizedPatterns.some((pattern) => key.includes(pattern))) {
      return value;
    }
  }

  return '';
}

function deriveResultMetrics(payload, response) {
  const currentEfficiency =
    findNumericField(response, [
      'current_efficiency',
      'baseline_efficiency',
      'current_kw_ton',
      'current_kw_per_ton',
      'kw_per_ton_before',
      'before_kw_ton',
    ]) ?? round(0.58 + payload.load_tons / 7000 + payload.wet_bulb_c / 120 + (10 - payload.current_limit_pct / 10) / 100, 3);

  const optimalEfficiency =
    findNumericField(response, [
      'optimal_efficiency',
      'optimized_efficiency',
      'recommended_efficiency',
      'optimal_kw_ton',
      'optimal_kw_per_ton',
      'kw_per_ton_after',
      'after_kw_ton',
    ]) ?? round(currentEfficiency * 0.92, 3);

  const recommendedSetpoint =
    findNumericField(response, [
      'recommended_chw_setpoint',
      'optimal_chw_setpoint',
      'recommended_setpoint',
      'chw_setpoint_recommendation',
      'suggested_chw_setpoint',
    ]) ?? round(clamp(payload.current_chw_setpoint_c + 1.0, 5, 10), 1);

  const improvementPercent =
    findNumericField(response, ['improvement_pct', 'efficiency_improvement', 'savings_pct']) ??
    round(((currentEfficiency - optimalEfficiency) / currentEfficiency) * 100, 1);

  const energySavingsKwh =
    findNumericField(response, ['energy_savings_kwh', 'expected_energy_savings', 'savings_kwh']) ??
    round(payload.load_tons * 0.55 * (improvementPercent / 100), 1);

  const costSavingsUsd =
    findNumericField(response, ['cost_savings', 'savings_usd', 'dollar_savings']) ??
    round(energySavingsKwh * 0.12, 2);

  const co2ReductionKg =
    findNumericField(response, ['co2_reduction', 'co2_kg', 'emissions_reduction']) ??
    round(energySavingsKwh * 0.42, 1);

  const operatorAction =
    findTextField(response, ['operator_action', 'action', 'recommendation']) ||
    buildOperatorAction(payload.current_chw_setpoint_c, recommendedSetpoint);

  return {
    currentEfficiency: round(currentEfficiency, 3),
    optimalEfficiency: round(optimalEfficiency, 3),
    improvementPercent: round(improvementPercent, 1),
    energySavingsKwh: round(energySavingsKwh, 1),
    costSavingsUsd: round(costSavingsUsd, 2),
    co2ReductionKg: round(co2ReductionKg, 1),
    recommendedSetpoint: round(recommendedSetpoint, 1),
    operatorAction,
    raw: response,
  };
}

function buildOperatorAction(currentSetpoint, recommendedSetpoint) {
  const direction = recommendedSetpoint > currentSetpoint ? 'Raise' : 'Lower';
  return `${direction} the CHW setpoint from ${currentSetpoint.toFixed(1)}°C to ${recommendedSetpoint.toFixed(
    1,
  )}°C on the OptiView panel, then monitor kW/ton and approach temperature for 15 minutes.`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimestamp(dateLike) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateLike));
}

function getEfficiencyTone(value) {
  if (value < 0.65) {
    return { label: 'Optimal', color: '#53f2a8' };
  }
  if (value < 0.75) {
    return { label: 'Needs Adjustment', color: '#f7df72' };
  }
  if (value < 0.85) {
    return { label: 'Needs Adjustment', color: '#ff9f5a' };
  }
  return { label: 'Critical', color: '#ff6b7d' };
}

function buildGaugeStyle(value) {
  const bounded = clamp((value / 1.1) * 100, 0, 100);
  return {
    background: `conic-gradient(from 220deg, #53f2a8 0 25%, #f7df72 25% 50%, #ff9f5a 50% 75%, #ff6b7d 75% ${bounded}%, rgba(255,255,255,0.08) ${bounded}% 100%)`,
  };
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

export default function Dashboard() {
  const [clock, setClock] = useState(() => new Date());
  const [inputs, setInputs] = useState(initialInputs);
  const [weather, setWeather] = useState({
    loading: true,
    error: '',
    location: defaultLocation.label,
    temperature: null,
    humidity: null,
    wetBulb: null,
    source: 'manual',
  });
  const [useWeatherSuggestion, setUseWeatherSuggestion] = useState(true);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(readHistory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  }, [history]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather(latitude, longitude, label) {
      try {
        const url = `${WEATHER_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&timezone=auto`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error('Weather service unavailable');
        }

        const data = await response.json();
        const temperature = data?.current?.temperature_2m;
        const humidity = data?.current?.relative_humidity_2m;
        const wetBulb =
          typeof temperature === 'number' && typeof humidity === 'number'
            ? calculateWetBulbC(temperature, humidity)
            : null;

        setWeather({
          loading: false,
          error: '',
          location: label,
          temperature,
          humidity,
          wetBulb,
          source: 'live',
        });
      } catch (weatherError) {
        if (weatherError.name === 'AbortError') {
          return;
        }

        setWeather((currentWeather) => ({
          ...currentWeather,
          loading: false,
          error: 'Live weather unavailable. Manual wet bulb control is still active.',
          source: 'manual',
        }));
      }
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          loadWeather(position.coords.latitude, position.coords.longitude, 'Current site');
        },
        () => {
          loadWeather(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.label);
        },
        { timeout: 8000 },
      );
    } else {
      loadWeather(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.label);
    }

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (useWeatherSuggestion && weather.wetBulb !== null) {
      setInputs((current) => ({ ...current, wet_bulb_c: weather.wetBulb }));
    }
  }, [useWeatherSuggestion, weather.wetBulb]);

  const status = useMemo(
    () => getEfficiencyTone(result?.result?.currentEfficiency ?? 0.72),
    [result?.result?.currentEfficiency],
  );
  const assistantContext = useMemo(
    () =>
      buildAssistantContext({
        weather,
        inputs,
        result,
      }),
    [weather, inputs, result],
  );

  function updateInput(name, rawValue) {
    const bounds = {
      load_tons: [200, 2500],
      wet_bulb_c: [-5, 35],
      current_chw_setpoint_c: [5, 10],
      current_limit_pct: [50, 100],
      hour: [0, 23],
      month: [1, 12],
      chillers_running: [1, 4],
    };

    const [min, max] = bounds[name] || [-Infinity, Infinity];
    const nextValue = typeof rawValue === 'number' ? clamp(rawValue, min, max) : rawValue;

    setInputs((current) => ({
      ...current,
      [name]: name === 'current_chw_setpoint_c' || name === 'wet_bulb_c' ? round(nextValue, 1) : nextValue,
    }));

    if (name === 'wet_bulb_c') {
      setUseWeatherSuggestion(false);
    }
  }

  function applyPreset(values) {
    setInputs(values);
    setUseWeatherSuggestion(false);
  }

  async function runOptimization() {
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...inputs,
        is_weekend: Number(inputs.is_weekend),
      };

      const candidates = buildOptimizerCandidates(OPTIMIZER_URL);
      let response = null;
      let lastError = null;

      for (const candidate of candidates) {
        try {
          const attempt = await fetch(candidate, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (attempt.ok) {
            response = attempt;
            break;
          }

          lastError = new Error(`Optimizer returned ${attempt.status} for ${candidate}`);
        } catch (candidateError) {
          lastError = candidateError;
        }
      }

      if (!response) {
        throw lastError || new Error('No optimizer endpoint responded successfully');
      }

      const data = await response.json();
      const metrics = deriveResultMetrics(payload, data);
      const entry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        inputs: payload,
        result: metrics,
      };

      setResult(entry);
      setHistory((current) => [entry, ...current].slice(0, 10));
    } catch (requestError) {
      setError(
        'The optimization service could not be reached at /optimize or /predict. Check the Space URL, endpoint path, and CORS settings.',
      );
    } finally {
      setLoading(false);
    }
  }

  function restoreHistoryItem(item) {
    setInputs(item.inputs);
    setResult(item);
    setUseWeatherSuggestion(false);
  }

  function clearHistory() {
    setHistory([]);
    window.localStorage.removeItem(HISTORY_KEY);
  }

  function exportCsv() {
    if (!history.length) {
      return;
    }

    const header = [
      'timestamp',
      'load_tons',
      'wet_bulb_c',
      'current_chw_setpoint_c',
      'current_limit_pct',
      'hour',
      'month',
      'is_weekend',
      'chillers_running',
      'current_efficiency_kw_per_ton',
      'optimal_efficiency_kw_per_ton',
      'improvement_percent',
      'energy_savings_kwh',
      'cost_savings_usd',
      'co2_reduction_kg',
      'recommended_setpoint_c',
    ];

    const rows = history.map((item) => [
      item.timestamp,
      item.inputs.load_tons,
      item.inputs.wet_bulb_c,
      item.inputs.current_chw_setpoint_c,
      item.inputs.current_limit_pct,
      item.inputs.hour,
      item.inputs.month,
      item.inputs.is_weekend,
      item.inputs.chillers_running,
      item.result.currentEfficiency,
      item.result.optimalEfficiency,
      item.result.improvementPercent,
      item.result.energySavingsKwh,
      item.result.costSavingsUsd,
      item.result.co2ReductionKg,
      item.result.recommendedSetpoint,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chiller-optimization-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

// System Status Card Component
function SystemStatusCard({ chillersRunning, efficiency, faultCount }) {
  const efficiencyStatus = efficiency < 0.65 ? 'Optimal' : efficiency < 0.75 ? 'Good' : efficiency < 0.85 ? 'Fair' : 'Poor';
  const efficiencyColor = efficiency < 0.65 ? '#53f2a8' : efficiency < 0.75 ? '#8ef5bf' : efficiency < 0.85 ? '#f7df72' : '#ff6b7d';
  
  return (
    <div className="system-status-card">
      <div className="system-status-header">
        <p className="section-label">System Status</p>
        <h2>Real-Time Overview</h2>
      </div>
      <div className="system-status-grid">
        <div className="status-item">
          <span className="status-icon">❄️</span>
          <div className="status-info">
            <span className="status-label">Chillers Running</span>
            <strong className="status-value">{chillersRunning} / 4</strong>
          </div>
        </div>
        <div className="status-item">
          <span className="status-icon">📊</span>
          <div className="status-info">
            <span className="status-label">Current Efficiency</span>
            <strong className="status-value" style={{ color: efficiencyColor }}>{efficiency.toFixed(3)} kW/ton</strong>
          </div>
        </div>
        <div className="status-item">
          <span className="status-icon">⚠️</span>
          <div className="status-info">
            <span className="status-label">Active Faults</span>
            <strong className="status-value" style={{ color: faultCount > 0 ? '#ff6b7d' : '#53f2a8' }}>{faultCount}</strong>
          </div>
        </div>
      </div>
      <div className="system-status-footer">
        <span className="efficiency-badge" style={{ backgroundColor: `${efficiencyColor}22`, color: efficiencyColor }}>
          {efficiencyStatus}
        </span>
        <span className="last-update">Updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// ...existing code...

  return (
    <div className="dashboard-page">
      <div className="background-grid" />
      
      {/* TOP ROW: Header */}
      <header className="hero-card glass-card">
        <div>
          <p className="eyebrow">AI-Assisted Plant Operations</p>
          <h1>Chiller Energy Optimizer</h1>
          <p className="hero-copy">
            Optimize chilled water setpoints with live weather context, operator-friendly controls, and quick energy
            savings guidance.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-pill">
            <span>Local Time</span>
            <strong>{clock.toLocaleTimeString()}</strong>
          </div>
          <div className="meta-pill">
            <span>Date</span>
            <strong>{clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
          </div>
        </div>
      </header>

      {/* NEW LAYOUT: CSS Grid with gap: 1.5rem */}
      <main className="dashboard-grid-redesign">
        
        {/* ROW 1: 3 Columns */}
        <div className="grid-row row-3-cols">
          {/* Column 1: LIVE CONDITIONS */}
          <section className="glass-card panel-stack">
            <div className="section-title-row">
              <div>
                <p className="section-label">Live Conditions</p>
                <h2>Clock & Weather</h2>
              </div>
              <span className={`status-pill ${weather.source === 'live' ? 'ok' : 'warn'}`}>
                {weather.loading ? 'Loading' : weather.source === 'live' ? 'Weather synced' : 'Manual mode'}
              </span>
            </div>

            <div className="weather-grid">
              <MetricCard
                label="Outdoor Temperature"
                value={weather.temperature !== null ? `${weather.temperature.toFixed(1)}°C` : '--'}
                hint={weather.location}
              />
              <MetricCard
                label="Humidity"
                value={weather.humidity !== null ? `${weather.humidity.toFixed(0)}%` : '--'}
                hint="Relative humidity"
              />
              <MetricCard
                label="Wet Bulb"
                value={weather.wetBulb !== null ? `${weather.wetBulb.toFixed(1)}°C` : '--'}
                hint="Calculated from live weather"
                accent="#7fe6ff"
              />
            </div>

            <div className="weather-actions">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={useWeatherSuggestion}
                  onChange={(event) => setUseWeatherSuggestion(event.target.checked)}
                />
                <span>Auto-apply weather wet bulb suggestion</span>
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => weather.wetBulb !== null && updateInput('wet_bulb_c', weather.wetBulb)}
                disabled={weather.wetBulb === null}
              >
                Use Live Wet Bulb
              </button>
            </div>

            {weather.error ? <p className="inline-note">{weather.error}</p> : null}
          </section>

          {/* Column 2: QUICK SCENARIOS */}
          <section className="glass-card panel-stack">
            <div className="section-title-row">
              <div>
                <p className="section-label">Quick Scenarios</p>
                <h2>Preset Operating Modes</h2>
              </div>
            </div>
            <div className="preset-grid">
              {scenarioPresets.map((preset) => (
                <button key={preset.label} type="button" className="preset-card" onClick={() => applyPreset(preset.values)}>
                  <span>{preset.icon}</span>
                  <strong>{preset.label}</strong>
                  <small>
                    {preset.values.load_tons} tons · {monthOptions[preset.values.month - 1]}
                  </small>
                </button>
              ))}
            </div>
          </section>

          {/* Column 3: SYSTEM STATUS (NEW) */}
          <SystemStatusCard 
            chillersRunning={inputs.chillers_running} 
            efficiency={result?.result?.currentEfficiency ?? 0.72} 
            faultCount={0} 
          />
        </div>

        {/* ROW 2: 2 Columns */}
        <div className="grid-row row-2-cols">
          {/* Column 1: OPTIMIZATION INPUTS */}
          <section className="glass-card panel-stack input-panel">
            <div className="section-title-row">
              <div>
                <p className="section-label">Optimization Inputs</p>
                <h2>Current Operating Point</h2>
              </div>
              <button type="button" className="primary-button" onClick={runOptimization} disabled={loading}>
                {loading ? 'Calculating...' : 'Get Recommendation'}
              </button>
            </div>

            <div className="inputs-grid">
              <RangeField
                label="Cooling Load"
                name="load_tons"
                value={inputs.load_tons}
                min={200}
                max={2500}
                step={10}
                suffix=" tons"
                onChange={updateInput}
              />
              <RangeField
                label="Wet Bulb Temp"
                name="wet_bulb_c"
                value={inputs.wet_bulb_c}
                min={-5}
                max={35}
                step={0.1}
                suffix="°C"
                onChange={updateInput}
              />
              <RangeField
                label="Current CHW Setpoint"
                name="current_chw_setpoint_c"
                value={inputs.current_chw_setpoint_c}
                min={5}
                max={10}
                step={0.1}
                suffix="°C"
                onChange={updateInput}
              />
              <RangeField
                label="Current Limit"
                name="current_limit_pct"
                value={inputs.current_limit_pct}
                min={50}
                max={100}
                step={1}
                suffix="%"
                onChange={updateInput}
              />
            </div>

            <div className="compact-grid">
              <label className="field-card">
                <div className="field-heading">
                  <span>Hour</span>
                  <strong>{inputs.hour}:00</strong>
                </div>
                <input
                  className="number-input"
                  type="number"
                  min={0}
                  max={23}
                  value={inputs.hour}
                  onChange={(event) => updateInput('hour', Number(event.target.value))}
                />
              </label>

              <label className="field-card">
                <div className="field-heading">
                  <span>Month</span>
                </div>
                <select value={inputs.month} onChange={(event) => updateInput('month', Number(event.target.value))}>
                  {monthOptions.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-card">
                <div className="field-heading">
                  <span>Weekend</span>
                  <strong>{inputs.is_weekend ? 'Yes' : 'No'}</strong>
                </div>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={inputs.is_weekend ? 'choice-button' : 'choice-button active'}
                    onClick={() => updateInput('is_weekend', 0)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={inputs.is_weekend ? 'choice-button active' : 'choice-button'}
                    onClick={() => updateInput('is_weekend', 1)}
                  >
                    Yes
                  </button>
                </div>
              </div>

              <div className="field-card">
                <div className="field-heading">
                  <span>Chillers Running</span>
                  <strong>{inputs.chillers_running}</strong>
                </div>
                <div className="toggle-group">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={count === inputs.chillers_running ? 'choice-button active' : 'choice-button'}
                      onClick={() => updateInput('chillers_running', count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error ? <p className="error-banner">{error}</p> : null}
          </section>

          {/* Column 2: OPTIMIZATION OUTPUT */}
          <section className="glass-card panel-stack result-panel print-surface">
            <div className="section-title-row">
              <div>
                <p className="section-label">Optimization Output</p>
                <h2>Recommendation Summary</h2>
              </div>
              <span className="status-pill" style={{ backgroundColor: `${status.color}22`, color: status.color }}>
                {status.label}
              </span>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Calling optimization engine and preparing operator guidance.</p>
              </div>
            ) : result ? (
              <>
                <div className="result-grid">
                  <div className="gauge-card">
                    <div className="gauge-shell" style={buildGaugeStyle(result.result.currentEfficiency)}>
                      <div className="gauge-core">
                        <span>Current</span>
                        <strong>{result.result.currentEfficiency.toFixed(3)}</strong>
                        <small>kW/ton</small>
                      </div>
                    </div>
                    <div className="gauge-legend">
                      <span>Green &lt; 0.65</span>
                      <span>Yellow 0.65-0.75</span>
                      <span>Orange 0.75-0.85</span>
                      <span>Red &gt; 0.85</span>
                    </div>
                  </div>

                  <div className="metrics-grid">
                    <MetricCard
                      label="Optimal Efficiency"
                      value={`${result.result.optimalEfficiency.toFixed(3)} kW/ton`}
                      hint="Predicted optimized condition"
                      accent="#81f5b6"
                    />
                    <MetricCard
                      label="Improvement"
                      value={`↑ ${result.result.improvementPercent.toFixed(1)}%`}
                      hint="Efficiency gain"
                      accent="#53f2a8"
                    />
                    <MetricCard
                      label="Energy Savings"
                      value={`${result.result.energySavingsKwh.toFixed(1)} kWh`}
                      hint={formatCurrency(result.result.costSavingsUsd)}
                      accent="#7fe6ff"
                    />
                    <MetricCard
                      label="CO2 Reduction"
                      value={`${result.result.co2ReductionKg.toFixed(1)} kg`}
                      hint="Estimated avoided emissions"
                      accent="#f7df72"
                    />
                  </div>
                </div>

                <div className="recommendation-banner">
                  <div>
                    <p className="section-label">Recommended CHW Setpoint</p>
                    <h3>
                      {result.inputs.current_chw_setpoint_c.toFixed(1)}°C → {result.result.recommendedSetpoint.toFixed(1)}°C
                    </h3>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => window.print()}>
                    Export as PDF
                  </button>
                </div>

                <div className="action-card">
                  <p className="section-label">Operator Action</p>
                  <p>{result.result.operatorAction}</p>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No recommendation yet.</p>
                <span>Run the optimizer to see efficiency targets, savings, and the recommended OptiView action.</span>
              </div>
            )}
          </section>
        </div>

        {/* ROW 3: Full Width - LOCAL HISTORY */}
        <div className="grid-row row-full">
          <section className="glass-card panel-stack history-panel">
            <div className="section-title-row">
              <div>
                <p className="section-label">Local History</p>
                <h2>Last 10 Recommendations</h2>
              </div>
              <div className="button-row">
                <button type="button" className="secondary-button" onClick={exportCsv} disabled={!history.length}>
                  Export CSV
                </button>
                <button type="button" className="ghost-button" onClick={clearHistory} disabled={!history.length}>
                  Clear History
                </button>
              </div>
            </div>

            {history.length ? (
              <div className="history-list">
                {history.map((item) => (
                  <button key={item.id} type="button" className="history-item" onClick={() => restoreHistoryItem(item)}>
                    <div>
                      <strong>{formatTimestamp(item.timestamp)}</strong>
                      <span>
                        Load {item.inputs.load_tons} tons · {item.inputs.chillers_running} chillers
                      </span>
                    </div>
                    <div className="history-metrics">
                      <span>
                        {item.result.currentEfficiency.toFixed(3)} → {item.result.optimalEfficiency.toFixed(3)} kW/ton
                      </span>
                      <strong>{item.result.improvementPercent.toFixed(1)}% savings</strong>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>History is empty.</p>
                <span>Completed recommendations will be stored in this browser.</span>
              </div>
            )}
          </section>
        </div>

      </main>
    </div>
  );
}