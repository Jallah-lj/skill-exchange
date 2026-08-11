-- ── Organization Automation (Notifications & Triggers) ───────────────────────
-- Run this in Supabase SQL Editor.

-- 1. Helper to notify all organization members
CREATE OR REPLACE FUNCTION notify_org_members()
RETURNS TRIGGER AS $$
DECLARE
  member_record RECORD;
  org_name text;
  notification_title text;
  notification_body text;
  notification_href text;
BEGIN
  -- Get organization name
  SELECT name INTO org_name FROM organizations WHERE id = NEW.organization_id;

  IF TG_TABLE_NAME = 'organization_announcements' THEN
    notification_title := 'New Announcement: ' || org_name;
    notification_body := NEW.title;
    notification_href := '/orgs/' || (SELECT slug FROM organizations WHERE id = NEW.organization_id) || '?tab=feed';
  ELSIF TG_TABLE_NAME = 'workshops' THEN
    notification_title := 'New Workshop: ' || org_name;
    notification_body := NEW.title || ' scheduled for ' || to_char(NEW.scheduled_at, 'Mon DD, HH:MI AM');
    notification_href := '/orgs/' || (SELECT slug FROM organizations WHERE id = NEW.organization_id) || '?tab=workshops';
  END IF;

  -- Insert notifications for all members except the author/instructor
  FOR member_record IN 
    SELECT user_id FROM organization_members 
    WHERE organization_id = NEW.organization_id 
      AND user_id != COALESCE(NEW.author_id, NEW.instructor_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, entity_id, href)
    VALUES (
      member_record.user_id, 
      CASE WHEN TG_TABLE_NAME = 'organization_announcements' THEN 'org_announcement' ELSE 'workshop_scheduled' END,
      notification_title, 
      notification_body, 
      NEW.id, 
      notification_href
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Triggers for Announcements and Workshops
DROP TRIGGER IF EXISTS on_announcement_created ON organization_announcements;
CREATE TRIGGER on_announcement_created
  AFTER INSERT ON organization_announcements
  FOR EACH ROW EXECUTE PROCEDURE notify_org_members();

DROP TRIGGER IF EXISTS on_workshop_created ON workshops;
CREATE TRIGGER on_workshop_created
  AFTER INSERT ON workshops
  FOR EACH ROW EXECUTE PROCEDURE notify_org_members();

-- 3. Notify admins on new organization messages
CREATE OR REPLACE FUNCTION notify_org_admins_of_message()
RETURNS TRIGGER AS $$
DECLARE
  thread_record RECORD;
  sender_name text;
  org_slug text;
BEGIN
  -- Get thread and sender info
  SELECT * INTO thread_record FROM organization_threads WHERE id = NEW.thread_id;
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT slug INTO org_slug FROM organizations WHERE id = thread_record.organization_id;

  -- If sender is the user who started the thread, notify org admins
  IF NEW.sender_id = thread_record.user_id THEN
    INSERT INTO notifications (user_id, type, title, body, entity_id, href)
    SELECT 
      user_id, 
      'org_message', 
      'New message from ' || sender_name, 
      LEFT(NEW.content, 100), 
      NEW.id, 
      '/orgs/' || org_slug || '/dashboard?tab=inbox'
    FROM organization_members 
    WHERE organization_id = thread_record.organization_id 
      AND role IN ('owner', 'admin', 'moderator');
  
  -- If sender is NOT the user (must be an admin), notify the user
  ELSE
    INSERT INTO notifications (user_id, type, title, body, entity_id, href)
    VALUES (
      thread_record.user_id,
      'org_message',
      'New message from ' || (SELECT name FROM organizations WHERE id = thread_record.organization_id),
      LEFT(NEW.content, 100),
      NEW.id,
      '/orgs/' || org_slug
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_message_created ON organization_messages;
CREATE TRIGGER on_org_message_created
  AFTER INSERT ON organization_messages
  FOR EACH ROW EXECUTE PROCEDURE notify_org_admins_of_message();
