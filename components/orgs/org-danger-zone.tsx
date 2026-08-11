'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, Crown, Trash2 } from 'lucide-react'
import type { OrganizationMember } from '@/lib/types'

interface OrgDangerZoneProps {
  orgId: string
  orgName: string
  currentUserId: string | null
  members: OrganizationMember[]
  onTransferred: () => void
}

export function OrgDangerZone({ orgId, orgName, currentUserId, members, onTransferred }: OrgDangerZoneProps) {
  const router = useRouter()
  const supabase = createClient()

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferring, setTransferring] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const transferCandidates = members.filter((m) => m.user_id !== currentUserId)

  const handleTransfer = async () => {
    const target = members.find((m) => m.id === transferTarget)
    if (!target) return
    setTransferring(true)
    try {
      const { error: orgErr } = await supabase
        .from('organizations')
        .update({ owner_id: target.user_id })
        .eq('id', orgId)
      if (orgErr) throw orgErr

      const { error: promoteErr } = await supabase
        .from('organization_members')
        .update({ role: 'owner' })
        .eq('id', target.id)
      if (promoteErr) throw promoteErr

      if (currentUserId) {
        await supabase
          .from('organization_members')
          .update({ role: 'admin' })
          .eq('organization_id', orgId)
          .eq('user_id', currentUserId)
      }

      toast.success(`Ownership transferred to ${target.profile?.name ?? 'the selected member'}`)
      setTransferOpen(false)
      onTransferred()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setTransferring(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('organizations').delete().eq('id', orgId)
      if (error) throw error
      toast.success(`${orgName} deleted`)
      router.push('/orgs')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed — you may not have permission')
      setDeleting(false)
    }
  }

  return (
    <Card className="border-0 ring-1 ring-red-200 dark:ring-red-900 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" /> Danger zone
        </CardTitle>
        <CardDescription>These actions are permanent — proceed carefully.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Transfer ownership</p>
            <p className="text-xs text-muted-foreground">
              Hand this organization to another member. You become an admin.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 gap-2"
            disabled={transferCandidates.length === 0}
            onClick={() => setTransferOpen(true)}
          >
            <Crown className="h-4 w-4" /> Transfer
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Delete organization</p>
            <p className="text-xs text-muted-foreground">
              Permanently removes the organization, its members, announcements, workshops, and messages.
            </p>
          </div>
          <Button variant="destructive" className="shrink-0 gap-2" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </CardContent>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={(v) => { setTransferOpen(v); if (!v) setTransferTarget('') }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">New owner</Label>
            <Select onValueChange={(v) => setTransferTarget(v ?? '')} value={transferTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.profile?.name ?? 'Unknown'} · {m.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              They gain full control, including the ability to remove you.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferring}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={transferring || !transferTarget}>
              {transferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); if (!v) setDeleteConfirm('') }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {orgName}?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">
              This cannot be undone. Type <span className="font-mono font-semibold text-foreground">{orgName}</span> to confirm.
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={orgName}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== orgName}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
