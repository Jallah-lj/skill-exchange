import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — SkillSwap',
  description: 'The terms that govern your use of SkillSwap.',
}

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p><em>Last updated: July 12, 2026</em></p>

      <p>
        Welcome to SkillSwap. These Terms of Service (&quot;Terms&quot;) govern your access to and use
        of the SkillSwap platform — including skill matching, sessions, chat, organizations,
        workshops, and community features. By creating an account or using SkillSwap, you agree to
        these Terms.
      </p>

      <h2>1. What SkillSwap is</h2>
      <p>
        SkillSwap is a skill-exchange platform: members teach what they know and learn what they
        want, matched with each other for barter-style exchanges. No money changes hands between
        members for skill exchanges, and SkillSwap does not process payments between members.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must provide accurate information when signing up and keep it up to date.</li>
        <li>You are responsible for all activity on your account and for keeping your password secure.</li>
        <li>You must be at least 16 years old (or the minimum age of digital consent in your country) to use SkillSwap.</li>
        <li>One person, one account. Impersonation and fake accounts are prohibited.</li>
      </ul>

      <h2>3. Identity verification</h2>
      <p>
        Some features may require identity verification (KYC). Documents you submit are used solely
        to verify your identity and are handled per our Privacy Policy. Verified badges reflect a
        completed verification, not an endorsement of skill or conduct.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>No harassment, hate speech, threats, or abusive behavior toward other members.</li>
        <li>No spam, scams, phishing, or attempts to move exchanges into paid arrangements that circumvent the barter model.</li>
        <li>No illegal content or use of the platform for unlawful purposes.</li>
        <li>No attempts to probe, breach, or disrupt the platform&apos;s security or other members&apos; accounts.</li>
        <li>Sessions must be used for genuine skill exchange — not solicitation, recruitment, or advertising.</li>
      </ul>

      <h2>5. Content</h2>
      <p>
        You keep ownership of the content you post (profiles, posts, comments, resources). By
        posting, you grant SkillSwap a non-exclusive license to host and display that content on the
        platform. You are responsible for what you post; we may remove content that violates these
        Terms or our Community Guidelines.
      </p>

      <h2>6. Organizations and workshops</h2>
      <p>
        Organization owners and admins are responsible for their organization&apos;s content,
        membership decisions, and workshop conduct. Workshop confirmation codes identify
        registrations and must not be shared or resold.
      </p>

      <h2>7. Enforcement</h2>
      <p>
        We may warn, suspend, restrict, or ban accounts that violate these Terms, and remove
        content at our discretion. Where possible we&apos;ll notify you of enforcement actions
        through the platform&apos;s notification system. You can appeal by contacting support.
      </p>

      <h2>8. Termination</h2>
      <p>
        You can delete your account at any time from Settings. We may suspend or terminate accounts
        that violate these Terms. On deletion, your profile and personal data are removed per our
        Privacy Policy.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        SkillSwap connects members but does not vet the quality, safety, or accuracy of skills
        taught. Sessions and exchanges are at your own judgment and risk. The platform is provided
        &quot;as is&quot; without warranties of any kind.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these Terms as the platform evolves. Material changes will be announced on the
        platform. Continued use after changes take effect constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Reach us through the in-app Support Center.
      </p>
    </>
  )
}
