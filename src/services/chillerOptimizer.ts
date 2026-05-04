const OPTIMIZER_URL = import.meta.env.VITE_OPTIMIZER_URL || 'https://DevNumb-MLYorkchillerOptimzer.hf.space';

export interface ChillerCombination {
  chillers: number[];
  count: number;
}

export interface SetpointOption {
  value: number;
  label: string;
}

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

export interface DashboardOptimizerInput {
  load_tons: number;
  wet_bulb_c: number;
  current_chw_setpoint_c: number;
  current_limit_pct: number;
  hour: number;
  month: number;
  is_weekend: number;
  chillers_running: number;
}

export interface PredictionResult {
  kw_per_tr: number;
  total_power_kw: number;
  efficiency: number;
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

function normalizeOptimizerBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildOptimizerCandidates(url: string): string[] {
  const normalized = normalizeOptimizerBaseUrl(url);
  if (normalized.endsWith('/optimize') || normalized.endsWith('/predict')) {
    return [normalized];
  }
  return [`${normalized}/predict`, `${normalized}/optimize`];
}

function findNumericField(source: any, patterns: string[]): number | null {
  const extractNumericValue = (value: any): number | null => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const direct = Number(value);
      if (!Number.isNaN(direct)) {
        return direct;
      }

      const matched = value.match(/-?\d+(\.\d+)?/);
      if (matched) {
        const parsed = Number(matched[0]);
        return Number.isNaN(parsed) ? null : parsed;
      }
    }

    return null;
  };

  const flattenEntries = (value: any, parentKey = '', entries: Array<[string, any]> = []): Array<[string, any]> => {
    if (value === null || value === undefined) return entries;
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
  };

  const entries = flattenEntries(source);
  const normalizedPatterns = patterns.map((p) => p.toLowerCase());

  for (const [key, value] of entries) {
    const numericValue = extractNumericValue(value);
    if (numericValue === null) continue;
    if (normalizedPatterns.some((pattern) => key.includes(pattern))) {
      return numericValue;
    }
  }
  return null;
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getAllChillerCombinations(): ChillerCombination[] {
  const combinations: ChillerCombination[] = [];

  combinations.push({ chillers: [1], count: 1 });
  combinations.push({ chillers: [2], count: 1 });
  combinations.push({ chillers: [3], count: 1 });
  combinations.push({ chillers: [4], count: 1 });

  combinations.push({ chillers: [1, 2], count: 2 });
  combinations.push({ chillers: [1, 3], count: 2 });
  combinations.push({ chillers: [1, 4], count: 2 });
  combinations.push({ chillers: [2, 3], count: 2 });
  combinations.push({ chillers: [2, 4], count: 2 });
  combinations.push({ chillers: [3, 4], count: 2 });

  combinations.push({ chillers: [1, 2, 3], count: 3 });
  combinations.push({ chillers: [1, 2, 4], count: 3 });
  combinations.push({ chillers: [1, 3, 4], count: 3 });
  combinations.push({ chillers: [2, 3, 4], count: 3 });

  combinations.push({ chillers: [1, 2, 3, 4], count: 4 });

  return combinations;
}

export function getAllSetpoints(): SetpointOption[] {
  const setpoints: SetpointOption[] = [];
  for (let i = 5.0; i <= 10.0; i += 0.5) {
    setpoints.push({
      value: round(i, 1),
      label: `${round(i, 1)}°C`,
    });
  }
  return setpoints;
}

export function buildPredictionInput(
  load: number,
  wetBulb: number,
  setpoint: number,
  hour: number,
  month: number,
  weekend: number,
  limit: number,
  chillers: number[]
): PredictionInput {
  const avgOutsideTemp = clamp(Math.max(32, round(wetBulb * 1.5 + 12, 1)), 32, 60);
  const avgDewPoint = clamp(Math.max(20, round(wetBulb + 2, 1)), 20, 40);
  const avgChilledWaterRate = clamp(round(Math.max(50, load / 20), 1), 50, 200);
  const avgCoolingWaterTemp = clamp(round(setpoint + 1, 1), 5, 35);
  const avgHumidity = clamp(60, 20, 100);
  const avgWindSpeed = clamp(5, 0, 30);
  const avgPressure = 30;
  const dayOfWeek = weekend ? 0 : 1;
  const dayOfYear = clamp(Math.max(1, Math.round((month - 1) * 30 + 15)), 1, 365);

  return {
    total_building_load: round(load, 1),
    avg_chilled_water_rate: avgChilledWaterRate,
    avg_cooling_water_temp: avgCoolingWaterTemp,
    avg_outside_temp: avgOutsideTemp,
    avg_dew_point: avgDewPoint,
    avg_humidity: avgHumidity,
    avg_wind_speed: avgWindSpeed,
    avg_pressure: avgPressure,
    hour: clamp(hour, 0, 23),
    day_of_week: clamp(dayOfWeek, 0, 6),
    month: clamp(month, 1, 12),
    day_of_year: dayOfYear,
  };
}

export function buildDashboardPredictionInput(inputs: DashboardOptimizerInput): PredictionInput {
  return buildPredictionInput(
    inputs.load_tons,
    inputs.wet_bulb_c,
    inputs.current_chw_setpoint_c,
    inputs.hour,
    inputs.month,
    inputs.is_weekend,
    inputs.current_limit_pct,
    expandChillerSelection(inputs.chillers_running),
  );
}

function expandChillerSelection(chillers: number[] | number): number[] {
  if (Array.isArray(chillers)) {
    if (chillers.length === 1 && Number.isInteger(chillers[0]) && chillers[0] >= 1 && chillers[0] <= 4) {
      return Array.from({ length: chillers[0] }, (_, index) => index + 1);
    }

    return [...new Set(chillers)]
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 4)
      .sort((a, b) => a - b);
  }

  const count = clamp(Math.round(chillers), 1, 4);
  return Array.from({ length: count }, (_, index) => index + 1);
}

function buildOrderedCandidates(path: 'predict' | 'optimize'): string[] {
  const normalized = normalizeOptimizerBaseUrl(OPTIMIZER_URL);
  if (normalized.endsWith('/predict') || normalized.endsWith('/optimize')) {
    return [normalized];
  }

  return path === 'optimize'
    ? [`${normalized}/optimize`, `${normalized}/predict`]
    : [`${normalized}/predict`, `${normalized}/optimize`];
}

async function fetchOptimizerResponse(inputs: PredictionInput, preferredPath: 'predict' | 'optimize' = 'predict'): Promise<any | null> {
  const candidates = buildOrderedCandidates(preferredPath);

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

export async function predictKwPerTr(inputs: PredictionInput): Promise<number | null> {
  const result = await fetchOptimizerResponse(inputs, 'predict');
  if (!result) {
    return null;
  }

  const kwPerTr = findNumericField(result, [
    'kw_per_tr',
    'current_kw_per_tr',
    'optimal_kw_per_tr',
    'efficiency',
    'efficiency_rating',
  ]);

  if (kwPerTr !== null && kwPerTr > 0.1 && kwPerTr < 1.5) {
    return round(kwPerTr, 3);
  }

  return null;
}

function calculateStageAdjustedTotalPower(load: number, kwPerTr: number, chillers: number[]): number {
  const activeChillers = Math.max(chillers.length, 1);
  const basePower = load * kwPerTr;
  const loadPerChiller = load / activeChillers;
  const targetLoadPerChiller = 500;

  const lowLoadPenalty = loadPerChiller < 300 ? ((300 - loadPerChiller) / 300) * 0.18 : 0;
  const highLoadPenalty = loadPerChiller > 700 ? ((loadPerChiller - 700) / 700) * 0.12 : 0;
  const balancePenalty = Math.abs(loadPerChiller - targetLoadPerChiller) / targetLoadPerChiller * 0.03;
  const stageFactor = 1 + lowLoadPenalty + highLoadPenalty + balancePenalty;

  return round(basePower * stageFactor, 1);
}

export function filterCombinationsByLoad(load: number, combinations: ChillerCombination[]): ChillerCombination[] {
  if (load < 400) {
    return combinations.filter((c) => c.count === 1);
  }
  if (load < 800) {
    return combinations.filter((c) => c.count <= 2);
  }
  if (load < 1200) {
    return combinations.filter((c) => c.count <= 3);
  }
  return combinations;
}

export async function findOptimalConfiguration(
  load: number,
  wetBulb: number,
  hour: number,
  month: number,
  weekend: number,
  limit: number,
  currentChillers: number[],
  currentSetpoint: number
): Promise<OptimalConfiguration | null> {
  const combinations = filterCombinationsByLoad(load, getAllChillerCombinations());
  const setpoints = getAllSetpoints();

  let bestConfig: OptimalConfiguration | null = null;
  let bestTotalPower = Infinity;

  for (const combo of combinations) {
    for (const setpointOpt of setpoints) {
      const inputs = buildPredictionInput(load, wetBulb, setpointOpt.value, hour, month, weekend, limit, combo.chillers);

      const kwPerTr = await predictKwPerTr(inputs);
      if (kwPerTr === null) continue;

      const totalPower = calculateStageAdjustedTotalPower(load, kwPerTr, combo.chillers);

      if (totalPower < bestTotalPower) {
        bestTotalPower = totalPower;
        bestConfig = {
          chillers: combo.chillers,
          setpoint: setpointOpt.value,
          kwPerTr,
          totalPower,
        };
      }
    }
  }

  return bestConfig;
}

export async function calculateSavings(
  load: number,
  wetBulb: number,
  hour: number,
  month: number,
  weekend: number,
  limit: number,
  currentChillers: number[],
  currentSetpoint: number
): Promise<SavingsResult | null> {
  const normalizedCurrentChillers = expandChillerSelection(currentChillers);
  const currentInputs = buildPredictionInput(
    load,
    wetBulb,
    currentSetpoint,
    hour,
    month,
    weekend,
    limit,
    normalizedCurrentChillers,
  );
  const response = await fetchOptimizerResponse(currentInputs, 'optimize');

  if (!response) {
    return null;
  }

  const currentKwPerTr = findNumericField(response, [
    'current_kw_per_tr',
    'kw_per_tr',
    'current_efficiency',
    'efficiency',
  ]);

  const optimalKwPerTr = findNumericField(response, [
    'optimal_kw_per_tr',
    'optimal_efficiency',
    'recommended_efficiency',
    'summary.optimal_efficiency',
    'efficiency',
  ]);

  const recommendedSetpoint = findNumericField(response, [
    'recommended_setpoint',
    'recommended_chw_setpoint',
    'optimal_chw_setpoint',
    'summary.recommended_setpoint',
  ]) ?? currentSetpoint;

  const improvementPercentFromApi = findNumericField(response, [
    'efficiency_improvement_pct',
    'improvement_pct',
    'potential_savings',
    'summary.potential_savings',
  ]);

  if (currentKwPerTr === null || optimalKwPerTr === null) {
    return null;
  }

  const currentTotalPower = calculateStageAdjustedTotalPower(load, currentKwPerTr, normalizedCurrentChillers);
  const currentConfig: OptimalConfiguration = {
    chillers: normalizedCurrentChillers,
    setpoint: currentSetpoint,
    kwPerTr: currentKwPerTr,
    totalPower: currentTotalPower,
  };

  const optimalConfigFromSearch =
    (await findOptimalConfiguration(
      load,
      wetBulb,
      hour,
      month,
      weekend,
      limit,
      normalizedCurrentChillers,
      round(recommendedSetpoint, 1),
    )) || null;

  const fallbackOptimalConfig: OptimalConfiguration = {
    chillers: normalizedCurrentChillers,
    setpoint: round(recommendedSetpoint, 1),
    kwPerTr: optimalKwPerTr,
    totalPower: calculateStageAdjustedTotalPower(load, optimalKwPerTr, normalizedCurrentChillers),
  };

  const optimalConfig = optimalConfigFromSearch ?? fallbackOptimalConfig;

  const effectiveOptimalPower = optimalConfig.totalPower;
  const effectivePowerSaved = round(currentTotalPower - effectiveOptimalPower, 1);
  const improvementPercent =
    improvementPercentFromApi !== null
      ? round(improvementPercentFromApi, 1)
      : currentTotalPower > 0
        ? round((effectivePowerSaved / currentTotalPower) * 100, 1)
        : 0;

  return {
    currentConfig,
    optimalConfig,
    powerSaved: effectivePowerSaved,
    improvementPercent,
    costSavingsPerHour: round(effectivePowerSaved * 0.12, 2),
    co2ReductionPerHour: round(effectivePowerSaved * 0.42, 1),
  };
}
