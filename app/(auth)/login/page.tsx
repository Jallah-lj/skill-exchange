'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, User, Lock, ArrowRight } from 'lucide-react'

const BLOCKED_MESSAGES: Record<string, string> = {
  banned: 'This account has been banned. Contact support if you believe this is a mistake.',
  disabled: 'This account has been disabled. Contact support for help restoring access.',
  locked: 'This account is temporarily locked. Please try again later.',
  suspended: 'This account is suspended. Contact support for more information.',
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Bounced back here by middleware because the session turned out to be blocked
  useEffect(() => {
    const blocked = searchParams.get('blocked')
    if (blocked) toast.error(BLOCKED_MESSAGES[blocked] ?? 'Your account access has been restricted.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('suspended, disabled, banned, locked_until')
      .eq('id', data.user.id)
      .single()

    const isLocked = !!profile?.locked_until && new Date(profile.locked_until) > new Date()
    const isBlocked = !!profile && (profile.banned || profile.disabled || profile.suspended || isLocked)

    if (isBlocked) {
      const reason = profile!.banned ? 'banned' : profile!.disabled ? 'disabled' : isLocked ? 'locked' : 'suspended'
      await supabase.auth.signOut()
      toast.error(BLOCKED_MESSAGES[reason])
      setLoading(false)
      return
    }

    toast.success('Welcome back!')
    // Only allow same-origin relative paths — '?next=https://evil.com' or
    // '?next=//evil.com' must never redirect off-site (open-redirect/phishing).
    const rawNext = searchParams.get('next') ?? '/browse'
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/browse'
    router.push(next)
    router.refresh()
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) toast.error(error.message)
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
        <p className="mt-2 text-sm text-gray-300">Sign in to continue swapping skills</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-8">
        {/* Email */}
        <div className="relative z-0">
          <input
            type="email"
            id="floating_email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-violet-400 peer"
            placeholder=" "
            required
          />
          <label
            htmlFor="floating_email"
            className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-violet-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            <User className="inline-block mr-2 -mt-1" size={16} />
            Email Address
          </label>
        </div>

        {/* Password */}
        <div className="relative z-0">
          <input
            type="password"
            id="floating_password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-violet-400 peer"
            placeholder=" "
            required
          />
          <label
            htmlFor="floating_password"
            className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-violet-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            <Lock className="inline-block mr-2 -mt-1" size={16} />
            Password
          </label>
        </div>

        <div className="flex justify-end -mt-4">
          <Link href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group w-full flex items-center justify-center py-3 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-violet-500 transition-all duration-300"
        >
          {loading
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : <>Sign In <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" /></>
          }
        </button>

        {/* Divider */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-400/30" />
          <span className="flex-shrink mx-4 text-gray-400 text-xs">OR CONTINUE WITH</span>
          <div className="flex-grow border-t border-gray-400/30" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center py-2.5 px-4 bg-white/90 hover:bg-white disabled:opacity-60 rounded-lg text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-violet-500 transition-all duration-300"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"/>
          </svg>
          Sign in with Google
        </button>
      </form>

      <p className="text-center text-xs text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-violet-400 hover:text-violet-300 transition">
          Sign Up
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm p-8 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20" />}>
      <LoginForm />
    </Suspense>
  )
}
