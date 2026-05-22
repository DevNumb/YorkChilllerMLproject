import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/supabaseAuthService';

export default function FaultDetection() {
  const [user, setUser] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsProgress, setDiagnosticsProgress] = useState(0);
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

  const runDiagnostics = () => {
    setIsRunningDiagnostics(true);
    setDiagnosticsProgress(0);
    
    const interval = setInterval(() => {
      setDiagnosticsProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRunningDiagnostics(false);
          // Add a mock new fault
          const newFault = {
            id: faults.length + 1,
            type: 'Flow Deviation',
            component: 'Chilled Water Loop',
            severity: 'Low',
            status: 'Active',
            timestamp: new Date().toLocaleString()
          };
          setFaults([newFault, ...faults]);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

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
              <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
                Run a comprehensive diagnostic scan across all sensors and mechanical components 
                to detect patterns indicative of impending failure or operational inefficiency.
              </p>
              
              {isRunningDiagnostics ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem' }}>Scanning system components...</span>
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
              <span className="last-update">Last scan: Today at 09:45 AM</span>
              <span className="efficiency-badge" style={{ background: 'rgba(75, 228, 164, 0.1)', color: '#4be4a4' }}>System Stable</span>
            </div>
          </div>

          {/* Health Metrics */}
          <div className="system-status-card glass-card">
            <div className="system-status-header">
              <p className="section-label">Health Metrics</p>
              <h2>Anomaly Scores</h2>
            </div>
            <div className="system-status-grid" style={{ gap: '12px' }}>
              {[
                { label: 'Thermal Efficiency', value: 98, trend: 'stable' },
                { label: 'Compressor Vibration', value: 85, trend: 'warning' },
                { label: 'Pressure Stability', value: 92, trend: 'stable' },
                { label: 'Sensor Reliability', value: 95, trend: 'stable' }
              ].map((metric, i) => (
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
