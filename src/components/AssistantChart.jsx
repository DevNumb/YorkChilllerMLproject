function flattenSeries(chart) {
  return chart.series.flatMap((series) => series.data);
}

function getChartBounds(chart) {
  const values = flattenSeries(chart);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  return { min, max, range };
}

function BarChart({ chart }) {
  const { max } = getChartBounds(chart);
  const series = chart.series[0];

  return (
    <div className="assistant-chart-plot bars">
      {chart.labels.map((label, index) => {
        const value = series.data[index] ?? 0;
        const height = `${Math.max((value / max) * 100, 4)}%`;
        return (
          <div key={label} className="assistant-bar-group">
            <div className="assistant-bar-value">
              {value}
              {chart.unit ? ` ${chart.unit}` : ''}
            </div>
            <div className="assistant-bar-track">
              <div className="assistant-bar-fill" style={{ height, backgroundColor: series.color }} />
            </div>
            <div className="assistant-bar-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ chart }) {
  const { min, range } = getChartBounds(chart);
  const points = chart.series[0].data
    .map((value, index, values) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="assistant-chart-line-shell">
      <svg viewBox="0 0 100 100" className="assistant-chart-svg" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={chart.series[0].color}
          strokeWidth="3"
          points={points}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {chart.series[0].data.map((value, index, values) => {
          const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
          const y = 100 - ((value - min) / range) * 100;
          return <circle key={`${chart.labels[index]}-${value}`} cx={x} cy={y} r="2.6" fill={chart.series[0].color} />;
        })}
      </svg>
      <div className="assistant-line-labels">
        {chart.labels.map((label, index) => (
          <div key={label} className="assistant-line-label">
            <span>{label}</span>
            <strong>
              {chart.series[0].data[index]}
              {chart.unit ? ` ${chart.unit}` : ''}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AssistantChart({ chart }) {
  if (!chart) {
    return null;
  }

  return (
    <article className="assistant-chart-card">
      <div className="assistant-chart-header">
        <div>
          <span className="assistant-section-kicker">Generated Chart</span>
          <h4>{chart.title}</h4>
        </div>
        <span className="assistant-chart-type">{chart.type.toUpperCase()}</span>
      </div>
      {chart.type === 'line' ? <LineChart chart={chart} /> : <BarChart chart={chart} />}
    </article>
  );
}
