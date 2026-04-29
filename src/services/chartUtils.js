function normalizeSeries(series) {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .filter((item) => item && Array.isArray(item.data))
    .map((item, index) => ({
      name: item.name || `Series ${index + 1}`,
      color: item.color || ['#64d6ff', '#4be4a4', '#f7df72', '#ff9f5a'][index % 4],
      data: item.data.map((value) => Number(value) || 0),
    }));
}

export function normalizeChartSpec(chart) {
  if (!chart || typeof chart !== 'object') {
    return null;
  }

  const labels = Array.isArray(chart.labels) ? chart.labels.map((label) => String(label)) : [];
  const series = normalizeSeries(chart.series);

  if (!labels.length || !series.length) {
    return null;
  }

  return {
    type: chart.type === 'line' ? 'line' : 'bar',
    title: chart.title || 'Assistant Chart',
    unit: chart.unit || '',
    labels,
    series,
  };
}

export function buildFallbackCharts(context) {
  const recommendation = context?.lastRecommendation;
  const inputs = context?.optimizationInputs;
  const liveConditions = context?.liveConditions;
  const charts = [];

  if (recommendation) {
    charts.push({
      type: 'bar',
      title: 'Efficiency Comparison',
      unit: 'kW/ton',
      labels: ['Current', 'Optimal'],
      series: [
        {
          name: 'Efficiency',
          color: '#64d6ff',
          data: [
            recommendation.currentEfficiencyKwPerTon ?? 0,
            recommendation.optimalEfficiencyKwPerTon ?? 0,
          ],
        },
      ],
    });

    charts.push({
      type: 'bar',
      title: 'Savings Snapshot',
      unit: '',
      labels: ['Improvement %', 'Savings kWh', 'CO2 kg'],
      series: [
        {
          name: 'Impact',
          color: '#4be4a4',
          data: [
            recommendation.improvementPercent ?? 0,
            recommendation.energySavingsKwh ?? 0,
            recommendation.co2ReductionKg ?? 0,
          ],
        },
      ],
    });
  }

  if (inputs && liveConditions) {
    charts.push({
      type: 'line',
      title: 'Operating Snapshot',
      unit: '',
      labels: ['Wet Bulb', 'CHW Setpoint', 'Current Limit', 'Load/100'],
      series: [
        {
          name: 'Current values',
          color: '#f7df72',
          data: [
            inputs.wetBulbC ?? 0,
            inputs.currentChwSetpointC ?? 0,
            inputs.currentLimitPct ?? 0,
            Math.round((inputs.coolingLoadTons ?? 0) / 100),
          ],
        },
      ],
    });
  }

  return charts.map(normalizeChartSpec).filter(Boolean);
}
