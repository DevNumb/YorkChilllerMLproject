import { supabase } from './supabaseClient';

/**
 * Save fault detection result to database
 */
export async function saveFaultDetectionHistory(data) {
  try {
    const { error } = await supabase
      .from('fault_detection_history')
      .insert({
        cooling_load: data.cooling_load,
        wet_bulb: data.wet_bulb,
        chiller_data: data.chiller_data,
        prediction: data.prediction,
        fault_score: data.fault_score,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;
  } catch (err) {
    console.error('[Supabase] Failed to save fault history:', err);
    throw err;
  }
}

/**
 * Get fault detection history
 */
export async function getFaultDetectionHistory(limit = 20) {
  const { data, error } = await supabase
    .from('fault_detection_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Maps Supabase snake_case to frontend camelCase
 */
function mapHistoryFromDb(dbRecord) {
  if (!dbRecord) return null;
  return {
    id: dbRecord.id,
    timestamp: dbRecord.timestamp,
    inputs: {
      load_tons: dbRecord.load_tons,
      wet_bulb_c: dbRecord.wet_bulb_c,
      current_chw_setpoint_c: dbRecord.current_chw_setpoint_c,
      current_limit_pct: dbRecord.current_limit_pct,
      hour: dbRecord.hour,
      month: dbRecord.month,
      is_weekend: dbRecord.is_weekend,
      chillers_running: dbRecord.chillers_running,
    },
    result: {
      currentEfficiency: dbRecord.current_efficiency,
      optimalEfficiency: dbRecord.optimal_efficiency,
      currentTotalPower: dbRecord.current_total_power,
      optimalTotalPower: dbRecord.optimal_total_power,
      powerSavedKw: dbRecord.power_saved_kw,
      improvementPercent: dbRecord.improvement_percent,
      recommendedSetpoint: dbRecord.recommended_setpoint,
      recommendedChillers: dbRecord.recommended_chillers,
      costSavingsUsd: dbRecord.cost_savings_usd,
      co2ReductionKg: dbRecord.co2_reduction_kg,
      operatorAction: dbRecord.operator_action,
    },
  };
}

/**
 * Maps frontend camelCase to Supabase snake_case
 */
function mapHistoryToDb(entry) {
  if (!entry) return null;
  return {
    timestamp: entry.timestamp,
    load_tons: entry.inputs.load_tons,
    wet_bulb_c: entry.inputs.wet_bulb_c,
    current_chw_setpoint_c: entry.inputs.current_chw_setpoint_c,
    current_limit_pct: entry.inputs.current_limit_pct,
    hour: entry.inputs.hour,
    month: entry.inputs.month,
    is_weekend: entry.inputs.is_weekend,
    chillers_running: entry.inputs.chillers_running,
    current_efficiency: entry.result.currentEfficiency,
    optimal_efficiency: entry.result.optimalEfficiency,
    current_total_power: entry.result.currentTotalPower,
    optimal_total_power: entry.result.optimalTotalPower,
    power_saved_kw: entry.result.powerSavedKw,
    improvement_percent: entry.result.improvementPercent,
    recommended_setpoint: entry.result.recommendedSetpoint,
    recommended_chillers: entry.result.recommendedChillers,
    cost_savings_usd: entry.result.costSavingsUsd,
    co2_reduction_kg: entry.result.co2ReductionKg,
    operator_action: entry.result.operatorAction,
  };
}

/**
 * Save optimization result to database
 */
export async function saveOptimizationHistory(entry) {
  try {
    const dbRecord = mapHistoryToDb(entry);

    console.log('[Supabase] Attempting to save optimization history:', {
      timestamp: dbRecord.timestamp,
      load_tons: dbRecord.load_tons,
      power_saved_kw: dbRecord.power_saved_kw,
      recommended_chillers: dbRecord.recommended_chillers,
    });

    const { data, error } = await supabase
      .from('dashboard_optimization_history')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log('[Supabase] Successfully saved optimization history:', data.id);
    return mapHistoryFromDb(data);
  } catch (err) {
    console.error('[Supabase] Failed to save optimization history:', err);
    throw err;
  }
}

/**
 * Get all optimization history
 */
export async function getOptimizationHistory(limit = 100) {
  const { data, error } = await supabase
    .from('dashboard_optimization_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data.map(mapHistoryFromDb);
}

/**
 * Get optimization history for a specific date range
 */
export async function getOptimizationHistoryByDateRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('dashboard_optimization_history')
    .select('*')
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return data.map(mapHistoryFromDb);
}

/**
 * Get optimization statistics
 */
export async function getOptimizationStats(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('dashboard_optimization_history')
    .select('*')
    .gte('timestamp', startDate.toISOString())
    .order('timestamp', { ascending: false });

  if (error) throw error;

  const records = data.map(mapHistoryFromDb);

  if (records.length === 0) {
    return {
      totalRecommendations: 0,
      totalPowerSaved: 0,
      totalCostSaved: 0,
      totalCo2Reduced: 0,
      averageImprovement: 0,
    };
  }

  const totalPowerSaved = records.reduce((sum, r) => sum + r.result.powerSavedKw, 0);
  const totalCostSaved = records.reduce((sum, r) => sum + r.result.costSavingsUsd, 0);
  const totalCo2Reduced = records.reduce((sum, r) => sum + r.result.co2ReductionKg, 0);
  const averageImprovement = records.reduce((sum, r) => sum + r.result.improvementPercent, 0) / records.length;

  return {
    totalRecommendations: records.length,
    totalPowerSaved: Number(totalPowerSaved.toFixed(1)),
    totalCostSaved: Number(totalCostSaved.toFixed(2)),
    totalCo2Reduced: Number(totalCo2Reduced.toFixed(1)),
    averageImprovement: Number(averageImprovement.toFixed(1)),
  };
}

/**
 * Delete old history records (older than specified days)
 */
export async function deleteOldHistory(days = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { error } = await supabase
    .from('dashboard_optimization_history')
    .delete()
    .lt('timestamp', cutoffDate.toISOString());

  if (error) throw error;
}
