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

function parseNumberFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const match = text.match(/-?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

function searchDomForData() {
  const debugInfo = [];
  const result = {
    liveConditions: {
      outdoorTemp: null,
      humidity: null,
      wetBulb: null,
      dataSource: null,
    },
    operatingPoint: {
      coolingLoad: null,
      currentSetpoint: null,
      chillersRunning: null,
    },
    parsingSuccess: false,
    debugInfo: '',
  };

  try {
    debugInfo.push('🔍 Searching for outdoor temperature...');
    const allElements = document.querySelectorAll('*');
    let foundTemp = false;
    let foundHumidity = false;
    let foundWetBulb = false;
    let foundLoad = false;
    let foundSetpoint = false;
    let foundChillers = false;

    for (const el of allElements) {
      const text = el.textContent || '';
      const lowerText = text.toLowerCase();

      if (!foundTemp && (lowerText.includes('outdoor temperature') || lowerText.includes('temperature') || lowerText.includes('°c')) && text.match(/\d+\.\d+.*°C/)) {
        const temp = parseNumberFromText(text);
        if (temp !== null && temp > -20 && temp < 60) {
          result.liveConditions.outdoorTemp = temp;
          result.liveConditions.dataSource = 'dom';
          debugInfo.push(`✅ Found: ${temp}°C from DOM`);
          foundTemp = true;
        }
      }

      if (!foundHumidity && (lowerText.includes('humidity') || lowerText.includes('%')) && text.match(/\d+.*%/)) {
        const hum = parseNumberFromText(text);
        if (hum !== null && hum >= 0 && hum <= 100) {
          result.liveConditions.humidity = hum;
          debugInfo.push(`✅ Found: ${hum}% humidity from DOM`);
          foundHumidity = true;
        }
      }

      if (!foundWetBulb && (lowerText.includes('wet bulb') || lowerText.includes('wetbulb'))) {
        const wb = parseNumberFromText(text);
        if (wb !== null && wb > -10 && wb < 40) {
          result.liveConditions.wetBulb = wb;
          debugInfo.push(`✅ Found: ${wb}°C wet bulb from DOM`);
          foundWetBulb = true;
        }
      }

      if (!foundLoad && (lowerText.includes('cooling load') || lowerText.includes('load') || lowerText.includes('tons'))) {
        const load = parseNumberFromText(text);
        if (load !== null && load > 0 && load < 3000) {
          result.operatingPoint.coolingLoad = load;
          debugInfo.push(`✅ Found: ${load} tons from DOM`);
          foundLoad = true;
        }
      }

      if (!foundSetpoint && (lowerText.includes('setpoint') || lowerText.includes('chw'))) {
        const setpoint = parseNumberFromText(text);
        if (setpoint !== null && setpoint > 0 && setpoint < 20) {
          result.operatingPoint.currentSetpoint = setpoint;
          debugInfo.push(`✅ Found: ${setpoint}°C setpoint from DOM`);
          foundSetpoint = true;
        }
      }

      if (!foundChillers && (lowerText.includes('chiller') || lowerText.includes('running'))) {
        const chillers = parseNumberFromText(text);
        if (chillers !== null && chillers >= 0 && chillers <= 10) {
          result.operatingPoint.chillersRunning = chillers;
          debugInfo.push(`✅ Found: ${chillers} chillers from DOM`);
          foundChillers = true;
        }
      }
    }

    if (!foundTemp) {
      debugInfo.push('❌ Not found: outdoor temperature');
    }
    if (!foundHumidity) {
      debugInfo.push('❌ Not found: humidity');
    }
    if (!foundWetBulb) {
      debugInfo.push('❌ Not found: wet bulb');
    }

    result.parsingSuccess = foundTemp || foundHumidity || foundWetBulb;
    result.debugInfo = debugInfo.join(' | ');
  } catch (err) {
    result.debugInfo = `DOM search error: ${err.message}`;
    debugInfo.push(`❌ DOM search failed: ${err.message}`);
  }

  return result;
}

function searchFromWindowVariables() {
  const debugInfo = [];

  try {
    if (window.__DASHBOARD_CONTEXT__) {
      debugInfo.push('✅ Found context from window.__DASHBOARD_CONTEXT__');
      return { data: window.__DASHBOARD_CONTEXT__, source: 'window', debugInfo };
    }

    if (window.__REACT_STATE__) {
      debugInfo.push('✅ Found context from window.__REACT_STATE__');
      return { data: window.__REACT_STATE__, source: 'react-state', debugInfo };
    }

    const keys = Object.keys(window).filter(k => k.toLowerCase().includes('dashboard') || k.toLowerCase().includes('chiller') || k.toLowerCase().includes('context'));
    for (const key of keys) {
      if (window[key] && typeof window[key] === 'object') {
        debugInfo.push(`✅ Found data from window.${key}`);
        return { data: window[key], source: key, debugInfo };
      }
    }

    debugInfo.push('❌ No window variables found');
  } catch (err) {
    debugInfo.push(`❌ Window search error: ${err.message}`);
  }

  return { data: null, source: null, debugInfo };
}

function searchFromLocalStorage() {
  const debugInfo = [];

  try {
    const keysToTry = [
      'chiller-dashboard-context-v1',
      'chiller-optimizer-history-v1',
      'chiller-optimizer-context',
      'dashboard-state',
      'optimization-context',
    ];

    for (const key of keysToTry) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = safeJsonParse(stored);
        if (parsed && typeof parsed === 'object') {
          debugInfo.push(`✅ Found context from localStorage[${key}]`);
          return { data: parsed, source: 'localStorage', debugInfo };
        }
      }
    }

    debugInfo.push('❌ No localStorage data found');
  } catch (err) {
    debugInfo.push(`❌ localStorage search error: ${err.message}`);
  }

  return { data: null, source: null, debugInfo };
}

export function getDashboardContext() {
  if (typeof window === 'undefined') {
    return normalizeDashboardContext(null);
  }

  console.log('🔍 Starting dashboard context search...');

  const windowResult = searchFromWindowVariables();
  if (windowResult.data) {
    console.log('✅ Found data from window variables');
    return normalizeDashboardContext(windowResult.data);
  }

  const storageResult = searchFromLocalStorage();
  if (storageResult.data) {
    console.log('✅ Found data from localStorage');
    return normalizeDashboardContext(storageResult.data);
  }

  console.log('⚠️ Falling back to DOM search...');
  const domResult = searchDomForData();
  if (domResult.parsingSuccess) {
    console.log('✅ Found data from DOM');
    return {
      liveConditions: {
        location: 'Current site',
        source: domResult.liveConditions.dataSource || 'dom',
        outdoorTemperatureC: domResult.liveConditions.outdoorTemp,
        humidityPct: domResult.liveConditions.humidity,
        wetBulbC: domResult.liveConditions.wetBulb,
        weatherError: '',
      },
      optimizationInputs: {
        coolingLoadTons: domResult.operatingPoint.coolingLoad,
        currentChwSetpointC: domResult.operatingPoint.currentSetpoint,
        chillersRunning: domResult.operatingPoint.chillersRunning,
      },
      optimizationHistory: [],
      faultDetection: { activeFaults: 0, alerts: [] },
      systemMetrics: null,
      capturedAt: new Date().toISOString(),
    };
  }

  console.log('❌ No dashboard data found via any method');

  return normalizeDashboardContext(null);
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
