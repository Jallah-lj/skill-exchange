---
name: user-profile-setup
description: "Profile setup workflow for Skill Exchange. Guides edits to the personal profile page, avatar upload, skills lists, location, endorsements, and verification-related profile flows."
---
# User Profile Setup Skill

A focused workflow for working on the Skill Exchange profile setup experience. Use this skill when the user request is centered on editing a profile, improving onboarding or verification guidance, and refining the `/profile` flow.

## When to Apply
- The user asks for changes to the personal profile page or profile setup flow.
- The task involves avatar upload, basic info, country selection, or saving profile details.
- The work touches teaching/learning skills, skill suggestions, endorsements, or profile completeness.
- The target is the current user's profile page rather than the public profile view.

## Scope
This skill is workspace-scoped and should be used for task-focused profile setup work in the existing Skill Exchange app.

## Workflow
1. Identify the relevant route:
   - `app/(main)/profile/page.tsx` is the primary profile setup page.
   - `app/(main)/profile/[id]/page.tsx` is the public profile detail view; avoid changes there unless the request explicitly includes public profile display.
2. Review current profile state and data flows:
   - `loadProfile()` loads profile, skills, and endorsements.
   - `saveProfile()` updates `name`, `bio`, and `location`.
   - `uploadAvatar()` uploads an avatar file and updates `profiles.avatar_url`.
3. Review UI and interaction patterns:
   - Avatar picker with file input hidden behind click target.
   - Country selection via `Select` with search and `COUNTRIES` constant.
   - Teach/learn skill add/remove flows and suggested skill buttons.
   - Endorsement pin/hide actions and visibility toggles.
4. Apply changes in small, targeted increments:
   - Keep new behavior consistent with existing `Button`, `Input`, `Select`, `Card`, and `Badge` components.
   - Prefer existing constants and helper utilities rather than introducing new abstractions.
   - Preserve current save-state, loading-state, and toast feedback patterns.
5. Validate the experience:
   - Ensure profile edits are saved and reflected in the profile page.
   - Confirm avatar uploads work and the public URL is saved.
   - Verify skill add/remove flows update UI state immediately.
   - Confirm endorsement toggles update state and do not break hidden/pinned listings.

## Decision Points
- If the request is about public profile display or profile SEO, switch to reviewing `app/(main)/profile/[id]/page.tsx`.
- If the request mentions user onboarding or verification progress, include `app/(main)/verify/page.tsx` and profile completion guidance.
- If the change requests come from the profile page but affect search/matching, preserve the core profile setup behavior and avoid overreaching into browse/search logic.

## Quality Criteria
- Changes should be minimal and aligned with existing app conventions.
- Reuse the current `supabase` client and `sonner` toast behavior.
- Keep the user experience mobile-first and accessible.
- Avoid adding dependencies unless the feature cannot reasonably be implemented with current components.
- Preserve state updates and optimistic UI updates for profile skill management.

## Example Prompts
- "Improve the profile setup page and save flow."
- "Add a profile completion indicator to the user profile page."
- "Fix avatar upload and country select behavior on profile setup."
- "Refactor the skill add/remove logic on the profile settings page."

## Related Customizations
- Create a workspace instruction for `app/(main)/profile/**` if you want automatic guidance on profile file edits.
- Create a targeted prompt for profile setup bug fixes or UI polish requests.
