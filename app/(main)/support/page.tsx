'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
  Loader2, Plus, Headphones, Clock, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Send, Star,
  Paperclip, FileIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ATTACHMENT_ACCEPT, validateAttachment } from '@/lib/support-attachments'

interface Ticket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  category: 'account' | 'password' | 'organization' | 'payments' | 'security' | 'technical_issue' | 'feature_request' | 'bug_report' | 'general_question' | 'abuse_report'
  satisfaction_rating: number | null
  satisfaction_comment: string | null
  created_at: string
  updated_at: string
}

interface TicketMessage {
  id: string
  ticket_id: string
  sender_id: string
  content: string | null
  is_admin: boolean
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: 'image' | 'pdf' | 'word' | 'log' | 'video' | null
  created_at: string
}

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',       icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300', icon: TrendingUp },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300', icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',           icon: XCircle },
  escalated:   { label: 'Escalated',   color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',           icon: AlertTriangle },
} as const

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const

const CATEGORY_OPTIONS = [
  { value: 'account', label: 'Account' },
  { value: 'password', label: 'Password' },
  { value: 'organization', label: 'Organization' },
  { value: 'payments', label: 'Payments' },
  { value: 'security', label: 'Security' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'general_question', label: 'General Question' },
  { value: 'abuse_report', label: 'Abuse Report' },
] as const

export default function SupportPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  const [newDialog, setNewDialog] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]['value']>('normal')
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]['value']>('general_question')
  const [submitting, setSubmitting] = useState(false)

  const [openTicket, setOpenTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Resolution confirmation + satisfaction rating
  const [rating, setRating] = useState(0)
  const [satisfactionComment, setSatisfactionComment] = useState('')
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setTickets((data as Ticket[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createTicket = async () => {
    if (!subject.trim() || !description.trim() || !userId) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({ user_id: userId, subject: subject.trim(), description: description.trim(), priority, category })
      .select('*')
      .single()
    if (error) {
      toast.error(error.message || 'Failed to submit ticket')
    } else {
      setTickets((prev) => [data as Ticket, ...prev])
      toast.success('Ticket submitted — we\'ll get back to you soon')
      setNewDialog(false)
      setSubject('')
      setDescription('')
      setPriority('normal')
      setCategory('general_question')
    }
    setSubmitting(false)
  }

  const openThread = async (ticket: Ticket) => {
    setOpenTicket(ticket)
    setRating(0)
    setSatisfactionComment('')
    setLoadingMessages(true)
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
    setMessages((data as TicketMessage[]) ?? [])
    setLoadingMessages(false)
  }

  const sendReply = async () => {
    if (!reply.trim() || !openTicket || !userId) return
    setSending(true)
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: openTicket.id,
      sender_id: userId,
      content: reply.trim(),
      is_admin: false,
    })
    if (error) {
      toast.error('Failed to send message')
    } else {
      setReply('')
      await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', openTicket.id)
      openThread(openTicket)
    }
    setSending(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !openTicket || !userId) return

    const check = validateAttachment(file)
    if (!check.ok) {
      toast.error(check.error)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadingFile(true)
    try {
      const ext = file.name.slice(file.name.lastIndexOf('.'))
      const path = `support-tickets/${openTicket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path)

      const { error: insertError } = await supabase.from('support_messages').insert({
        ticket_id: openTicket.id,
        sender_id: userId,
        is_admin: false,
        attachment_url: publicUrl,
        attachment_name: file.name,
        attachment_type: check.kind,
      })
      if (insertError) throw insertError

      await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', openTicket.id)
      openThread(openTicket)
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload attachment')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmResolved = async () => {
    if (!openTicket || !rating) return
    setConfirming(true)
    const patch = {
      status: 'closed' as const,
      satisfaction_rating: rating,
      satisfaction_comment: satisfactionComment.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('support_tickets').update(patch).eq('id', openTicket.id)
    if (error) {
      toast.error(error.message || `Failed to submit feedback${error.code ? ` (${error.code})` : ''}`)
      console.error('confirmResolved failed:', { message: error.message, code: error.code, details: error.details, hint: error.hint })
    } else {
      toast.success('Thanks for your feedback!')
      setTickets((prev) => prev.map((t) => t.id === openTicket.id ? { ...t, ...patch } : t))
      setOpenTicket((t) => t ? { ...t, ...patch } : t)
    }
    setConfirming(false)
  }

  const reopenTicket = async () => {
    if (!openTicket) return
    setConfirming(true)
    const patch = { status: 'open' as const, resolved_at: null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('support_tickets').update(patch).eq('id', openTicket.id)
    if (error) {
      toast.error(error.message || `Failed to reopen ticket${error.code ? ` (${error.code})` : ''}`)
      console.error('reopenTicket failed:', { message: error.message, code: error.code, details: error.details, hint: error.hint })
    } else {
      toast.success('Ticket reopened — let us know what\'s still wrong')
      setTickets((prev) => prev.map((t) => t.id === openTicket.id ? { ...t, status: 'open' } : t))
      setOpenTicket((t) => t ? { ...t, status: 'open' } : t)
    }
    setConfirming(false)
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="text-muted-foreground mt-1">Need help? Submit a ticket and we'll respond here.</p>
        </div>
        <Button onClick={() => setNewDialog(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <Headphones className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-medium">No support tickets yet</p>
          <p className="text-sm text-muted-foreground mt-1">Have a question or issue? We're here to help.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setNewDialog(true)}>
            <Plus className="h-4 w-4" /> Submit your first ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const cfg = STATUS_CONFIG[ticket.status]
            const Icon = cfg.icon
            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                onClick={() => openThread(ticket)}
              >
                <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Updated {new Date(ticket.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ticket.status === 'resolved' && (
                      <Badge className="text-[10px] gap-1 border-0 bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                        Awaiting your confirmation
                      </Badge>
                    )}
                    <Badge className={cn('text-[10px] gap-1 border-0', cfg.color)}>
                      <Icon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* New ticket dialog */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New support ticket</DialogTitle>
            <DialogDescription>Tell us what's going on and we'll get back to you as soon as we can.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => { if (v) setCategory(v as typeof category) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => { if (v) setPriority(v as typeof priority) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={createTicket} disabled={submitting || !subject.trim() || !description.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket thread dialog */}
      <Dialog open={!!openTicket} onOpenChange={(open) => !open && setOpenTicket(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto flex flex-col">
          {openTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{openTicket.subject}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Badge className={cn('text-[10px] gap-1 border-0', STATUS_CONFIG[openTicket.status].color)}>
                    {STATUS_CONFIG[openTicket.status].label}
                  </Badge>
                  <span>Opened {new Date(openTicket.created_at).toLocaleDateString()}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                {openTicket.description}
              </div>

              <div className="space-y-3 flex-1">
                {loadingMessages ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">No replies yet — our team will respond soon.</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={cn('flex', msg.is_admin ? 'justify-start' : 'justify-end')}>
                      <div className={cn(
                        'max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm',
                        msg.is_admin ? 'bg-muted' : 'bg-violet-600 text-white'
                      )}>
                        <p className="text-[10px] font-semibold mb-0.5 opacity-70">{msg.is_admin ? 'Support' : 'You'}</p>
                        {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                        {msg.attachment_url && msg.attachment_type === 'image' && (
                          <img
                            src={msg.attachment_url}
                            alt={msg.attachment_name || 'Attachment'}
                            className="max-w-full max-h-64 rounded-md mt-1.5 cursor-pointer hover:opacity-90"
                            onClick={() => window.open(msg.attachment_url!, '_blank')}
                          />
                        )}
                        {msg.attachment_url && msg.attachment_type === 'video' && (
                          <video controls className="max-w-full max-h-64 rounded-md mt-1.5" src={msg.attachment_url} />
                        )}
                        {msg.attachment_url && !['image', 'video'].includes(msg.attachment_type ?? '') && (
                          <a
                            href={msg.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2.5 py-2 mt-1.5 text-xs font-medium hover:opacity-80',
                              msg.is_admin ? 'bg-background/60' : 'bg-white/15'
                            )}
                          >
                            <FileIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{msg.attachment_name || 'Attachment'}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Resolved — waiting on the user to confirm and rate */}
              {openTicket.status === 'resolved' && (
                <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Marked resolved — did this solve your issue?
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setRating(n)} className="focus:outline-none">
                        <Star className={cn('h-7 w-7 transition-colors', n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30')} />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={satisfactionComment}
                    onChange={(e) => setSatisfactionComment(e.target.value)}
                    placeholder="Anything else you'd like to share? (optional)"
                    rows={2}
                    className="bg-background"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={reopenTicket} disabled={confirming}>
                      Not resolved, reopen
                    </Button>
                    <Button size="sm" className="flex-1 gap-1.5" onClick={confirmResolved} disabled={confirming || !rating}>
                      {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm resolved
                    </Button>
                  </div>
                </div>
              )}

              {/* Closed — show the rating that was left, if any */}
              {openTicket.status === 'closed' && openTicket.satisfaction_rating && (
                <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1">
                  <p className="text-xs text-muted-foreground">Your rating</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={cn('h-4 w-4', n <= openTicket.satisfaction_rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30')} />
                    ))}
                  </div>
                  {openTicket.satisfaction_comment && (
                    <p className="text-xs text-muted-foreground italic mt-1">"{openTicket.satisfaction_comment}"</p>
                  )}
                </div>
              )}

              {!['closed', 'resolved'].includes(openTicket.status) && (
                <div className="flex gap-2 border-t pt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 self-end"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Attach a file"
                  >
                    {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type a message..."
                    rows={2}
                    className="resize-none"
                  />
                  <Button size="icon" className="shrink-0 self-end" onClick={sendReply} disabled={sending || !reply.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
