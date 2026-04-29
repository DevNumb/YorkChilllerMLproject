const DASHBOARD_CONTEXT_KEY = 'chiller-dashboard-context-v1';

function safeJsonParse(value) {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.slice(0, 10).map((entry) => ({
    timestamp: entry?.timestamp || null,
    coolingLoadTons: entry?.inputs?.load_tons ?? null,
    wetBulbC: entry?.inputs?.wet_bulb_c ?? null,
    currentChwSetpointC: entry?.inputs?.current_chw_setpoint_c ?? null,
    currentLimitPct: entry?.inputs?.current_limit_pct ?? null,
    hour: entry?.inputs?.hour ?? null,
    month: entry?.inputs?.month ?? null,
    isWeekend: entry?.inputs?.is_weekend === 1,
    chillersRunning: entry?.inputs?.chillers_running ?? null,
    currentEfficiencyKwPerTon: entry?.result?.currentEfficiency ?? null,
    optimalEfficiencyKwPerTon: entry?.result?.optimalEfficiency ?? null,
    improvementPercent: entry?.result?.improvementPercent ?? null,
    energySavingsKwh: entry?.result?.energySavingsKwh ?? null,
    costSavingsUsd: entry?.result?.costSavingsUsd ?? null,
    co2ReductionKg: entry?.result?.co2ReductionKg ?? null,
    recommendedSetpointC: entry?.result?.recommendedSetpoint ?? null,
    operatorAction: entry?.result?.operatorAction || '',
  }));
}

function normalizeDashboardContext(value) {
  if (!value || typeof value !== 'object') {
    return {
      liveConditions: null,
      optimizationInputs: null,
      optimizationHistory: [],
      faultDetection: { activeFaults: 0, alerts: [] },
      systemMetrics: null,
      capturedAt: null,
    };
  }

  return {
    liveConditions: value.liveConditions || null,
    optimizationInputs: value.optimizationInputs || null,
    optimizationHistory: normalizeHistory(value.optimizationHistory),
    faultDetection: value.faultDetection || { activeFaults: 0, alerts: [] },
    systemMetrics: value.systemMetrics || null,
    capturedAt: value.capturedAt || null,
  };
}

export function getDashboardContext() {
  if (typeof window === 'undefined') {
    return normalizeDashboardContext(null);
  }

  const storedContext = window.__DASHBOARD_CONTEXT__ || safeJsonParse(window.localStorage.getItem(DASHBOARD_CONTEXT_KEY));
  return normalizeDashboardContext(storedContext);
}

export function readDashboardContextStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return getDashboardContext();
}

export function DASHBOARD_CONTEXT_STORAGE_KEY() {
  return DASHBOARD_CONTEXT_KEY;
}
