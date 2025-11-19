-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('public', 'private')),
  password_hash VARCHAR(255),
  owner_id UUID REFERENCES auth.users(id),
  created_by_authenticated_user BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  auto_clear_history BOOLEAN DEFAULT false,
  clear_after_days INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_members table for private room access control
CREATE TABLE IF NOT EXISTS room_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages(room_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_timestamp ON messages(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);

-- Enable pg_cron extension for scheduled jobs (may need superuser access)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Database function for automated 24-hour public message cleanup
CREATE OR REPLACE FUNCTION cleanup_old_public_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages
  WHERE created_at < NOW() - INTERVAL '24 hours'
  AND room_id IN (SELECT id FROM chat_rooms WHERE type = 'public');
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup every hour using pg_cron (uncomment if pg_cron is available)
-- SELECT cron.schedule('cleanup-public-messages', '0 * * * *', 'SELECT cleanup_old_public_messages();');

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Anyone can read user profiles" ON user_profiles
  FOR SELECT USING (true);

-- Chat rooms policies
CREATE POLICY "Public rooms are readable by everyone" ON chat_rooms
  FOR SELECT USING (type = 'public');

CREATE POLICY "Private rooms readable by authenticated users" ON chat_rooms
  FOR SELECT USING (type = 'private' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can create public rooms" ON chat_rooms
  FOR INSERT WITH CHECK (type = 'public');

CREATE POLICY "Authenticated users can create private rooms" ON chat_rooms
  FOR INSERT WITH CHECK (type = 'private' AND auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Room owners can update private rooms" ON chat_rooms
  FOR UPDATE USING (owner_id = auth.uid());

-- Messages policies
CREATE POLICY "Public messages readable by everyone" ON messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM chat_rooms WHERE chat_rooms.id = messages.room_id AND chat_rooms.type = 'public'
  ));

CREATE POLICY "Private messages readable by room members" ON messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = messages.room_id
    AND room_members.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can insert messages to public rooms" ON messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM chat_rooms WHERE chat_rooms.id = room_id AND chat_rooms.type = 'public'
  ));

CREATE POLICY "Room members can insert messages to private rooms" ON messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = room_id
    AND room_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own messages" ON messages
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Room owners can delete messages in their rooms" ON messages
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE chat_rooms.id = messages.room_id
    AND chat_rooms.owner_id = auth.uid()
  ));

-- Room members policies
CREATE POLICY "Users can join private rooms with password" ON room_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_rooms WHERE chat_rooms.id = room_id AND chat_rooms.type = 'private')
    AND auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

CREATE POLICY "Room members can view their memberships" ON room_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can leave rooms" ON room_members
  FOR DELETE USING (user_id = auth.uid());

-- User settings policies
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (user_id::text = auth.uid()::text);

-- Insert default rooms
INSERT INTO chat_rooms (name, type) VALUES
  ('Public Room', 'public')
ON CONFLICT DO NOTHING;