# Implementation Plan - Organization Accounts

Add support for Organization Accounts (companies, schools, clubs) to enable professional networking, internal skill swapping, and official group branding.

## Objective
Enable users to create, manage, and belong to organizations. Organizations will provide a trust layer, branding, and optional private swapping environments.

## Key Files & Context
- `lib/supabase/schema.sql`: Database tables and RLS policies.
- `lib/types.ts`: TypeScript interfaces for the new entities.
- `app/(main)/layout.tsx` & `components/navbar.tsx`: Navigation updates.
- `app/(main)/orgs/`: New route group for organization profiles and management.
- `app/(main)/settings/page.tsx`: Entry point for creating organizations.

## Implementation Steps

### Phase 1: Database & Types
1. **Update Schema**: Add the following tables to `lib/supabase/schema.sql`:
    - `organizations`: `id`, `name`, `slug` (unique), `bio`, `avatar_url`, `website`, `is_verified`, `internal_only_swapping` (boolean).
    - `organization_members`: `id`, `organization_id`, `user_id`, `role` (owner, admin, member).
    - `organization_invites`: `id`, `organization_id`, `email`, `inviter_id`, `status` (pending, accepted, expired).
2. **RLS Policies**: Implement strict RLS:
    - Organizations are public.
    - Only `owner`/`admin` can update org details.
    - Only `owner`/`admin` can view/manage invites.
3. **TypeScript Types**: Update `lib/types.ts` with `Organization`, `OrganizationMember`, and `OrganizationInvite` interfaces.

### Phase 2: Creation & Basic Profile
1. **Creation Flow**:
    - Add "Create Organization" button to the user settings page.
    - Create a modal or new page `app/(main)/orgs/create/page.tsx` for initial setup.
2. **Organization Profile**:
    - Create `app/(main)/orgs/[slug]/page.tsx` to display the organization's public information and its members.
3. **Settings Integration**:
    - Add "My Organizations" section to the main settings page.

### Phase 3: Member Management & Invitations
1. **Admin Dashboard**:
    - Create `app/(main)/orgs/[slug]/dashboard/page.tsx` for admins.
    - Implement member list with "Remove" and "Change Role" actions.
2. **Invitation System**:
    - Implement email-based invitations.
    - Create `app/api/orgs/invite/route.ts` to handle sending/storing invites.
    - Implement an "Accept Invite" landing page.

### Phase 4: Branding & Privacy Logic
1. **UI Branding**:
    - Add an "Organization Badge" (mini-logo/name) next to user names in `app/(main)/browse/page.tsx` and user profiles.
2. **Match Request Logic**:
    - Update the matching logic to respect `internal_only_swapping`.
    - If a user is in an "Internal Only" org, prevent matching with users outside that org (unless they have an existing match).

## Verification & Testing
- **Schema Validation**: Verify all tables and RLS policies are active.
- **Creation Test**: Create a new organization, upload an avatar, and set a slug.
- **Invitation Test**: Invite a user, accept the invite, and verify the user appears in the member list.
- **Privacy Test**: Toggle "Internal Only" and verify that the user's profile is hidden/restricted for non-org members.
- **Role Test**: Verify that a standard member cannot edit the organization profile or invite others.
