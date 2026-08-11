-- ── Workshop Check-in ────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Lets org admins/moderators/instructors mark a registrant as "attended".
-- (The existing "Users can manage own workshop registration" policy only
-- lets the registrant update their own row, not an organizer checking them in.)

CREATE POLICY "Org admins can check in workshop attendees"
  ON workshop_attendees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workshops w
      JOIN organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workshop_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'moderator', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workshops w
      JOIN organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workshop_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'moderator', 'instructor')
    )
  );
