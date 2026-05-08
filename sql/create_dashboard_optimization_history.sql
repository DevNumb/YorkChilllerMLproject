-- Create dashboard_optimization_history table
CREATE TABLE IF NOT EXISTS dashboard_optimization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Input parameters
  load_tons NUMERIC(10, 2) NOT NULL,
  wet_bulb_c NUMERIC(5, 1) NOT NULL,
  current_chw_setpoint_c NUMERIC(5, 1) NOT NULL,
  current_limit_pct NUMERIC(5, 1) NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  is_weekend INTEGER NOT NULL CHECK (is_weekend IN (0, 1)),
  chillers_running INTEGER NOT NULL CHECK (chillers_running >= 1 AND chillers_running <= 4),

  -- Current configuration results
  current_efficiency NUMERIC(6, 3) NOT NULL,
  current_total_power NUMERIC(10, 1) NOT NULL,

  -- Optimal configuration results
  optimal_efficiency NUMERIC(6, 3) NOT NULL,
  optimal_total_power NUMERIC(10, 1) NOT NULL,

  -- Savings metrics
  power_saved_kw NUMERIC(10, 1) NOT NULL,
  improvement_percent NUMERIC(6, 2) NOT NULL,

  -- Recommendations
  recommended_setpoint NUMERIC(5, 1) NOT NULL,
  recommended_chillers INTEGER NOT NULL CHECK (recommended_chillers >= 1 AND recommended_chillers <= 4),

  -- Financial and environmental impact
  cost_savings_usd NUMERIC(10, 2) NOT NULL,
  co2_reduction_kg NUMERIC(10, 1) NOT NULL,

  -- Operator action text
  operator_action TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_dashboard_optimization_timestamp ON dashboard_optimization_history(timestamp DESC);
CREATE INDEX idx_dashboard_optimization_load ON dashboard_optimization_history(load_tons);
CREATE INDEX idx_dashboard_optimization_savings ON dashboard_optimization_history(power_saved_kw DESC);
CREATE INDEX idx_dashboard_optimization_month ON dashboard_optimization_history(month);

-- Create view for daily statistics
CREATE OR REPLACE VIEW dashboard_daily_stats AS
SELECT
  DATE(timestamp) as date,
  COUNT(*) as total_recommendations,
  ROUND(AVG(power_saved_kw)::NUMERIC, 1) as avg_power_saved_kw,
  ROUND(SUM(power_saved_kw)::NUMERIC, 1) as total_power_saved_kw,
  ROUND(SUM(cost_savings_usd)::NUMERIC, 2) as total_cost_saved_usd,
  ROUND(SUM(co2_reduction_kg)::NUMERIC, 1) as total_co2_reduced_kg,
  ROUND(AVG(improvement_percent)::NUMERIC, 2) as avg_improvement_percent,
  ROUND(AVG(current_total_power)::NUMERIC, 1) as avg_current_power_kw,
  ROUND(AVG(optimal_total_power)::NUMERIC, 1) as avg_optimal_power_kw
FROM dashboard_optimization_history
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Create view for monthly statistics
CREATE OR REPLACE VIEW dashboard_monthly_stats AS
SELECT
  DATE_TRUNC('month', timestamp)::DATE as month,
  COUNT(*) as total_recommendations,
  ROUND(AVG(power_saved_kw)::NUMERIC, 1) as avg_power_saved_kw,
  ROUND(SUM(power_saved_kw)::NUMERIC, 1) as total_power_saved_kw,
  ROUND(SUM(cost_savings_usd)::NUMERIC, 2) as total_cost_saved_usd,
  ROUND(SUM(co2_reduction_kg)::NUMERIC, 1) as total_co2_reduced_kg,
  ROUND(AVG(improvement_percent)::NUMERIC, 2) as avg_improvement_percent
FROM dashboard_optimization_history
GROUP BY DATE_TRUNC('month', timestamp)
ORDER BY month DESC;

-- Create view for chiller staging analysis
CREATE OR REPLACE VIEW dashboard_staging_analysis AS
SELECT
  chillers_running,
  recommended_chillers,
  COUNT(*) as frequency,
  ROUND(AVG(power_saved_kw)::NUMERIC, 1) as avg_power_saved_kw,
  ROUND(AVG(improvement_percent)::NUMERIC, 2) as avg_improvement_percent,
  ROUND(SUM(power_saved_kw)::NUMERIC, 1) as total_power_saved_kw
FROM dashboard_optimization_history
GROUP BY chillers_running, recommended_chillers
ORDER BY frequency DESC;

-- Enable Row Level Security (optional, for multi-tenant support)
ALTER TABLE dashboard_optimization_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read optimization history"
  ON dashboard_optimization_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create policy to allow all authenticated users to insert
CREATE POLICY "Allow authenticated users to insert optimization history"
  ON dashboard_optimization_history
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
