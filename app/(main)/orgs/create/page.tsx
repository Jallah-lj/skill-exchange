'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2, ArrowLeft, ArrowRight, Building2, Globe, Check, AlertCircle,
  Lock, Users, Mail, Phone, MapPin, Eye, EyeOff, KeyRound, AtSign, Search,
  GraduationCap, Briefcase, Code2, Heart, Landmark, Rocket, Users2, Sparkles,
} from 'lucide-react'
import type { OrgCategory, OrgVisibility, OrgMembershipType } from '@/lib/types'
import { COUNTRIES } from '@/lib/constants'
import { OrgImageUpload } from '@/components/orgs/org-image-upload'
import { OrgPreviewCard } from '@/components/orgs/org-preview-card'

const CATEGORIES: { value: OrgCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'School / University', label: 'School / University', icon: <GraduationCap className="h-4 w-4" /> },
  { value: 'Professional',        label: 'Professional',        icon: <Briefcase className="h-4 w-4" /> },
  { value: 'Tech Club',           label: 'Tech Club',           icon: <Code2 className="h-4 w-4" /> },
  { value: 'Non-Profit',          label: 'Non-Profit',          icon: <Heart className="h-4 w-4" /> },
  { value: 'Government',          label: 'Government',          icon: <Landmark className="h-4 w-4" /> },
  { value: 'Startup',             label: 'Startup',              icon: <Rocket className="h-4 w-4" /> },
  { value: 'Community',           label: 'Community',           icon: <Users2 className="h-4 w-4" /> },
  { value: 'Other',               label: 'Other',                icon: <Building2 className="h-4 w-4" /> },
]

const VISIBILITY_OPTIONS: { value: OrgVisibility; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'public',  label: 'Public',  desc: 'Anyone can find and view this organization', icon: <Eye className="h-4 w-4" /> },
  { value: 'private', label: 'Private', desc: 'Only members can see the full profile',      icon: <Lock className="h-4 w-4" /> },
  { value: 'hidden',  label: 'Hidden',  desc: 'Does not appear in search or browse',        icon: <EyeOff className="h-4 w-4" /> },
]

const MEMBERSHIP_OPTIONS: { value: OrgMembershipType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'open',       label: 'Open Join',        desc: 'Anyone can join instantly',                          icon: <Users className="h-4 w-4" /> },
  { value: 'request',    label: 'Request Approval', desc: 'Users apply, admins approve each request',           icon: <Mail className="h-4 w-4" /> },
  { value: 'invitation', label: 'Invitation Only',  desc: 'Members join via invite link or organization code',  icon: <KeyRound className="h-4 w-4" /> },
]

const STEPS = [
  { n: 1, label: 'Brand' },
  { n: 2, label: 'Contact' },
  { n: 3, label: 'Membership' },
  { n: 4, label: 'Launch' },
]

export default function CreateOrgPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)

  // Step 1 — Brand & identity
  const [logoUrl, setLogoUrl]   = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [name, setName]         = useState('')
  const [slug, setSlug]         = useState('')
  const [category, setCategory] = useState<OrgCategory | ''>('')
  const [bio, setBio]           = useState('')

  // Step 2 — Contact & presence
  const [website, setWebsite]   = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [country, setCountry]   = useState('')
  const [city, setCity]         = useState('')
  const [searchCountry, setSearchCountry] = useState('')

  // Step 3 — Membership & privacy
  const [visibility, setVisibility]         = useState<OrgVisibility>('public')
  const [membershipType, setMembershipType] = useState<OrgMembershipType>('open')
  const [internalOnly, setInternalOnly]     = useState(false)
  const [emailDomain, setEmailDomain]       = useState('')

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(searchCountry.toLowerCase())
  )

  const checkSlug = useCallback(async (val: string) => {
    if (val.length < 3) { setSlugAvailable(null); return }
    setSlugChecking(true)
    const { data } = await supabase.from('organizations').select('id').eq('slug', val).maybeSingle()
    setSlugAvailable(!data)
    setSlugChecking(false)
  }, [supabase])

  const handleNameChange = (v: string) => {
    setName(v)
    const auto = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setSlug(auto)
    checkSlug(auto)
  }

  const handleSlugChange = (v: string) => {
    const clean = v.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    setSlug(clean)
    checkSlug(clean)
  }

  const handleCreate = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    try {
      // Create org — handle duplicate slug from partial creates
      let orgId: string
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name, slug, bio: bio || null, category: category || null,
          avatar_url: logoUrl || null, cover_image_url: coverUrl || null,
          website: website || null, email: email || null, phone: phone || null,
          country: country || null, city: city || null,
          visibility, membership_type: membershipType,
          internal_only_swapping: internalOnly,
          email_domain: emailDomain || null,
          owner_id: user.id,
        })
        .select()
        .single()

      if (orgErr) {
        if (orgErr.code === '23505') {
          // Slug collision — check if it's our own partial create
          const { data: existing } = await supabase
            .from('organizations')
            .select('id, owner_id')
            .eq('slug', slug)
            .single()
          if (!existing || (existing.owner_id && existing.owner_id !== user.id)) {
            setSlugAvailable(false)
            toast.error('That slug is already taken — choose another')
            setStep(1)
            setLoading(false)
            return
          }
          orgId = existing.id
        } else {
          throw orgErr
        }
      } else {
        orgId = org.id
      }

      // Add creator as owner (upsert — safe on retry)
      const { error: memberErr } = await supabase
        .from('organization_members')
        .upsert(
          { organization_id: orgId, user_id: user.id, role: 'owner' },
          { onConflict: 'organization_id,user_id' }
        )
      if (memberErr) throw memberErr

      toast.success(`${name} created!`)
      router.push(`/orgs/${slug}`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const step1Valid = name.trim().length >= 2 && slug.length >= 3 && slugAvailable === true && category !== ''

  const goTo = (target: number) => {
    if (target < step) setStep(target)
    else if (target === 2 && step1Valid) setStep(2)
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6 gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create your organization</h1>
        <p className="mt-1 text-muted-foreground">
          A home for your school, club, or team to share skills, host workshops, and grow together.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {/* Stepper */}
          <div className="mb-8 flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(s.n)}
                  disabled={s.n > step && !(s.n === 2 && step1Valid)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    s.n < step  ? 'bg-primary text-primary-foreground' :
                    s.n === step ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                                   'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.n < step ? <Check className="h-4 w-4" /> : s.n}
                </button>
                <span className={`text-sm font-medium hidden sm:block ${s.n === step ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className={`h-px w-6 sm:w-12 ${s.n < step ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Brand & identity ── */}
          {step === 1 && (
            <Card className="shadow-lg border-0 ring-1 ring-border">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 mb-2">
                  <Building2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold">Brand & identity</CardTitle>
                <CardDescription>This is what members and visitors will see first.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Cover + logo */}
                <div className="space-y-2">
                  <Label>Branding</Label>
                  <OrgImageUpload variant="cover" imageUrl={coverUrl} onChange={setCoverUrl} />
                  <div className="flex items-center gap-4 pt-1">
                    <OrgImageUpload variant="logo" imageUrl={logoUrl} onChange={setLogoUrl} />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Upload a logo (square) and an optional cover image.
                      Organizations with a logo look more trustworthy and get more join requests.
                    </p>
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    placeholder="e.g. University of Rwanda, Cyber Security Club"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                  />
                </div>

                {/* Slug */}
                <div className="space-y-2">
                  <Label htmlFor="slug" className="flex items-center justify-between">
                    <span>Short Name (URL) <span className="text-red-500">*</span></span>
                    {slugChecking && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {!slugChecking && slugAvailable === true && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 uppercase">
                        <Check className="h-3 w-3" /> Available
                      </span>
                    )}
                    {!slugChecking && slugAvailable === false && (
                      <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5 uppercase">
                        <AlertCircle className="h-3 w-3" /> Taken
                      </span>
                    )}
                  </Label>
                  <div className="flex items-center gap-0">
                    <span className="h-10 px-3 flex items-center text-sm text-muted-foreground bg-muted border border-r-0 rounded-l-md border-input">
                      /orgs/
                    </span>
                    <Input
                      id="slug"
                      className="rounded-l-none"
                      placeholder="university-of-rwanda"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                          category === c.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {c.icon}
                        <span className="text-center leading-tight">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="bio">Description</Label>
                  <Textarea
                    id="bio"
                    placeholder="What does your organization do? What skills do members share?"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!step1Valid} className="gap-2 min-w-32">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Contact & presence ── */}
          {step === 2 && (
            <Card className="shadow-lg border-0 ring-1 ring-border">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 mb-2">
                  <Globe className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold">Contact & presence</CardTitle>
                <CardDescription>Help people reach and trust your organization. All optional.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="website" className="pl-9" placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" className="pl-9" placeholder="info@org.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="phone" className="pl-9" placeholder="+1 234 567 8900" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select onValueChange={(v) => { if (v) setCountry(v) }} value={country}>
                      <SelectTrigger className="w-full">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                          <SelectValue placeholder="Select country" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 sticky top-0 bg-popover z-10">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search countries..."
                              className="pl-8 h-9"
                              value={searchCountry}
                              onChange={(e) => setSearchCountry(e.target.value)}
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-72">
                          {filteredCountries.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                          {filteredCountries.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">No countries found.</div>
                          )}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="city">City</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="city" className="pl-9" placeholder="Kigali" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={() => setStep(3)} className="gap-2 min-w-32">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Membership & privacy ── */}
          {step === 3 && (
            <Card className="shadow-lg border-0 ring-1 ring-border">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 mb-2">
                  <Lock className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold">Membership & privacy</CardTitle>
                <CardDescription>Control who can find and join your organization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Visibility */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Visibility</Label>
                  <div className="space-y-2">
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVisibility(opt.value)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                          visibility === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/40'
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          visibility === opt.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {visibility === opt.value && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Membership Type */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">How people join</Label>
                  <div className="space-y-2">
                    {MEMBERSHIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMembershipType(opt.value)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                          membershipType === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/40'
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          membershipType === opt.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {membershipType === opt.value && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email domain auto-join */}
                <div className="space-y-2 p-4 border rounded-xl bg-muted/20">
                  <Label htmlFor="emailDomain" className="text-sm font-semibold flex items-center gap-2">
                    <AtSign className="h-4 w-4 text-violet-500" />
                    Email Domain Auto-Join
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Anyone signing in with this email domain automatically becomes a member. Great for schools (e.g. <code className="bg-muted px-1 rounded">ur.ac.rw</code>).
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">@</span>
                    <Input
                      id="emailDomain"
                      className="pl-7"
                      placeholder="ur.ac.rw"
                      value={emailDomain}
                      onChange={(e) => setEmailDomain(e.target.value.replace(/^@/, ''))}
                    />
                  </div>
                </div>

                {/* Internal-only swapping toggle */}
                <div className="flex items-center justify-between gap-4 p-4 border rounded-xl bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Internal Skill Swapping Only</Label>
                    <p className="text-xs text-muted-foreground">
                      Members can only match and swap skills with other members of this organization.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={internalOnly}
                    aria-label="Internal skill swapping only"
                    onClick={() => setInternalOnly(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      internalOnly ? 'bg-primary' : 'bg-input'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${internalOnly ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={() => setStep(4)} className="gap-2 min-w-32">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 4: Review & launch ── */}
          {step === 4 && (
            <Card className="shadow-lg border-0 ring-1 ring-border">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 mb-2">
                  <Sparkles className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold">Review & launch</CardTitle>
                <CardDescription>
                  Check the preview one last time — you can change everything later from the dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview inline for small screens where the side panel is hidden */}
                <div className="xl:hidden">
                  <OrgPreviewCard
                    name={name} slug={slug} category={category} bio={bio}
                    website={website} city={city} country={country}
                    logoUrl={logoUrl} coverUrl={coverUrl}
                    visibility={visibility} membershipType={membershipType}
                  />
                </div>

                <div className="rounded-xl border bg-muted/20 divide-y">
                  <Row label="Name"         value={name} />
                  <Row label="URL"          value={`/orgs/${slug}`} mono />
                  <Row label="Category"     value={category || '—'} />
                  {website && <Row label="Website"  value={website} />}
                  {email   && <Row label="Email"    value={email} />}
                  {phone   && <Row label="Phone"    value={phone} />}
                  {(city || country) && <Row label="Location" value={[city, country].filter(Boolean).join(', ')} />}
                  <Row label="Visibility"   value={VISIBILITY_OPTIONS.find(v => v.value === visibility)?.label ?? visibility} />
                  <Row label="Join method"  value={MEMBERSHIP_OPTIONS.find(m => m.value === membershipType)?.label ?? membershipType} />
                  {emailDomain && <Row label="Auto-join domain" value={`@${emailDomain}`} />}
                  {internalOnly && <Row label="Swapping" value="Internal members only" />}
                </div>

                <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">What happens next?</p>
                  You become the owner. From the dashboard you can post announcements, schedule
                  workshops, answer member messages, invite people, and manage join requests.
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={handleCreate} disabled={loading} className="gap-2 min-w-40">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    {loading ? 'Creating…' : 'Create Organization'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live preview (desktop) */}
        <div className="hidden xl:block">
          <div className="sticky top-8 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
            <OrgPreviewCard
              name={name} slug={slug} category={category} bio={bio}
              website={website} city={city} country={country}
              logoUrl={logoUrl} coverUrl={coverUrl}
              visibility={visibility} membershipType={membershipType}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-foreground break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
