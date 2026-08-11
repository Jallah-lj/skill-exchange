'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Megaphone, Bell, Send } from 'lucide-react'

export default function AnnouncementsPage() {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState(false)

  const sendAnnouncement = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required')
      return
    }
    setSending(true)

    // Fetch all user IDs
    const { data: users } = await supabase.from('profiles').select('id')
    if (!users || users.length === 0) {
      toast.error('No users found')
      setSending(false)
      return
    }

    // Insert notification for every user in batches
    const BATCH = 100
    let failed = 0
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH).map((u) => ({
        user_id: u.id,
        type: 'announcement',
        title: title.trim(),
        body: body.trim(),
        href: null,
        entity_id: null,
      }))
      const { error } = await supabase.from('notifications').insert(batch)
      if (error) failed += batch.length
    }

    if (failed > 0) {
      toast.error(`Sent with errors — ${failed} users may have missed it`)
    } else {
      toast.success(`Announcement sent to ${users.length} users!`)
      setTitle('')
      setBody('')
      setPreview(false)
    }
    setSending(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1">Send a platform-wide notification to all users.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-violet-500" /> Compose Announcement
          </CardTitle>
          <CardDescription>
            This will send a notification to <strong>every user</strong> on the platform. Use sparingly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g. New feature: Live session rooms are here!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground text-right">{title.length}/80</p>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Describe the announcement in detail…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground text-right">{body.length}/300</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setPreview((v) => !v)}
              disabled={!title.trim() || !body.trim()}
            >
              {preview ? 'Edit' : 'Preview'}
            </Button>
            <Button
              onClick={sendAnnouncement}
              disabled={sending || !title.trim() || !body.trim()}
              className="gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to all users
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && title && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Preview — how users will see it</p>
          <div className="rounded-xl border bg-white dark:bg-gray-900 p-4 flex items-start gap-3 shadow-sm">
            <div className="h-10 w-10 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
              <p className="text-xs text-muted-foreground mt-2">Just now · SkillSwap</p>
            </div>
          </div>
        </div>
      )}

      {/* Guidelines */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-4 px-5 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold">Best practices</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-400 text-xs">
            <li>Only send for major releases, outages, or policy changes</li>
            <li>Keep titles under 60 characters for mobile readability</li>
            <li>Avoid sending more than once per week to prevent notification fatigue</li>
            <li>Test with a small internal group before sending platform-wide</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
