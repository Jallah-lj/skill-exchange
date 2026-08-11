-- ── Predefined Support Ticket Categories ────────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Replaces the original 5-value category set with the full predefined list
-- so users can never type a free-form category — only pick from this list.

-- Drop the old constraint FIRST — the remap below writes new category values
-- that the old 5-value constraint doesn't allow, so it must be gone before
-- the UPDATEs run (doing this in the other order fails with "new row ...
-- violates check constraint" on the very first remapped row).
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;

-- Remap old values to their closest new equivalent.
UPDATE support_tickets SET category = 'bug_report'       WHERE category = 'bug';
UPDATE support_tickets SET category = 'payments'         WHERE category = 'billing';
UPDATE support_tickets SET category = 'general_question' WHERE category = 'other';

ALTER TABLE support_tickets ALTER COLUMN category SET DEFAULT 'general_question';

ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN (
    'account', 'password', 'organization', 'payments', 'security',
    'technical_issue', 'feature_request', 'bug_report', 'general_question', 'abuse_report'
  ));
