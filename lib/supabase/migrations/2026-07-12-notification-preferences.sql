-- ── Notification Preferences + Management ───────────────────────────────────
-- Run this in Supabase SQL Editor.
-- 1) Per-user in-app notification preferences (jsonb on profiles)
-- 2) A BEFORE INSERT trigger that drops notifications the recipient opted out
--    of — enforced at the database so EVERY writer (client actions, admin
--    pages, edge functions) respects preferences without code changes.
-- 3) A DELETE policy so users can dismiss/clear their own notifications
--    (schema.sql only ever created SELECT/UPDATE/INSERT policies).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Groups a user can turn off. Account/safety types (account_status, warning,
-- kyc_update, role_change, report_resolved, badge_*) are ALWAYS delivered —
-- deliberately not mapped to any opt-out group.
CREATE OR REPLACE FUNCTION filter_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prefs jsonb;
  grp text;
BEGIN
  grp := CASE NEW.type
    WHEN 'match_request'   THEN 'matches'
    WHEN 'match_accepted'  THEN 'matches'
    WHEN 'new_message'     THEN 'messages'
    WHEN 'new_endorsement' THEN 'social'
    WHEN 'new_review'      THEN 'social'
    WHEN 'mention'         THEN 'social'
    WHEN 'announcement'    THEN 'community'
    WHEN 'info'            THEN 'community'
    WHEN 'support_ticket'  THEN 'support'
    ELSE NULL
  END;

  IF grp IS NULL THEN
    RETURN NEW;  -- unmapped/account types always deliver
  END IF;

  SELECT notification_prefs INTO prefs FROM profiles WHERE id = NEW.user_id;

  IF prefs IS NOT NULL AND prefs ->> grp = 'false' THEN
    RETURN NULL;  -- recipient opted out: drop silently
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_filter_notification ON notifications;
CREATE TRIGGER trg_filter_notification
  BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION filter_notification();

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);
