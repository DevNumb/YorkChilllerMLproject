import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/supabaseAuthService';
import { saveFaultDetectionHistory } from '../services/supabaseDashboardService';

export default function FaultDetection() {
  const [user, setUser] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsProgress, setDiagnosticsProgress] = useState(0);
  const [systemStatus, setSystemStatus] = useState('System Stable');
  const [lastScanTime, setLastScanTime] = useState('Today at 09:45 AM');
  
  // ML Input States
  const [coolingLoad, setCoolingLoad] = useState(1200);
  const [wetBulb, setWetBulb] = useState(17.1);
  const [chiller1, setChiller1] = useState({ speed: 85, fan: 65, flow: 280 });
  const [chiller2, setChiller2] = useState({ speed: 80, fan: 60, flow: 270 });
  const [chiller3, setChiller3] = useState({ speed: 75, fan: 55, flow: 260 });

  // Anomaly Scores
  const [anomalyScores, setAnomalyScores] = useState([
    { label: 'Thermal Efficiency', value: 98, trend: 'stable' },
    { label: 'Compressor Vibration', value: 85, trend: 'warning' },
    { label: 'Pressure Stability', value: 92, trend: 'stable' },
    { label: 'Sensor Reliability', value: 95, trend: 'stable' }
  ]);

  const [faults, setFaults] = useState([
    { id: 1, type: 'Sensor Anomaly', component: 'Chiller 1 - Discharge Temp', severity: 'Medium', status: 'Active', timestamp: new Date(Date.now() - 3600000).toLocaleString() },
    { id: 2, type: 'Efficiency Drop', component: 'Chiller 3 - Heat Exchanger', severity: 'High', status: 'Investigating', timestamp: new Date(Date.now() - 86400000).toLocaleString() },
    { id: 3, type: 'Vibration Alert', component: 'Condenser Pump 2', severity: 'Low', status: 'Resolved', timestamp: new Date(Date.now() - 172800000).toLocaleString() },
  ]);

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error('[FaultDetection] Failed to load user:', err);
      }
    }
    loadUser();
  }, []);

  const getSeverityColor = (severity) => {
    switch (severity.toLowerCase()) {
      case 'high': return '#ff6b7d';
      case 'medium': return '#ffb37e';
      case 'low': return '#f7df72';
      default: return '#9ab2c8';
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return '#ff6b7d';
      case 'investigating': return '#64d6ff';
      case 'resolved': return '#4be4a4';
      default: return '#9ab2c8';
    }
  };

  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 24px';
    toast.style.background = '#ff6b7d';
    toast.style.color = 'white';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = 'bold';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  };

  const callFaultDetectionAPI = async (isRetry = false) => {
    const BASE_URL = 'https://devnumb-fault.hf.space/gradio_api/call/predict/';
    
    const payload = {
      cooling_load: Number(coolingLoad),
      wet_bulb: Number(wetBulb),
      units: [
        { speed: Number(chiller1.speed), fan: Number(chiller1.fan), flow: Number(chiller1.flow) },
        { speed: Number(chiller2.speed), fan: Number(chiller2.fan), flow: Number(chiller2.flow) },
        { speed: Number(chiller3.speed), fan: Number(chiller3.fan), flow: Number(chiller3.flow) }
      ]
    };

    console.log('[FaultDetection] Calling ML API with payload:', payload);

    try {
      // Step 1: POST to get event_id
      const postRes = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [JSON.stringify(payload)] })
      });

      if (!postRes.ok) throw new Error('Network error');
      const { event_id } = await postRes.json();
      console.log('[FaultDetection] Received event_id:', event_id);
      setDiagnosticsProgress(20);

      // Step 2: Poll for results via GET
      let result = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (!result && attempts < maxAttempts) {
        attempts++;
        setDiagnosticsProgress(Math.min(20 + (attempts * 3), 95));
        
        const pollRes = await fetch(`${BASE_URL}${event_id}`);
        if (pollRes.ok) {
          const text = await pollRes.text();
          if (text.includes('data:')) {
            const dataParts = text.split('data:');
            for (let i = dataParts.length - 1; i >= 1; i--) {
              try {
                const chunk = dataParts[i].split('\n')[0].trim();
                const parsedData = JSON.parse(chunk);
                if (Array.isArray(parsedData) && parsedData[0] && (parsedData[0].prediction || parsedData[0].fault_score !== undefined)) {
                  result = parsedData[0];
                  console.log('[FaultDetection] Successfully polled model result:', result);
                  break;
                }
              } catch (e) {}
            }
          }
        }
        
        if (!result) await new Promise(r => setTimeout(r, 1000));
      }

      if (!result) throw new Error('Timeout');
      return result;

    } catch (err) {
      console.error('[FaultDetection] API error:', err);
      if (!isRetry && (err.message === 'Timeout' || err.message === 'Network error')) {
        console.log('[FaultDetection] Retrying scan...');
        return await callFaultDetectionAPI(true);
      }
      throw err;
    }
  };

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticsProgress(10);
    console.log('[FaultDetection] Starting diagnostics scan...');
    
    try {
      const result = await callFaultDetectionAPI();
      setDiagnosticsProgress(100);
      
      const now = new Date();
      setLastScanTime(`Today at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

      console.log('[FaultDetection] Model Prediction:', result.prediction, 'Score:', result.fault_score);

      // Persist to Supabase
      try {
        await saveFaultDetectionHistory({
          cooling_load: coolingLoad,
          wet_bulb: wetBulb,
          chiller_data: { chiller1, chiller2, chiller3 },
          prediction: result.prediction,
          fault_score: result.fault_score
        });
        console.log('[FaultDetection] Saved scan results to database');
      } catch (dbErr) {
        console.error('[FaultDetection] Database save failed:', dbErr);
      }

      if (result && result.prediction === 'Fault') {
        const newFault = {
          id: Date.now(),
          type: 'ML Detection: Fault',
          component: 'System Wide Analysis',
          severity: Math.abs(result.fault_score) > 0.5 ? 'High' : 'Medium',
          status: 'Active',
          timestamp: now.toLocaleString()
        };
        setFaults([newFault, ...faults]);
        setSystemStatus('Fault Detected');
        
        setAnomalyScores(prev => prev.map(s => ({
          ...s,
          value: Math.max(30, s.value - 20),
          trend: 'warning'
        })));
      } else {
        setSystemStatus('System Stable');
        setAnomalyScores(prev => prev.map(s => ({
          ...s,
          value: Math.min(98, s.value + 2),
          trend: 'stable'
        })));
      }
    } catch (err) {
      console.error('[FaultDetection] Diagnostic Scan Failed:', err);
      showToast('Scan failed');
    } finally {
      setTimeout(() => setIsRunningDiagnostics(false), 800);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="background-grid"></div>
      
      <div className="hero-card glass-card">
        <div className="hero-content">
          <p className="eyebrow">System Diagnostics</p>
          <h1>Fault Detection & Analysis</h1>
          <p className="hero-copy">
            AI-powered anomaly detection for your chiller plant. Monitor system health, 
            identify potential failures before they occur, and optimize maintenance schedules.
          </p>
        </div>
        <div className="hero-meta">
          <div className="meta-pill">
            <span>Overall Health</span>
            <strong style={{ color: '#4be4a4' }}>94%</strong>
          </div>
          <div className="meta-pill">
            <span>Active Faults</span>
            <strong style={{ color: '#ff6b7d' }}>{faults.filter(f => f.status !== 'Resolved').length}</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-redesign">
        <div className="grid-row row-2-cols">
          {/* Diagnostics Control */}
          <div className="system-status-card glass-card">
            <div className="system-status-header">
              <p className="section-label">Diagnostic Tools</p>
              <h2>System Scan</h2>
            </div>
            <div className="system-status-grid">
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Input system parameters for real-time ML fault detection.
                </p>
                
                {/* Global Parameters */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cooling Load</label>
                    <input 
                      type="number" 
                      value={coolingLoad} 
                      onChange={(e) => setCoolingLoad(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Wet Bulb</label>
                    <input 
                      type="number" 
                      value={wetBulb} 
                      onChange={(e) => setWetBulb(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                {/* Chiller Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { id: 1, state: chiller1, setter: setChiller1 },
                    { id: 2, state: chiller2, setter: setChiller2 },
                    { id: 3, state: chiller3, setter: setChiller3 }
                  ].map((ch) => (
                    <div key={ch.id} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--muted)' }}>Chiller Unit {ch.id}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', display: 'block' }}>Speed</label>
                          <input type="number" value={ch.state.speed} onChange={(e) => ch.setter({...ch.state, speed: e.target.value})} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white', padding: '4px', fontSize: '0.8rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', display: 'block' }}>Fan</label>
                          <input type="number" value={ch.state.fan} onChange={(e) => ch.setter({...ch.state, fan: e.target.value})} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white', padding: '4px', fontSize: '0.8rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', display: 'block' }}>Flow</label>
                          <input type="number" value={ch.state.flow} onChange={(e) => ch.setter({...ch.state, flow: e.target.value})} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white', padding: '4px', fontSize: '0.8rem' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {isRunningDiagnostics ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Analyzing system patterns...</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{diagnosticsProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${diagnosticsProgress}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #64d6ff, #4be4a4)',
                        transition: 'width 0.3s ease'
                      }} 
                    />
                  </div>
                </div>
              ) : (
                <button 
                  className="primary-button" 
                  onClick={runDiagnostics}
                  style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem' }}
                >
                  🚀 Run Full Diagnostics Scan
                </button>
              )}
            </div>
            <div className="system-status-footer">
              <span className="last-update">Last scan: {lastScanTime}</span>
              <span className="efficiency-badge" style={{ 
                background: systemStatus === 'System Stable' ? 'rgba(75, 228, 164, 0.1)' : 'rgba(255, 107, 125, 0.1)', 
                color: systemStatus === 'System Stable' ? '#4be4a4' : '#ff6b7d' 
              }}>
                {systemStatus}
              </span>
            </div>
          </div>

          {/* Health Metrics */}
          <div className="system-status-card glass-card">
            <div className="system-status-header">
              <p className="section-label">Health Metrics</p>
              <h2>Anomaly Scores</h2>
            </div>
            <div className="system-status-grid" style={{ gap: '12px' }}>
              {anomalyScores.map((metric, i) => (
                <div key={i} className="status-item" style={{ padding: '12px 16px' }}>
                  <div className="status-info" style={{ flex: 1 }}>
                    <span className="status-label">{metric.label}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span className="status-value">{metric.value}%</span>
                      <span style={{ fontSize: '0.75rem', color: metric.trend === 'warning' ? '#ffb37e' : '#4be4a4' }}>
                        {metric.trend === 'warning' ? '↑ Increasing Risk' : '✓ Normal'}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                    <div style={{ width: `${metric.value}%`, height: '100%', background: metric.value > 90 ? '#4be4a4' : '#f7df72', borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fault List */}
        <div className="system-status-card glass-card">
          <div className="system-status-header">
            <p className="section-label">Alert History</p>
            <h2>Detected Faults & Anomalies</h2>
          </div>
          
          <div className="optimized-table-container">
            <table className="optimized-settings-table">
              <thead>
                <tr>
                  <th>Fault Type</th>
                  <th>Component</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Detected At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faults.map((fault) => (
                  <tr key={fault.id}>
                    <td>{fault.type}</td>
                    <td>{fault.component}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold',
                        background: `${getSeverityColor(fault.severity)}20`,
                        color: getSeverityColor(fault.severity),
                        border: `1px solid ${getSeverityColor(fault.severity)}40`
                      }}>
                        {fault.severity}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold',
                        background: `${getStatusColor(fault.status)}20`,
                        color: getStatusColor(fault.status),
                        border: `1px solid ${getStatusColor(fault.status)}40`
                      }}>
                        {fault.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{fault.timestamp}</td>
                    <td>
                      <button className="ghost-button" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
