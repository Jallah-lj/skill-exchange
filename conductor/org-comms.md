# Implementation Plan - Organization Communication & Sessions

Enhance organizations with communication tools (Announcements, Direct Messaging) and group session capabilities (Workshops).

## Objective
Provide organizations with the tools they need to engage with their members and the broader community through broadcasts, group learning, and direct support.

## Key Files & Context
- `lib/supabase/org-comms-migration.sql`: New database tables and RLS policies.
- `lib/types.ts`: TypeScript interfaces for the new entities.
- `app/(main)/orgs/[slug]/page.tsx`: Update to display announcements and workshops.
- `app/(main)/orgs/[slug]/dashboard/page.tsx`: Update to manage announcements, workshops, and messages.
- `app/(main)/sessions/page.tsx`: Update to show registered workshops.

## Implementation Steps

### Phase 1: Database & Types
1. **Migration**: Create `lib/supabase/org-comms-migration.sql` with:
    - `organization_announcements`: `id`, `organization_id`, `author_id`, `title`, `content`, `type`, `is_pinned`, `created_at`.
    - `workshops`: `id`, `organization_id`, `instructor_id`, `title`, `description`, `scheduled_at`, `duration_minutes`, `max_participants`, `location`, `status`.
    - `workshop_attendees`: `id`, `workshop_id`, `user_id`, `status`.
    - `organization_threads`: `id`, `organization_id`, `user_id`, `last_message_at`.
    - `organization_messages`: `id`, `thread_id`, `sender_id`, `content`, `created_at`.
2. **TypeScript**: Update `lib/types.ts` with new interfaces.

### Phase 2: Announcements Feed
1. **Admin UI**: Add "Announcements" tab to `app/(main)/orgs/[slug]/dashboard/page.tsx`.
    - List existing announcements.
    - Create announcement form.
2. **Public UI**: Add "Feed" tab to `app/(main)/orgs/[slug]/page.tsx`.
    - Display announcements in reverse chronological order.

### Phase 3: Workshops & Group Sessions
1. **Admin UI**: Add "Workshops" tab to `app/(main)/orgs/[slug]/dashboard/page.tsx`.
    - Workshop creation form.
2. **Public UI**: Add "Workshops" tab to `app/(main)/orgs/[slug]/page.tsx`.
    - List upcoming workshops with a "Register" button.
3. **User UI**: Update `app/(main)/sessions/page.tsx` to include registered workshops.

### Phase 4: Direct Messaging
1. **User UI**: Add "Message" button on `app/(main)/orgs/[slug]/page.tsx`.
2. **Admin UI**: Add "Inbox" tab to `app/(main)/orgs/[slug]/dashboard/page.tsx`.
    - List threads and allow replies.

## Verification & Testing
- **Announcements**: Post an announcement as an admin and verify it appears on the public profile.
- **Workshops**: Register for a workshop and verify it appears in the "Sessions" list.
- **Messaging**: Send a message as a user and reply as an admin.
