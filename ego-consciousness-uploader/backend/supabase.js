// JAKE/ZHENGFENG: Supabase client and database operations

import { mockSupabase } from './mock-data.js';

// Check if running in demo mode (no API keys)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const USE_MOCK = !supabaseUrl || !supabaseKey;

let supabase = null;

// Only import and create real client if we have credentials
if (!USE_MOCK) {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, supabaseKey);
}

if (USE_MOCK) {
  console.log('⚠️  Running in DEMO MODE - Using mock Supabase (no real database)');
}

// Create a new profile
export async function createProfile(fullName) {
  if (USE_MOCK) return mockSupabase.createProfile(fullName);

  const { data, error } = await supabase
    .from('profiles')
    .insert([
      {
        full_name: fullName,
        is_ego_ready: false
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get profile by ID
export async function getProfile(sessionId) {
  if (USE_MOCK) return mockSupabase.getProfile(sessionId);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

// Update profile
export async function updateProfile(sessionId, updates) {
  if (USE_MOCK) return mockSupabase.updateProfile(sessionId, updates);

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Upload audio file to storage
export async function uploadAudio(sessionId, audioFile) {
  if (USE_MOCK) return mockSupabase.uploadAudio(sessionId, audioFile);

  const fileName = `${sessionId}-${Date.now()}.webm`;
  const { data, error } = await supabase.storage
    .from('voice-samples')
    .upload(fileName, audioFile, {
      contentType: 'audio/webm'
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('voice-samples')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// Save conversation message
export async function saveMessage(sessionId, role, content, audioUrl = null) {
  if (USE_MOCK) return mockSupabase.saveMessage(sessionId, role, content, audioUrl);

  const { data, error } = await supabase
    .from('conversations')
    .insert([
      {
        profile_id: sessionId,
        role,
        content,
        audio_url: audioUrl
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get conversation history
export async function getConversationHistory(sessionId) {
  if (USE_MOCK) return mockSupabase.getConversationHistory(sessionId);

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('profile_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}
