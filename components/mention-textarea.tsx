'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AtSign, Building2 } from 'lucide-react'

interface Suggestion {
  id: string
  handle: string
  label: string
  type: 'user' | 'org'
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  id?: string
}

const DEFAULT_CLASSNAME =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

/** A plain textarea with @mention autocomplete for users (by username) and organizations (by slug). */
export function MentionTextarea({ value, onChange, placeholder, rows = 4, className, id }: MentionTextareaProps) {
  const supabase = createClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [queryStart, setQueryStart] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const search = async (query: string) => {
    if (!query) { setSuggestions([]); return }
    // Match either the handle (prefix) or the display name (anywhere) — most people
    // won't know someone's auto-generated username, only their display name.
    const [{ data: users }, { data: orgs }] = await Promise.all([
      supabase.from('profiles').select('id, username, name')
        .or(`username.ilike.${query}%,name.ilike.%${query}%`)
        .limit(5),
      supabase.from('organizations').select('id, slug, name')
        .or(`slug.ilike.${query}%,name.ilike.%${query}%`)
        .limit(5),
    ])
    const list: Suggestion[] = [
      ...(users ?? []).map((u: { id: string; username: string; name: string }) => (
        { id: u.id, handle: u.username, label: u.name, type: 'user' as const }
      )),
      ...(orgs ?? []).map((o: { id: string; slug: string; name: string }) => (
        { id: o.id, handle: o.slug, label: o.name, type: 'org' as const }
      )),
    ]
    setSuggestions(list)
    setActiveIndex(0)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    onChange(next)
    const cursor = e.target.selectionStart
    const upToCursor = next.slice(0, cursor)
    const match = upToCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,32})$/)
    if (match) {
      setQueryStart(cursor - match[1].length - 1)
      void search(match[1])
    } else {
      setQueryStart(null)
      setSuggestions([])
    }
  }

  const applySuggestion = (s: Suggestion) => {
    if (queryStart === null || !textareaRef.current) return
    const cursor = textareaRef.current.selectionStart
    const before = value.slice(0, queryStart)
    const after = value.slice(cursor)
    const next = `${before}@${s.handle} ${after}`
    onChange(next)
    setSuggestions([])
    setQueryStart(null)
    requestAnimationFrame(() => {
      const pos = before.length + s.handle.length + 2
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(pos, pos)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[activeIndex]) }
    else if (e.key === 'Escape') { setSuggestions([]); setQueryStart(null) }
  }

  return (
    <div className="relative">
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
        placeholder={placeholder}
        rows={rows}
        className={className ?? DEFAULT_CLASSNAME}
      />
      {suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-w-xs rounded-lg border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.type}-${s.id}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(s)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${i === activeIndex ? 'bg-accent' : ''}`}
            >
              {s.type === 'org'
                ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <AtSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate font-medium">{s.label}</span>
              <span className="truncate text-xs text-muted-foreground">@{s.handle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
