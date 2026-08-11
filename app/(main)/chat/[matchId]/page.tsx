'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Send, Calendar, ArrowLeft, Video, MoreHorizontal, Trash2, Undo2, CheckCheck, Paperclip, Mic, MicOff, Image as ImageIcon, FileIcon, Play, Pause, X } from 'lucide-react'
import Link from 'next/link'
import type { Message, Profile } from '@/lib/types'

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const currentUserIdRef = useRef('')
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const [messages, setMessages] = useState<(Message & { sender: Profile })[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [otherUserId, setOtherUserId] = useState('')
  const [myName, setMyName] = useState('Someone')

  const [sessionOpen, setSessionOpen] = useState(false)
  const [sessionDate, setSessionDate] = useState('')
  const [sessionSkill, setSessionSkill] = useState('')
  const [sessionDuration, setSessionDuration] = useState('60')
  const [sessionNotes, setSessionNotes] = useState('')
  const [schedulingSession, setSchedulingSession] = useState(false)

  // Attachment state
  const [isRecording, setIsRecording] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    // Unique suffix prevents Supabase returning a cached already-subscribed channel
    // when Strict Mode runs this effect twice in development.
    const channelName = `chat:${matchId}:${Math.random().toString(36).slice(2)}`

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) { router.push('/login'); return }
      currentUserIdRef.current = user.id
      setCurrentUserId(user.id)

      const { data: match } = await supabase
        .from('match_requests')
        .select('*, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
        .eq('id', matchId)
        .single()
      if (cancelled) return

      if (!match || match.status !== 'accepted') {
        toast.error('This match is not active.')
        router.push('/matches')
        return
      }

      const other = match.from_user_id === user.id ? match.to_profile : match.from_profile
      const otherId = match.from_user_id === user.id ? match.to_user_id : match.from_user_id
      const mine = match.from_user_id === user.id ? match.from_profile : match.to_profile
      setOtherUser(other)
      setOtherUserId(otherId)
      setMyName(mine?.name ?? 'Someone')

      const { data: msgs } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
      if (cancelled) return

      setMessages((msgs ?? []) as any)
      setLoading(false)

      // Mark other user's messages as read
      supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .neq('sender_id', user.id)
        .is('read_at', null)
        .then(() => {})

      channel = supabase
        .channel(channelName)
        .on('presence', { event: 'sync' }, () => {
          if (cancelled) return
          const state = channel!.presenceState<{ typing: boolean; user_id: string }>()
          const others = Object.values(state).flat().filter((p) => p.user_id !== currentUserIdRef.current)
          setOtherUserTyping(others.some((p) => p.typing))
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          async (payload) => {
            const newId = payload.new.id
            const { data: sender } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', payload.new.sender_id)
              .single()

            // Mark as read immediately if it's from the other person
            if (payload.new.sender_id !== currentUserIdRef.current) {
              supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', newId).then(() => {})
            }

            setMessages((prev) => {
              if (prev.some((m) => m.id === newId)) return prev
              const isOwn = payload.new.sender_id === currentUserIdRef.current
              const filtered = isOwn ? prev.filter((m) => !String(m.id).startsWith('temp-')) : prev
              return [...filtered, { ...payload.new, sender } as any]
            })
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          (payload) => {
            setMessages((prev) =>
              prev.map((m) => m.id === payload.new.id ? { ...payload.new, sender: m.sender } as any : m)
            )
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          (payload) => {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
          }
        )
        .subscribe(async (status) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            await channel!.track({ user_id: user.id, typing: false })
            presenceChannelRef.current = channel
          }
        })
    }

    init()

    return () => {
      cancelled = true
      presenceChannelRef.current = null
      if (channel) supabase.removeChannel(channel)
    }
  }, [matchId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, otherUserTyping])

  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const handleTyping = async (value: string) => {
    setNewMsg(value)
    const ch = presenceChannelRef.current
    if (!ch) return

    await ch.track({ user_id: currentUserId, typing: true })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(async () => {
      await ch.track({ user_id: currentUserId, typing: false })
    }, 2000)
  }

  const notifyNewMessage = () => {
    if (!otherUserId) return
    void supabase.from('notifications').insert({
      user_id: otherUserId,
      type: 'new_message',
      title: `${myName} sent you a message`,
      href: `/chat/${matchId}`,
    })
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = newMsg.trim()
    if (!content || !currentUserId) return

    // Stop typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    presenceChannelRef.current?.track({ user_id: currentUserId, typing: false })

    const tempId = `temp-${Date.now()}`
    setNewMsg('')
    setSending(true)

    const tempMsg: Message & { sender: Profile } = {
      id: tempId,
      match_id: matchId,
      sender_id: currentUserId,
      content,
      read_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      sender: null as any,
    }

    setMessages((prev) => [...prev, tempMsg])

    const { error } = await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: currentUserId,
      content,
    })

    if (error) {
      toast.error('Failed to send message')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMsg(content)
    } else {
      notifyNewMessage()
    }
    setSending(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return

    setUploadingFile(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${matchId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error: uploadError } = await supabase.storage.from('attachments').upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(fileName)

      const type = file.type.startsWith('image/') ? 'image' : 'file'
      
      const { error: insertError } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_id: currentUserId,
        attachment_url: publicUrl,
        attachment_type: type,
        attachment_name: file.name,
      })

      if (insertError) throw insertError
      notifyNewMessage()
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioBlob.size < 100) return // Too short

        setUploadingFile(true)
        try {
          const fileName = `${matchId}/${Date.now()}-voice.webm`
          const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, audioBlob)
          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(fileName)

          await supabase.from('messages').insert({
            match_id: matchId,
            sender_id: currentUserId,
            attachment_url: publicUrl,
            attachment_type: 'audio',
            attachment_name: 'Voice message',
          })
          notifyNewMessage()
        } catch (error: any) {
          toast.error('Failed to send voice message')
        } finally {
          setUploadingFile(false)
          stream.getTracks().forEach(track => track.stop())
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const deleteForMe = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    toast.success('Message removed from your view')
  }

  const unsendMessage = async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (error) toast.error('Failed to unsend')
  }

  const deleteFromEveryone = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
    if (error) toast.error('Failed to delete message')
  }

  const scheduleSession = async () => {
    if (!sessionDate || !sessionSkill) {
      toast.error('Date and skill focus are required')
      return
    }
    setSchedulingSession(true)

    const { error } = await supabase.from('sessions').insert({
      match_id: matchId,
      scheduled_at: new Date(sessionDate).toISOString(),
      skill_focus: sessionSkill,
      duration_minutes: parseInt(sessionDuration),
      notes: sessionNotes || null,
    })

    if (error) toast.error('Failed to schedule session')
    else {
      toast.success('Session scheduled!')
      setSessionOpen(false)
      setSessionDate('')
      setSessionSkill('')
      setSessionNotes('')
    }
    setSchedulingSession(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b mb-4">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/matches" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {otherUser && (
          <>
            <Avatar className="h-9 w-9">
              <AvatarImage src={otherUser.avatar_url ?? ''} />
              <AvatarFallback>{otherUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold">{otherUser.name}</p>
              {otherUserTyping
                ? <p className="text-xs text-violet-500 animate-pulse">typing…</p>
                : <Badge variant="secondary" className="text-xs">Matched</Badge>}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`https://meet.jit.si/skillswap-${matchId.slice(0, 8)}`, '_blank')}
            >
              <Video className="h-4 w-4 mr-1.5" /> Video call
            </Button>
            <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Calendar className="h-4 w-4 mr-1.5" /> Schedule
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule a session</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Date & time</Label>
                    <Input type="datetime-local" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Skill to focus on</Label>
                    <Input placeholder="e.g. Python basics, Spanish conversation..." value={sessionSkill} onChange={(e) => setSessionSkill(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} min={15} step={15} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Input placeholder="Any prep or context..." value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} />
                  </div>
                  <Button onClick={scheduleSession} disabled={schedulingSession} className="w-full">
                    {schedulingSession && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirm session
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId
          const isDeleted = !!msg.deleted_at
          const isTemp = String(msg.id).startsWith('temp-')
          const isSeen = isMe && !!msg.read_at

          return (
            <div key={msg.id} className={`flex gap-2 group items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMe && (
                <Avatar className="h-7 w-7 shrink-0 self-end">
                  <AvatarImage src={msg.sender?.avatar_url ?? ''} />
                  <AvatarFallback className="text-xs">{msg.sender?.name?.slice(0, 2)}</AvatarFallback>
                </Avatar>
              )}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0`}>
                <div className={`flex items-center gap-1 min-w-0 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm break-words ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-sm max-w-[70vw] sm:max-w-xs'
                      : 'bg-muted rounded-bl-sm max-w-[70vw] sm:max-w-xs'
                  } ${isDeleted ? 'opacity-60' : ''}`}>
                    {isDeleted ? (
                      <p className="italic text-xs">Message deleted</p>
                    ) : (
                      <>
                        {msg.attachment_type === 'image' && msg.attachment_url && (
                          <div className="mb-2 rounded-lg overflow-hidden border bg-background/50">
                            <img src={msg.attachment_url} alt="Attachment" className="max-w-full h-auto cursor-pointer hover:opacity-90" onClick={() => window.open(msg.attachment_url!, '_blank')} />
                          </div>
                        )}
                        {msg.attachment_type === 'file' && msg.attachment_url && (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" 
                            className={`flex items-center gap-2 p-2 rounded-lg mb-2 border ${isMe ? 'bg-primary-foreground/10 border-primary-foreground/20' : 'bg-background border-border'}`}>
                            <FileIcon className="h-5 w-5 shrink-0" />
                            <span className="text-xs font-medium truncate flex-1">{msg.attachment_name || 'File'}</span>
                          </a>
                        )}
                        {msg.attachment_type === 'audio' && msg.attachment_url && (
                          <div className="mb-2 min-w-[200px]">
                            <audio controls className="w-full h-8 filter grayscale" src={msg.attachment_url} />
                          </div>
                        )}
                        {msg.content && <p>{msg.content}</p>}
                        <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isTemp && ' · Sending…'}
                        </p>
                      </>
                    )}
                  </div>

                  {!isTemp && !isDeleted && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isMe ? 'end' : 'start'} className="min-w-[180px]">
                          <DropdownMenuItem onClick={() => deleteForMe(msg.id)} className="gap-2 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" /> Delete for me
                          </DropdownMenuItem>
                          {isMe && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => unsendMessage(msg.id)} className="gap-2 cursor-pointer">
                                <Undo2 className="h-3.5 w-3.5" /> Unsend
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteFromEveryone(msg.id)} className="gap-2 cursor-pointer text-destructive">
                                <Trash2 className="h-3.5 w-3.5" /> Delete for everyone
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {/* Read receipt — only on the last own message that's been seen */}
                {isMe && isSeen && !isTemp && (
                  <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground">
                    <CheckCheck className="h-3 w-3 text-violet-500" /> Seen
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Typing indicator bubble */}
        {otherUserTyping && (
          <div className="flex gap-2 items-end">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={otherUser?.avatar_url ?? ''} />
              <AvatarFallback className="text-xs">{otherUser?.name?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t mt-4 space-y-2">
        {isRecording && (
          <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/20 px-4 py-2 rounded-lg animate-pulse">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-medium text-sm">
              <Mic className="h-4 w-4" /> Recording voice message...
            </div>
            <Button size="sm" variant="destructive" className="h-7" onClick={stopRecording}>
              Stop & Send
            </Button>
          </div>
        )}
        
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploadingFile || isRecording}
          >
            {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          
          <Input
            placeholder={isRecording ? "Recording..." : "Type a message..."}
            value={newMsg}
            onChange={(e) => handleTyping(e.target.value)}
            disabled={sending || isRecording}
          />
          
          <Button 
            type="button" 
            variant={isRecording ? "destructive" : "ghost"} 
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sending || uploadingFile}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>

          <Button type="submit" disabled={sending || !newMsg.trim() || isRecording} size="icon">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
