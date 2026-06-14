import { useEffect, useMemo, useState } from 'react';
import { buildAssistantContext } from '../services/assistantContext';
import { calculateSavings, formatChillerStageLabel } from '../services/chillerOptimizer';
import { saveOptimizationHistory, getOptimizationHistory } from '../services/supabaseDashboardService';

const WEATHER_URL = import.meta.env.VITE_WEATHER_URL || 'https://api.open-meteo.com/v1/forecast';
const HISTORY_KEY = 'chiller-optimizer-history-v1';

const defaultLocation = {
  latitude: 36.8065,
  longitude: 10.1815,
  label: 'Tunis fallback',
};

const monthOptions = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const scenarioPresets = [
  {
    label: 'Summer Peak',
    icon: '',
    values: {
      load_tons: 1800, wet_bulb_c: 26, current_chw_setpoint_c: 6, current_limit_pct: 100, hour: 14, month: 7, is_weekend: 0, chillers_running: 3,
      CHL_STA_1: 1, CHL_STA_2: 1, CHL_STA_3: 1,
      CHL_COMP_SPD_CTRL_1: 95, CHL_COMP_SPD_CTRL_2: 95, CHL_COMP_SPD_CTRL_3: 95,
      CT_FAN_SPD_CTRL_1: 85, CT_FAN_SPD_CTRL_2: 85, CT_FAN_SPD_CTRL_3: 85,
      CHL_CD_FLOW_1: 300, CHL_CD_FLOW_2: 300, CHL_CD_FLOW_3: 300
    },
  },
  {
    label: 'Winter Night',
    icon: '',
    values: {
      load_tons: 400, wet_bulb_c: 5, current_chw_setpoint_c: 7, current_limit_pct: 70, hour: 2, month: 1, is_weekend: 0, chillers_running: 1,
      CHL_STA_1: 1, CHL_STA_2: 0, CHL_STA_3: 0,
      CHL_COMP_SPD_CTRL_1: 40, CHL_COMP_SPD_CTRL_2: 0, CHL_COMP_SPD_CTRL_3: 0,
      CT_FAN_SPD_CTRL_1: 30, CT_FAN_SPD_CTRL_2: 0, CT_FAN_SPD_CTRL_3: 0,
      CHL_CD_FLOW_1: 200, CHL_CD_FLOW_2: 0, CHL_CD_FLOW_3: 0
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
  oa_temp: 25,
  chillers_running: 3,
  CHL_STA_1: 1, CHL_STA_2: 1, CHL_STA_3: 1,
  CHL_COMP_SPD_CTRL_1: 85, CHL_COMP_SPD_CTRL_2: 85, CHL_COMP_SPD_CTRL_3: 85,
  CT_FAN_SPD_CTRL_1: 65, CT_FAN_SPD_CTRL_2: 65, CT_FAN_SPD_CTRL_3: 65,
  CHL_CD_FLOW_1: 280, CHL_CD_FLOW_2: 280, CHL_CD_FLOW_3: 280,
};

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function round(value, digits = 1) { return Number(value.toFixed(digits)); }

function calculateWetBulbC(tempC, humidity) {
  const rh = clamp(humidity, 1, 100);
  const tw = tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tempC + rh) - Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
  return round(tw, 1);
}

function buildStagingAction(chillers, recommendedSetpoint, currentTotalPower, optimalTotalPower, settings) {
  const powerSaved = round(currentTotalPower - optimalTotalPower, 1);
  let action = `Stage chillers ${formatChillerStageLabel(chillers)} and set CHW setpoint to ${recommendedSetpoint.toFixed(1)}°C. `;
  
  if (settings) {
    action += "Set ";
    chillers.forEach((chId) => {
      action += `Chiller ${chId} to ${settings[`CHL_COMP_SPD_CTRL_${chId}`]}% Speed & ${settings[`CT_FAN_SPD_CTRL_${chId}`]}% Fan. `;
    });
  }
  
  action += `Reduces power from ${currentTotalPower.toFixed(0)}kW to ${optimalTotalPower.toFixed(0)}kW.`;
  return action;
}

function getEfficiencyTone(value) {
  if (value < 0.65) return { label: 'Optimal', color: '#53f2a8' };
  if (value < 0.75) return { label: 'Good', color: '#8ef5bf' };
  if (value < 0.85) return { label: 'Fair', color: '#f7df72' };
  return { label: 'Poor', color: '#ff6b7d' };
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
      <strong className="metric-value" style={{ color: accent || '#f5fbff' }}>{value}</strong>
      {hint ? <span className="metric-hint">{hint}</span> : null}
    </div>
  );
}

function RangeField({ label, name, value, min, max, step, suffix, onChange }) {
  return (
    <label className="field-card">
      <div className="field-heading"><span>{label}</span><strong>{value}{suffix}</strong></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(name, Number(e.target.value))} />
      <input className="number-input" type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(name, Number(e.target.value))} />
    </label>
  );
}

function ChillerBaselineControl({ id, inputs, onChange }) {
  const isActive = inputs[`CHL_STA_${id}`] === 1;
  return (
    <div className={`chiller-status-mini ${!isActive ? 'is-off' : ''}`}>
      <div className="mini-header">
        <span>Unit {id}</span>
        <button 
          className={`toggle-small ${isActive ? 'on' : 'off'}`}
          onClick={() => onChange(`CHL_STA_${id}`, isActive ? 0 : 1)}
        >
          {isActive ? 'ON' : 'OFF'}
        </button>
      </div>
      {isActive && (
        <div className="mini-controls">
          <div className="mini-input">
            <small>Spd</small>
            <input type="number" value={inputs[`CHL_COMP_SPD_CTRL_${id}`]} onChange={(e) => onChange(`CHL_COMP_SPD_CTRL_${id}`, Number(e.target.value))} />
          </div>
          <div className="mini-input">
            <small>Fan</small>
            <input type="number" value={inputs[`CT_FAN_SPD_CTRL_${id}`]} onChange={(e) => onChange(`CT_FAN_SPD_CTRL_${id}`, Number(e.target.value))} />
          </div>
          <div className="mini-input">
            <small>Flow</small>
            <input type="number" value={inputs[`CHL_CD_FLOW_${id}`]} onChange={(e) => onChange(`CHL_CD_FLOW_${id}`, Number(e.target.value))} />
          </div>
        </div>
      )}
    </div>
  );
}

function SystemStatusCard({ chillersRunning, efficiency, faultCount }) {
  const tone = getEfficiencyTone(efficiency);
  return (
    <div className="system-status-card">
      <div className="system-status-header"><p className="section-label">System Status</p><h2>Real-Time Overview</h2></div>
      <div className="system-status-grid">
        <div className="status-item"><span className="status-icon"></span><div className="status-info"><span className="status-label">Chillers Running</span><strong className="status-value">{chillersRunning} / 4</strong></div></div>
        <div className="status-item"><span className="status-icon"></span><div className="status-info"><span className="status-label">Current Efficiency</span><strong className="status-value" style={{ color: tone.color }}>{efficiency.toFixed(3)} kW/ton</strong></div></div>
        <div className="status-item"><span className="status-icon"></span><div className="status-info"><span className="status-label">Active Faults</span><strong className="status-value" style={{ color: faultCount > 0 ? '#ff6b7d' : '#53f2a8' }}>{faultCount}</strong></div></div>
      </div>
      <div className="system-status-footer">
        <span className="efficiency-badge" style={{ backgroundColor: `${tone.color}22`, color: tone.color }}>{tone.label}</span>
        <span className="last-update">Updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [clock, setClock] = useState(() => new Date());
  const [inputs, setInputs] = useState(initialInputs);
  const [weather, setWeather] = useState({ loading: true, error: '', location: defaultLocation.label, temperature: null, humidity: null, wetBulb: null, source: 'manual' });
  const [useWeatherSuggestion, setUseWeatherSuggestion] = useState(true);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadHistory() {
      try {
        const dbHistory = await getOptimizationHistory(10);
        if (dbHistory) setHistory(dbHistory);
      } catch (e) { console.error(e); }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadWeather(lat, lon, label) {
      try {
        const response = await fetch(`${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&timezone=auto`, { signal: controller.signal });
        const data = await response.json();
        const t = data?.current?.temperature_2m;
        const h = data?.current?.relative_humidity_2m;
        const wb = (t && h) ? calculateWetBulbC(t, h) : null;
        setWeather({ loading: false, error: '', location: label, temperature: t, humidity: h, wetBulb: wb, source: 'live' });
      } catch { setWeather(w => ({ ...w, loading: false, source: 'manual' })); }
    }
    navigator.geolocation.getCurrentPosition(p => loadWeather(p.coords.latitude, p.coords.longitude, 'Current site'), () => loadWeather(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.label));
    return () => controller.abort();
  }, []);

  useEffect(() => { if (useWeatherSuggestion && weather.wetBulb !== null) updateInput('wet_bulb_c', weather.wetBulb); }, [useWeatherSuggestion, weather.wetBulb]);

  const updateInput = (name, val) => {
    setInputs(prev => ({ ...prev, [name]: val }));
    if (name === 'wet_bulb_c') setUseWeatherSuggestion(false);
  };

  const runOptimization = async () => {
    setLoading(true);
    setRecharging(true);
    setError('');
    try {
      const currentSettings = {
        ...inputs,
        OA_TEMP: weather.temperature || inputs.oa_temp || 25,
        OA_TEMP_WB: inputs.wet_bulb_c,
        Hour: inputs.hour,
        Weekday: inputs.is_weekend ? 0 : 1,
        Month: inputs.month,
        CWL_SEC_LOAD: inputs.load_tons
      };

      const savings = await calculateSavings(inputs.load_tons, inputs.wet_bulb_c, inputs.hour, inputs.month, inputs.is_weekend ? 0 : 1, currentSettings.OA_TEMP, currentSettings);
      if (!savings) throw new Error('Optimization service failed to return results.');

      const metrics = {
        currentEfficiency: savings.currentConfig.kwPerTr,
        optimalEfficiency: savings.optimalConfig.kwPerTr,
        currentTotalPower: savings.currentConfig.totalPower,
        optimalTotalPower: savings.optimalConfig.totalPower,
        powerSavedKw: savings.powerSaved,
        improvementPercent: savings.improvementPercent,
        recommendedSetpoint: savings.optimalConfig.setpoint || 6.5,
        recommendedChillers: savings.optimalConfig.chillers.length,
        costSavingsUsd: savings.costSavingsPerHour || (savings.powerSaved * 0.12),
        co2ReductionKg: savings.co2ReductionPerHour || (savings.powerSaved * 0.42),
        operatorAction: buildStagingAction(savings.optimalConfig.chillers, savings.optimalConfig.setpoint || 6.5, savings.currentConfig.totalPower, savings.optimalConfig.totalPower, savings.optimalConfig.settings),
        recommended_settings: savings.optimalConfig.settings
      };

      const entry = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), inputs: { ...inputs }, result: metrics };
      setResult(entry);
      setHistory(h => [entry, ...h].slice(0, 10));
      await saveOptimizationHistory(entry);
    } catch (e) { setError(e.message); }
    finally { 
      setLoading(false);
      setTimeout(() => setRecharging(false), 800);
    }
  };

  const statusTone = useMemo(() => getEfficiencyTone(result?.result?.currentEfficiency ?? 0.72), [result]);

  return (
    <div className={`dashboard-page ${recharging ? 'recharging-active' : ''}`}>
      <style>{`
        .recharging-indicator {
          font-size: 0.75rem;
          font-weight: 800;
          color: #7fe6ff;
          letter-spacing: 0.1em;
          animation: blink 0.5s infinite alternate;
        }
        @keyframes blink {
          from { opacity: 0.4; }
          to { opacity: 1; }
        }
        .recharging-content {
          filter: blur(4px);
          opacity: 0.6;
          transition: all 0.3s ease;
          pointer-events: none;
        }
        .recharging-active .background-grid {
          background-size: 21px 21px;
          opacity: 0.1;
          transition: all 0.8s ease;
        }
      `}</style>
      <div className="background-grid" />
      
      <header className="hero-card glass-card">
        <div>
          <p className="eyebrow">AI-Assisted Plant Operations</p>
          <h1>Chiller Energy Optimizer</h1>
          <p className="hero-copy">Optimize plant efficiency with real-time AI recommendations and granular component control.</p>
        </div>
        <div className="hero-meta">
          <div className="meta-pill"><span>Local Time</span><strong>{clock.toLocaleTimeString()}</strong></div>
          <div className="meta-pill"><span>Date</span><strong>{clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong></div>
        </div>
      </header>

      <main className="dashboard-grid-redesign">
        
        <div className="grid-row row-3-cols">
          <section className="glass-card panel-stack">
            <div className="section-title-row">
              <div><p className="section-label">Live Conditions</p><h2>Clock & Weather</h2></div>
              <span className={`status-pill ${weather.source === 'live' ? 'ok' : 'warn'}`}>
                {weather.loading ? 'Loading' : weather.source === 'live' ? 'Weather synced' : 'Manual mode'}
              </span>
            </div>
            <div className="weather-grid">
              <MetricCard label="Outdoor Temp" value={weather.temperature !== null ? `${weather.temperature.toFixed(1)}°C` : '--'} hint={weather.location} />
              <MetricCard label="Humidity" value={weather.humidity !== null ? `${weather.humidity.toFixed(0)}%` : '--'} />
              <MetricCard label="Wet Bulb" value={weather.wetBulb !== null ? `${weather.wetBulb.toFixed(1)}°C` : '--'} accent="#7fe6ff" />
            </div>
            <div className="weather-actions">
              <label className="toggle-row">
                <input type="checkbox" checked={useWeatherSuggestion} onChange={(e) => setUseWeatherSuggestion(e.target.checked)} />
                <span>Auto-sync wet bulb</span>
              </label>
            </div>
          </section>

          <section className="glass-card panel-stack">
            <div className="section-title-row"><div><p className="section-label">Quick Scenarios</p><h2>Presets</h2></div></div>
            <div className="preset-grid">
              {scenarioPresets.map(p => (
                <button key={p.label} className="preset-card" onClick={() => setInputs(p.values)}>
                  <span>{p.icon}</span><strong>{p.label}</strong>
                  <small>{p.values.load_tons} tons</small>
                </button>
              ))}
            </div>
          </section>

          <SystemStatusCard 
            chillersRunning={inputs.CHL_STA_1 + inputs.CHL_STA_2 + inputs.CHL_STA_3} 
            efficiency={result?.result?.currentEfficiency ?? 0.72} 
            faultCount={0} 
          />
        </div>

        <div className="grid-row row-2-cols">
          <section className="glass-card panel-stack input-panel">
            <div className="section-title-row">
              <div><p className="section-label">Baseline Inputs</p><h2>Current Operation</h2></div>
              <button className="primary-button" onClick={runOptimization} disabled={loading}>{loading ? 'Calculating...' : 'Get Recommendation'}</button>
            </div>
            <div className="inputs-grid">
              <RangeField label="Cooling Load" name="load_tons" value={inputs.load_tons} min={200} max={2500} step={10} suffix=" tons" onChange={updateInput} />
              <RangeField label="Wet Bulb" name="wet_bulb_c" value={inputs.wet_bulb_c} min={-5} max={35} step={0.1} suffix="°C" onChange={updateInput} />
              <RangeField label="Current Limit" name="current_limit_pct" value={inputs.current_limit_pct} min={50} max={100} step={1} suffix="%" onChange={updateInput} />
              <label className="field-card">
                <div className="field-heading"><span>Chillers Running</span><strong>{inputs.chillers_running}</strong></div>
                <select value={inputs.chillers_running} onChange={(e) => updateInput('chillers_running', Number(e.target.value))}>
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n} Chillers</option>)}
                </select>
              </label>
            </div>
            <div className="advanced-baseline-section">
              <p className="section-label" style={{ marginTop: '20px' }}>Baseline Chiller Settings</p>
              <div className="chiller-baseline-grid">
                {[1, 2, 3].map(id => <ChillerBaselineControl key={id} id={id} inputs={inputs} onChange={updateInput} />)}
              </div>
            </div>
          </section>

          <section className="glass-card panel-stack result-panel">
            <div className="section-title-row">
              <div><p className="section-label">Optimization Output</p><h2>AI Recommendations</h2></div>
              {recharging && <span className="recharging-indicator">⚡ RECHARGING...</span>}
              <span className="status-pill" style={{ backgroundColor: `${statusTone.color}22`, color: statusTone.color }}>{statusTone.label}</span>
            </div>
            {result ? (
              <div className={recharging ? 'recharging-content' : ''}>
                <div className="result-grid">
                  <div className="gauge-card">
                    <div className="gauge-shell" style={buildGaugeStyle(result.result.currentEfficiency)}>
                      <div className="gauge-core"><span>Current</span><strong>{result.result.currentEfficiency.toFixed(3)}</strong><small>kW/ton</small></div>
                    </div>
                  </div>
                  <div className="metrics-grid">
                    <MetricCard label="Current Power" value={`${result.result.currentTotalPower.toFixed(0)} kW`} accent="#ff6b7d" />
                    <MetricCard label="Optimal Power" value={`${result.result.optimalTotalPower.toFixed(0)} kW`} accent="#4be4a4" />
                    <MetricCard label="Improvement" value={`${result.result.improvementPercent.toFixed(1)}%`} accent="#53f2a8" />
                    <MetricCard label="Power Saved" value={`${result.result.powerSavedKw.toFixed(1)} kW`} accent="#7fe6ff" />
                  </div>
                </div>
                <div className="action-card"><p className="section-label">Operator Action</p><p>{result.result.operatorAction}</p></div>
                <div className="optimized-table-container">
                   <p className="section-label">Recommended Component Setpoints</p>
                   <table className="optimized-settings-table">
                     <thead><tr><th>Unit</th><th>Speed</th><th>Fan</th><th>Flow</th></tr></thead>
                     <tbody>
                       {[1, 2, 3].map(id => {
                         const s = result.result.recommended_settings;
                         if (s[`CHL_STA_${id}`] !== 1) return null;
                         return (
                           <tr key={id}>
                             <td>Chiller {id}</td>
                             <td>{s[`CHL_COMP_SPD_CTRL_${id}`]}%</td>
                             <td>{s[`CT_FAN_SPD_CTRL_${id}`]}%</td>
                             <td>{s[`CHL_CD_FLOW_${id}`]} GPM</td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                </div>
              </div>
            ) : <div className="empty-state"><p>No recommendation yet. Run the optimizer to see energy savings guidance.</p></div>}
            {error && <p className="error-banner">{error}</p>}
          </section>
        </div>

        <div className="grid-row row-full">
          <section className="glass-card panel-stack">
            <div className="section-title-row"><h2>History</h2></div>
            <div className="history-list">
              {history.map(item => (
                <div key={item.id} className="history-item">
                  <div><strong>{new Date(item.timestamp).toLocaleTimeString()}</strong><small>Load: {item.inputs.load_tons} tons</small></div>
                  <div className="history-metrics">
                    <strong style={{ color: '#53f2a8' }}>{item.result.powerSavedKw.toFixed(1)} kW saved</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
