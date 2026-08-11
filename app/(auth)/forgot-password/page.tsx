'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Check your email</h2>
          <p className="text-sm text-gray-400 mt-2">
            We sent a password reset link to <span className="font-medium text-gray-200">{email}</span>.
            It expires in 1 hour.
          </p>
        </div>
        <p className="text-xs text-gray-500">
          Didn&apos;t receive it? Check your spam folder or{' '}
          <button
            onClick={() => setSent(false)}
            className="text-violet-400 hover:underline"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center">
            <Mail className="h-6 w-6 text-violet-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white">Forgot password?</h2>
        <p className="text-sm text-gray-400 mt-1">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-gray-300">Email address</Label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Send reset link
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
