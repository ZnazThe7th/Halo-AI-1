-- Create user_data table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_data (
  email TEXT PRIMARY KEY,
  password_hash TEXT, -- Hashed password for email/password authentication
  business_profile JSONB,
  clients JSONB DEFAULT '[]'::jsonb,
  appointments JSONB DEFAULT '[]'::jsonb,
  expenses JSONB DEFAULT '[]'::jsonb,
  ratings JSONB DEFAULT '[]'::jsonb,
  bonus_entries JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_data_email ON user_data(email);

-- ================================================================
-- DEVICES TABLE — tracks device fingerprints per user
-- ================================================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES user_data(email) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'desktop', -- 'mobile' | 'desktop' | 'tablet'
  device_name TEXT NOT NULL DEFAULT 'Unknown Device',
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_email, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_email);

-- ================================================================
-- SAVEPOINTS TABLE — manual snapshots of app state
-- ================================================================
CREATE TABLE IF NOT EXISTS savepoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES user_data(email) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT 'Save Point',
  snapshot_json JSONB NOT NULL,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  device_type TEXT, -- denormalized for quick display
  device_name TEXT, -- denormalized for quick display
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savepoints_user ON savepoints(user_email);
CREATE INDEX IF NOT EXISTS idx_savepoints_created ON savepoints(created_at DESC);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE savepoints ENABLE ROW LEVEL SECURITY;

-- user_data policies
CREATE POLICY "Users can read their own data"
  ON user_data FOR SELECT USING (true);
CREATE POLICY "Users can update their own data"
  ON user_data FOR UPDATE USING (true);
CREATE POLICY "Users can insert their own data"
  ON user_data FOR INSERT WITH CHECK (true);

-- devices policies
CREATE POLICY "Devices full access"
  ON devices FOR ALL USING (true);

-- savepoints policies
CREATE POLICY "Savepoints full access"
  ON savepoints FOR ALL USING (true);
