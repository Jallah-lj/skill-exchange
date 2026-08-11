'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock, LogOut, Download, Trash2, Eye, EyeOff, Bell, BellOff, Shield, ShieldCheck, Phone, CheckCircle2, Clock, AlertCircle, Building2, Plus, ArrowRight, Headphones } from 'lucide-react'
import type { Profile, OrganizationMember } from '@/lib/types'
import Link from 'next/link'
import { TrashSection } from '@/components/settings/trash-section'

interface Toggle {
  label: string
  description: string
  key: keyof Profile
  icon: React.ReactNode
}

const privacyToggles: Toggle[] = [
  {
    label: 'Hide location',
    description: 'Your city/country won\'t appear on your public profile.',
    key: 'hide_location',
    icon: <EyeOff className="h-4 w-4" />,
  },
  {
    label: 'Appear offline',
    description: 'You won\'t show up in Browse for users you haven\'t matched with.',
    key: 'appear_offline',
    icon: <EyeOff className="h-4 w-4" />,
  },
]

// In-app notification groups (saved into profiles.notification_prefs jsonb;
// a DB trigger drops opted-out inserts). Account/safety alerts have no toggle
// on purpose — they're always delivered.
const inAppNotificationGroups = [
  { key: 'matches',   label: 'Matches',        description: 'Match requests and acceptances.' },
  { key: 'messages',  label: 'Messages',       description: 'New chat messages.' },
  { key: 'social',    label: 'Social',         description: 'Mentions, endorsements, and reviews.' },
  { key: 'community', label: 'Community',      description: 'Announcements and platform updates.' },
  { key: 'support',   label: 'Support',        description: 'Replies to your support tickets.' },
] as const

const notificationToggles: Toggle[] = [
  {
    label: 'New match requests',
    description: 'Email me when someone sends me a match request.',
    key: 'notify_match_request',
    icon: <Bell className="h-4 w-4" />,
  },
  {
    label: 'New messages',
    description: 'Email me when I receive a new message.',
    key: 'notify_new_message',
    icon: <Bell className="h-4 w-4" />,
  },
  {
    label: 'Session reminders',
    description: 'Email me a reminder before a scheduled session.',
    key: 'notify_session_reminder',
    icon: <Bell className="h-4 w-4" />,
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [organizations, setOrganizations] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [isOAuthUser, setIsOAuthUser] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Profile visibility
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'matched_only'>('public')
  const [savingVisibility, setSavingVisibility] = useState(false)

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Export
  const [exporting, setExporting] = useState(false)

  // Saving privacy/notification toggles
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Verification
  const [submittingVerification, setSubmittingVerification] = useState(false)

  // Phone verification
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneStep, setPhoneStep] = useState<'idle' | 'sending' | 'otp_sent' | 'verifying'>('idle')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const isOAuth = user.app_metadata?.provider !== 'email'
      setIsOAuthUser(isOAuth)

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data)
        setProfileVisibility(data.profile_visibility ?? 'public')
      }

      // Load organizations
      const { data: orgData } = await supabase
        .from('organization_members')
        .select('*, organization:organizations(*)')
        .eq('user_id', user.id)
      
      if (orgData) setOrganizations(orgData as any)

      setLoading(false)
    }
    load()
  }, [])

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setChangingPassword(true)

    // Re-authenticate then update
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { toast.error('Could not identify account'); setChangingPassword(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) { toast.error('Current password is incorrect'); setChangingPassword(false); return }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error(error.message)
    else {
      toast.success('Password updated!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setChangingPassword(false)
  }

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/')
    router.refresh()
  }

  const submitVerification = async () => {
    if (!profile) return
    setSubmittingVerification(true)
    const { error } = await supabase.from('profiles').update({ kyc_status: 'pending' }).eq('id', profile.id)
    if (error) toast.error('Failed to submit')
    else {
      toast.success('Verification request submitted!')
      setProfile((p) => p ? { ...p, kyc_status: 'pending' } : p)
    }
    setSubmittingVerification(false)
  }

  const sendPhoneOtp = async () => {
    const phone = phoneNumber.trim()
    if (!phone) { toast.error('Enter a phone number'); return }
    setPhoneStep('sending')
    const { error } = await supabase.auth.updateUser({ phone })
    if (error) {
      toast.error(error.message)
      setPhoneStep('idle')
      return
    }
    setPhoneStep('otp_sent')
    toast.success('Code sent! Check your phone.')
    // 60-second resend cooldown
    setResendCooldown(60)
    const t = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 })
    }, 1000)
  }

  const verifyPhoneOtp = async () => {
    if (phoneOtp.length < 6) { toast.error('Enter the 6-digit code'); return }
    setPhoneStep('verifying')
    const { error } = await supabase.auth.verifyOtp({
      phone: phoneNumber.trim(),
      token: phoneOtp.trim(),
      type: 'phone_change',
    })
    if (error) {
      toast.error(error.message)
      setPhoneStep('otp_sent')
      return
    }
    // Mark verified in profiles
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        phone: phoneNumber.trim(),
        phone_verified: true,
      }).eq('id', user.id)
      setProfile((p) => p ? { ...p, phone: phoneNumber.trim(), phone_verified: true } : p)
    }
    toast.success('Phone number verified!')
    setPhoneStep('idle')
    setPhoneOtp('')
  }

  const saveToggle = async (key: keyof Profile, value: boolean) => {
    if (!profile) return
    setSavingKey(key)
    const { error } = await supabase.from('profiles').update({ [key]: value }).eq('id', profile.id)
    if (error) toast.error('Failed to save')
    else setProfile((p) => p ? { ...p, [key]: value } : p)
    setSavingKey(null)
  }

  const saveNotifPref = async (group: string, enabled: boolean) => {
    if (!profile) return
    setSavingKey(`pref:${group}`)
    const prefs = { ...(profile.notification_prefs ?? {}), [group]: enabled }
    const { error } = await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', profile.id)
    if (error) toast.error('Failed to save')
    else setProfile((p) => p ? { ...p, notification_prefs: prefs } : p)
    setSavingKey(null)
  }

  const saveVisibility = async () => {
    if (!profile) return
    setSavingVisibility(true)
    const { error } = await supabase.from('profiles').update({ profile_visibility: profileVisibility }).eq('id', profile.id)
    if (error) toast.error('Failed to save')
    else toast.success('Visibility updated!')
    setSavingVisibility(false)
  }

  const exportData = async () => {
    if (!profile) return
    setExporting(true)

    const [{ data: skills }, { data: matches }, { data: messages }, { data: sessions }, { data: reviews }] = await Promise.all([
      supabase.from('user_skills').select('*').eq('user_id', profile.id),
      supabase.from('match_requests').select('*').or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`),
      supabase.from('messages').select('*').eq('sender_id', profile.id),
      supabase.from('sessions').select('*'),
      supabase.from('reviews').select('*').eq('reviewer_id', profile.id),
    ])

    const exportPayload = {
      exported_at: new Date().toISOString(),
      profile,
      skills: skills ?? [],
      matches: matches ?? [],
      messages_sent: messages ?? [],
      sessions: sessions ?? [],
      reviews_given: reviews ?? [],
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `skillswap-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported!')
    setExporting(false)
  }

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') { toast.error('Type DELETE to confirm'); return }
    setDeleting(true)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }
    )

    if (!res.ok) {
      toast.error('Failed to delete account. Please contact support.')
      setDeleting(false)
      return
    }

    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, privacy, and notifications.</p>
      </div>

      {/* ── Security ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Security
          </CardTitle>
          <CardDescription>Password and session management.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isOAuthUser ? (
            <p className="text-sm text-muted-foreground">
              You signed in with Google. Password management is handled by your Google account.
            </p>
          ) : (
            <form onSubmit={changePassword} className="space-y-4">
              <p className="text-sm font-medium">Change password</p>
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" disabled={changingPassword} size="sm">
                {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update password
              </Button>
            </form>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out everywhere</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ends all active sessions on other devices.</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOutEverywhere} className="gap-2 shrink-0">
              <LogOut className="h-4 w-4" /> Sign out all
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Organizations ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Organizations
              </CardTitle>
              <CardDescription>Manage your organizational ties and teams.</CardDescription>
            </div>
            <Link href="/orgs/create">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {organizations.length === 0 ? (
            <div className="text-center py-6 px-4 border-2 border-dashed rounded-xl">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No organizations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Join a team to collaborate and swap skills internally.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {organizations.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 font-bold">
                      {member.organization?.avatar_url ? (
                        <img src={member.organization.avatar_url} alt="" className="h-full w-full object-cover rounded-lg" />
                      ) : (
                        member.organization?.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{member.organization?.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{member.role}</p>
                    </div>
                  </div>
                  <Link href={`/orgs/${member.organization?.slug}`}>
                    <Button variant="ghost" size="sm" className="gap-2 text-xs">
                      View Profile <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Privacy ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Privacy
          </CardTitle>
          <CardDescription>Control who can see your profile and activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {privacyToggles.map(({ label, description, key }) => {
            const value = !!(profile?.[key])
            const saving = savingKey === key
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <button
                  onClick={() => saveToggle(key, !value)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    value ? 'bg-primary' : 'bg-input'
                  } ${saving ? 'opacity-50' : ''}`}
                  role="switch"
                  aria-checked={value}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      value ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Profile visibility</p>
              <p className="text-xs text-muted-foreground mt-0.5">Who can view your full profile.</p>
            </div>
            <div className="flex gap-3">
              {(['public', 'matched_only'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setProfileVisibility(opt)}
                  className={`flex-1 rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                    profileVisibility === opt
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {opt === 'public' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {opt === 'public' ? 'Everyone' : 'Matches only'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-normal">
                    {opt === 'public'
                      ? 'Anyone browsing SkillSwap can view your profile.'
                      : 'Only users you\'ve matched with can view your profile.'}
                  </p>
                </button>
              ))}
            </div>
            <Button size="sm" onClick={saveVisibility} disabled={savingVisibility}>
              {savingVisibility && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save visibility
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Notifications ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
          <CardDescription>Choose what you're notified about, in the app and by email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">In-app notifications</p>
          {inAppNotificationGroups.map(({ key, label, description }) => {
            const value = profile?.notification_prefs?.[key] !== false // on unless opted out
            const saving = savingKey === `pref:${key}`
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <button
                  onClick={() => saveNotifPref(key, !value)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    value ? 'bg-primary' : 'bg-input'
                  } ${saving ? 'opacity-50' : ''}`}
                  role="switch"
                  aria-checked={value}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      value ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}
          <p className="text-xs text-muted-foreground">
            Account and safety alerts (verification, warnings, account status) are always delivered.
          </p>

          <Separator />

          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Email notifications</p>
          {notificationToggles.map(({ label, description, key }) => {
            const value = profile?.[key] !== false // default to true
            const saving = savingKey === key
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <button
                  onClick={() => saveToggle(key, !value)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    value ? 'bg-primary' : 'bg-input'
                  } ${saving ? 'opacity-50' : ''}`}
                  role="switch"
                  aria-checked={value}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      value ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Trust & Verification ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Trust & Verification
          </CardTitle>
          <CardDescription>Verify your identity to earn the Verified Member badge and boost your Trust Score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Identity Verification</p>
              <div className="flex items-center gap-1.5">
                {profile?.kyc_status === 'verified' ? (
                  <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Fully Verified
                  </span>
                ) : profile?.kyc_status === 'pending' ? (
                  <span className="text-xs text-yellow-600 flex items-center gap-1 font-medium">
                    <Clock className="h-3 w-3" /> Review Pending
                  </span>
                ) : profile?.kyc_status === 'rejected' ? (
                  <span className="text-xs text-red-600 flex items-center gap-1 font-medium">
                   <AlertCircle className="h-3 w-3" /> Verification Rejected
                  </span>
                  ) : (
                  <span className="text-xs text-muted-foreground">Not verified</span>
                  )}
                  </div>
                  {profile?.kyc_status === 'rejected' && profile?.kyc_rejection_reason && (
                  <p className="text-xs text-red-500 mt-1 pl-4.5 border-l-2 border-red-200 py-1">
                  Reason: {profile.kyc_rejection_reason}
                  </p>
                  )}
                  </div>
                  {(!profile?.kyc_status || profile.kyc_status === 'unverified' || profile.kyc_status === 'rejected') && (
              <Button size="sm" onClick={submitVerification} disabled={submittingVerification}>
                {submittingVerification && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Get Verified
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Phone Verification
                </p>
                {profile?.phone_verified ? (
                  <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Verified{profile.phone ? ` · ${profile.phone}` : ''}
                  </span>
                ) : (
                  <p className="text-xs text-muted-foreground">Add your phone number for extra account security.</p>
                )}
              </div>
              {profile?.phone_verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              )}
            </div>

            {!profile?.phone_verified && (
              <div className="space-y-2">
                {/* Step 1 — enter phone */}
                <div className="flex gap-2">
                  <Input
                    placeholder="+1 234 567 8900"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={phoneStep === 'otp_sent' || phoneStep === 'verifying'}
                    className="h-9 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={sendPhoneOtp}
                    disabled={phoneStep === 'sending' || phoneStep === 'verifying' || (phoneStep === 'otp_sent' && resendCooldown > 0)}
                    className="shrink-0 h-9"
                  >
                    {phoneStep === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    {phoneStep === 'otp_sent' && resendCooldown > 0 ? `Resend (${resendCooldown}s)` : phoneStep === 'otp_sent' ? 'Resend code' : 'Send code'}
                  </Button>
                </div>

                {/* Step 2 — enter OTP */}
                {phoneStep === 'otp_sent' || phoneStep === 'verifying' ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="6-digit code"
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="h-9 text-sm tracking-widest font-mono"
                    />
                    <Button
                      size="sm"
                      onClick={verifyPhoneOtp}
                      disabled={phoneOtp.length < 6 || phoneStep === 'verifying'}
                      className="shrink-0 h-9 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {phoneStep === 'verifying' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                ) : null}
                <p className="text-[11px] text-muted-foreground">Include country code · e.g. +1 for US, +44 for UK</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Support ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-4 w-4" /> Support
          </CardTitle>
          <CardDescription>Need help? Submit a ticket and our team will respond.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Contact Support</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ask a question, report a bug, or get help with your account.</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" nativeButton={false} render={<Link href="/support" />}>
              <Headphones className="h-4 w-4" /> Get Help
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Trash ── */}
      {profile && <TrashSection userId={profile.id} />}

      {/* ── Your Data ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Your Data
          </CardTitle>
          <CardDescription>Export or permanently delete your SkillSwap account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export your data</p>
              <p className="text-xs text-muted-foreground mt-0.5">Download all your profile, skills, messages, and sessions as JSON.</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting} className="shrink-0">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
              Export
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">Delete account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permanently removes your account and all data. This cannot be undone.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="shrink-0 gap-1.5">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete your account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete your profile, skills, matches, messages, and all other data.
              <strong className="text-foreground"> This action cannot be undone.</strong>
            </p>
            <div className="space-y-2">
              <Label>
                Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
              </Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleteConfirm !== 'DELETE' || deleting}
              onClick={deleteAccount}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Permanently delete my account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
