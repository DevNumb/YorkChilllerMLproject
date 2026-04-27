function formatWeather(weather) {
  return {
    location: weather?.location || 'Unknown',
    source: weather?.source || 'manual',
    outdoorTemperatureC: weather?.temperature ?? null,
    humidityPct: weather?.humidity ?? null,
    wetBulbC: weather?.wetBulb ?? null,
    weatherError: weather?.error || '',
  };
}

function formatInputs(inputs) {
  if (!inputs) {
    return null;
  }

  return {
    coolingLoadTons: inputs.load_tons,
    wetBulbC: inputs.wet_bulb_c,
    currentChwSetpointC: inputs.current_chw_setpoint_c,
    currentLimitPct: inputs.current_limit_pct,
    hour: inputs.hour,
    month: inputs.month,
    isWeekend: Boolean(inputs.is_weekend),
    chillersRunning: inputs.chillers_running,
  };
}

function formatRecommendation(result) {
  if (!result?.result) {
    return null;
  }

  return {
    timestamp: result.timestamp || null,
    currentEfficiencyKwPerTon: result.result.currentEfficiency,
    optimalEfficiencyKwPerTon: result.result.optimalEfficiency,
    improvementPercent: result.result.improvementPercent,
    energySavingsKwh: result.result.energySavingsKwh,
    costSavingsUsd: result.result.costSavingsUsd,
    co2ReductionKg: result.result.co2ReductionKg,
    recommendedSetpointC: result.result.recommendedSetpoint,
    operatorAction: result.result.operatorAction,
  };
}

export function buildAssistantContext({ weather, inputs, result }) {
  return {
    liveConditions: formatWeather(weather),
    optimizationInputs: formatInputs(inputs),
    lastRecommendation: formatRecommendation(result),
  };
}
