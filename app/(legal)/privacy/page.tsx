import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — SkillSwap',
  description: 'How SkillSwap collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p><em>Last updated: July 12, 2026</em></p>

      <p>
        This policy explains what data SkillSwap collects, why, and what control you have over it.
        We collect the minimum needed to run a skill-exchange platform — we do not sell your data.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account data</strong> — name, email, username, password (stored as a secure hash by our authentication provider).</li>
        <li><strong>Profile data</strong> — bio, location, avatar, skills you teach and learn, and anything else you choose to add.</li>
        <li><strong>Verification documents</strong> — if you apply for identity verification, the ID documents you upload. These are stored in restricted storage accessible only to platform administrators.</li>
        <li><strong>Content</strong> — posts, comments, messages, session notes, reviews, support tickets, and attachments you upload.</li>
        <li><strong>Activity data</strong> — matches, sessions, workshop registrations, and in-app notifications.</li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>To operate the platform: matching, sessions, chat, organizations, and support.</li>
        <li>To keep the community safe: enforcing guidelines, reviewing reports, and preventing abuse.</li>
        <li>To notify you about activity relevant to you (matches, replies, account updates).</li>
        <li>We do <strong>not</strong> sell personal data or share it with advertisers.</li>
      </ul>

      <h2>3. Where your data lives</h2>
      <p>
        SkillSwap is built on Supabase (database, authentication, and file storage). Data is
        protected with row-level security so members can only access what they&apos;re entitled to
        see. Direct messages are visible only to the two matched members; support conversations are
        visible only to you and platform support staff.
      </p>

      <h2>4. Who can see what</h2>
      <ul>
        <li>Your profile, skills, posts, and reviews are visible to other signed-in members.</li>
        <li>Private messages are visible only to you and your match.</li>
        <li>Verification documents are never public and never shown to other members.</li>
        <li>Platform administrators can access account records when needed for safety, support, or legal compliance.</li>
      </ul>

      <h2>5. Your rights</h2>
      <ul>
        <li><strong>Access & correction</strong> — view and edit your profile data at any time in Settings.</li>
        <li><strong>Deletion</strong> — delete your account from Settings. This permanently removes your profile and associated personal data from active systems.</li>
        <li><strong>Notification control</strong> — manage what notifications you receive in Settings.</li>
      </ul>

      <h2>6. Retention</h2>
      <p>
        We keep your data while your account is active. When you delete your account, personal data
        is removed; some records may persist briefly in backups before rotating out, and we may
        retain minimal records where required for safety or legal reasons.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use essential cookies only — session cookies that keep you signed in. No third-party
        advertising or tracking cookies.
      </p>

      <h2>8. Changes</h2>
      <p>
        If this policy changes materially, we&apos;ll announce it on the platform before it takes
        effect.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions or requests? Contact us through the in-app Support Center.
      </p>
    </>
  )
}
