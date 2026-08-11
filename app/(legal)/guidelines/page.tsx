import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Community Guidelines — SkillSwap',
  description: 'The standards that keep the SkillSwap community safe and worth joining.',
}

export default function GuidelinesPage() {
  return (
    <>
      <h1>Community Guidelines</h1>
      <p><em>Last updated: July 12, 2026</em></p>

      <p>
        SkillSwap works because people show up generously — teaching what they know and respecting
        the people they learn from. These guidelines describe the behavior we expect and what
        happens when they&apos;re broken.
      </p>

      <h2>Be respectful</h2>
      <ul>
        <li>Treat every member with courtesy — in sessions, chat, posts, and comments.</li>
        <li>No harassment, hate speech, discrimination, or personal attacks.</li>
        <li>Disagreement is fine; hostility is not.</li>
      </ul>

      <h2>Keep exchanges genuine</h2>
      <ul>
        <li>Show up to sessions you commit to, on time and prepared.</li>
        <li>Represent your skills honestly — it&apos;s okay to be a beginner teacher, not okay to fake expertise.</li>
        <li>Leave honest, constructive reviews after sessions.</li>
        <li>Don&apos;t use the platform to sell services or move exchanges to paid arrangements.</li>
      </ul>

      <h2>Protect the community</h2>
      <ul>
        <li>No spam, scams, phishing links, or deceptive content.</li>
        <li>No sharing of other members&apos; personal information without consent.</li>
        <li>No content that is illegal, sexually explicit, or promotes harm.</li>
        <li>Report bad behavior with the in-app report tools — reports are reviewed by our Trust &amp; Safety team.</li>
      </ul>

      <h2>Organizations & workshops</h2>
      <ul>
        <li>Organization admins are responsible for their spaces: moderate member content and keep workshops legitimate.</li>
        <li>Workshop attendance codes are personal — don&apos;t share or trade them.</li>
      </ul>

      <h2>Enforcement</h2>
      <p>
        Violations are handled proportionally: warnings for minor issues, temporary suspension for
        repeated or serious ones, and permanent bans for severe abuse (threats, scams, exploitation).
        Enforcement actions are communicated through platform notifications, and you can appeal any
        action through the Support Center.
      </p>
    </>
  )
}
