'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react'

interface PrivateRoomPasswordDialogProps {
  isOpen: boolean
  onClose: () => void
  onJoin: (password: string) => Promise<{ success: boolean; error?: string }>
  roomName: string
}

export function PrivateRoomPasswordDialog({
  isOpen,
  onClose,
  onJoin,
  roomName
}: PrivateRoomPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      setError('Please enter a password')
      return
    }

    if (password.length !== 4 || !/^\d+$/.test(password)) {
      setError('Password must be exactly 4 digits')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await onJoin(password)
      if (result.success) {
        setPassword('')
        onClose()
      } else {
        setError(result.error || 'Failed to join room')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setPassword('')
      setError(null)
      onClose()
    }
  }

  const handlePasswordChange = (value: string) => {
    // Only allow digits, max 4 characters
    const numericValue = value.replace(/\D/g, '').slice(0, 4)
    setPassword(numericValue)
    setError(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Join Private Room
          </DialogTitle>
          <DialogDescription>
            Enter the 4-digit password to join &quot;{roomName}&quot;
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password (4 digits)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Enter 4-digit password"
                maxLength={4}
                className="text-center text-lg font-mono tracking-widest"
                disabled={isLoading}
                autoComplete="one-time-code"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
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
              disabled={isLoading || password.length !== 4}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Room'
              )}
            </Button>
          </div>
        </form>

        <div className="text-xs text-muted-foreground text-center">
          This room is private and requires a password for entry.
        </div>
      </DialogContent>
    </Dialog>
  )
}