-- ── Support Ticket Categories + Satisfaction Ratings ────────────────────────
-- Run this in Supabase SQL Editor.
-- Adds a category (for "Top Categories"/"Most Reported Bugs" reporting) and a
-- post-resolution satisfaction rating/comment the user leaves when confirming
-- their ticket is actually resolved.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('bug', 'billing', 'account', 'feature_request', 'other'));

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS satisfaction_rating int
    CHECK (satisfaction_rating BETWEEN 1 AND 5);

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS satisfaction_comment text;
