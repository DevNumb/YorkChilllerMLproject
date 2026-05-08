-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  company TEXT,
  role TEXT DEFAULT 'operator',
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audit log table for tracking user actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Create indexes for better query performance
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for audit_logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for user_sessions
CREATE POLICY "Users can view their own sessions"
  ON user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON user_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to log user actions
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_details)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update user session
CREATE OR REPLACE FUNCTION public.update_user_session(
  p_device_name TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO public.user_sessions (user_id, device_name, device_type)
  VALUES (auth.uid(), p_device_name, p_device_type)
  RETURNING id INTO v_session_id;
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for user dashboard stats
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT
  up.id,
  up.email,
  up.full_name,
  up.company,
  up.role,
  COUNT(DISTINCT al.id) as total_actions,
  COUNT(DISTINCT us.id) as active_sessions,
  MAX(al.created_at) as last_activity,
  up.created_at as joined_date
FROM user_profiles up
LEFT JOIN audit_logs al ON up.id = al.user_id
LEFT JOIN user_sessions us ON up.id = us.user_id AND us.expires_at > NOW()
GROUP BY up.id, up.email, up.full_name, up.company, up.role, up.created_at;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON user_profiles TO authenticated;
GRANT UPDATE ON user_profiles TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON user_sessions TO authenticated;
GRANT DELETE ON user_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_action TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_session TO authenticated;
