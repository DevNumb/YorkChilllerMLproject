const OPTIMIZER_URL = import.meta.env.VITE_OPTIMIZER_URL || 'https://DevNumb-MLYorkchillerOptimzer.hf.space';
const CACHE_TTL_MS = 30_000;

import { getAllTasks, getHistory } from './maintenanceDatabase.js';

let plantCache = { data: null, timestamp: 0 };
let maintenanceCache = { data: null, timestamp: 0 };

function isCacheValid(cache) {
  return cache.data !== null && (Date.now() - cache.timestamp) < CACHE_TTL_MS;
}

export async function fetchPlantData() {
  if (isCacheValid(plantCache)) {
    return plantCache.data;
  }

  try {
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth() + 1;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6 ? 1 : 0;

    const response = await fetch(
      `${OPTIMIZER_URL}/predict?load_tons=500&wet_bulb_c=20&current_chw_setpoint_c=7&current_limit_pct=80&hour=${hour}&month=${month}&is_weekend=${isWeekend}&chillers_running=2`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`Optimizer API returned ${response.status}`);

    const result = await response.json();

    const plantData = {
      source: 'api',
      capturedAt: new Date().toISOString(),
      currentEfficiency: result.currentEfficiency ?? result.current_efficiency ?? null,
      optimalEfficiency: result.optimalEfficiency ?? result.optimal_efficiency ?? null,
      recommendedSetpoint: result.recommendedSetpoint ?? result.recommended_setpoint ?? null,
      improvementPercent: result.improvementPercent ?? result.improvement_percent ?? null,
      energySavingsKwh: result.energySavingsKwh ?? result.energy_savings_kwh ?? null,
      costSavingsUsd: result.costSavingsUsd ?? result.cost_savings_usd ?? null,
      operatorAction: result.operatorAction ?? result.operator_action ?? null,
      outdoorTemp: result.outdoor_temp ?? null,
      loadTons: result.load_tons ?? null,
      wetBulb: result.wet_bulb_c ?? null,
      chillersRunning: result.chillers_running ?? null,
    };

    plantCache = { data: plantData, timestamp: Date.now() };
    return plantData;
  } catch (err) {
    console.warn('Plant data fetch failed:', err.message);

    const cached = plantCache.data;
    if (cached) return cached;

    const fallback = {
      source: 'unavailable',
      capturedAt: new Date().toISOString(),
      currentEfficiency: null,
      optimalEfficiency: null,
      recommendedSetpoint: null,
      improvementPercent: null,
      energySavingsKwh: null,
      costSavingsUsd: null,
      operatorAction: null,
      outdoorTemp: null,
      loadTons: null,
      wetBulb: null,
      chillersRunning: null,
      error: err.message,
    };

    plantCache = { data: fallback, timestamp: Date.now() };
    return fallback;
  }
}

export async function fetchMaintenanceData() {
  if (isCacheValid(maintenanceCache)) {
    return maintenanceCache.data;
  }

  try {
    const tasks = await getAllTasks();
    const recentHistory = await getHistory(null, 20);

    const now = new Date();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const maintenanceData = {
      source: 'database',
      capturedAt: now.toISOString(),
      totalTasks: tasks.length,
      overdueCount: tasks.filter((t) => t.status === 'overdue').length,
      pendingCount: tasks.filter((t) => t.status === 'pending').length,
      completedThisMonth: tasks.filter((t) => {
        if (!t.lastCompleted) return false;
        const d = new Date(t.lastCompleted);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }).length,
      upcomingNext7Days: tasks.filter((t) => {
        if (!t.nextDue) return false;
        const due = new Date(t.nextDue);
        return due.getTime() - now.getTime() > 0 && due.getTime() - now.getTime() <= oneWeekMs;
      }).length,
      overdueTasks: tasks.filter((t) => t.status === 'overdue').map((t) => t.name),
      upcomingTasks: tasks
        .filter((t) => t.nextDue && new Date(t.nextDue).getTime() - now.getTime() > 0 && new Date(t.nextDue).getTime() - now.getTime() <= oneWeekMs)
        .map((t) => ({ name: t.name, dueDate: t.nextDue })),
      recentHistory: recentHistory.slice(0, 5).map((h) => ({
        taskName: tasks.find((t) => t.id === h.taskId)?.name || h.taskId,
        completedDate: h.completedDate,
        completedBy: h.completedBy,
        durationMinutes: h.durationMinutes,
        notes: h.notes,
      })),
    };

    maintenanceCache = { data: maintenanceData, timestamp: Date.now() };
    return maintenanceData;
  } catch (err) {
    console.warn('Maintenance data fetch failed:', err.message);
    const fallback = {
      source: 'unavailable',
      capturedAt: new Date().toISOString(),
      totalTasks: 0,
      overdueCount: 0,
      pendingCount: 0,
      completedThisMonth: 0,
      upcomingNext7Days: 0,
      overdueTasks: [],
      upcomingTasks: [],
      recentHistory: [],
      error: err.message,
    };
    maintenanceCache = { data: fallback, timestamp: Date.now() };
    return fallback;
  }
}

export function buildContextPrompt(plantData, maintenanceData) {
  const lines = ['[SYSTEM CONTEXT - Live Plant Data]'];

  if (plantData.source === 'api') {
    lines.push('Plant Optimization Data (live from API):');
    if (plantData.currentEfficiency !== null) lines.push(`- Current Efficiency: ${plantData.currentEfficiency} kW/ton`);
    if (plantData.optimalEfficiency !== null) lines.push(`- Optimal Efficiency: ${plantData.optimalEfficiency} kW/ton`);
    if (plantData.recommendedSetpoint !== null) lines.push(`- Recommended Setpoint: ${plantData.recommendedSetpoint}°C`);
    if (plantData.improvementPercent !== null) lines.push(`- Improvement Potential: ${plantData.improvementPercent}%`);
    if (plantData.energySavingsKwh !== null) lines.push(`- Energy Savings: ${plantData.energySavingsKwh} kWh`);
    if (plantData.costSavingsUsd !== null) lines.push(`- Cost Savings: $${plantData.costSavingsUsd}`);
    if (plantData.operatorAction) lines.push(`- Operator Action: ${plantData.operatorAction}`);
    if (plantData.outdoorTemp !== null) lines.push(`- Outdoor Temperature: ${plantData.outdoorTemp}°C`);
    if (plantData.loadTons !== null) lines.push(`- Cooling Load: ${plantData.loadTons} tons`);
    if (plantData.wetBulb !== null) lines.push(`- Wet Bulb: ${plantData.wetBulb}°C`);
    if (plantData.chillersRunning !== null) lines.push(`- Chillers Running: ${plantData.chillersRunning}`);
  } else {
    lines.push('Plant Optimization Data: API unavailable — answer based on general chiller plant knowledge.');
  }

  lines.push('');
  lines.push('[SYSTEM CONTEXT - Maintenance Data]');

  if (maintenanceData.source === 'database') {
    lines.push('Maintenance Status:');
    lines.push(`- Total Tasks: ${maintenanceData.totalTasks}`);
    lines.push(`- Overdue: ${maintenanceData.overdueCount}`);
    lines.push(`- Pending: ${maintenanceData.pendingCount}`);
    lines.push(`- Completed This Month: ${maintenanceData.completedThisMonth}`);
    lines.push(`- Upcoming (next 7 days): ${maintenanceData.upcomingNext7Days}`);
    if (maintenanceData.overdueTasks.length > 0) {
      lines.push(`- Overdue Tasks: ${maintenanceData.overdueTasks.join(', ')}`);
    }
    if (maintenanceData.upcomingTasks.length > 0) {
      lines.push(`- Upcoming: ${maintenanceData.upcomingTasks.map((t) => `${t.name} (due ${new Date(t.dueDate).toLocaleDateString()})`).join('; ')}`);
    }
    if (maintenanceData.recentHistory.length > 0) {
      lines.push('- Recent Activity:');
      maintenanceData.recentHistory.forEach((h) => {
        lines.push(`  • ${h.taskName} — ${new Date(h.completedDate).toLocaleDateString()} by ${h.completedBy || 'N/A'} (${h.durationMinutes} min)`);
      });
    }
  } else {
    lines.push('Maintenance Data: Database unavailable.');
  }

  lines.push('');
  lines.push('Use this context to provide specific, actionable answers. If the user asks about current conditions, efficiency, or maintenance, reference the live data above.');

  return lines.join('\n');
}

export function clearContextCache() {
  plantCache = { data: null, timestamp: 0 };
  maintenanceCache = { data: null, timestamp: 0 };
}
