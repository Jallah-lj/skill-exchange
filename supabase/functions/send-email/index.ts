import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'SkillSwap <noreply@skillswap.app>'
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:3000'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
  }
}

async function getUserEmail(userId: string): Promise<{ email: string; name: string } | null> {
  // auth.users is only accessible with service role
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).single()
  return { email: data.user.email, name: profile?.name ?? 'there' }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const payload = await req.json()
  const { table, record } = payload

  try {
    if (table === 'match_requests' && record) {
      // New match request OR acceptance
      if (payload.type === 'INSERT') {
        // Notify recipient about new request
        const [sender, recipient] = await Promise.all([
          getUserEmail(record.from_user_id),
          getUserEmail(record.to_user_id),
        ])
        if (recipient && sender) {
          await sendEmail(
            recipient.email,
            `${sender.name} wants to swap skills with you on SkillSwap`,
            `
              <p>Hi ${recipient.name},</p>
              <p><strong>${sender.name}</strong> sent you a match request on SkillSwap.</p>
              <p>
                <a href="${APP_URL}/matches" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">
                  Review the request
                </a>
              </p>
            `
          )
        }
      } else if (payload.type === 'UPDATE' && record.status === 'accepted' && payload.old_record.status === 'pending') {
        // Notify the original sender that their request was accepted
        const [sender, recipient] = await Promise.all([
          getUserEmail(record.to_user_id), // The person who accepted
          getUserEmail(record.from_user_id), // The person who sent the request
        ])
        if (recipient && sender) {
          await sendEmail(
            recipient.email,
            `Match accepted! You are now connected with ${sender.name}`,
            `
              <p>Hi ${recipient.name},</p>
              <p>Great news! <strong>${sender.name}</strong> accepted your match request on SkillSwap.</p>
              <p>You can now start chatting and schedule your first session.</p>
              <p>
                <a href="${APP_URL}/chat/${record.id}" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">
                  Send a message
                </a>
              </p>
            `
          )
        }
      }
    }

    if (table === 'sessions' && record && payload.type === 'INSERT') {
      // New session scheduled — notify the other participant
      const { data: match } = await supabase
        .from('match_requests')
        .select('from_user_id, to_user_id')
        .eq('id', record.match_id)
        .single()

      if (match) {
        // We need to know who created the session (usually the current user, but record doesn't have created_by)
        // For simplicity, we'll notify both or try to guess. 
        // Better: Fetch both users and send a "Session Scheduled" email.
        const [user1, user2] = await Promise.all([
          getUserEmail(match.from_user_id),
          getUserEmail(match.to_user_id),
        ])

        const dateStr = new Date(record.scheduled_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })
        
        const emailHtml = (name: string, otherName: string) => `
          <p>Hi ${name},</p>
          <p>A new skill-swapping session has been scheduled with <strong>${otherName}</strong>.</p>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0;"><strong>Focus:</strong> ${record.skill_focus}</p>
            <p style="margin:4px 0 0 0;"><strong>Time:</strong> ${dateStr}</p>
            <p style="margin:4px 0 0 0;"><strong>Duration:</strong> ${record.duration_minutes} minutes</p>
          </div>
          <p>
            <a href="${APP_URL}/sessions" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              View session details
            </a>
          </p>
        `

        if (user1 && user2) {
          // Send to both to be sure, or you'd need to track who initiated the insert
          await Promise.all([
            sendEmail(user1.email, `Session Scheduled: ${record.skill_focus}`, emailHtml(user1.name, user2.name)),
            sendEmail(user2.email, `Session Scheduled: ${record.skill_focus}`, emailHtml(user2.name, user1.name)),
          ])
        }
      }
    }

    if (table === 'messages' && record) {
      // New message — find the other person in the match and notify them
      const { data: match } = await supabase
        .from('match_requests')
        .select('from_user_id, to_user_id')
        .eq('id', record.match_id)
        .single()

      if (!match) return new Response('Match not found', { status: 404 })

      const recipientId = record.sender_id === match.from_user_id ? match.to_user_id : match.from_user_id

      const [sender, recipient] = await Promise.all([
        getUserEmail(record.sender_id),
        getUserEmail(recipientId),
      ])

      if (recipient && sender) {
        let preview = record.content ?? ''
        if (!preview && record.attachment_type) {
          preview = record.attachment_type === 'image' ? '[Image]' : 
                    record.attachment_type === 'audio' ? '[Voice Message]' : '[File]'
        }
        if (preview.length > 100) preview = preview.slice(0, 100) + '…'
        
        await sendEmail(
          recipient.email,
          `New message from ${sender.name} on SkillSwap`,
          `
            <p>Hi ${recipient.name},</p>
            <p><strong>${sender.name}</strong> sent you a message:</p>
            <blockquote style="border-left:3px solid #7c3aed;padding-left:12px;margin:12px 0;color:#444;">
              ${preview}
            </blockquote>
            <p>
              <a href="${APP_URL}/matches" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">
                Reply
              </a>
            </p>
            <p style="color:#888;font-size:12px;margin-top:24px;">You're receiving this because you have an account on SkillSwap.</p>
          `
        )
      }
    }
  } catch (err) {
    console.error('Error:', err)
    return new Response('Internal error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
})
