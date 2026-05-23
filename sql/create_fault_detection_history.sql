-- Fault Detection History Table
CREATE TABLE IF NOT EXISTS fault_detection_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    cooling_load NUMERIC,
    wet_bulb NUMERIC,
    chiller_data JSONB, -- Stores speed, fan, flow for all units
    prediction TEXT,
    fault_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (Assuming public access for now as per other tables in this project context)
ALTER TABLE fault_detection_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON fault_detection_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON fault_detection_history FOR INSERT WITH CHECK (true);
