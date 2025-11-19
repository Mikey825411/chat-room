import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, Send, User, Settings, Wifi, WifiOff, Users, Lock, AlertCircle, Trash2, Database, Loader2 } from 'lucide-react'
import { ChatDatabaseService } from '@/lib/chat-database'
import { signInWithEmail, signUpWithEmail, signOut } from '@/lib/supabase'

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
  data: string // base64 encoded
  url?: string // for preview
}

interface UserProfile {
  name: string
  avatar: string
  email: string
}

interface P2PRoom {
  id: string
  peerConnection: RTCPeerConnection | null
  dataChannel: RTCDataChannel | null
  isConnected: boolean
  isHost: boolean
}

export default function ChatApp() {
  const [profile, setProfile] = useState<UserProfile>({ name: '', avatar: '' })
  const [publicMessages, setPublicMessages] = useState<Message[]>([])
  const [privateMessages, setPrivateMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [privateMessageInput, setPrivateMessageInput] = useState('')
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [publicAttachments, setPublicAttachments] = useState<File[]>([])
  const [privateAttachments, setPrivateAttachments] = useState<File[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false)
  const [autoClearHistory, setAutoClearHistory] = useState(false)
  const [clearAfterDays, setClearAfterDays] = useState(30)
  const [isLoading, setIsLoading] = useState(false)
  const [dbService] = useState<ChatDatabaseService | null>(null)
  
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

  const publicChannelRef = useRef<BroadcastChannel | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize database service and auth
  useEffect(() => {
    const service = ChatDatabaseService.getInstance()
    setDbService(service)
    
    // Initialize auth and load data
    if (service.isSupabaseConfigured()) {
      initializeAuth(service)
      loadStoredMessages(service)
    } else {
      loadUserSettings(service)
      loadStoredMessages(service)
    }
  }, [])

  const initializeAuth = async (service: ChatDatabaseService) => {
    try {
      await service.initializeAuth()
      const user = await service.getUserProfile()
      setCurrentUser(user)
      setIsAuthenticated(!!user)
      
      // Set up auth state change listener
      service.onAuthStateChange((event) => {
        setCurrentUser(event.session?.user || null)
        setIsAuthenticated(!!event.session)
      })
    } catch (error) {
      console.error('Error initializing auth:', error)
    }
  }

  const loadStoredMessages = async (service: ChatDatabaseService) => {
    try {
      setIsLoading(true)
      const [publicMessages, privateMessages] = await Promise.all([
        service.getMessages('public'),
        service.getMessages('private')
      ])
      
      setPublicMessages(publicMessages.map(msg => service.convertFromDatabaseMessage(msg)))
      setPrivateMessages(privateMessages.map(msg => service.convertFromDatabaseMessage(msg)))
    } catch (error) {
      console.error('Error loading stored messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadUserSettings = async (service: ChatDatabaseService) => {
    try {
      const settings = await service.getUserSettings()
      if (settings) {
        setAutoClearHistory(settings.auto_clear_history)
        setClearAfterDays(settings.clear_after_days)
      }
    } catch (error) {
      console.error('Error loading user settings:', error)
    }
  }

  // Save profile to localStorage and load from localStorage
  useEffect(() => {
    if (profile.name) {
      localStorage.setItem('chatProfile', JSON.stringify(profile))
    }
  }, [profile.name])

  useEffect(() => {
    if (profile.name) {
      localStorage.setItem('chatProfile', JSON.stringify(profile))
    }
  }, [profile])

  // Initialize BroadcastChannel for public room
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      publicChannelRef.current = new BroadcastChannel('retro-public-chat')
      
      publicChannelRef.current.onmessage = (event) => {
        const message: Message = event.data
        setPublicMessages(prev => [...prev, message])
      }
    }
  }, [])

  const createMessage = (content: string, attachments: Attachment[] = [], isPrivate = false): Message => {
    return {
      id: Math.random().toString(36).substr(2, 9),
      author: profile.name || 'Anonymous',
      avatar: profile.avatar || '',
      content,
      timestamp: new Date(),
      isOwn: true,
      attachments
    }
  }

  const fileToAttachment = async (file: File): Promise<Attachment> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
          url: base64
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const processFiles = async (files: File[]): Promise<Attachment[]> => {
    const attachments: Attachment[] = []
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(`File ${file.name} is too large. Maximum size is 10MB.`)
        continue
      }
      const attachment = await fileToAttachment(file)
      attachments.push(attachment)
    }
    return attachments
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" alt="Image file" />
    if (type.startsWith('video/')) return <Video className="w-4 h-4" alt="Video file" />
    if (type.startsWith('audio/')) return <Loader2 className="w-4 h-4" alt="Audio file" />
    if (type.includes('text') || type.includes('document')) return <Database className="w-4 h-4" alt="Document file" />
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return <Database className="w-4 h-4" alt="Archive file" />
    return <Database className="w-4 h-4" alt="File" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, isPrivate: boolean) => {
    const files = Array.from(event.target.files || [])
    if (isPrivate) {
      setPrivateAttachments(prev => [...prev, ...files])
    } else {
      setPublicAttachments(prev => [...prev, ...files])
    }
  }

  const removeAttachment = (index: number, isPrivate: boolean) => {
    if (isPrivate) {
      setPrivateAttachments(prev => prev.filter((_, i) => i !== index))
    } else {
      setPublicAttachments(prev => prev.filter((_, i) => i !== index))
    }
  }

  const downloadAttachment = (attachment: Attachment) => {
    const link = document.createElement('a')
    link.href = attachment.data
    link.download = attachment.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const previewAttachmentDialog = (attachment: Attachment) => {
    setPreviewAttachment(attachment)
    setPreviewDialogOpen(true)
  }

  const sendPublicMessage = async () => {
    if ((!messageInput.trim() && publicAttachments.length === 0) || !profile.name) return
    
    const attachments = await processFiles(publicAttachments)
    const message = createMessage(messageInput, attachments)
    
    // Always add to local state immediately
    setPublicMessages(prev => [...prev, message])
    
    // Send via BroadcastChannel if available
    if (publicChannelRef.current) {
      publicChannelRef.current.postMessage(message)
    }
    
    // Save to database if configured
    if (dbService && dbService.isSupabaseConfigured()) {
      try {
        await dbService.saveMessage('public', dbService.convertToDatabaseMessage(message))
      } catch (error) {
        console.error('Error saving message to database:', error)
      }
    }
    
    setMessageInput('')
    setPublicAttachments([])
  }

  const sendPrivateMessage = async () => {
    if ((!privateMessageInput.trim() && privateAttachments.length === 0) || !p2pRoom.dataChannel || p2pRoom.dataChannel.readyState !== 'open') return
    
    const attachments = await processFiles(privateAttachments)
    const message = createMessage(privateMessageInput, attachments, true)
    
    // Always add to local state immediately
    setPrivateMessages(prev => [...prev, message])
    
    // Send via DataChannel
    p2pRoom.dataChannel.send(JSON.stringify(message))
    
    // Save to database if configured
    if (dbService && dbService.isSupabaseConfigured()) {
      try {
        await dbService.saveMessage('private', dbService.convertToDatabaseMessage(message))
      } catch (error) {
        console.error('Error saving private message to database:', error)
      }
    }
    
    setPrivateMessageInput('')
    setPrivateAttachments([])
  }

  const createP2POffer = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      
      const dc = pc.createDataChannel('chat')
      setupDataChannel(dc)
      
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      setP2pRoom({
        id: Math.random().toString(36).substr(2, 9),
        peerConnection: pc,
        dataChannel: dc,
        isConnected: false,
        isHost: true
      })
      
      setSdpOffer(JSON.stringify(pc.localDescription))
    } catch (error) {
      console.error('Error creating offer:', error)
      alert('Failed to create P2P offer. Please check browser support.')
    }
  }

  const acceptP2POffer = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      
      pc.ondatachannel = (event) => {
        const dc = event.channel
        setupDataChannel(dc)
        setP2pRoom(prev => ({ ...prev, dataChannel: dc, peerConnection: pc, isHost: false }))
      }
      
      const offerText = sdpOffer
      if (!offerText) {
        alert('Please paste the offer first')
        return
      }
      
      const offer = JSON.parse(offerText)
      await pc.setRemoteDescription(offer)
      
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      setSdpAnswer(JSON.stringify(pc.localDescription))
    } catch (error) {
      console.error('Error accepting offer:', error)
      alert('Failed to accept P2P offer. Please check the offer format.')
    }
  }

  const finalizeP2PConnection = async () => {
    try {
      if (!p2pRoom.peerConnection || !sdpAnswer) {
        alert('Please paste the answer first')
        return
      }
      
      const answer = JSON.parse(sdpAnswer)
      await p2pRoom.peerConnection.setRemoteDescription(answer)
      setConnectionStatus('connected')
    } catch (error) {
      console.error('Error finalizing connection:', error)
      alert('Failed to finalize P2P connection. Please check the answer format.')
    }
  }

  const setupDataChannel = (dc: RTCDataChannel) => {
    dc.onopen = () => {
      setConnectionStatus('connected')
      setP2pRoom(prev => ({ ...prev, isConnected: true }))
    }
    
    dc.onmessage = (event) => {
      try {
        const message: Message = JSON.parse(event.data)
        setPrivateMessages(prev => [...prev, message])
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }
    
    dc.onclose = () => {
      setConnectionStatus('disconnected')
      resetP2PConnection()
    }
  }

  const resetP2PConnection = () => {
    setP2pRoom({
      id: '',
      peerConnection: null,
      dataChannel: null,
      isConnected: false,
      isHost: false
    })
    setSdpOffer('')
    setSdpAnswer('')
    setConnectionStatus('disconnected')
  }

  const updateProfile = (name: string, avatar: string) => {
    setProfile({ name, avatar })
    setProfileDialogOpen(false)
    
    // Update database if authenticated
    if (dbService && dbService.isSupabaseConfigured() && currentUser) {
      dbService.saveUserProfile({
        display_name: name,
        email: currentUser.email,
        avatar_url: avatar
      })
    }
  }

  const clearChatHistory = async (isPrivate: boolean) => {
    if (!dbService || !dbService.isSupabaseConfigured()) return
    
    try {
      setIsLoading(true)
      const roomId = isPrivate ? 'private' : 'public'
      const success = await dbService.clearChatHistory(roomId)
      
      if (success) {
        if (isPrivate) {
          setPrivateMessages([])
        } else {
          setPublicMessages([])
        }
        setClearHistoryDialogOpen(false)
      }
    } catch (error) {
      console.error('Error clearing chat history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearAllChatHistory = async () => {
    if (!dbService || !dbService.isSupabaseConfigured()) return
    
    try {
      setIsLoading(true)
      const success = await dbService.clearAllChatHistory()
      
      if (success) {
        setPublicMessages([])
        setPrivateMessages([])
        setClearHistoryDialogOpen(false)
      }
    } catch (error) {
      console.error('Error clearing all chat history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveUserSettings = async () => {
    if (!dbService || !dbService.isSupabaseConfigured()) return
    
    try {
      await dbService.saveUserSettings({
        auto_clear_history: autoClearHistory,
        clear_after_days: clearAfterDays
      })
    } catch (error) {
      console.error('Error saving user settings:', error)
    }
  }

  const handleSignIn = async () => {
    if (!dbService || !email.trim() || !password.trim()) return
    
    try {
      setAuthLoading(true)
      setAuthError('')
      
      const result = await signInWithEmail(email, password)
      
      if (result.error) {
        setAuthError(result.error)
      } else {
        setAuthDialogOpen(null)
        // Profile will be updated by auth state change listener
      }
    } catch (error) {
      setAuthError('Login failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!dbService || !signUpEmail.trim() || !signUpPassword.trim() || !signUpName.trim()) return
    
    try {
      setAuthLoading(true)
      setAuthError('')
      
      const result = await signUpWithEmail(signUpEmail, signUpPassword, signUpName)
      
      if (result.error) {
        setAuthError(result.error)
      } else {
        setAuthDialogOpen(null)
        // Profile will be updated by auth state change listener
      }
    } catch (error) {
      setAuthError('Registration failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    if (!dbService) return
    
    try {
      await signOut()
      setCurrentUser(null)
      setIsAuthenticated(false)
      setAuthDialogOpen(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const [sdpOffer, setSdpOffer] = useState('')
  const [sdpAnswer, setSdpAnswer] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  const renderAttachment = (attachment: Attachment) => {
    const isImage = attachment.type.startsWith('image/')
    const isVideo = attachment.type.startsWith('video/')
    const isAudio = attachment.type.startsWith('audio/')
    
    return (
      <div key={attachment.id} className="border border-green-400 bg-black p-2 rounded">
        <div className="flex items-center gap-2 mb-2">
          {getFileIcon(attachment.type)}
          <span className="text-xs truncate flex-1">{attachment.name}</span>
          <span className="text-xs opacity-70">{formatFileSize(attachment.size)}</span>
        </div>
        
        {isImage && (
          <img 
            src={attachment.url} 
            alt={attachment.name}
            className="max-w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
            onClick={() => previewAttachmentDialog(attachment)}
          />
        )}
        
        {isVideo && (
          <video 
            src={attachment.url}
            controls
            className="max-w-full h-32 rounded"
          />
        )}
        
        {isAudio && (
          <audio 
            src={attachment.url}
            controls
            className="w-full"
          />
        )}
        
        {!isImage && !isVideo && !isAudio && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => previewAttachmentDialog(attachment)}
              className="text-xs bg-green-400 text-black px-2 py-1 rounded hover:bg-green-300"
            >
              Preview
            </button>
            <button
              onClick={() => downloadAttachment(attachment)}
              className="text-xs bg-green-400 text-black px-2 py-1 rounded hover:bg-green-300"
            >
              Download
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderAttachments = (attachments: Attachment[]) => {
    if (!attachments || attachments.length === 0) return null
    
    return (
      <div className="space-y-2 mt-2">
        {attachments.map(renderAttachment)}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4 relative overflow-hidden">
      {/* Scanlines effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="h-px bg-green-400 w-full animate-pulse"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="retro-border p-4 mb-4 relative">
          <div className="absolute top-0 left-0 right-0 h-6 bg-green-400 flex items-center justify-center">
            <div className="text-xs font-bold">RETRO CHAT v1.0</div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 border-2 border-green-400 bg-black flex items-center justify-center">
                {currentUser?.user_metadata?.avatar_url ? (
                  <img 
                    src={currentUser.user_metadata.avatar_url} 
                    alt={`${currentUser.user_metadata.display_name}'s avatar`} 
                    className="w-10 h-10" 
                  />
                ) : (
                  <User className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="text-green-400 font-bold">{currentUser?.user_metadata?.display_name || 'Guest'}</div>
                <div className="text-xs text-green-600">
                  {isAuthenticated ? 'ONLINE' : 'OFFLINE'}
                  {dbService && dbService.isSupabaseConfigured() ? '• AUTHENTICATED' : '• LOCAL'}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setAuthDialogOpen('login')} 
                variant="outline" 
                className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                disabled={isAuthenticated}
              >
                {isAuthenticated ? 'ACCOUNT' : 'LOGIN'}
              </Button>
              <Button 
                onClick={() => setAuthDialogOpen('profile')} 
                variant="outline" 
                className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                disabled={!isAuthenticated}
              >
                PROFILE
              </Button>
              {isAuthenticated && (
                <Button 
                  onClick={handleSignOut} 
                  variant="outline" 
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
                >
                  LOGOUT
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Auth Dialogs */}
        <Dialog open={authDialogOpen === 'login'} onOpenChange={() => setAuthDialogOpen(null)}>
          <DialogContent className="bg-black border-green-400 text-green-400">
            <DialogHeader>
              <DialogTitle className="text-green-400">LOGIN</DialogTitle>
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
              <div className="flex gap-2">
                <Button 
                  onClick={handleSignIn}
                  disabled={authLoading}
                  className="flex-1 bg-green-400 text-black hover:bg-green-300"
                >
                  {authLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'LOGIN'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={authDialogOpen === 'register'} onOpenChange={() => setAuthDialogOpen(null)}>
          <DialogContent className="bg-black border-green-400 text-green-400">
            <DialogHeader>
              <DialogTitle className="text-green-400">SIGN UP</DialogTitle>
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
                  className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                >
                  BACK TO LOGIN
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Main Chat Interface */}
        <Tabs defaultValue="public" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-black border-green-400 border">
            <TabsTrigger value="public" className="data-[state=active]:bg-green-400 data-[state=active]:text-black text-green-400">
              <Users className="w-4 h-4 mr-2" />
              PUBLIC ROOM
            </TabsTrigger>
            <TabsTrigger value="private" className="data-[state=active]:bg-green-400 data-[state=active]:text-black text-green-400">
              <Lock className="w-4 h-4 mr-2" />
              PRIVATE ROOM
            </TabsTrigger>
          </TabsList>

          {/* Public Room */}
          <TabsContent value="public" className="space-y-4">
            <Card className="bg-black border-green-400">
              <CardHeader>
                <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 mr-2" />
                  PUBLIC CHAT ROOM
                  <Badge variant="outline" className="border-green-400 text-green-400">
                    {dbService && dbService.isSupabaseConfigured() ? 'PERSISTENT' : 'TEMPORARY'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 w-full border-2 border-green-400 bg-black p-4 mb-4">
                  <div className="space-y-2">
                    {publicMessages.length === 0 ? (
                      <div className="text-center text-xs text-green-600">No messages yet. Start chatting!</div>
                    ) : (
                      publicMessages.map((msg, index) => (
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
                            {renderAttachments(msg.attachments)}
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

                <div className="space-y-2">
                  {renderAttachments(publicAttachments)}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileSelect(e, false)}
                      className="hidden"
                      id="publicFileInput"
                    />
                    <Button
                      onClick={() => document.getElementById('publicFileInput')?.click()}
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
                      onKeyPress={(e) => e.key === 'Enter' && sendPublicMessage()}
                      className="bg-black border-green-400 text-green-400 placeholder-green-700 flex-1"
                      placeholder="Type your message..."
                      disabled={!profile.name}
                    />
                    <Button 
                      onClick={sendPublicMessage}
                      disabled={(!messageInput.trim() && publicAttachments.length === 0) || !profile.name}
                      className="bg-green-400 text-black hover:bg-green-300"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Private Room */}
          <TabsContent value="private" className="space-y-4">
            <Card className="bg-black border-green-400">
              <CardHeader>
                <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 mr-2" />
                  PRIVATE P2P ROOM
                  <Badge variant="outline" className={`border-green-400 text-green-400 ${connectionStatus === 'connected' ? 'bg-green-600' : ''}`}>
                    {connectionStatus.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* P2P Connection Setup */}
                  {!p2pRoom.isConnected && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-xs text-green-600 mb-2">HOST: CREATE OFFER</div>
                          <Button
                            onClick={createP2POffer}
                            disabled={connectionStatus === 'connecting'}
                            className="w-full bg-green-400 text-black hover:bg-green-300"
                          >
                            {connectionStatus === 'connecting' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'CREATE OFFER'}
                          </Button>
                          {sdpOffer && (
                            <Textarea
                              value={sdpOffer}
                              readOnly
                              className="h-24 bg-black border-green-400 text-green-400 text-xs p-2"
                              placeholder="Offer will appear here..."
                            />
                          )}
                          {sdpOffer && (
                            <Button
                              onClick={() => navigator.clipboard.writeText(sdpOffer)}
                              variant="outline"
                              className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              COPY OFFER
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-xs text-green-600 mb-2">GUEST: JOIN ROOM</div>
                          <Textarea
                            value={sdpOffer}
                            onChange={(e) => setSdpOffer(e.target.value)}
                            className="h-24 bg-black border-green-400 text-green-400 text-xs p-2"
                            placeholder="Paste offer here..."
                          />
                          <Button
                            onClick={acceptP2POffer}
                            disabled={connectionStatus === 'connecting'}
                            className="w-full bg-green-400 text-black hover:bg-green-300"
                          >
                              {connectionStatus === 'connecting' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'CREATE ANSWER'}
                          </Button>
                          {sdpAnswer && (
                            <Textarea
                              value={sdpAnswer}
                              readOnly
                              className="h-24 bg-black border-green-400 text-green-400 text-xs p-2"
                              placeholder="Answer will appear here..."
                            />
                          )}
                          {sdpAnswer && (
                            <Button
                              onClick={() => navigator.clipboard.writeText(sdpAnswer)}
                              variant="outline"
                              className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              COPY ANSWER
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-xs text-green-600 mb-2">HOST: FINALIZE CONNECTION</div>
                          <Textarea
                            value={sdpAnswer}
                            onChange={(e) => setSdpAnswer(e.target.value)}
                            className="h-24 bg-black border-green-400 text-green-400 text-xs p-2"
                            placeholder="Paste answer here..."
                          />
                          <Button
                            onClick={finalizeP2PConnection}
                            disabled={connectionStatus === 'connecting'}
                            className="w-full bg-green-400 text-black hover:bg-green-300"
                          >
                              {connectionStatus === 'connecting' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'CONNECT'}
                          </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Private Chat */}
                  <div className="space-y-4">
                    <ScrollArea className="h-64 w-full border-2 border-green-400 bg-black p-4 mb-4">
                      <div className="space-y-2">
                        {privateMessages.length === 0 ? (
                          <div className="text-center text-xs text-green-600">
                            {connectionStatus === 'connected' ? 'Connected! Start chatting...' : 'Connect to start chatting'}
                          </div>
                        ) : (
                          privateMessages.map((msg, index) => (
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
                                  {renderAttachments(msg.attachments)}
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

                    <div className="space-y-2">
                      {renderAttachments(privateAttachments)}
                      <div className="flex gap-2">
                        <input
                          type="file"
                          multiple
                          onChange={(e) => handleFileSelect(e, true)}
                          className="hidden"
                          id="privateFileInput"
                        />
                        <Button
                          onClick={() => document.getElementById('privateFileInput')?.click()}
                          variant="outline"
                          className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                          disabled={!p2pRoom.isConnected}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          ATTACH
                        </Button>
                        <Input
                          value={privateMessageInput}
                          onChange={(e) => setPrivateMessageInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendPrivateMessage()}
                          className="bg-black border-green-400 text-green-400 placeholder-green-700 flex-1"
                          placeholder="Type your private message..."
                          disabled={!p2pRoom.isConnected}
                        />
                        <Button 
                          onClick={sendPrivateMessage}
                          disabled={(!privateMessageInput.trim() && privateAttachments.length === 0) || !p2pRoom.isConnected}
                          className="bg-green-400 text-black hover:bg-green-300"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {p2pRoom.isConnected && (
                        <Button 
                          onClick={resetP2PConnection}
                          variant="outline"
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
                        >
                          DISCONNECT
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Clear History Dialog */}
        <Dialog open={clearHistoryDialogOpen} onOpenChange={setClearHistoryDialogOpen}>
          <DialogContent className="bg-black border-green-400 text-green-400">
            <DialogHeader>
              <DialogTitle className="text-green-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                CLEAR CHAT HISTORY
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="autoClear"
                  checked={autoClearHistory}
                  onCheckedChange={setAutoClearHistory}
                />
                <Label htmlFor="autoClear" className="text-xs">
                  Automatically clear history after {clearAfterDays} days
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="clearDays" className="text-xs">Clear after:</Label>
                <Input
                  id="clearDays"
                  type="number"
                  min="1"
                  max="365"
                  value={clearAfterDays.toString()}
                  onChange={(e) => setClearAfterDays(parseInt(e.target.value) || 30)}
                  className="bg-black border-green-400 text-green-400 w-20"
                />
                <span className="text-xs">days</span>
              </div>
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={() => clearChatHistory(false)}
                  disabled={isLoading}
                  className="w-full bg-green-400 text-black hover:bg-green-300"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  CLEAR PUBLIC ROOM
                </Button>
                
                <Button 
                  onClick={() => clearChatHistory(true)}
                  disabled={isLoading}
                  className="w-full bg-green-400 text-black hover:bg-green-300"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  CLEAR PRIVATE ROOM
                </Button>
                
                <Button 
                  onClick={clearAllChatHistory}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  CLEAR ALL CHAT HISTORY
                </Button>
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={saveUserSettings}
                  disabled={isLoading}
                  className="w-full bg-green-400 text-black hover:bg-green-300"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                  SAVE SETTINGS
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Instructions */}
        <Card className="mt-4 bg-black border-green-400">
          <CardHeader>
            <CardTitle className="text-green-400 text-sm">HOW TO USE</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-green-600 space-y-2">
            <div><strong>PUBLIC ROOM:</strong> Works automatically between tabs on same browser using BroadcastChannel API.</div>
            <div><strong>PRIVATE ROOM:</strong> Manual P2P connection required:</div>
            <div>1. Host clicks "CREATE OFFER" → copies offer text</div>
            <div>2. Guest pastes offer → clicks "CREATE ANSWER" → copies answer text</div>
            <div>3. Host pastes answer → clicks "CONNECT"</div>
            <div><strong>FILE SHARING:</strong> Click "ATTACH" to add files (max 10MB each). Supports images, videos, audio, documents, and archives.</div>
            <div><strong>AUTHENTICATION:</strong> Click "LOGIN" to sign in with email. Click "SIGN UP" to register. Profile data is saved to database and persists across sessions.</div>
            <div><strong>CLEAR HISTORY:</strong> Click "CLEAR HISTORY" to manage chat cleanup with optional auto-clear settings.</div>
            <div><strong>DATABASE:</strong> {dbService && dbService.isSupabaseConfigured() ? 'Chat history is saved to database and persists across sessions.' : 'Database features disabled - history stored locally only.'}</div>
            <div><strong>NOTE:</strong> P2P may fail behind strict NATs. No TURN server provided.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}