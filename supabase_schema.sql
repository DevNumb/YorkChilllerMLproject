-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Maintenance Tasks Table
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    frequency_days INTEGER NOT NULL,
    last_completed TIMESTAMPTZ,
    next_due TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_to TEXT,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    estimated_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance History Table
CREATE TABLE IF NOT EXISTS maintenance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
    completed_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_by TEXT,
    duration_minutes INTEGER DEFAULT 0,
    notes TEXT,
    parts_replaced TEXT,
    cost NUMERIC DEFAULT 0,
    attachments JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance Stats Table
CREATE TABLE IF NOT EXISTS maintenance_stats (
    id TEXT PRIMARY KEY, -- stats-year-month-taskId
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    task_id UUID REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
    completed_count INTEGER DEFAULT 0,
    total_duration_minutes INTEGER DEFAULT 0,
    average_completion_days INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_maintenance_tasks_updated_at
    BEFORE UPDATE ON maintenance_tasks
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Seed data for maintenance_tasks (optional, based on DEFAULT_TASKS)
INSERT INTO maintenance_tasks (name, category, frequency_days, priority, estimated_minutes, next_due)
VALUES 
('Clean condenser coils', 'cleaning', 30, 'high', 60, NOW() + INTERVAL '30 days'),
('Check refrigerant levels', 'refrigerant', 90, 'high', 45, NOW() + INTERVAL '90 days'),
('Inspect and replace filters', 'filters', 45, 'medium', 30, NOW() + INTERVAL '45 days'),
('Calibrate sensors', 'calibration', 180, 'medium', 90, NOW() + INTERVAL '180 days'),
('Inspect electrical connections', 'inspection', 60, 'high', 45, NOW() + INTERVAL '60 days'),
('Lubricate moving parts', 'cleaning', 90, 'medium', 30, NOW() + INTERVAL '90 days'),
('Test safety controls', 'inspection', 30, 'high', 60, NOW() + INTERVAL '30 days'),
('Check belt tension', 'inspection', 60, 'medium', 20, NOW() + INTERVAL '60 days')
ON CONFLICT DO NOTHING;
