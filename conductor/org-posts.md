# Implementation Plan - Public Organization Posts & Browse Integration

Enable organizations to create public posts that are discoverable on the global browse page.

## Objective
Increase organization visibility and engagement by allowing them to share opportunities, news, and requests with the entire community.

## Key Files & Context
- `lib/supabase/org-posts-migration.sql`: New database table and policies.
- `lib/types.ts`: Update with `OrganizationPost` interface.
- `app/(main)/orgs/[slug]/dashboard/page.tsx`: Add "Public Posts" management.
- `app/(main)/browse/page.tsx`: Add "Community" tab to display organization posts and public workshops.

## Implementation Steps

### Phase 1: Database & Types
1. **Migration**: Create `organization_posts` table.
    - `id`, `organization_id`, `author_id`, `title`, `content`, `category`, `image_url`, `is_published`, `created_at`.
2. **Update Workshops**: Add `is_public` boolean to `workshops` table to allow them to appear on Browse.
3. **TypeScript**: Add `OrganizationPost` type to `lib/types.ts`.

### Phase 2: Dashboard Implementation
1. **Admin UI**: Add "Public Posts" tab to `app/(main)/orgs/[slug]/dashboard/page.tsx`.
    - Create/Edit/Delete posts.
    - Toggle `is_published`.
2. **Workshop Update**: Add "List on global browse page" checkbox to the Workshop creation form.

### Phase 3: Browse Page Integration
1. **New Tab**: Add "Community" tab to `app/(main)/browse/page.tsx`.
2. **Fetching**: Implement `loadCommunityFeed` to fetch published posts and public workshops in parallel.
3. **UI Components**:
    - `PostCard`: For displaying organization posts.
    - `PublicWorkshopCard`: A variant of the workshop card for the browse page.

### Phase 4: Discovery Optimization
1. **Filtering**: Add category filters to the Community tab (e.g., Opportunities, News, Events).
2. **Call to Action**: Ensure each post links back to the organization profile.

## Verification & Testing
- **Creation**: Create a public post and verify it's NOT visible if `is_published` is false.
- **Browse**: Verify the post appears on the Browse page once published.
- **Interaction**: Verify the "View Organization" link on the post card works.
