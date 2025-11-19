import { supabase, DatabaseMessage, DatabaseUserSettings, DatabaseUserProfile, DatabaseRoom, DatabaseRoomMember, getCurrentUser, signInWithEmail, signUpWithEmail, signOut, authenticateForPrivateRoom, clearPrivateRoomHistory } from './supabase'

export class ChatDatabaseService {
  private static instance: ChatDatabaseService
  private userId: string | null = null
  private currentUser: any = null
  private realtimeSubscriptions: Map<string, any> = new Map()

  private constructor() {
    this.userId = this.generateUserId()
  }

  static getInstance(): ChatDatabaseService {
    if (!ChatDatabaseService.instance) {
      ChatDatabaseService.instance = new ChatDatabaseService()
    }
    return ChatDatabaseService.instance
  }

  private generateUserId(): string {
    // For authenticated users, use their actual UUID
    if (this.currentUser) {
      return this.currentUser.id
    }

    // For anonymous users, use a generated ID
    let userId = localStorage.getItem('chat_user_id')
    if (!userId) {
      userId = `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('chat_user_id', userId)
    }
    return userId
  }

  // Initialize user authentication
  async initializeAuth(): Promise<void> {
    this.currentUser = await getCurrentUser()
    if (this.currentUser) {
      this.userId = this.currentUser.id
      localStorage.setItem('chat_user_id', this.currentUser.id)
    }
  }

  // User profile operations
  async getUserProfile(): Promise<DatabaseUserProfile | null> {
    try {
      if (!this.userId) return null
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  async saveUserProfile(profile: { display_name: string; email: string; avatar_url?: string }): Promise<DatabaseUserProfile | null> {
    try {
      if (!this.userId) return null

      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: this.userId,
          display_name: profile.display_name,
          email: profile.email,
          avatar_url: profile.avatar_url || null,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error saving user profile:', error)
      return null
    }
  }

  // Message operations
  async saveMessage(roomId: string, message: Omit<DatabaseMessage, 'id' | 'created_at'>): Promise<DatabaseMessage | null> {
    try {
      if (!this.userId) return null

      const { data, error } = await supabase
        .from('messages')
        .insert({
          ...message,
          room_id: roomId,
          user_id: this.userId,
          timestamp: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving message:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error saving message:', error)
      return null
    }
  }

  async getMessages(roomId: string, limit: number = 100): Promise<DatabaseMessage[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching messages:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching messages:', error)
      return []
    }
  }

  async clearChatHistory(roomId: string): Promise<boolean> {
    try {
      if (!this.userId) return false

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', this.userId)

      if (error) {
        console.error('Error clearing chat history:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error clearing chat history:', error)
      return false
    }
  }

  async clearAllChatHistory(): Promise<boolean> {
    try {
      if (!this.userId) return false

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('user_id', this.userId)

      if (error) {
        console.error('Error clearing all chat history:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error clearing all chat history:', error)
      return false
    }
  }

  // Clean up old public room messages (older than 24 hours)
  async cleanupOldPublicMessages(): Promise<void> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', 'public')
        .lt('timestamp', twentyFourHoursAgo)
        .not('user_id', this.userId) // Don't delete user's own messages

      if (error) {
        console.error('Error cleaning up old public messages:', error)
      }
    } catch (error) {
      console.error('Error cleaning up old public messages:', error)
    }
  }

  // User settings operations
  async getUserSettings(): Promise<DatabaseUserSettings | null> {
    try {
      if (!this.userId) return null

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', this.userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user settings:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user settings:', error)
      return null
    }
  }

  async saveUserSettings(settings: Omit<DatabaseUserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<DatabaseUserSettings | null> {
    try {
      if (!this.userId) return null

      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          ...settings,
          user_id: this.userId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving user settings:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error saving user settings:', error)
      return null
    }
  }

  // Utility functions
  isSupabaseConfigured(): boolean {
    return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  }

  convertToDatabaseMessage(message: any): DatabaseMessage {
    return {
      id: message.id,
      room_id: message.room_id || 'public',
      user_id: message.user_id || this.userId || 'anonymous',
      user_name: message.author || message.user_name,
      user_avatar: message.avatar || message.user_avatar,
      content: message.content,
      attachments: message.attachments || [],
      timestamp: message.timestamp || message.created_at,
      created_at: message.created_at
    }
  }

  convertFromDatabaseMessage(dbMessage: DatabaseMessage): any {
    return {
      id: dbMessage.id,
      author: dbMessage.user_name,
      avatar: dbMessage.user_avatar || '',
      content: dbMessage.content,
      attachments: dbMessage.attachments,
      timestamp: new Date(dbMessage.timestamp),
      isOwn: dbMessage.user_id === this.userId
    }
  }

  // Auto-clear history based on user settings
  async autoClearHistoryIfNeeded(): Promise<void> {
    try {
      const settings = await this.getUserSettings()
      if (settings && settings.auto_clear_history) {
        const clearAfterDays = settings.clear_after_days || 30
        const cutoffDate = new Date(Date.now() - clearAfterDays * 24 * 60 * 60 * 1000).toISOString()

        // Clear old messages from all rooms
        const { error } = await supabase
          .from('messages')
          .delete()
          .lt('timestamp', cutoffDate)
          .eq('user_id', this.userId)

        if (error) {
          console.error('Error auto-clearing history:', error)
        }
      }
    } catch (error) {
      console.error('Error auto-clearing history:', error)
    }
  }

  // Room operations
  async getRooms(): Promise<DatabaseRoom[]> {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching rooms:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching rooms:', error)
      return []
    }
  }

  async getRoom(roomId: string): Promise<DatabaseRoom | null> {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (error) {
        console.error('Error fetching room:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching room:', error)
      return null
    }
  }

  async isRoomMember(roomId: string): Promise<boolean> {
    try {
      if (!this.currentUser) return false

      const { data, error } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', this.currentUser.id)
        .single()

      return !error && !!data
    } catch (error) {
      console.error('Error checking room membership:', error)
      return false
    }
  }

  async getRoomMembership(roomId: string): Promise<DatabaseRoomMember | null> {
    try {
      if (!this.currentUser) return null

      const { data, error } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', this.currentUser.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching room membership:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching room membership:', error)
      return null
    }
  }

  async joinRoom(roomId: string, password?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const room = await this.getRoom(roomId)
      if (!room) {
        return { success: false, error: 'Room not found' }
      }

      if (room.type === 'public') {
        return { success: true }
      }

      if (room.type === 'private') {
        if (!this.currentUser) {
          return { success: false, error: 'Authentication required for private rooms' }
        }

        if (!password) {
          return { success: false, error: 'Password required for private rooms' }
        }

        const isAuthenticated = await authenticateForPrivateRoom(roomId, password)
        if (!isAuthenticated) {
          return { success: false, error: 'Invalid password' }
        }

        return { success: true }
      }

      return { success: false, error: 'Unknown room type' }
    } catch (error) {
      console.error('Error joining room:', error)
      return { success: false, error: 'Failed to join room' }
    }
  }

  async clearPrivateRoom(roomId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await clearPrivateRoomHistory(roomId)
      return result
    } catch (error) {
      console.error('Error clearing private room:', error)
      return { success: false, error: 'Failed to clear room history' }
    }
  }

  // Real-time subscriptions
  setupPublicRoomRealtime(roomId: string, onNewMessage: (message: DatabaseMessage) => void): () => void {
    const channelName = `public-room-${roomId}`

    // Remove existing subscription if any
    if (this.realtimeSubscriptions.has(channelName)) {
      supabase.removeChannel(this.realtimeSubscriptions.get(channelName))
    }

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          onNewMessage(payload.new as DatabaseMessage)
        }
      )
      .subscribe()

    this.realtimeSubscriptions.set(channelName, subscription)

    // Return cleanup function
    return () => {
      supabase.removeChannel(subscription)
      this.realtimeSubscriptions.delete(channelName)
    }
  }

  // Message sending with room type detection
  async sendMessage(roomId: string, content: string, userName?: string, userAvatar?: string): Promise<DatabaseMessage | null> {
    try {
      const room = await this.getRoom(roomId)
      if (!room) {
        console.error('Room not found:', roomId)
        return null
      }

      // For private rooms, check if user is a member
      if (room.type === 'private') {
        const isMember = await this.isRoomMember(roomId)
        if (!isMember) {
          console.error('User is not a member of private room:', roomId)
          return null
        }
      }

      const messageData = {
        room_id: roomId,
        user_id: this.currentUser?.id || null, // Will be null for anonymous users
        user_name: userName || 'Anonymous',
        user_avatar: userAvatar || null,
        content,
        attachments: [] as any[],
        timestamp: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single()

      if (error) {
        console.error('Error sending message:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error sending message:', error)
      return null
    }
  }

  // Cleanup subscriptions on service destruction
  cleanup(): void {
    this.realtimeSubscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription)
    })
    this.realtimeSubscriptions.clear()
  }
}