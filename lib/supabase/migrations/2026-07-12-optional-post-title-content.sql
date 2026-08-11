-- ── Optional title/content on personal & org posts ───────────────────────────
-- Run this in Supabase SQL Editor.
-- The composer no longer forces users to fill in both a title and content —
-- a post just needs *something* (title, content, or a photo). The DB was
-- still enforcing NOT NULL on both, which would reject those posts outright.

ALTER TABLE organization_posts ALTER COLUMN title DROP NOT NULL;
ALTER TABLE organization_posts ALTER COLUMN content DROP NOT NULL;
