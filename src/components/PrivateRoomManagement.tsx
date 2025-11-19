'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Alert, AlertDescription } from './ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Loader2, Trash2, Key, Settings } from 'lucide-react'

interface PrivateRoomManagementProps {
  roomId: string
  roomName: string
  isOwner: boolean
  onClearHistory: () => Promise<{ success: boolean; error?: string }>
  onChangePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
}

export function PrivateRoomManagement({
  roomId,
  roomName,
  isOwner,
  onClearHistory,
  onChangePassword
}: PrivateRoomManagementProps) {
  const [isClearing, setIsClearing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleClearHistory = async () => {
    setIsClearing(true)
    try {
      const result = await onClearHistory()
      if (result.success) {
        setSuccess('Room history cleared successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || 'Failed to clear history')
        setTimeout(() => setError(null), 5000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsClearing(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword.trim()) {
      setError('Please enter a new password')
      return
    }

    if (newPassword.length !== 4 || !/^\d+$/.test(newPassword)) {
      setError('Password must be exactly 4 digits')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsChangingPassword(true)
    setError(null)

    try {
      const result = await onChangePassword(newPassword)
      if (result.success) {
        setSuccess('Password changed successfully')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordDialog(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || 'Failed to change password')
        setTimeout(() => setError(null), 5000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleNewPasswordChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4)
    setNewPassword(numericValue)
    setError(null)
  }

  const handleConfirmPasswordChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4)
    setConfirmPassword(numericValue)
    setError(null)
  }

  if (!isOwner) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Settings className="h-4 w-4" />
        Room Owner Controls
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          onClick={() => setShowPasswordDialog(true)}
          className="justify-start"
        >
          <Key className="h-4 w-4 mr-2" />
          Change Password
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="justify-start text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Chat
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear All Chat History?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all messages in &quot;{roomName}&quot;.
                This action cannot be undone and will affect all room members.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearHistory}
                disabled={isClearing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  'Clear All Chat'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Room Password
            </DialogTitle>
            <DialogDescription>
              Set a new 4-digit password for &quot;{roomName}&quot;.
              All room members will need the new password to rejoin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password (4 digits)</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => handleNewPasswordChange(e.target.value)}
                  placeholder="Enter new 4-digit password"
                  maxLength={4}
                  className="text-center text-lg font-mono tracking-widest"
                  disabled={isChangingPassword}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  placeholder="Confirm 4-digit password"
                  maxLength={4}
                  className="text-center text-lg font-mono tracking-widest"
                  disabled={isChangingPassword}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isChangingPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false)
                  setNewPassword('')
                  setConfirmPassword('')
                  setError(null)
                }}
                disabled={isChangingPassword}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isChangingPassword || newPassword.length !== 4 || confirmPassword.length !== 4}
                className="flex-1"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}