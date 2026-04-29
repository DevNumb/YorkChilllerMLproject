function normalizeWeather(weather) {
  if (!weather) {
    return null;
  }

  return {
    location: weather.location || 'Unknown site',
    source: weather.source || 'manual',
    outdoorTemperatureC: weather.temperature ?? null,
    humidityPct: weather.humidity ?? null,
    wetBulbC: weather.wetBulb ?? null,
    weatherError: weather.error || '',
  };
}

function normalizeInputs(inputs) {
  if (!inputs) {
    return null;
  }

  return {
    coolingLoadTons: inputs.load_tons ?? null,
    wetBulbC: inputs.wet_bulb_c ?? null,
    currentChwSetpointC: inputs.current_chw_setpoint_c ?? null,
    currentLimitPct: inputs.current_limit_pct ?? null,
    hour: inputs.hour ?? null,
    month: inputs.month ?? null,
    isWeekend: inputs.is_weekend === undefined ? null : Boolean(inputs.is_weekend),
    chillersRunning: inputs.chillers_running ?? null,
  };
}

function normalizeRecommendation(result) {
  if (!result?.result) {
    return null;
  }

  return {
    timestamp: result.timestamp || null,
    currentEfficiencyKwPerTon: result.result.currentEfficiency ?? null,
    optimalEfficiencyKwPerTon: result.result.optimalEfficiency ?? null,
    improvementPercent: result.result.improvementPercent ?? null,
    energySavingsKwh: result.result.energySavingsKwh ?? null,
    costSavingsUsd: result.result.costSavingsUsd ?? null,
    co2ReductionKg: result.result.co2ReductionKg ?? null,
    recommendedSetpointC: result.result.recommendedSetpoint ?? null,
    operatorAction: result.result.operatorAction || '',
  };
}

export function buildAssistantContext({ weather, inputs, result }) {
  return {
    liveConditions: normalizeWeather(weather),
    optimizationInputs: normalizeInputs(inputs),
    lastRecommendation: normalizeRecommendation(result),
    capturedAt: new Date().toISOString(),
  };
}
