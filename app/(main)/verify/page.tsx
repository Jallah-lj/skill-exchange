'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ShieldCheck, Clock, AlertTriangle, CheckCircle, XCircle,
  Upload, FileText, ChevronRight, ChevronLeft,
  BadgeCheck, Loader2, Link2, ExternalLink, Zap,
} from 'lucide-react'
import type { Profile } from '@/lib/types'

type IdType = 'passport' | 'national_id' | 'drivers_license' | 'school_id' | 'other'

interface Eligibility {
  profileComplete: { ok: boolean; detail: string; fix?: string }
  accountAge:      { ok: boolean; detail: string }
  sessions:        { ok: boolean; detail: string }
  rating:          { ok: boolean; detail: string }
  noRestrictions:  { ok: boolean; detail: string }
}

const ID_TYPES: { value: IdType; label: string; description: string }[] = [
  { value: 'passport',        label: 'International Passport',  description: 'Valid passport from any country' },
  { value: 'national_id',     label: 'National ID Card',        description: 'Government-issued national identity card' },
  { value: 'drivers_license', label: "Driver's License",        description: "Valid government-issued driver's license" },
  { value: 'school_id',       label: 'School / University ID',  description: 'Current student or staff ID from an accredited institution' },
  { value: 'other',           label: 'Other Government ID',     description: 'Any other government-issued photo ID' },
]

const BENEFITS = [
  'Blue Verified badge on your profile and in search results',
  'Higher placement when others browse for skill matches',
  'Unlock Top Teacher, Trusted, and other achievement badges',
  'Verified users receive significantly more swap requests',
  'Priority support from our team',
]

export default function VerifyPage() {
  const router = useRouter()
  const supabase = createClient()
  const docInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [existingApp, setExistingApp] = useState<any | null>(null)
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [autoApproved, setAutoApproved] = useState(false)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [idType, setIdType] = useState<IdType>('national_id')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docUrl, setDocUrl] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [reason, setReason] = useState('')
  const [notableWork, setNotableWork] = useState('')
  const [website, setWebsite] = useState('')
  const [twitter, setTwitter] = useState('')
  const [instagram, setInstagram] = useState('')
  const [linkedin, setLinkedin] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: prof }, { data: appData }, { data: matches }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('kyc_applications').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('match_requests').select('id')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq('status', 'accepted'),
    ])

    setProfile(prof)
    setExistingApp(appData)
    if (prof) setFullName(prof.name ?? '')

    // Compute eligibility for auto-approval
    const matchIds = (matches ?? []).map((m: any) => m.id)
    let sessionCount = 0
    let avgRating = 0

    if (matchIds.length > 0) {
      const [{ count }, { data: reviews }] = await Promise.all([
        supabase.from('sessions').select('*', { count: 'exact', head: true })
          .in('match_id', matchIds).eq('status', 'completed'),
        supabase.from('reviews').select('rating').eq('reviewee_id', user.id),
      ])
      sessionCount = count ?? 0
      avgRating = reviews?.length
        ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length
        : 0
    }

    const ageDays = prof?.created_at
      ? Math.floor((Date.now() - new Date(prof.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    setEligibility({
      profileComplete: {
        ok:     !!(prof?.name && prof?.bio && prof?.avatar_url),
        detail: (prof?.name && prof?.bio && prof?.avatar_url) ? 'Name, bio, and photo set' : 'Missing bio or profile photo',
        fix:    '/profile',
      },
      accountAge: {
        ok:     ageDays >= 14,
        detail: `${ageDays} day${ageDays !== 1 ? 's' : ''} old (14+ required)`,
      },
      sessions: {
        ok:     sessionCount >= 5,
        detail: `${sessionCount} completed session${sessionCount !== 1 ? 's' : ''} (5+ required)`,
      },
      rating: {
        ok:     avgRating === 0 || avgRating >= 4.0,
        detail: avgRating > 0 ? `${avgRating.toFixed(1)} ★ average (4.0+ required)` : 'No ratings yet — passes automatically',
      },
      noRestrictions: {
        ok:     !(prof?.banned || prof?.suspended),
        detail: (prof?.banned || prof?.suspended) ? 'Account has active restrictions' : 'Account in good standing',
      },
    })

    setLoading(false)
  }

  const allPass = eligibility ? Object.values(eligibility).every(c => c.ok) : false

  const uploadDocument = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('Document must be under 10 MB'); return }
    setUploadingDoc(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `${user.id}/id_document.${ext}`
    const { error } = await supabase.storage.from('kyc-docs').upload(path, file, { upsert: true })

    if (error) {
      toast.error('Upload failed — the "kyc-docs" storage bucket may not exist yet. Contact support.')
      setUploadingDoc(false)
      return
    }

    setDocFile(file)
    setDocUrl(path)
    toast.success('Document uploaded securely')
    setUploadingDoc(false)
  }

  const submitApplication = async () => {
    if (!docFile && !docUrl) { toast.error('Please upload your ID document to continue'); return }
    if (!reason.trim()) { toast.error('Please tell us why you should be verified'); return }
    setSubmitting(true)

    try {
      const res = await fetch('/api/verify/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, idType,
          documentUrl: docUrl || null,
          reason, notableWork: notableWork || null,
          socialLinks: { website, twitter, instagram, linkedin },
        }),
      })

      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? 'Submission failed'); setSubmitting(false); return }

      setAutoApproved(result.autoApproved)
      setSubmitted(true)
    } catch {
      toast.error('Network error — please try again')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const kycStatus = profile?.kyc_status ?? 'unverified'

  // ── Already verified ──────────────────────────────────────
  if (kycStatus === 'verified') {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-5">
        <div className="h-24 w-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto ring-4 ring-emerald-200 dark:ring-emerald-800">
          <ShieldCheck className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold">You're verified!</h1>
        <p className="text-muted-foreground">Your identity has been confirmed. Your badge is live on your profile.</p>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold text-sm border border-blue-200 dark:border-blue-800">
          <BadgeCheck className="h-4 w-4" /> Verified Member
        </span>
        <div className="pt-2"><Button variant="outline" onClick={() => router.push('/profile')}>View my profile</Button></div>
      </div>
    )
  }

  // ── Pending (already submitted) ───────────────────────────
  if (kycStatus === 'pending' && !submitted) {
    return (
      <div className="max-w-lg mx-auto py-12 space-y-6">
        <div className="text-center space-y-3">
          <div className="h-20 w-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto ring-4 ring-yellow-200 dark:ring-yellow-800">
            <Clock className="h-10 w-10 text-yellow-600 dark:text-yellow-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold">Under review</h1>
          <p className="text-muted-foreground">Our team is reviewing your identity document. Usually 24–48 hours.</p>
        </div>
        <div className="rounded-xl border p-5 space-y-2.5 bg-muted/30 text-sm">
          {['Our team manually reviews your submitted ID document', 'We verify that the name and photo match your SkillSwap account', 'A decision is made and your status updates automatically', 'If approved, your Verified badge appears immediately on your profile'].map(item => (
            <div key={item} className="flex items-start gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" /> {item}
            </div>
          ))}
        </div>
        {existingApp && (
          <div className="rounded-xl border p-5 text-sm space-y-2">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Your submission</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Legal name</span><span className="font-medium">{existingApp.full_name}</span>
              <span className="text-muted-foreground">Document type</span><span className="font-medium capitalize">{existingApp.id_type?.replace(/_/g, ' ')}</span>
              <span className="text-muted-foreground">ID document</span>
              <span className={existingApp.document_url ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                {existingApp.document_url ? '✓ Uploaded' : 'Not provided'}
              </span>
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-medium">{new Date(existingApp.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
      </div>
    )
  }

  // ── Just submitted ────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-5">
        <div className={cn(
          'h-24 w-24 rounded-full flex items-center justify-center mx-auto ring-4',
          autoApproved
            ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-emerald-200 dark:ring-emerald-800'
            : 'bg-violet-100 dark:bg-violet-900/30 ring-violet-200 dark:ring-violet-800'
        )}>
          {autoApproved
            ? <ShieldCheck className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            : <Clock className="h-12 w-12 text-violet-600 dark:text-violet-400" />}
        </div>
        <h1 className="text-2xl font-bold">
          {autoApproved ? 'Verified instantly!' : 'Application submitted!'}
        </h1>
        <p className="text-muted-foreground">
          {autoApproved
            ? 'You met all auto-verification criteria and your document was submitted. Your Verified Member badge is now live!'
            : 'Your document and application are under manual review. Our team will process it within 24–48 hours.'}
        </p>
        {autoApproved && (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold text-sm border border-blue-200 dark:border-blue-800">
            <BadgeCheck className="h-4 w-4" /> Verified Member
          </span>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => router.push('/profile')}>My profile</Button>
          <Button onClick={() => router.push('/browse')}>Browse members</Button>
        </div>
      </div>
    )
  }

  const isRejected = kycStatus === 'rejected'
  const selectedIdType = ID_TYPES.find(t => t.value === idType)
  const stepLabels = ['', 'ID Document', 'About you', 'Review']

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <BadgeCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Request Verification</h1>
          <p className="text-muted-foreground mt-1">Submit your government-issued ID to get the verified checkmark on SkillSwap.</p>
        </div>
      </div>

      {/* Rejection banner */}
      {isRejected && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900 dark:text-red-200 text-sm">Previous application was not approved</p>
            {profile?.kyc_rejection_reason && (
              <p className="text-sm text-red-700 dark:text-red-400 mt-1"><span className="font-medium">Reason:</span> {profile.kyc_rejection_reason}</p>
            )}
            <p className="text-xs text-red-600 dark:text-red-500 mt-1.5">Re-apply below. Make sure your document is clear, unexpired, and addresses the reason above.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="space-y-4">

          {/* Auto-verification eligibility */}
          <div className="rounded-xl border p-5 space-y-3">
            <p className="font-semibold text-sm">Auto-verification status</p>
            <p className="text-xs text-muted-foreground">
              Meet all 5 criteria and your account is verified <span className="font-medium">instantly</span> upon document submission. Otherwise we review manually within 48h.
            </p>
            <div className="space-y-2.5">
              {eligibility && Object.entries(eligibility).map(([key, c]) => (
                <div key={key} className="flex items-start gap-2.5">
                  {c.ok
                    ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className={cn('text-xs font-medium leading-snug', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
                      {key === 'profileComplete' && 'Complete profile'}
                      {key === 'accountAge' && 'Account age'}
                      {key === 'sessions' && 'Completed sessions'}
                      {key === 'rating' && 'Average rating'}
                      {key === 'noRestrictions' && 'No restrictions'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{c.detail}</p>
                    {!c.ok && 'fix' in c && c.fix && (
                      <button onClick={() => router.push(c.fix!)} className="text-[11px] text-violet-600 hover:underline mt-0.5">Fix now →</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className={cn(
              'mt-3 rounded-lg px-3 py-2.5 text-xs font-medium flex items-center gap-2 border',
              allPass
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800'
            )}>
              {allPass
                ? <><Zap className="h-3.5 w-3.5 shrink-0" /> You qualify for instant verification!</>
                : <><Clock className="h-3.5 w-3.5 shrink-0" /> Manual review required (24–48h)</>}
            </div>
          </div>

          {/* Accepted documents */}
          <div className="rounded-xl border p-5 space-y-3">
            <p className="font-semibold text-sm">Accepted ID documents</p>
            <div className="space-y-2">
              {ID_TYPES.map((t) => (
                <div key={t.value} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">{t.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Requirements:</p>
              {['Must be valid and unexpired', 'All four corners visible', 'Clear photo (not blurry)', 'JPG · PNG · PDF · max 10 MB'].map(r => (
                <p key={r} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" /> {r}
                </p>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="rounded-xl border p-5 space-y-2">
            <p className="font-semibold text-sm">Why get verified?</p>
            {BENEFITS.map((b) => (
              <p key={b} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" /> {b}
              </p>
            ))}
          </div>
        </div>

        {/* Right: form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border overflow-hidden">
            {/* Step indicator */}
            <div className="border-b bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <div className={cn(
                      'h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
                      step === n ? 'bg-violet-600 text-white shadow-sm' : step > n ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {step > n ? <CheckCircle className="h-4 w-4" /> : n}
                    </div>
                    <span className={cn('text-xs font-medium hidden sm:block', step === n ? 'text-foreground' : 'text-muted-foreground')}>
                      {stepLabels[n]}
                    </span>
                    {n < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Step 1: ID document ─────────────────────────── */}
            {step === 1 && (
              <div className="p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Upload your ID document</h2>
                  <p className="text-sm text-muted-foreground mt-1">Encrypted and stored securely. Only our verification team can access it.</p>
                </div>

                <div className="space-y-2">
                  <Label>Full legal name <span className="text-red-500">*</span></Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Exactly as it appears on your ID" />
                </div>

                <div className="space-y-2">
                  <Label>Document type <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ID_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setIdType(t.value)}
                        className={cn(
                          'text-left rounded-lg border p-3 transition-all',
                          idType === t.value
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 ring-1 ring-violet-500'
                            : 'border-muted hover:border-muted-foreground/40 hover:bg-muted/30'
                        )}
                      >
                        <p className={cn('text-sm font-medium', idType === t.value ? 'text-violet-700 dark:text-violet-300' : '')}>{t.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    ID document photo <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(required for verification)</span>
                  </Label>

                  <div
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:bg-muted/20',
                      docFile ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10'
                        : uploadingDoc ? 'border-violet-400 bg-violet-50/20'
                        : 'border-muted-foreground/30 hover:border-violet-400'
                    )}
                    onClick={() => !uploadingDoc && docInputRef.current?.click()}
                  >
                    {uploadingDoc ? (
                      <div className="space-y-2">
                        <Loader2 className="h-10 w-10 animate-spin text-violet-500 mx-auto" />
                        <p className="text-sm text-muted-foreground">Uploading securely…</p>
                      </div>
                    ) : docFile ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <FileText className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{docFile.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{(docFile.size / 1024 / 1024).toFixed(2)} MB · Uploaded securely</p>
                          <p className="text-xs text-violet-600 mt-1 hover:underline">Click to replace</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
                          <Upload className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Click to upload your {selectedIdType?.label ?? 'ID'}</p>
                          <p className="text-xs text-muted-foreground mt-1">or drag and drop here</p>
                          <p className="text-xs text-muted-foreground mt-1">JPG · PNG · PDF · max 10 MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input ref={docInputRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(f); e.target.value = '' }} />

                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                    <span className="text-amber-500 text-sm shrink-0 mt-0.5">🔒</span>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Your document is encrypted in transit and at rest. It is only visible to our trained verification team and deleted after review.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      if (!fullName.trim()) { toast.error('Please enter your full legal name'); return }
                      if (!docFile && !docUrl) { toast.error('Please upload your ID document before continuing'); return }
                      setStep(2)
                    }}
                    className="gap-2" disabled={uploadingDoc}
                  >
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: About you ───────────────────────────── */}
            {step === 2 && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Tell us about yourself</h2>
                  <p className="text-sm text-muted-foreground mt-1">This helps our review team understand who you are and speeds up the process.</p>
                </div>

                <div className="space-y-2">
                  <Label>Why should your account be verified? <span className="text-red-500">*</span></Label>
                  <Textarea
                    value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Tell us about your background and why you want verification. e.g. I'm a professional software engineer who teaches Python and I want learners to trust my profile…"
                    rows={4} maxLength={600}
                  />
                  <p className="text-xs text-muted-foreground text-right">{reason.length}/600</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Notable achievements or credentials
                    <Badge variant="outline" className="text-[10px] font-normal">optional</Badge>
                  </Label>
                  <Textarea
                    value={notableWork} onChange={(e) => setNotableWork(e.target.value)}
                    placeholder="e.g. Certified AWS Solutions Architect, 5+ years of professional teaching, licensed medical professional, published author…"
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Social or professional links
                    <Badge variant="outline" className="text-[10px] font-normal">optional</Badge>
                  </Label>
                  <p className="text-xs text-muted-foreground -mt-1">Links to your social profiles or portfolio help confirm your public identity.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Website / Portfolio</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">LinkedIn</Label><Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/username" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Twitter / X</Label><Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@username" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Instagram</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@username" /></div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
                  <Button onClick={() => { if (!reason.trim()) { toast.error('Please tell us why you want verification'); return } setStep(3) }} className="gap-2">
                    Review <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Review ──────────────────────────────── */}
            {step === 3 && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Review your application</h2>
                  <p className="text-sm text-muted-foreground mt-1">Check everything before submitting. You can only have one active application at a time.</p>
                </div>

                <div className="rounded-xl border divide-y overflow-hidden text-sm">
                  {[
                    { label: 'Legal name',    value: fullName },
                    { label: 'Document type', value: selectedIdType?.label },
                    { label: 'ID document',   value: docFile ? <span className="text-emerald-600 font-medium flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{docFile.name}</span> : <span className="text-red-500">Not uploaded</span> },
                  ].map(row => (
                    <div key={row.label} className="grid grid-cols-3 gap-3 px-4 py-3.5">
                      <span className="text-muted-foreground text-xs font-medium">{row.label}</span>
                      <span className="col-span-2 font-medium">{row.value}</span>
                    </div>
                  ))}
                  {reason && (
                    <div className="grid grid-cols-3 gap-3 px-4 py-3.5">
                      <span className="text-muted-foreground text-xs font-medium">Reason</span>
                      <span className="col-span-2 text-muted-foreground text-xs leading-relaxed">{reason}</span>
                    </div>
                  )}
                  {notableWork && (
                    <div className="grid grid-cols-3 gap-3 px-4 py-3.5">
                      <span className="text-muted-foreground text-xs font-medium">Credentials</span>
                      <span className="col-span-2 text-muted-foreground text-xs leading-relaxed">{notableWork}</span>
                    </div>
                  )}
                  {[website, linkedin, twitter, instagram].some(Boolean) && (
                    <div className="grid grid-cols-3 gap-3 px-4 py-3.5">
                      <span className="text-muted-foreground text-xs font-medium">Links</span>
                      <div className="col-span-2 space-y-1">
                        {[website, linkedin, twitter, instagram].filter(Boolean).map(v => (
                          <span key={v} className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ExternalLink className="h-3 w-3 shrink-0" /> {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto-approval outcome preview */}
                <div className={cn(
                  'rounded-lg p-4 flex items-start gap-3 border text-sm',
                  allPass
                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                    : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                )}>
                  {allPass
                    ? <Zap className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    : <Clock className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />}
                  <div>
                    <p className={cn('font-semibold', allPass ? 'text-emerald-800 dark:text-emerald-300' : 'text-yellow-800 dark:text-yellow-300')}>
                      {allPass ? 'Instant verification — badge goes live immediately' : 'Manual review — decision within 24–48 hours'}
                    </p>
                    <p className={cn('text-xs mt-0.5', allPass ? 'text-emerald-700 dark:text-emerald-400' : 'text-yellow-700 dark:text-yellow-400')}>
                      {allPass
                        ? 'You meet all auto-verification criteria. As soon as you submit, your account will be marked Verified.'
                        : 'You don\'t meet all auto-approval criteria yet, but you can still apply. Our team will review your document and application.'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  By submitting, you confirm all information is accurate and that you are the lawful owner of the ID document. Submitting false or fraudulent documents may result in a permanent account ban.
                </p>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
                  <Button onClick={submitApplication} disabled={submitting || !docFile} className="gap-2 bg-violet-600 hover:bg-violet-700">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {allPass ? 'Submit & get verified now' : 'Submit for review'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
