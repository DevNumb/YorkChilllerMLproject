/**
 * York Chiller Optimizer - Frontend-Only Optimization Engine
 * Calls the Hugging Face /predict endpoint directly and performs scenario searching in JS.
 */

const OPTIMIZER_URL = 'https://DevNumb-MLYorkchillerOptimzer.hf.space/predict';

export interface PredictionInput {
  total_building_load: number;
  avg_chilled_water_rate: number;
  avg_cooling_water_temp: number;
  avg_outside_temp: number;
  avg_dew_point: number;
  avg_humidity: number;
  avg_wind_speed: number;
  avg_pressure: number;
  hour: number;
  day_of_week: number;
  month: number;
  day_of_year: number;
}

export interface OptimalConfiguration {
  chillers: number[];
  setpoint: number;
  kwPerTr: number;
  totalPower: number;
}

export interface SavingsResult {
  currentConfig: OptimalConfiguration;
  optimalConfig: OptimalConfiguration;
  powerSaved: number;
  improvementPercent: number;
  costSavingsPerHour: number;
  co2ReductionPerHour: number;
}

/**
 * Ensures inputs pass the remote ML model's strict validation rules.
 */
function buildValidatedPayload(
  load: number,
  wetBulb: number,
  setpoint: number,
  hour: number,
  month: number,
  weekend: number,
  activeChillers: number
): PredictionInput {
  // Clamping to satisfy model thresholds (observed from 422 errors)
  const modelLoad = Math.max(load, 401); // Load must be >= 400
  const rawRate = (modelLoad / activeChillers);
  const avgChilledWaterRate = rawRate < 200 ? 200 : (rawRate > 1000 ? 1000 : rawRate); // Rate must be >= 200
  const avgCoolingWaterTemp = Math.max(setpoint + 20, 20); // Temp must be >= 15
  
  // Weather proxies
  const avgOutsideTemp = Math.max(wetBulb * 1.5 + 52, 40);
  const avgDewPoint = Math.max(wetBulb * 1.35 + 35, 20);
  const avgHumidity = Math.min(Math.max(72 - (avgOutsideTemp - avgDewPoint) * 0.6, 20), 100);

  return {
    total_building_load: Number(modelLoad.toFixed(1)),
    avg_chilled_water_rate: Number(avgChilledWaterRate.toFixed(1)),
    avg_cooling_water_temp: Number(avgCoolingWaterTemp.toFixed(1)),
    avg_outside_temp: Number(avgOutsideTemp.toFixed(1)),
    avg_dew_point: Number(avgDewPoint.toFixed(1)),
    avg_humidity: Number(avgHumidity.toFixed(1)),
    avg_wind_speed: Number((6 + activeChillers * 1.2).toFixed(1)),
    avg_pressure: 29.92,
    hour: Math.min(Math.max(hour, 0), 23),
    day_of_week: weekend ? 0 : 1,
    month: Math.min(Math.max(month, 1), 12),
    day_of_year: Math.min(Math.max((month - 1) * 30 + 15, 1), 365),
  };
}

/**
 * Makes a single JSON POST request to the prediction API with retry logic.
 */
async function callPredictApi(payload: PredictionInput, retries = 2): Promise<number | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(OPTIMIZER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      if (response.ok) {
        const data = await response.json();
        const kw = data.kw_per_tr;
        console.log(`[API] Chillers: ${Math.round(payload.total_building_load / payload.avg_chilled_water_rate)}, Rate: ${payload.avg_chilled_water_rate}, Setpoint: ${payload.avg_cooling_water_temp - 20} → kW/TR: ${kw}`);
        return (typeof kw === 'number' && kw > 0) ? kw : null;
      } else if (response.status === 429) {
        const wait = 2000 * (i + 1);
        console.warn(`[Predict API] Rate limited (429). Retrying in ${wait}ms...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      } else {
        const error = await response.text();
        console.error(`[Predict API] Failed (${response.status}):`, error, payload);
        return null;
      }
    } catch (err: any) {
      if (err.name === 'TimeoutError' && i < retries) {
        const wait = 1000 * (i + 1);
        console.warn(`[Predict API] Timeout. Retrying in ${wait}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      }
      console.error('[Predict API] Request error:', err);
      return null;
    }
  }
  return null;
}

/**
 * Main optimization entry point called by the Dashboard.
 * Loops through scenarios and picks the best one with comfort zone constraint.
 */
export async function calculateSavings(
  load: number,
  wetBulb: number,
  hour: number,
  month: number,
  weekend: number,
  limit: number,
  currentChillers: number[] | number,
  currentSetpoint: number,
  fastMode = false
): Promise<SavingsResult | null> {
  // Fix: Correctly interpret current chiller count from input
  let currentCount: number;
  if (Array.isArray(currentChillers)) {
    if (currentChillers.length === 1 && currentChillers[0] >= 1 && currentChillers[0] <= 4) {
      currentCount = currentChillers[0];
    } else {
      currentCount = currentChillers.length;
    }
  } else {
    currentCount = currentChillers;
  }

  // 1. Get Baseline
  const currentPayload = buildValidatedPayload(load, wetBulb, currentSetpoint, hour, month, weekend, currentCount);
  const currentKwPerTr = await callPredictApi(currentPayload) || 0.6;
  const currentTotalPower = load * currentKwPerTr;

  // 2. Generate Scenarios with comfort zone constraint (±1°C from current setpoint)
  // Try all 4 chiller combinations with setpoints within comfort zone
  const comfortMin = Math.max(currentSetpoint - 1.0, 5.0);
  const comfortMax = Math.min(currentSetpoint + 1.0, 10.0);

  // Generate setpoints in 0.5°C increments within comfort zone
  const setpoints: number[] = [];
  for (let sp = comfortMin; sp <= comfortMax; sp += 0.5) {
    setpoints.push(Number(sp.toFixed(1)));
  }

  // Try all 4 chiller combinations
  const stagings = [1, 2, 3, 4];

  const scenarios: { count: number, setpoint: number, payload: PredictionInput }[] = [];
  const seen = new Set();

  for (const count of stagings) {
    for (const sp of setpoints) {
      const key = `${count}-${sp}`;
      if (seen.has(key)) continue;
      seen.add(key);

      scenarios.push({
        count,
        setpoint: sp,
        payload: buildValidatedPayload(load, wetBulb, sp, hour, month, weekend, count)
      });
    }
  }

  // 3. Call API in batches
  const batchSize = 4;
  const results: { count: number, setpoint: number, kwPerTr: number, totalPower: number }[] = [];

  console.log(`[Optimizer] Searching ${scenarios.length} scenarios within comfort zone [${comfortMin}°C - ${comfortMax}°C]...`);

  for (let i = 0; i < scenarios.length; i += batchSize) {
    const batch = scenarios.slice(i, i + batchSize);
    const batchPromises = batch.map(async (s) => {
      const kw = await callPredictApi(s.payload);
      if (kw !== null) {
        const totalPower = load * kw;
        return { count: s.count, setpoint: s.setpoint, kwPerTr: kw, totalPower };
      }
      return null;
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(r => { if (r) results.push(r); });

    if (i + batchSize < scenarios.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // 4. Find the best configuration (minimum power consumption)
  if (results.length === 0) {
    console.error('[Optimizer] All scenarios failed.');
    return null;
  }

  // Find best among all scenarios
  const best = results.reduce((prev, curr) => (curr.totalPower < prev.totalPower ? curr : prev), results[0]);

  // Calculate savings: always compare to current, even if current is best
  const bestTotalPower = best.totalPower;
  const powerSaved = currentTotalPower - bestTotalPower;
  const improvementPercent = currentTotalPower > 0 ? (powerSaved / currentTotalPower) * 100 : 0;

  console.log(`[Optimizer] Current: ${currentCount} chillers @ ${currentSetpoint}°C = ${currentTotalPower.toFixed(0)} kW`);
  console.log(`[Optimizer] Best: ${best.count} chillers @ ${best.setpoint}°C = ${bestTotalPower.toFixed(0)} kW (saved ${powerSaved.toFixed(1)} kW)`);

  // 5. Build Result
  const expandChillers = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  return {
    currentConfig: {
      chillers: expandChillers(currentCount),
      setpoint: currentSetpoint,
      kwPerTr: Number(currentKwPerTr.toFixed(3)),
      totalPower: Number(currentTotalPower.toFixed(1)),
    },
    optimalConfig: {
      chillers: expandChillers(best.count),
      setpoint: best.setpoint,
      kwPerTr: Number(best.kwPerTr.toFixed(3)),
      totalPower: Number(bestTotalPower.toFixed(1)),
    },
    powerSaved: Number(powerSaved.toFixed(1)),
    improvementPercent: Number(improvementPercent.toFixed(1)),
    costSavingsPerHour: Number((powerSaved * 0.12).toFixed(2)),
    co2ReductionPerHour: Number((powerSaved * 0.42).toFixed(1)),
  };
}

/**
 * Formats a list of chillers for display (e.g. [1, 2] -> "1, 2")
 */
export function formatChillerStageLabel(chillers: number[]): string {
  return Array.isArray(chillers) ? chillers.join(', ') : String(chillers);
}
