'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Supabase puts the access_token in the URL hash after redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setValidSession(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error('Password must include at least one letter and one number'); return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/browse'), 2500)
    }
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!validSession) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <p className="text-white font-semibold">Invalid or expired reset link</p>
        <p className="text-sm text-gray-400">Please request a new password reset link.</p>
        <Button onClick={() => router.push('/forgot-password')} className="w-full">
          Request new link
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Password updated!</h2>
          <p className="text-sm text-gray-400 mt-1">Redirecting you to the app…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center">
            <Lock className="h-6 w-6 text-violet-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white">Set new password</h2>
        <p className="text-sm text-gray-400 mt-1">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-gray-300">New password</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            minLength={6}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-300">Confirm password</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || !password || !confirm}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update password
        </Button>
      </form>
    </div>
  )
}
