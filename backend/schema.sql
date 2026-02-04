-- Create user_data table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_data (
  email TEXT PRIMARY KEY,
  business_profile JSONB,
  clients JSONB DEFAULT '[]'::jsonb,
  appointments JSONB DEFAULT '[]'::jsonb,
  expenses JSONB DEFAULT '[]'::jsonb,
  ratings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_data_email ON user_data(email);

-- Enable Row Level Security (RLS)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read/write their own data
-- Note: In production, you'd want more sophisticated auth
CREATE POLICY "Users can read their own data"
  ON user_data FOR SELECT
  USING (true); -- Simplified for MVP - in production, verify email matches session

CREATE POLICY "Users can update their own data"
  ON user_data FOR UPDATE
  USING (true); -- Simplified for MVP

CREATE POLICY "Users can insert their own data"
  ON user_data FOR INSERT
  WITH CHECK (true); -- Simplified for MVP
