-- JAKE/ZHENGFENG: Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  voice_sample_url TEXT,
  scraped_data_json JSONB,
  master_prompt TEXT,
  elevenlabs_voice_id TEXT,
  is_ego_ready BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_conversations_profile_id ON conversations(profile_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);

-- Create storage buckets (run these in Supabase Dashboard -> Storage)
-- 1. Create bucket: voice-samples (public)
-- 2. Create bucket: chat-audio (public)

-- Enable RLS (Row Level Security) - optional for MVP
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies (optional for MVP - allows all access)
CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all access to conversations" ON conversations FOR ALL USING (true);
