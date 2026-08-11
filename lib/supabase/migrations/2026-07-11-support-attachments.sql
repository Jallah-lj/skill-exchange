-- ── Ticket Conversation Attachments ──────────────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Lets users/admins attach a file to a support ticket reply (images, PDF,
-- Word docs, logs, and optionally video) — reuses the existing "attachments"
-- storage bucket already used by 1:1 chat, just under a support-tickets/ prefix.
-- Executables are never accepted: there is no malware-scanning service wired
-- into this app, so the allowlist below (enforced client-side in both ticket
-- pages) is the only gate — treat it as "no scanning available" rather than
-- "scanning happened and passed."

ALTER TABLE support_messages ALTER COLUMN content DROP NOT NULL;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS attachment_url text;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS attachment_name text;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS attachment_type text
    CHECK (attachment_type IN ('image', 'pdf', 'word', 'log', 'video'));

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

-- A message must have either text content or an attachment.
ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_content_or_attachment;
ALTER TABLE support_messages ADD CONSTRAINT support_messages_content_or_attachment
  CHECK (content IS NOT NULL OR attachment_url IS NOT NULL);
