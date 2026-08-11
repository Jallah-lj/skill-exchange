'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, KeyRound, Copy, Link2, QrCode, Ban, Users, Plus } from 'lucide-react'
import type { Organization, OrganizationInviteCode, OrganizationInviteCodeUse } from '@/lib/types'

const ROLES = ['member', 'instructor', 'moderator', 'admin'] as const
const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expires' },
  { value: '1', label: '24 hours' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join('')
}

interface OrgInviteCodesProps {
  org: Organization
}

export function OrgInviteCodes({ org }: OrgInviteCodesProps) {
  const supabase = createClient()

  const [codes, setCodes] = useState<OrganizationInviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number]>('member')
  const [expiry, setExpiry] = useState('30')
  const [maxUses, setMaxUses] = useState('')

  const [qrFor, setQrFor] = useState<OrganizationInviteCode | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [usesFor, setUsesFor] = useState<OrganizationInviteCode | null>(null)
  const [uses, setUses] = useState<OrganizationInviteCodeUse[]>([])

  useEffect(() => {
    const loadCodes = async () => {
      const { data } = await supabase
        .from('organization_invite_codes')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
      setCodes(data ?? [])
      setLoading(false)
    }
    loadCodes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const joinUrl = (code: string) => `${window.location.origin}/orgs/join/${code}`

  const createCode = async () => {
    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('organization_invite_codes')
        .insert({
          organization_id: org.id,
          code: generateCode(),
          role,
          label: label.trim() || null,
          max_uses: maxUses ? parseInt(maxUses, 10) : null,
          expires_at: expiry === 'never' ? null : new Date(Date.now() + parseInt(expiry, 10) * 86_400_000).toISOString(),
          created_by: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      setCodes((prev) => [data, ...prev])
      setLabel('')
      setMaxUses('')
      toast.success('Invite code created')
    } catch (err: unknown) {
      const e = err as { message?: string; hint?: string; code?: string; details?: string }
      console.error('Failed to create invite code:', JSON.stringify({
        message: e?.message, code: e?.code, details: e?.details, hint: e?.hint,
      }))
      toast.error(e?.message ? `${e.message}${e.hint ? ` — ${e.hint}` : ''}` : 'Failed to create code')
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (code: OrganizationInviteCode) => {
    const revokedAt = new Date().toISOString()
    const { error } = await supabase
      .from('organization_invite_codes')
      .update({ revoked_at: revokedAt })
      .eq('id', code.id)
    if (error) { toast.error('Failed to revoke'); return }
    setCodes((prev) => prev.map((c) => c.id === code.id ? { ...c, revoked_at: revokedAt } : c))
    toast.success('Code revoked')
  }

  const showQr = async (code: OrganizationInviteCode) => {
    // Loaded on demand: qrcode is CommonJS and breaks if evaluated during SSR.
    const QRCode = (await import('qrcode')).default
    const dataUrl = await QRCode.toDataURL(joinUrl(code.code), { width: 280, margin: 1 })
    setQrDataUrl(dataUrl)
    setQrFor(code)
  }

  const showUses = async (code: OrganizationInviteCode) => {
    setUsesFor(code)
    const { data } = await supabase
      .from('organization_invite_code_uses')
      .select('*, profile:profiles!organization_invite_code_uses_user_id_fkey(*)')
      .eq('code_id', code.id)
      .order('used_at', { ascending: false })
    setUses((data as unknown as OrganizationInviteCodeUse[]) ?? [])
  }

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  }

  const codeStatus = (c: OrganizationInviteCode) => {
    if (c.revoked_at) return { label: 'Revoked', className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' }
    if (c.expires_at && new Date(c.expires_at) < new Date()) return { label: 'Expired', className: 'bg-muted text-muted-foreground' }
    if (c.max_uses != null && c.use_count >= c.max_uses) return { label: 'Used up', className: 'bg-muted text-muted-foreground' }
    return { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' }
  }

  return (
    <Card className="border-0 ring-1 ring-border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-violet-500" /> Invite Codes
        </CardTitle>
        <CardDescription>
          Share a code, link, or QR code — people who use it join instantly with the role you choose.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Generator */}
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Label (optional)</Label>
              <Input placeholder="e.g. Orientation week" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Role granted</Label>
              <Select value={role} onValueChange={(v) => { if (v) setRole(v as typeof ROLES[number]) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Expires</Label>
              <Select value={expiry} onValueChange={(v) => { if (v) setExpiry(v) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Max uses (blank = unlimited)</Label>
              <Input type="number" min="1" placeholder="e.g. 50" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
          </div>
          <Button onClick={createCode} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate code
          </Button>
        </div>

        {/* Code list */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : codes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No invite codes yet.</p>
        ) : (
          <div className="space-y-3">
            {codes.map((c) => {
              const status = codeStatus(c)
              return (
                <div key={c.id} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <code className="font-mono text-base font-bold tracking-widest">{c.code}</code>
                      <Badge className={`border-0 ${status.className}`}>{status.label}</Badge>
                      <Badge variant="outline" className="capitalize">{c.role}</Badge>
                      {c.label && <span className="text-xs text-muted-foreground">{c.label}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Copy code" onClick={() => copy(c.code, 'Code')}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Copy invite link" onClick={() => copy(joinUrl(c.code), 'Link')}>
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Show QR code" onClick={() => showQr(c)}>
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="View usage" onClick={() => showUses(c)}>
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                      {!c.revoked_at && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Revoke code"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => revoke(c)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.use_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''} uses
                    {c.expires_at && ` · expires ${new Date(c.expires_at).toLocaleDateString()}`}
                    {` · created ${new Date(c.created_at).toLocaleDateString()}`}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* QR dialog */}
      <Dialog open={qrFor !== null} onOpenChange={(v) => { if (!v) setQrFor(null) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Scan to join {org.name}</DialogTitle>
          </DialogHeader>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR code for invite ${qrFor?.code}`} className="rounded-xl border bg-white p-2" />
              <code className="font-mono text-sm font-bold tracking-widest">{qrFor?.code}</code>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => qrFor && copy(joinUrl(qrFor.code), 'Link')}>
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Usage dialog */}
      <Dialog open={usesFor !== null} onOpenChange={(v) => { if (!v) setUsesFor(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Usage — {usesFor?.code}</DialogTitle>
          </DialogHeader>
          {uses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nobody has used this code yet.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {uses.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={u.profile?.avatar_url ?? ''} />
                    <AvatarFallback className="text-xs font-bold">
                      {u.profile?.name?.slice(0, 2).toUpperCase() ?? '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.profile?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(u.used_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
