import { createClient, Session, User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Database features will be disabled.')
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

// Auth helpers
export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const signInWithEmail = async (email: string, password: string): Promise<{ user: User; session: Session } | { error: string }> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  
  if (error) {
    return { error: error.message }
  }
  
  return { user: data.user!, session: data.session! }
}

export const signUpWithEmail = async (email: string, password: string, name?: string): Promise<{ user: User; session: Session } | { error: string }> => {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password, 
    options: {
      data: {
        display_name: name || email.split('@')[0]
      }
    }
  })
  
  if (error) {
    return { error: error.message }
  }
  
  return { user: data.user!, session: data.session! }
}

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut()
}

export const onAuthStateChange = (callback: (event: any) => void) => {
  supabase.auth.onAuthStateChange((event) => {
    callback(event)
  })
}

export interface DatabaseMessage {
  id: string
  room_id: string
  user_id: string
  user_name: string
  user_avatar: string | null
  content: string
  attachments: any[]
  timestamp: string
  created_at: string
}

export interface DatabaseRoom {
  id: string
  name: string
  type: 'public' | 'private'
  password_hash: string | null
  owner_id: string | null
  created_by_authenticated_user: boolean
  created_at: string
  updated_at: string
}

export interface DatabaseUserSettings {
  id: string
  user_id: string
  auto_clear_history: boolean
  clear_after_days: number
  created_at: string
  updated_at: string
}

export interface DatabaseUserProfile {
  id: string
  user_id: string
  display_name: string
  email: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface DatabaseRoomMember {
  id: string
  room_id: string
  user_id: string
  joined_at: string
}

// Password utilities (using a simple hash for now - in production use bcrypt on server-side)
export const hashPassword = async (password: string): Promise<string> => {
  // For client-side, we'll use a simple hash. In production, this should be done server-side
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'salt_for_client_side')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  const inputHash = await hashPassword(password)
  return inputHash === hashedPassword
}

// Generate random 4-digit password
export const generateRoomPassword = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Private room authentication functions
export const createPrivateRoom = async (name: string, password: string): Promise<{ roomId: string; error?: string }> => {
  const user = await getCurrentUser()
  if (!user) {
    return { roomId: '', error: 'Authentication required to create private room' }
  }

  const passwordHash = await hashPassword(password)

  const { data, error } = await supabase
    .from('chat_rooms')
    .insert({
      name,
      type: 'private',
      password_hash: passwordHash,
      owner_id: user.id,
      created_by_authenticated_user: true
    })
    .select()
    .single()

  if (error) {
    return { roomId: '', error: error.message }
  }

  // Add creator as room member
  await supabase
    .from('room_members')
    .insert({
      room_id: data.id,
      user_id: user.id
    })

  return { roomId: data.id }
}

export const joinPrivateRoom = async (roomId: string, password: string): Promise<{ success: boolean; error?: string }> => {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Authentication required to join private room' }
  }

  // Get room and verify password
  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .select('password_hash, type')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    return { success: false, error: 'Room not found' }
  }

  if (room.type !== 'private') {
    return { success: false, error: 'Not a private room' }
  }

  const isPasswordValid = await verifyPassword(password, room.password_hash || '')
  if (!isPasswordValid) {
    return { success: false, error: 'Invalid password' }
  }

  // Add user to room members
  const { error: memberError } = await supabase
    .from('room_members')
    .insert({
      room_id: roomId,
      user_id: user.id
    })

  if (memberError) {
    // Check if already a member
    if (memberError.code !== '23505') {
      return { success: false, error: memberError.message }
    }
  }

  return { success: true }
}

export const authenticateForPrivateRoom = async (roomId: string, password: string): Promise<boolean> => {
  const user = await getCurrentUser()
  if (!user) {
    return false
  }

  // Check if user is already a member
  const { data: member } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single()

  if (member) {
    return true
  }

  // Try to join with password
  const result = await joinPrivateRoom(roomId, password)
  return result.success
}

export const clearPrivateRoomHistory = async (roomId: string): Promise<{ success: boolean; error?: string }> => {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  // Check if user is room owner
  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .select('owner_id')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    return { success: false, error: 'Room not found' }
  }

  if (room.owner_id !== user.id) {
    return { success: false, error: 'Only room owner can clear history' }
  }

  // Delete all messages in the room
  const { error: deleteError } = await supabase
    .from('messages')
    .delete()
    .eq('room_id', roomId)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  return { success: true }
}

export const getRoomPassword = async (roomId: string): Promise<string | null> => {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .select('password_hash, owner_id')
    .eq('id', roomId)
    .single()

  if (error || !room || room.owner_id !== user.id) {
    return null
  }

  return room.password_hash
}

export const verifyRoomPassword = async (roomId: string, password: string): Promise<boolean> => {
  const { data: room, error } = await supabase
    .from('chat_rooms')
    .select('password_hash, type')
    .eq('id', roomId)
    .single()

  if (error || !room || room.type !== 'private') {
    return false
  }

  return await verifyPassword(password, room.password_hash || '')
}