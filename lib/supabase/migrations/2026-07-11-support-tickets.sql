-- ── Support Tickets ──────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Backs the admin Support Center (app/admin/support/page.tsx), which was
-- querying `support_tickets`/`support_messages` tables that were never created
-- by any prior migration — same silent-failure bug as the `posts` table.
-- Also adds the user-facing side: a Contact Support page for creating/replying.

CREATE TABLE IF NOT EXISTS support_tickets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  subject     text NOT NULL,
  description text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'escalated')),
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid REFERENCES profiles ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id  uuid REFERENCES support_tickets ON DELETE CASCADE NOT NULL,
  sender_id  uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  content    text NOT NULL,
  is_admin   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: a user can see/create/update their own; admins can manage all
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own tickets" ON support_tickets;
CREATE POLICY "Users can create own tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tickets" ON support_tickets;
CREATE POLICY "Users can update own tickets"
  ON support_tickets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all tickets" ON support_tickets;
CREATE POLICY "Admins can manage all tickets"
  ON support_tickets FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Messages: visible to the ticket's owner and any admin; either can reply
DROP POLICY IF EXISTS "Ticket participants can view messages" ON support_messages;
CREATE POLICY "Ticket participants can view messages"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
        AND (t.user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
  );

DROP POLICY IF EXISTS "Ticket participants can send messages" ON support_messages;
CREATE POLICY "Ticket participants can send messages"
  ON support_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
        AND (t.user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
  );
