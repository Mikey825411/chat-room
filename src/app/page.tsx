'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Copy, Send, User, Settings, Users, Lock, AlertCircle, Trash2, Database, Loader2, Plus, Eye } from 'lucide-react'
import { ChatDatabaseService } from '@/lib/chat-database'
import { signInWithEmail, signUpWithEmail, signOut, createPrivateRoom, getCurrentUser, DatabaseRoom } from '@/lib/supabase'
import { PrivateRoomPasswordDialog } from '@/components/PrivateRoomPasswordDialog'
import { CreatePrivateRoomDialog } from '@/components/CreatePrivateRoomDialog'
import { PrivateRoomManagement } from '@/components/PrivateRoomManagement'

interface Message {
  id: string
  author: string
  avatar: string
  content: string
  timestamp: Date
  isOwn?: boolean
  attachments?: Attachment[]
}

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  data: string
  url?: string
}

export default function ChatApp() {
  const [profile, setProfile] = useState({ name: '', avatar: '' })
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dbService, setDbService] = useState<ChatDatabaseService | null>(null)

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState<'login' | 'register' | 'profile' | null>(null)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signUpName, setSignUpName] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')

  // Room state
  const [rooms, setRooms] = useState<DatabaseRoom[]>([])
  const [currentRoom, setCurrentRoom] = useState<DatabaseRoom | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showCreateRoomDialog, setShowCreateRoomDialog] = useState(false)
  const [selectedRoomForPassword, setSelectedRoomForPassword] = useState<DatabaseRoom | null>(null)
  const [realtimeUnsubscribe, setRealtimeUnsubscribe] = useState<(() => void) | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize database service and auth
  useEffect(() => {
    const service = ChatDatabaseService.getInstance()
    setDbService(service)

    if (service.isSupabaseConfigured()) {
      initializeAuth(service)
      loadRooms(service)
      loadStoredProfile()
    }
  }, [])

  // Clean up realtime subscriptions
  useEffect(() => {
    return () => {
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe()
      }
    }
  }, [realtimeUnsubscribe])

  // Load stored profile
  const loadStoredProfile = () => {
    const storedProfile = localStorage.getItem('chatProfile')
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile)
        setProfile({ name: parsed.name || '', avatar: parsed.avatar || '' })
      } catch (error) {
        console.error('Error parsing stored profile:', error)
      }
    }
  }

  // Initialize auth
  const initializeAuth = async (service: ChatDatabaseService) => {
    try {
      await service.initializeAuth()
      const user = await getCurrentUser()
      setCurrentUser(user)
      setIsAuthenticated(!!user)
    } catch (error) {
      console.error('Error initializing auth:', error)
    }
  }

  // Load rooms
  const loadRooms = async (service: ChatDatabaseService) => {
    try {
      const roomList = await service.getRooms()
      setRooms(roomList)

      // Auto-select public room
      const publicRoom = roomList.find(room => room.type === 'public')
      if (publicRoom) {
        await selectRoom(publicRoom, service)
      }
    } catch (error) {
      console.error('Error loading rooms:', error)
    }
  }

  // Select a room
  const selectRoom = async (room: DatabaseRoom, service: ChatDatabaseService) => {
    // Check private room access
    if (room.type === 'private' && !isAuthenticated) {
      setSelectedRoomForPassword(room)
      setShowPasswordDialog(true)
      return
    }

    // For private rooms, check if user is a member
    if (room.type === 'private' && isAuthenticated) {
      const isMember = await service.isRoomMember(room.id)
      if (!isMember) {
        setSelectedRoomForPassword(room)
        setShowPasswordDialog(true)
        return
      }
    }

    // Clean up previous subscription
    if (realtimeUnsubscribe) {
      realtimeUnsubscribe()
      setRealtimeUnsubscribe(null)
    }

    // Load room messages
    try {
      const roomMessages = await service.getMessages(room.id)
      setMessages(roomMessages.map(msg => service.convertFromDatabaseMessage(msg)))
      setCurrentRoom(room)

      // Set up real-time subscription for public rooms
      if (room.type === 'public') {
        const unsubscribe = service.setupPublicRoomRealtime(room.id, (newMessage) => {
          setMessages(prev => [...prev, service.convertFromDatabaseMessage(newMessage)])
        })
        setRealtimeUnsubscribe(() => unsubscribe)
      }
    } catch (error) {
      console.error('Error selecting room:', error)
    }
  }

  // Handle room click
  const handleRoomClick = async (room: DatabaseRoom) => {
    if (!dbService) return

    if (room.type === 'private' && !isAuthenticated) {
      setSelectedRoomForPassword(room)
      setAuthDialogOpen('login')
      return
    }

    await selectRoom(room, dbService)
  }

  // Handle private room password entry
  const handlePrivateRoomJoin = async (password: string) => {
    if (!dbService || !selectedRoomForPassword) {
      return { success: false, error: 'Room not selected' }
    }

    try {
      const result = await dbService.joinRoom(selectedRoomForPassword.id, password)
      if (result.success) {
        await selectRoom(selectedRoomForPassword, dbService)
        setShowPasswordDialog(false)
        setSelectedRoomForPassword(null)
      }
      return result
    } catch (error) {
      return { success: false, error: 'Failed to join room' }
    }
  }

  // Handle private room creation
  const handleCreatePrivateRoom = async (roomName: string, password: string) => {
    try {
      const result = await createPrivateRoom(roomName, password)
      if (result.roomId) {
        if (dbService) {
          await loadRooms(dbService)
        }
        return { roomId: result.roomId }
      }
      return { roomId: '', error: result.error }
    } catch (error) {
      return { roomId: '', error: 'Failed to create room' }
    }
  }

  // Handle private room management
  const handleClearPrivateRoom = async (roomId: string) => {
    if (!dbService) return { success: false, error: 'Database service not available' }

    try {
      const result = await dbService.clearPrivateRoom(roomId)
      if (result.success && currentRoom?.id === roomId) {
        setMessages([])
      }
      return result
    } catch (error) {
      return { success: false, error: 'Failed to clear room' }
    }
  }

  const handleChangePassword = async (newPassword: string) => {
    // This would need to be implemented in the database service
    // For now, return a placeholder
    return { success: true, error: undefined }
  }

  // Check if user is room owner
  const isRoomOwner = (room: DatabaseRoom) => {
    return room.owner_id === currentUser?.id
  }

  // Profile management
  const updateProfile = (name: string, avatar: string) => {
    setProfile({ name, avatar })
    localStorage.setItem('chatProfile', JSON.stringify({ name, avatar }))
    setProfileDialogOpen(false)

    if (dbService && dbService.isSupabaseConfigured() && currentUser) {
      dbService.saveUserProfile({
        display_name: name,
        email: currentUser.email,
        avatar_url: avatar
      })
    }
  }

  // Message sending
  const sendMessage = async () => {
    if (!currentRoom || (!messageInput.trim() && attachments.length === 0) || !profile.name) return

    if (!dbService) return

    try {
      const processedAttachments = await processFiles(attachments)

      // Create message object
      const messageData = {
        room_id: currentRoom.id,
        user_name: profile.name,
        user_avatar: profile.avatar,
        content: messageInput,
        attachments: processedAttachments,
        timestamp: new Date().toISOString()
      }

      const dbMessage = await dbService.sendMessage(
        currentRoom.id,
        messageInput,
        profile.name,
        profile.avatar
      )

      if (dbMessage) {
        const newMessage = dbService.convertFromDatabaseMessage(dbMessage)
        newMessage.isOwn = true
        setMessages(prev => [...prev, newMessage])

        setMessageInput('')
        setAttachments([])
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  // File processing
  const processFiles = async (files: File[]): Promise<any[]> => {
    const processedFiles = []
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`)
        continue
      }
      const attachment = await fileToAttachment(file)
      processedFiles.push(attachment)
    }
    return processedFiles
  }

  const fileToAttachment = async (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result as string,
          url: reader.result as string
        })
      }
      reader.readAsDataURL(file)
    })
  }

  // Auth handlers
  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) return

    try {
      setAuthLoading(true)
      setAuthError('')

      const result = await signInWithEmail(email, password)

      if ('error' in result) {
        setAuthError(result.error)
      } else {
        setAuthDialogOpen(null)
        setCurrentUser(result.user)
        setIsAuthenticated(true)
      }
    } catch (error) {
      setAuthError('Login failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!signUpEmail.trim() || !signUpPassword.trim() || !signUpName.trim()) return

    try {
      setAuthLoading(true)
      setAuthError('')

      const result = await signUpWithEmail(signUpEmail, signUpPassword, signUpName)

      if ('error' in result) {
        setAuthError(result.error)
      } else {
        setAuthDialogOpen(null)
        setCurrentUser(result.user)
        setIsAuthenticated(true)
      }
    } catch (error) {
      setAuthError('Registration failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setCurrentUser(null)
      setIsAuthenticated(false)
      setAuthDialogOpen(null)

      // Switch to public room if currently in private room
      if (currentRoom?.type === 'private') {
        const publicRoom = rooms.find(room => room.type === 'public')
        if (publicRoom && dbService) {
          await selectRoom(publicRoom, dbService)
        }
      }
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Utility functions
  const formatTime = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Database className="w-4 h-4" />
    if (type.startsWith('video/')) return <Database className="w-4 h-4" />
    if (type.startsWith('audio/')) return <Database className="w-4 h-4" />
    return <Database className="w-4 h-4" />
  }

  const renderAttachment = (attachment: any) => {
    const isImage = attachment.type.startsWith('image/')

    return (
      <div key={attachment.id} className="border border-green-400 bg-black p-2 rounded mt-2">
        <div className="flex items-center gap-2 mb-2">
          {getFileIcon(attachment.type)}
          <span className="text-xs truncate flex-1">{attachment.name}</span>
        </div>

        {isImage && (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
          />
        )}

        {!isImage && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              const link = document.createElement('a')
              link.href = attachment.data
              link.download = attachment.name
              link.click()
            }}
          >
            Download
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <Card className="bg-black border-green-400">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border-2 border-green-400 bg-black flex items-center justify-center">
                  {currentUser?.user_metadata?.avatar_url ? (
                    <img src={currentUser.user_metadata.avatar_url} className="w-8 h-8" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-green-400 font-bold">
                    {currentUser?.user_metadata?.display_name || profile.name || 'Guest'}
                  </div>
                  <div className="text-xs text-green-600">
                    {isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setAuthDialogOpen(isAuthenticated ? 'profile' : 'login')}
                  variant="outline"
                  className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                >
                  {isAuthenticated ? 'PROFILE' : 'LOGIN'}
                </Button>

                {isAuthenticated && (
                  <>
                    <Button
                      onClick={() => setShowCreateRoomDialog(true)}
                      variant="outline"
                      className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      CREATE ROOM
                    </Button>
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
                    >
                      LOGOUT
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Room List */}
          <Card className="bg-black border-green-400 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-green-400 text-sm">ROOMS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rooms.map((room) => (
                <Button
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  variant={currentRoom?.id === room.id ? "default" : "outline"}
                  className={`w-full justify-start ${
                    currentRoom?.id === room.id
                      ? 'bg-green-400 text-black'
                      : 'border-green-400 text-green-400 hover:bg-green-400 hover:text-black'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    {room.type === 'private' && <Lock className="w-4 h-4" />}
                    {room.type === 'public' && <Users className="w-4 h-4" />}
                    <span className="truncate flex-1 text-left">{room.name}</span>
                    {room.type === 'public' && (
                      <Badge variant="outline" className="text-xs">
                        24h
                      </Badge>
                    )}
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="bg-black border-green-400 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                {currentRoom?.type === 'private' && <Lock className="w-4 h-4" />}
                {currentRoom?.type === 'public' && <Users className="w-4 h-4" />}
                {currentRoom?.name || 'Select a room'}
                {currentRoom?.type === 'public' && (
                  <Badge variant="outline" className="text-xs">
                    Messages auto-delete after 24 hours
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentRoom ? (
                <>
                  {/* Room Management for Private Room Owners */}
                  {currentRoom.type === 'private' && isRoomOwner(currentRoom) && (
                    <div className="mb-4">
                      <PrivateRoomManagement
                        roomId={currentRoom.id}
                        roomName={currentRoom.name}
                        isOwner={true}
                        onClearHistory={handleClearPrivateRoom}
                        onChangePassword={handleChangePassword}
                      />
                    </div>
                  )}

                  {/* Messages */}
                  <ScrollArea className="h-96 w-full border-2 border-green-400 bg-black p-4 mb-4">
                    <div className="space-y-2">
                      {messages.length === 0 ? (
                        <div className="text-center text-xs text-green-600">
                          No messages yet. Start chatting!
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <div key={msg.id} className={`flex gap-2 ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                            {!msg.isOwn && (
                              <div className="w-8 h-8 border-2 border-green-400 bg-black flex-shrink-0 flex items-center justify-center">
                                {msg.avatar ? (
                                  <img src={msg.avatar} alt={msg.author} className="w-6 h-6" />
                                ) : (
                                  <User className="w-4 h-4" />
                                )}
                              </div>
                            )}
                            <div className={`max-w-xs ${msg.isOwn ? 'text-right' : 'text-left'}`}>
                              <div className="text-xs text-green-600 mb-1">{msg.author}</div>
                              {msg.content && (
                                <div className={`border border-green-400 bg-black p-2 ${msg.isOwn ? 'bg-green-950' : ''}`}>
                                  {msg.content}
                                </div>
                              )}
                              {msg.attachments?.map(renderAttachment)}
                              <div className="text-xs text-green-600 mt-1">{formatTime(msg.timestamp)}</div>
                            </div>
                            {msg.isOwn && (
                              <div className="w-8 h-8 border-2 border-green-400 bg-black flex-shrink-0 flex items-center justify-center">
                                {msg.avatar ? (
                                  <img src={msg.avatar} alt={msg.author} className="w-6 h-6" />
                                ) : (
                                  <User className="w-4 h-4" />
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="space-y-2">
                    {attachments.map(renderAttachment)}
                    <div className="flex gap-2">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                        className="hidden"
                        id="fileInput"
                      />
                      <Button
                        onClick={() => document.getElementById('fileInput')?.click()}
                        variant="outline"
                        className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                        disabled={!profile.name}
                      >
                        <Database className="w-4 h-4 mr-2" />
                        ATTACH
                      </Button>
                      <Input
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        className="bg-black border-green-400 text-green-400 placeholder-green-700 flex-1"
                        placeholder="Type your message..."
                        disabled={!profile.name}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={(!messageInput.trim() && attachments.length === 0) || !profile.name}
                        className="bg-green-400 text-black hover:bg-green-300"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-green-600 py-8">
                  Select a room to start chatting
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Profile Dialog */}
        <Dialog open={!profile.name} onOpenChange={() => {}}>
          <DialogContent className="bg-black border-green-400 text-green-400">
            <DialogHeader>
              <DialogTitle>SET YOUR PROFILE</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="profile-name">Display Name</Label>
                <Input
                  id="profile-name"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-black border-green-400 text-green-400"
                  placeholder="Enter your name"
                />
              </div>
              <Button
                onClick={() => updateProfile(profile.name, profile.avatar)}
                disabled={!profile.name.trim()}
                className="w-full bg-green-400 text-black hover:bg-green-300"
              >
                Start Chatting
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Auth Dialogs */}
        <Dialog open={authDialogOpen === 'login'} onOpenChange={() => setAuthDialogOpen(null)}>
          <DialogContent className="bg-black border-green-400 text-green-400">
            <DialogHeader>
              <DialogTitle>LOGIN</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {authError && (
                <Alert className="border-red-500 text-red-500">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black border-green-400 text-green-400"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black border-green-400 text-green-400"
                  placeholder="Enter your password"
                />
              </div>
              <Button
                onClick={handleSignIn}
                disabled={authLoading}
                className="w-full bg-green-400 text-black hover:bg-green-300"
              >
                {authLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'LOGIN'}
              </Button>
              <Button
                onClick={() => setAuthDialogOpen('register')}
                variant="outline"
                className="w-full border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
              >
                Don't have an account? Sign Up
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={authDialogOpen === 'register'} onOpenChange={() => setAuthDialogOpen(null)}>
          <DialogContent className="bg-black border-green-400 text-green-400">
            <DialogHeader>
              <DialogTitle>SIGN UP</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {authError && (
                <Alert className="border-red-500 text-red-500">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="signup-name">Display Name</Label>
                <Input
                  id="signup-name"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  className="bg-black border-green-400 text-green-400"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  className="bg-black border-green-400 text-green-400"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  className="bg-black border-green-400 text-green-400"
                  placeholder="Enter your password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSignUp}
                  disabled={authLoading}
                  className="flex-1 bg-green-400 text-black hover:bg-green-300"
                >
                  {authLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'SIGN UP'}
                </Button>
                <Button
                  onClick={() => setAuthDialogOpen('login')}
                  variant="outline"
                  className="flex-1 border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                >
                  BACK TO LOGIN
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Private Room Password Dialog */}
        <PrivateRoomPasswordDialog
          isOpen={showPasswordDialog}
          onClose={() => {
            setShowPasswordDialog(false)
            setSelectedRoomForPassword(null)
          }}
          onJoin={handlePrivateRoomJoin}
          roomName={selectedRoomForPassword?.name || ''}
        />

        {/* Create Private Room Dialog */}
        <CreatePrivateRoomDialog
          isOpen={showCreateRoomDialog}
          onClose={() => setShowCreateRoomDialog(false)}
          onCreate={handleCreatePrivateRoom}
        />

        {/* Instructions */}
        <Card className="bg-black border-green-400">
          <CardHeader>
            <CardTitle className="text-green-400 text-sm">HOW TO USE</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-green-600 space-y-2">
            <div><strong>PUBLIC ROOMS:</strong> Open to everyone. Messages auto-delete after 24 hours.</div>
            <div><strong>PRIVATE ROOMS:</strong> Require authentication and a 4-digit password. Only room owners can clear chat history.</div>
            <div><strong>CREATE ROOMS:</strong> Click "CREATE ROOM" when authenticated to make private rooms with custom passwords.</div>
            <div><strong>AUTHENTICATION:</strong> Click "LOGIN" to access private rooms and create your own rooms.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}