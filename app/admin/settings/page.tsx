'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Settings, Globe, Lock, Code2, Save, RefreshCw,
  Palette, Bell, Shield, ToggleLeft, ToggleRight,
  Plus, Trash2, Copy, Eye, EyeOff, Webhook, Key,
  AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SettingsMap = Record<string, string | number | boolean | string[]>

const TABS = ['general', 'localization', 'access', 'api'] as const
type Tab = typeof TABS[number]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
]

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney', 'Africa/Lagos', 'Africa/Nairobi',
]

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'NGN', label: 'Nigerian Naira (NGN)' },
  { value: 'KES', label: 'Kenyan Shilling (KES)' },
  { value: 'GHS', label: 'Ghanaian Cedi (GHS)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
]

const COLORS = ['violet', 'blue', 'emerald', 'orange', 'rose', 'indigo', 'sky']

const COLOR_PREVIEWS: Record<string, string> = {
  violet: 'bg-violet-600',
  blue:   'bg-blue-600',
  emerald:'bg-emerald-600',
  orange: 'bg-orange-500',
  rose:   'bg-rose-500',
  indigo: 'bg-indigo-600',
  sky:    'bg-sky-500',
}

export default function PlatformSettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<SettingsMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<Tab>('general')
  const [showApiKey, setShowApiKey] = useState(false)
  const [newCountry, setNewCountry] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhooks, setWebhooks] = useState<string[]>([])

  // Placeholder text for a UI mock only — deliberately NOT shaped like a real
  // provider key (no sk_live_/pk_live_ prefix), so it can never be mistaken
  // for a live secret by GitHub secret scanning or anyone reading the code.
  const MOCK_API_KEY = 'demo-key-••••••••••••••••••••••••••••••••'
  const MOCK_API_KEY_REVEALED = 'demo-key-not-a-real-credential-0000000000000000'

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
    if (data) {
      const map: SettingsMap = {}
      for (const row of data) {
        try {
          map[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
        } catch {
          map[row.key] = row.value
        }
      }
      setSettings(map)
    }
    setLoading(false)
    setDirty(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = (key: string, value: unknown) => {
    setSettings(s => ({ ...s, [key]: value as SettingsMap[string] }))
    setDirty(true)
  }

  const get = <T,>(key: string, fallback: T): T => {
    if (key in settings) return settings[key] as unknown as T
    return fallback
  }

  const save = async () => {
    setSaving(true)
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    }))
    for (const row of rows) {
      await supabase.from('platform_settings').upsert(row, { onConflict: 'key' })
    }
    toast.success('Settings saved')
    setSaving(false)
    setDirty(false)
  }

  const addCountry = () => {
    if (!newCountry.trim() || newCountry.length !== 2) { toast.error('Enter a valid 2-letter country code'); return }
    const current = get<string[]>('country_restrictions', [])
    if (current.includes(newCountry.toUpperCase())) { toast.error('Already added'); return }
    set('country_restrictions', [...current, newCountry.toUpperCase()])
    setNewCountry('')
  }

  const removeCountry = (code: string) => {
    set('country_restrictions', get<string[]>('country_restrictions', []).filter(c => c !== code))
  }

  const addWebhook = () => {
    if (!webhookUrl.trim()) return
    setWebhooks(w => [...w, webhookUrl])
    setWebhookUrl('')
    toast.success('Webhook added (save to persist)')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Global configuration for SkillSwap</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
          <Button onClick={save} disabled={saving || !dirty} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {dirty && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">You have unsaved changes</p>
          <Button size="sm" onClick={save} disabled={saving} className="ml-auto bg-amber-600 hover:bg-amber-700 gap-1.5 h-7 text-xs">
            <Save className="h-3 w-3" />
            Save now
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-muted/50 rounded-lg p-1 gap-0.5 w-fit">
        {([
          { key: 'general',      label: 'General',      icon: Settings },
          { key: 'localization', label: 'Localization',  icon: Globe },
          { key: 'access',       label: 'Access',        icon: Lock },
          { key: 'api',          label: 'API & Webhooks',icon: Code2 },
        ] as const).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all',
                tab === t.key ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* General */}
      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-5">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-violet-600" />
                Platform Identity
              </h2>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Platform Name</label>
                <Input
                  value={get('platform_name', 'SkillSwap')}
                  onChange={e => set('platform_name', e.target.value)}
                  placeholder="SkillSwap"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tagline</label>
                <Input
                  value={get('platform_tagline', '')}
                  onChange={e => set('platform_tagline', e.target.value)}
                  placeholder="Learn skills, teach skills, grow together"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Logo URL</label>
                <Input
                  value={get('platform_logo_url', '')}
                  onChange={e => set('platform_logo_url', e.target.value)}
                  placeholder="https://…/logo.png"
                  type="url"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Support Email</label>
                <Input
                  value={get('support_email', '')}
                  onChange={e => set('support_email', e.target.value)}
                  placeholder="support@skillswap.com"
                  type="email"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Platform Description</label>
                <Textarea
                  value={get('platform_description', '')}
                  onChange={e => set('platform_description', e.target.value)}
                  placeholder="Describe your platform in a few sentences…"
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4 text-violet-600" />
                Theme & Branding
              </h2>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Primary Brand Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => set('theme_primary_color', color)}
                      className={cn(
                        'h-9 w-9 rounded-lg transition-all border-2',
                        COLOR_PREVIEWS[color],
                        get('theme_primary_color', 'violet') === color
                          ? 'border-gray-900 dark:border-white scale-110 shadow-md'
                          : 'border-transparent hover:scale-105'
                      )}
                      title={color}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Selected: <span className="font-medium capitalize">{get('theme_primary_color', 'violet')}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Preview card */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
              <h2 className="font-semibold mb-4 text-sm">Live Preview</h2>
              <div className="border rounded-xl overflow-hidden">
                <div className={cn('p-5 text-white', COLOR_PREVIEWS[get('theme_primary_color', 'violet')])}>
                  <div className="flex items-center gap-2 mb-3">
                    {get('platform_logo_url', '') ? (
                      <img src={get<string>('platform_logo_url', '')} alt="logo" className="h-8 w-8 rounded" />
                    ) : (
                      <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {get<string>('platform_name', 'SS').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-lg">{get('platform_name', 'SkillSwap')}</span>
                  </div>
                  <p className="text-sm text-white/80">{get('platform_tagline', 'Learn skills, teach skills, grow together')}</p>
                </div>
                <div className="p-4 text-xs text-muted-foreground">
                  This is how your platform name and brand appear to users
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
              <h2 className="font-semibold mb-3 text-sm">Platform Limits</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Skills Per User</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={get('max_skills_per_user', 20)}
                    onChange={e => set('max_skills_per_user', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Localization */}
      {tab === 'localization' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-5">
            <h2 className="font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-violet-600" />
              Localization Settings
            </h2>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Default Language</label>
              <Select value={get('platform_language', 'en')} onValueChange={v => set('platform_language', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Timezone</label>
              <Select value={get('platform_timezone', 'UTC')} onValueChange={v => set('platform_timezone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Currency</label>
              <Select value={get('platform_currency', 'USD')} onValueChange={v => set('platform_currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold">Country Restrictions</h2>
            <p className="text-xs text-muted-foreground">
              Users from these countries will be blocked from registering. Leave empty to allow all countries.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Country code (e.g. US, GB)"
                value={newCountry}
                onChange={e => setNewCountry(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                className="w-44"
                onKeyDown={e => e.key === 'Enter' && addCountry()}
              />
              <Button variant="outline" onClick={addCountry} className="gap-2">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {get<string[]>('country_restrictions', []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No restrictions — all countries allowed</p>
              ) : (
                get<string[]>('country_restrictions', []).map(code => (
                  <span key={code} className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full border border-red-200">
                    {code}
                    <button onClick={() => removeCountry(code)} className="hover:text-red-900 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Access Control */}
      {tab === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-5">
            <h2 className="font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-violet-600" />
              Access Controls
            </h2>

            {([
              { key: 'allow_registration',  label: 'Open Registration',    desc: 'Allow new users to sign up', danger: false },
              { key: 'maintenance_mode',     label: 'Maintenance Mode',     desc: 'Block all non-admin access', danger: true },
              { key: 'require_email_verify', label: 'Require Email Verify', desc: 'Users must verify email before login', danger: false },
              { key: 'require_kyc',          label: 'Require KYC',          desc: 'Users must complete KYC to swap', danger: false },
              { key: 'allow_guest_browse',   label: 'Guest Browsing',       desc: 'Allow unauthenticated users to browse public profiles', danger: false },
            ]).map(opt => {
              const val = get<boolean>(opt.key, opt.key === 'allow_registration' || opt.key === 'allow_guest_browse')
              return (
                <div key={opt.key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className={cn('text-sm font-medium', opt.danger && val && 'text-orange-600')}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                  <button
                    onClick={() => set(opt.key, !val)}
                    className={cn(
                      'h-6 w-11 rounded-full border-2 relative transition-all shrink-0',
                      val ? 'bg-violet-600 border-violet-600' : 'bg-gray-200 border-gray-200'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0 left-0 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      val ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              )
            })}

            {get<boolean>('maintenance_mode', false) && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                  <p className="text-xs text-orange-800 dark:text-orange-300 font-medium">
                    Maintenance mode is ON — users cannot access the platform
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold">Session Configuration</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Maintenance Message</label>
              <Textarea
                value={get('maintenance_message', '')}
                onChange={e => set('maintenance_message', e.target.value)}
                placeholder="We're updating the platform. Back soon!"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">Shown to users when maintenance mode is ON</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Session Duration (days)</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={get('session_duration_days', 30)}
                onChange={e => set('session_duration_days', Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      )}

      {/* API & Webhooks */}
      {tab === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-violet-600" />
                API Keys
              </h2>
              <p className="text-xs text-muted-foreground">
                Use these keys to integrate SkillSwap with external services. Keep the secret key private.
              </p>

              <div className="space-y-3">
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-600">Live Secret Key</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                      {showApiKey ? MOCK_API_KEY_REVEALED : MOCK_API_KEY}
                    </code>
                    <button onClick={() => setShowApiKey(v => !v)} className="text-muted-foreground hover:text-foreground shrink-0">
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(MOCK_API_KEY_REVEALED); toast.success('Copied to clipboard') }}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Your actual API credentials are managed in Supabase Dashboard → Project Settings → API. The keys above are for integration reference.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
              <h2 className="font-semibold">Rate Limits</h2>
              <div className="space-y-3">
                {([
                  { key: 'api_rate_limit_per_minute', label: 'Requests per minute', default: 60 },
                  { key: 'api_max_file_size_mb', label: 'Max file upload (MB)', default: 10 },
                ]).map(opt => (
                  <div key={opt.key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{opt.label}</label>
                    <Input
                      type="number"
                      value={get(opt.key, opt.default)}
                      onChange={e => set(opt.key, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Webhook className="h-4 w-4 text-violet-600" />
              Webhooks
            </h2>
            <p className="text-xs text-muted-foreground">
              Register URLs to receive real-time event notifications when users sign up, complete swaps, or get flagged.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="https://your-server.com/webhook"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                type="url"
              />
              <Button variant="outline" onClick={addWebhook} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {webhooks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 border rounded-lg border-dashed">
                  No webhooks configured
                </p>
              ) : (
                webhooks.map((url, i) => (
                  <div key={i} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="flex-1 text-xs font-mono truncate">{url}</span>
                    <button onClick={() => setWebhooks(w => w.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Events dispatched</p>
              <div className="flex flex-wrap gap-1.5">
                {['user.created', 'user.banned', 'swap.completed', 'swap.disputed', 'report.filed', 'session.completed'].map(e => (
                  <code key={e} className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono">{e}</code>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
