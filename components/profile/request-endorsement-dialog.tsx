'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ThumbsUp } from 'lucide-react'
import type { UserSkill } from '@/lib/types'
import type { MatchedConnection } from '@/hooks/use-profile'

interface RequestEndorsementDialogProps {
  matches: MatchedConnection[]
  teachSkills: UserSkill[]
  onRequest: (recipientId: string, skillName: string) => Promise<boolean>
}

export function RequestEndorsementDialog({ matches, teachSkills, onRequest }: RequestEndorsementDialogProps) {
  const [open, setOpen] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [skillName, setSkillName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const disabled = matches.length === 0 || teachSkills.length === 0

  const handleSubmit = async () => {
    if (!recipientId || !skillName) return
    setSubmitting(true)
    const ok = await onRequest(recipientId, skillName)
    setSubmitting(false)
    if (ok) {
      setOpen(false)
      setRecipientId('')
      setSkillName('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        title={disabled ? 'Add a teaching skill and connect with a match first' : undefined}
        onClick={() => setOpen(true)}
      >
        <ThumbsUp className="h-4 w-4 mr-1" /> Request endorsement
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Request an endorsement</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Select onValueChange={(v) => setRecipientId(v ?? '')} value={recipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a connection" />
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">For skill</Label>
            <Select onValueChange={(v) => setSkillName(v ?? '')} value={skillName}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a teaching skill" />
              </SelectTrigger>
              <SelectContent>
                {teachSkills.map((s) => (
                  <SelectItem key={s.id} value={s.skill_name}>{s.skill_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !recipientId || !skillName}>
            {submitting ? 'Sending...' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
