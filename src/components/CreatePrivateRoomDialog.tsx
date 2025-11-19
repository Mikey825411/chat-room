'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Alert, AlertDescription } from './ui/alert'
import { Loader2, Plus, RefreshCw, Eye, EyeOff } from 'lucide-react'

interface CreatePrivateRoomDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, password: string) => Promise<{ roomId: string; error?: string }>
}

export function CreatePrivateRoomDialog({
  isOpen,
  onClose,
  onCreate
}: CreatePrivateRoomDialogProps) {
  const [roomName, setRoomName] = useState('')
  const [passwordType, setPasswordType] = useState<'custom' | 'auto'>('auto')
  const [customPassword, setCustomPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateNewPassword = () => {
    const password = Math.floor(1000 + Math.random() * 9000).toString()
    setGeneratedPassword(password)
  }

  // Generate initial password when dialog opens
  if (isOpen && !generatedPassword) {
    generateNewPassword()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!roomName.trim()) {
      setError('Please enter a room name')
      return
    }

    let finalPassword = ''
    if (passwordType === 'auto') {
      finalPassword = generatedPassword
    } else {
      if (!customPassword.trim()) {
        setError('Please enter a password')
        return
      }
      if (customPassword.length !== 4 || !/^\d+$/.test(customPassword)) {
        setError('Password must be exactly 4 digits')
        return
      }
      finalPassword = customPassword
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await onCreate(roomName, finalPassword)
      if (result.roomId) {
        // Reset form
        setRoomName('')
        setCustomPassword('')
        setPasswordType('auto')
        setGeneratedPassword('')
        setShowPassword(false)
        onClose()
      } else {
        setError(result.error || 'Failed to create room')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setRoomName('')
      setCustomPassword('')
      setPasswordType('auto')
      setGeneratedPassword('')
      setShowPassword(false)
      setError(null)
      onClose()
    }
  }

  const handleCustomPasswordChange = (value: string) => {
    // Only allow digits, max 4 characters
    const numericValue = value.replace(/\D/g, '').slice(0, 4)
    setCustomPassword(numericValue)
    setError(null)
  }

  const currentPassword = passwordType === 'auto' ? generatedPassword : customPassword

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Private Room
          </DialogTitle>
          <DialogDescription>
            Create a new private room with a 4-digit password for secure access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              value={roomName}
              onChange={(e) => {
                setRoomName(e.target.value)
                setError(null)
              }}
              placeholder="Enter room name"
              disabled={isLoading}
              maxLength={50}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Password Type</Label>
            <RadioGroup
              value={passwordType}
              onValueChange={(value: 'custom' | 'auto') => {
                setPasswordType(value)
                setError(null)
              }}
              disabled={isLoading}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="font-normal">
                  Auto-generate random password
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal">
                  Set my own password
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Room Password</Label>
            <div className="flex gap-2">
              {passwordType === 'auto' ? (
                <div className="flex gap-2 flex-1">
                  <Input
                    value={generatedPassword}
                    readOnly
                    className="text-center text-lg font-mono tracking-widest bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={generateNewPassword}
                    disabled={isLoading}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={customPassword}
                    onChange={(e) => handleCustomPasswordChange(e.target.value)}
                    placeholder="Enter 4-digit password"
                    maxLength={4}
                    className="text-center text-lg font-mono tracking-widest"
                    disabled={isLoading}
                    autoComplete="one-time-code"
                  />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading || !currentPassword}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {currentPassword && (
              <div className="text-xs text-muted-foreground">
                Share this 4-digit password with people you want to invite to this room.
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !roomName.trim() || !currentPassword}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Room'
              )}
            </Button>
          </div>
        </form>

        <div className="text-xs text-muted-foreground text-center">
          Private rooms require authentication and a password for access.
        </div>
      </DialogContent>
    </Dialog>
  )
}