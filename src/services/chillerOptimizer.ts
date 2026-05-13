/**
 * York Chiller Optimizer - 18-Feature Gradio API Integration
 * Fixed to call the real API at: https://DevNumb-randomforestmodel.hf.space/gradio_api/call/predict
 */

const API_BASE_URL = 'https://DevNumb-randomforestmodel.hf.space/gradio_api/call/predict';

export interface PredictionInput18 {
  OA_TEMP: number;
  OA_TEMP_WB: number;
  Hour: number;
  Weekday: number;
  Month: number;
  CHL_STA_1: number;
  CHL_STA_2: number;
  CHL_STA_3: number;
  CHL_COMP_SPD_CTRL_1: number;
  CHL_COMP_SPD_CTRL_2: number;
  CHL_COMP_SPD_CTRL_3: number;
  CT_FAN_SPD_CTRL_1: number;
  CT_FAN_SPD_CTRL_2: number;
  CT_FAN_SPD_CTRL_3: number;
  CHL_CD_FLOW_1: number;
  CHL_CD_FLOW_2: number;
  CHL_CD_FLOW_3: number;
  CWL_SEC_LOAD: number;
}

export interface OptimalConfiguration {
  chillers: number[];
  speeds: number[];
  fans: number[];
  flows: number[];
  kwPerTr: number;
  totalPower: number;
  setpoint: number;
  settings: PredictionInput18;
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
 * CORRECT API INTEGRATION - POST to submit, GET to retrieve
 */
async function callPredictionAPI(features18Array: number[]): Promise<number> {
  try {
    console.log('[API] Sending POST request with features:', features18Array);

    // Step 1: POST to get event_id
    // URL: /gradio_api/call/predict (NO trailing slash)
    const postResponse = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: features18Array })
    });

    if (!postResponse.ok) {
      throw new Error(`POST failed: ${postResponse.status}`);
    }

    // POST response is JSON
    const postData = await postResponse.json();
    console.log('[API] POST response:', postData);
    const { event_id } = postData;

    if (!event_id) {
      throw new Error('No event_id in POST response');
    }

    console.log('[API] Got event_id:', event_id);

    // Step 2: Wait 2 seconds for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: GET the result
    // URL: /gradio_api/call/predict/{event_id}
    const getUrl = `${API_BASE_URL}/${event_id}`;
    console.log('[API] Sending GET request to:', getUrl);

    const getResponse = await fetch(getUrl);

    if (!getResponse.ok) {
      throw new Error(`GET failed: ${getResponse.status}`);
    }

    // GET response is SSE (starts with "event: complete")
    const text = await getResponse.text();
    console.log('[API] GET response (first 500 chars):', text.substring(0, 500));

    // Step 4: Extract prediction from SSE format
    // Data format: data: ["**Prediction:** 186.32"]
    const dataMatch = text.match(/data:\s*\["([^"]+)"\]/);
    const powerText = dataMatch ? dataMatch[1] : text;
    console.log('[API] Extracted power text:', powerText);

    const powerMatch = powerText.match(/\*\*Prediction:\*\*\s*(\d+\.?\d*)/);
    const power = powerMatch ? parseFloat(powerMatch[1]) : null;

    console.log('[API] Parsed power value:', power);

    if (power === null) {
      throw new Error(`Could not parse power from SSE response: ${text.substring(0, 200)}`);
    }

    return power;
  } catch (error) {
    console.error('[API] Call failed:', error);
    throw error;
  }
}

/**
 * Builds the 18-parameter array for the API.
 */
function buildFeaturesFromState(state: PredictionInput18): number[] {
  return [
    state.OA_TEMP || 30.0,
    state.OA_TEMP_WB || 20.0,
    state.Hour || 14,
    state.Weekday || 3,
    state.Month || 7,
    state.CHL_STA_1,
    state.CHL_STA_2,
    state.CHL_STA_3,
    state.CHL_COMP_SPD_CTRL_1,
    state.CHL_COMP_SPD_CTRL_2,
    state.CHL_COMP_SPD_CTRL_3,
    state.CT_FAN_SPD_CTRL_1,
    state.CT_FAN_SPD_CTRL_2,
    state.CT_FAN_SPD_CTRL_3,
    state.CHL_CD_FLOW_1,
    state.CHL_CD_FLOW_2,
    state.CHL_CD_FLOW_3,
    state.CWL_SEC_LOAD
  ];
}

/**
 * Comfort Zone Constraints - Safe Operating Ranges
 */
const COMFORT_ZONE = {
  CHW_SETPOINT_MIN: 5.0,
  CHW_SETPOINT_MAX: 10.0,
  COMPRESSOR_SPEED_MIN: 30,
  COMPRESSOR_SPEED_MAX: 100,
  FAN_SPEED_MIN: 20,
  FAN_SPEED_MAX: 100,
  FLOW_MIN: 150,
  FLOW_MAX: 350,
  MIN_CHILLERS_RUNNING: 1,
};

function isWithinComfortZone(config: PredictionInput18, setpoint: number): boolean {
  // Check setpoint
  if (setpoint < COMFORT_ZONE.CHW_SETPOINT_MIN || setpoint > COMFORT_ZONE.CHW_SETPOINT_MAX) {
    return false;
  }

  // Check that at least one chiller is running if there's load
  const chillersRunning = config.CHL_STA_1 + config.CHL_STA_2 + config.CHL_STA_3;
  if (chillersRunning < COMFORT_ZONE.MIN_CHILLERS_RUNNING && config.CWL_SEC_LOAD > 100) {
    return false;
  }

  // Check compressor speeds (only for running chillers)
  if (config.CHL_STA_1 === 1 && (config.CHL_COMP_SPD_CTRL_1 < COMFORT_ZONE.COMPRESSOR_SPEED_MIN || config.CHL_COMP_SPD_CTRL_1 > COMFORT_ZONE.COMPRESSOR_SPEED_MAX)) {
    return false;
  }
  if (config.CHL_STA_2 === 1 && (config.CHL_COMP_SPD_CTRL_2 < COMFORT_ZONE.COMPRESSOR_SPEED_MIN || config.CHL_COMP_SPD_CTRL_2 > COMFORT_ZONE.COMPRESSOR_SPEED_MAX)) {
    return false;
  }
  if (config.CHL_STA_3 === 1 && (config.CHL_COMP_SPD_CTRL_3 < COMFORT_ZONE.COMPRESSOR_SPEED_MIN || config.CHL_COMP_SPD_CTRL_3 > COMFORT_ZONE.COMPRESSOR_SPEED_MAX)) {
    return false;
  }

  // Check fan speeds (only for running chillers)
  if (config.CHL_STA_1 === 1 && (config.CT_FAN_SPD_CTRL_1 < COMFORT_ZONE.FAN_SPEED_MIN || config.CT_FAN_SPD_CTRL_1 > COMFORT_ZONE.FAN_SPEED_MAX)) {
    return false;
  }
  if (config.CHL_STA_2 === 1 && (config.CT_FAN_SPD_CTRL_2 < COMFORT_ZONE.FAN_SPEED_MIN || config.CT_FAN_SPD_CTRL_2 > COMFORT_ZONE.FAN_SPEED_MAX)) {
    return false;
  }
  if (config.CHL_STA_3 === 1 && (config.CT_FAN_SPD_CTRL_3 < COMFORT_ZONE.FAN_SPEED_MIN || config.CT_FAN_SPD_CTRL_3 > COMFORT_ZONE.FAN_SPEED_MAX)) {
    return false;
  }

  // Check flows (only for running chillers)
  if (config.CHL_STA_1 === 1 && (config.CHL_CD_FLOW_1 < COMFORT_ZONE.FLOW_MIN || config.CHL_CD_FLOW_1 > COMFORT_ZONE.FLOW_MAX)) {
    return false;
  }
  if (config.CHL_STA_2 === 1 && (config.CHL_CD_FLOW_2 < COMFORT_ZONE.FLOW_MIN || config.CHL_CD_FLOW_2 > COMFORT_ZONE.FLOW_MAX)) {
    return false;
  }
  if (config.CHL_STA_3 === 1 && (config.CHL_CD_FLOW_3 < COMFORT_ZONE.FLOW_MIN || config.CHL_CD_FLOW_3 > COMFORT_ZONE.FLOW_MAX)) {
    return false;
  }

  return true;
}

/**
 * Main optimization entry point with HYPERPARAMETER SEARCH.
 */
export async function calculateSavings(
  load: number,
  wetBulb: number,
  hour: number,
  month: number,
  weekday: number,
  oaTemp: number,
  currentSettings: PredictionInput18
): Promise<SavingsResult | null> {
  try {
    // 1. Get Baseline Power from API
    const currentFeatures = buildFeaturesFromState(currentSettings);
    console.log('[Optimizer] Fetching baseline power from API...');
    let currentTotalPower: number;

    try {
      currentTotalPower = await callPredictionAPI(currentFeatures);
      console.log('[Optimizer] Baseline power from API:', currentTotalPower);
    } catch (apiError) {
      console.error('[Optimizer] API call failed, cannot proceed:', apiError);
      throw new Error('Failed to get baseline power from API: ' + (apiError as Error).message);
    }

    // Efficiency (kW/ton) = Total Power (kW) / Load (tons)
    const currentKwPerTr = load > 0 ? currentTotalPower / load : 0;

    // 2. Define Hyperparameter Search Space (within comfort zone)
    const stagings = [
      [1, 0, 0], [0, 1, 0], [0, 0, 1], // 1 Chiller options
      [1, 1, 0], [1, 0, 1], [0, 1, 1], // 2 Chiller options
      [1, 1, 1]                      // 3 Chiller options
    ];

    // Control levels for search (Speed %, Fan %, Flow GPM) - reduced for faster execution
    const controlLevels = [
      { spd: 40, fan: 30, flow: 180 },
      { spd: 60, fan: 50, flow: 240 },
      { spd: 80, fan: 70, flow: 300 },
      { spd: 100, fan: 100, flow: 350 }
    ];

    const scenarios: PredictionInput18[] = [];
    const setpoint = 6.5; // Standard setpoint within comfort zone

    for (const stage of stagings) {
      for (const ctrl of controlLevels) {
        const scenario: PredictionInput18 = {
          OA_TEMP: oaTemp,
          OA_TEMP_WB: wetBulb,
          Hour: hour,
          Weekday: weekday,
          Month: month,
          CHL_STA_1: stage[0],
          CHL_STA_2: stage[1],
          CHL_STA_3: stage[2],
          CHL_COMP_SPD_CTRL_1: stage[0] ? ctrl.spd : 0,
          CHL_COMP_SPD_CTRL_2: stage[1] ? ctrl.spd : 0,
          CHL_COMP_SPD_CTRL_3: stage[2] ? ctrl.spd : 0,
          CT_FAN_SPD_CTRL_1: stage[0] ? ctrl.fan : 0,
          CT_FAN_SPD_CTRL_2: stage[1] ? ctrl.fan : 0,
          CT_FAN_SPD_CTRL_3: stage[2] ? ctrl.fan : 0,
          CHL_CD_FLOW_1: stage[0] ? ctrl.flow : 0,
          CHL_CD_FLOW_2: stage[1] ? ctrl.flow : 0,
          CHL_CD_FLOW_3: stage[2] ? ctrl.flow : 0,
          CWL_SEC_LOAD: load
        };

        // Only add scenarios within comfort zone
        if (isWithinComfortZone(scenario, setpoint)) {
          scenarios.push(scenario);
        }
      }
    }

    // 3. Run all scenarios through the API
    // We use a simple batching to avoid hitting API limits too hard
    const results: OptimalConfiguration[] = [];
    const batchSize = 5;

    for (let i = 0; i < scenarios.length; i += batchSize) {
      const batch = scenarios.slice(i, i + batchSize);
      const batchPromises = batch.map(async (settings) => {
        try {
          const power = await callPredictionAPI(buildFeaturesFromState(settings));
          // Verify result is within comfort zone before adding
          if (isWithinComfortZone(settings, setpoint)) {
            return {
              chillers: [settings.CHL_STA_1, settings.CHL_STA_2, settings.CHL_STA_3].map((v, idx) => v ? idx + 1 : 0).filter(v => v > 0),
              speeds: [settings.CHL_COMP_SPD_CTRL_1, settings.CHL_COMP_SPD_CTRL_2, settings.CHL_COMP_SPD_CTRL_3].filter(v => v > 0),
              fans: [settings.CT_FAN_SPD_CTRL_1, settings.CT_FAN_SPD_CTRL_2, settings.CT_FAN_SPD_CTRL_3].filter(v => v > 0),
              flows: [settings.CHL_CD_FLOW_1, settings.CHL_CD_FLOW_2, settings.CHL_CD_FLOW_3].filter(v => v > 0),
              kwPerTr: power / load,
              totalPower: power,
              setpoint: setpoint,
              settings
            };
          }
          return null;
        } catch (e) {
          console.warn('Scenario failed:', e);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is OptimalConfiguration => r !== null));
    }

    if (results.length === 0) {
      throw new Error('All optimization scenarios failed. No solutions within comfort zone.');
    }

    // 4. Find Best (Minimum Total Power) within comfort zone
    const best = results.reduce((prev, curr) => (curr.totalPower < prev.totalPower ? curr : prev), results[0]);
    console.log('[Optimizer] Best result from hyperparameter search:', {
      totalPower: best.totalPower,
      kwPerTr: best.kwPerTr,
      chillers: best.chillers,
      speeds: best.speeds,
      fans: best.fans,
      flows: best.flows,
    });

    // Also compare with baseline (if within comfort zone)
    let bestFinal = best;
    if (isWithinComfortZone(currentSettings, 6.5) && best.totalPower > currentTotalPower) {
      console.log('[Optimizer] Baseline is better than optimized result, using baseline');
      bestFinal = {
        chillers: [currentSettings.CHL_STA_1, currentSettings.CHL_STA_2, currentSettings.CHL_STA_3].map((v, i) => v ? i + 1 : 0).filter(v => v > 0),
        speeds: [currentSettings.CHL_COMP_SPD_CTRL_1, currentSettings.CHL_COMP_SPD_CTRL_2, currentSettings.CHL_COMP_SPD_CTRL_3].filter(v => v > 0),
        fans: [currentSettings.CT_FAN_SPD_CTRL_1, currentSettings.CT_FAN_SPD_CTRL_2, currentSettings.CT_FAN_SPD_CTRL_3].filter(v => v > 0),
        flows: [currentSettings.CHL_CD_FLOW_1, currentSettings.CHL_CD_FLOW_2, currentSettings.CHL_CD_FLOW_3].filter(v => v > 0),
        kwPerTr: currentKwPerTr,
        totalPower: currentTotalPower,
        setpoint: 6.5,
        settings: currentSettings
      };
    } else {
      console.log('[Optimizer] Using optimized result from hyperparameter search');
    }

    const powerSaved = Math.max(0, currentTotalPower - bestFinal.totalPower);
    const improvementPercent = currentTotalPower > 0 ? (powerSaved / currentTotalPower) * 100 : 0;

    console.log('[Optimizer] Final result:', {
      currentPower: currentTotalPower,
      optimalPower: bestFinal.totalPower,
      powerSaved: powerSaved,
      improvementPercent: improvementPercent,
    });

    return {
      currentConfig: {
        chillers: [currentSettings.CHL_STA_1, currentSettings.CHL_STA_2, currentSettings.CHL_STA_3].map((v, i) => v ? i + 1 : 0).filter(v => v > 0),
        speeds: [currentSettings.CHL_COMP_SPD_CTRL_1, currentSettings.CHL_COMP_SPD_CTRL_2, currentSettings.CHL_COMP_SPD_CTRL_3].filter(v => v > 0),
        fans: [currentSettings.CT_FAN_SPD_CTRL_1, currentSettings.CT_FAN_SPD_CTRL_2, currentSettings.CT_FAN_SPD_CTRL_3].filter(v => v > 0),
        flows: [currentSettings.CHL_CD_FLOW_1, currentSettings.CHL_CD_FLOW_2, currentSettings.CHL_CD_FLOW_3].filter(v => v > 0),
        kwPerTr: currentKwPerTr,
        totalPower: currentTotalPower,
        setpoint: 6.5,
        settings: currentSettings
      },
      optimalConfig: bestFinal,
      powerSaved,
      improvementPercent,
      costSavingsPerHour: powerSaved * 0.12,
      co2ReductionPerHour: powerSaved * 0.42
    };
  } catch (err) {
    console.error('[Chiller Optimizer] Error:', err);
    return null;
  }
}

export function formatChillerStageLabel(chillers: number[]): string {
  return Array.isArray(chillers) ? chillers.join(', ') : String(chillers);
}

