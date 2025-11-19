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