'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { extractMentionHandles } from '@/lib/mentions'

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g
const MENTION_PATTERN = /@([a-zA-Z0-9_.-]{2,32})/g

interface ResolvedMention {
  href: string
  handle: string
}

/** Renders text with URLs and @mentions as clickable links, preserving line breaks. */
export function Linkify({ text, className }: { text: string; className?: string }) {
  const [mentions, setMentions] = useState<Record<string, ResolvedMention>>({})

  useEffect(() => {
    const handles = extractMentionHandles(text)
    if (handles.length === 0) {
      setMentions({})
      return
    }

    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const [{ data: users }, { data: orgs }] = await Promise.all([
        supabase.from('profiles').select('id, username').in('username', handles),
        supabase.from('organizations').select('id, slug').in('slug', handles),
      ])
      if (cancelled) return
      const map: Record<string, ResolvedMention> = {}
      for (const u of users ?? []) {
        map[u.username.toLowerCase()] = { href: `/profile/${u.id}`, handle: u.username }
      }
      for (const o of orgs ?? []) {
        // A username collision with a slug is rare; first match (users) wins.
        if (!map[o.slug.toLowerCase()]) {
          map[o.slug.toLowerCase()] = { href: `/orgs/${o.slug}`, handle: o.slug }
        }
      }
      setMentions(map)
    })()

    return () => { cancelled = true }
  }, [text])

  // split() with a capture group puts matches at odd indices;
  // testing with the global regex would be stateful and unreliable.
  const urlParts = text.split(URL_PATTERN)

  return (
    <span className={className}>
      {urlParts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline break-all dark:text-violet-400"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          )
        }

        const mentionParts = part.split(MENTION_PATTERN)
        return (
          <span key={i}>
            {mentionParts.map((piece, j) => {
              if (j % 2 === 1) {
                const match = mentions[piece.toLowerCase()]
                if (match) {
                  return (
                    <Link
                      key={j}
                      href={match.href}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-violet-600 hover:underline dark:text-violet-400"
                    >
                      @{match.handle}
                    </Link>
                  )
                }
                return <span key={j}>@{piece}</span>
              }
              return <span key={j}>{piece}</span>
            })}
          </span>
        )
      })}
    </span>
  )
}
