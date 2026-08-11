'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Video, PenLine, Code2, Layout, Save, Users } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/lib/types'

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'c', 'c++', 'go',
  'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'other',
]

interface SessionInfo {
  id: string
  match_id: string
  skill_focus: string
  scheduled_at: string
  duration_minutes: number
  other_user: Profile
}

export default function SessionRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('notes')

  // Shared notes
  const [notesContent, setNotesContent] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesLastSaved, setNotesLastSaved] = useState<Date | null>(null)

  // Shared code pad
  const [codeContent, setCodeContent] = useState('')
  const [codeLanguage, setCodeLanguage] = useState('javascript')
  const [codeSaving, setCodeSaving] = useState(false)

  // Realtime channel ref
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeSaveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadSession()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current)
      if (codeSaveTimer.current)  clearTimeout(codeSaveTimer.current)
    }
  }, [sessionId])

  const loadSession = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)

    const { data: s } = await supabase
      .from('sessions')
      .select('id, match_id, skill_focus, scheduled_at, duration_minutes')
      .eq('id', sessionId)
      .single()

    if (!s) { router.push('/sessions'); return }

    const { data: match } = await supabase
      .from('match_requests')
      .select('from_user_id, to_user_id, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
      .eq('id', s.match_id)
      .single()

    if (!match || (match.from_user_id !== user.id && match.to_user_id !== user.id)) {
      router.push('/sessions'); return
    }

    const otherUser = (match.from_user_id === user.id ? match.to_profile : match.from_profile) as unknown as Profile
    setSession({ ...s, other_user: otherUser })

    // Load or create session notes
    const { data: notes } = await supabase
      .from('session_notes')
      .select('notes_content, code_content, code_language')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (notes) {
      setNotesContent(notes.notes_content ?? '')
      setCodeContent(notes.code_content ?? '')
      setCodeLanguage(notes.code_language ?? 'javascript')
    } else {
      // Create empty row
      await supabase.from('session_notes').insert({ session_id: sessionId })
    }

    setupRealtime(sessionId)
    setLoading(false)
  }

  const setupRealtime = (sid: string) => {
    const channel = supabase.channel(`room:${sid}:${Math.random().toString(36).slice(2)}`)
      .on('broadcast', { event: 'notes' }, ({ payload }) => {
        setNotesContent(payload.content)
      })
      .on('broadcast', { event: 'code' }, ({ payload }) => {
        setCodeContent(payload.content)
        if (payload.language) setCodeLanguage(payload.language)
      })
      .subscribe()
    channelRef.current = channel
  }

  const persistNotes = useCallback(async (content: string) => {
    setNotesSaving(true)
    await supabase.from('session_notes').upsert({
      session_id: sessionId,
      notes_content: content,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' })
    setNotesSaving(false)
    setNotesLastSaved(new Date())
  }, [sessionId])

  const persistCode = useCallback(async (content: string, language: string) => {
    setCodeSaving(true)
    await supabase.from('session_notes').upsert({
      session_id: sessionId,
      code_content: content,
      code_language: language,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' })
    setCodeSaving(false)
  }, [sessionId])

  const handleNotesChange = (value: string) => {
    setNotesContent(value)
    channelRef.current?.send({ type: 'broadcast', event: 'notes', payload: { content: value } })
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current)
    notesSaveTimer.current = setTimeout(() => persistNotes(value), 1500)
  }

  const handleCodeChange = (value: string) => {
    setCodeContent(value)
    channelRef.current?.send({ type: 'broadcast', event: 'code', payload: { content: value, language: codeLanguage } })
    if (codeSaveTimer.current) clearTimeout(codeSaveTimer.current)
    codeSaveTimer.current = setTimeout(() => persistCode(value, codeLanguage), 1500)
  }

  const handleLanguageChange = (lang: string) => {
    setCodeLanguage(lang)
    persistCode(codeContent, lang)
  }

  const jitsiUrl = `https://meet.jit.si/skillswap-${sessionId}`
  const whiteboardUrl = `https://tldraw.com/r/skillswap-${sessionId}`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" nativeButton={false}
          render={<Link href="/sessions" />}>
          <ArrowLeft className="h-4 w-4" /> Sessions
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={session.other_user.avatar_url ?? ''} />
          <AvatarFallback>{session.other_user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold">{session.skill_focus}</h1>
            <Badge variant="secondary" className="text-xs">
              with {session.other_user.name}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(session.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {session.duration_minutes}min
          </p>
        </div>

        {/* Launch buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            nativeButton={false}
            render={<a href={whiteboardUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <Layout className="h-4 w-4" /> Whiteboard
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700"
            nativeButton={false}
            render={<a href={jitsiUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <Video className="h-4 w-4" /> Start Video
          </Button>
        </div>
      </div>

      {/* Collaboration tools */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="notes" className="gap-1.5">
            <PenLine className="h-3.5 w-3.5" /> Shared Notes
          </TabsTrigger>
          <TabsTrigger value="code" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" /> Code Pad
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Room Info
          </TabsTrigger>
        </TabsList>

        {/* Shared Notes */}
        <TabsContent value="notes" className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Changes sync live with {session.other_user.name}.
            </p>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {notesSaving ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
              ) : notesLastSaved ? (
                <><Save className="h-3 w-3" /> Saved {notesLastSaved.toLocaleTimeString([], { timeStyle: 'short' })}</>
              ) : null}
            </span>
          </div>
          <textarea
            value={notesContent}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder={`Start taking shared notes for your ${session.skill_focus} session…\n\nBoth of you can type here simultaneously.`}
            className="w-full min-h-[420px] resize-none rounded-lg border bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
          />
        </TabsContent>

        {/* Code Pad */}
        <TabsContent value="code" className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Select value={codeLanguage} onValueChange={(v) => { if (v) handleLanguageChange(v) }}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Paste or type code — syncs live.
              </p>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {codeSaving ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
              ) : null}
            </span>
          </div>
          <textarea
            value={codeContent}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder={`// Paste or write ${codeLanguage} code here…\n// Both participants can edit in real time.`}
            spellCheck={false}
            className="w-full min-h-[420px] resize-none rounded-lg border bg-zinc-950 dark:bg-zinc-900 text-zinc-100 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-zinc-600"
          />
        </TabsContent>

        {/* Room Info */}
        <TabsContent value="info" className="mt-4">
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-sm">Session Details</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Skill Focus</p>
                  <p className="font-medium">{session.skill_focus}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Partner</p>
                  <p className="font-medium">{session.other_user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Scheduled</p>
                  <p className="font-medium">{new Date(session.scheduled_at).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Duration</p>
                  <p className="font-medium">{session.duration_minutes} minutes</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">External Tools</h3>
              <p className="text-xs text-muted-foreground">
                These tools open in a new tab and use your session ID as a shared room — both of you will be in the same space automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a href={whiteboardUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors">
                  <Layout className="h-4 w-4 text-violet-500" />
                  <div className="text-left">
                    <p>Whiteboard</p>
                    <p className="text-xs text-muted-foreground font-normal">tldraw · shared canvas</p>
                  </div>
                </a>
                <a href={jitsiUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors">
                  <Video className="h-4 w-4 text-green-500" />
                  <div className="text-left">
                    <p>Video Call</p>
                    <p className="text-xs text-muted-foreground font-normal">Jitsi Meet · no account needed</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
