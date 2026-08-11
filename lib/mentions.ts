// Negative lookbehind: the @ must not be preceded by a word character, so
// email addresses ("user@example.com") don't produce phantom mentions.
const MENTION_PATTERN = /(?<![a-zA-Z0-9_.-])@([a-zA-Z0-9_.-]{2,32})/g

/** Lowercased, de-duplicated @handles found in a piece of text. */
export function extractMentionHandles(text: string): string[] {
  const matches = [...text.matchAll(MENTION_PATTERN)]
  return [...new Set(matches.map((m) => m[1].toLowerCase()))]
}

/** @handles present in `newText` but not in `oldText` — so edits only notify newly-added mentions. */
export function newMentionHandles(oldText: string, newText: string): string[] {
  const before = new Set(extractMentionHandles(oldText))
  return extractMentionHandles(newText).filter((h) => !before.has(h))
}

/**
 * Resolves @handles to users (by username) and organizations (by slug — all
 * of that org's owner/admin/moderator get notified), then inserts a 'mention'
 * notification for each. Failures are non-fatal — the mentioning action
 * itself already succeeded.
 */
export async function notifyMentions(
  supabase: any,
  opts: { text: string; actorName: string; title: string; href: string; excludeUserId?: string }
) {
  const handles = extractMentionHandles(opts.text)
  if (handles.length === 0) return

  try {
    const [{ data: users }, { data: orgs }] = await Promise.all([
      supabase.from('profiles').select('id, username').in('username', handles),
      supabase.from('organizations').select('id, slug').in('slug', handles),
    ])

    const notifyUserIds = new Set<string>()
    for (const u of users ?? []) {
      if (u.id !== opts.excludeUserId) notifyUserIds.add(u.id)
    }

    if (orgs?.length) {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .in('organization_id', orgs.map((o: { id: string }) => o.id))
        .in('role', ['owner', 'admin', 'moderator'])
      for (const m of members ?? []) {
        if (m.user_id !== opts.excludeUserId) notifyUserIds.add(m.user_id)
      }
    }

    if (notifyUserIds.size === 0) return

    await supabase.from('notifications').insert(
      [...notifyUserIds].map((userId) => ({
        user_id: userId,
        type: 'mention',
        title: opts.title,
        href: opts.href,
      }))
    )
  } catch (error) {
    console.error('Mention notification failed:', error)
  }
}
