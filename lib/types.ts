export type SkillCategory =
  | 'Technology'
  | 'Language'
  | 'Art & Design'
  | 'Music'
  | 'Business'
  | 'Fitness'
  | 'Cooking'
  | 'Education'
  | 'Other'

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Expert'

export type MatchStatus = 'pending' | 'accepted' | 'declined' | 'unmatched'

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled'

export type NotificationType =
  | 'match_request'
  | 'match_accepted'
  | 'new_message'
  | 'new_endorsement'
  | 'new_review'
  | 'org_announcement'
  | 'workshop_scheduled'
  | 'org_message'
  | 'endorsement_request'
  | 'org_join_request'
  | 'org_request_approved'
  | 'org_request_declined'
  | 'org_cooldown_lifted'
  | 'org_invite'
  | 'org_invite_accepted'
  | 'org_invite_declined'
  | 'org_invite_revoked'
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'mention'
  | 'badge_awarded'
  | 'badge_revoked'
  | 'kyc_update'
  | 'account_status'
  | 'role_change'
  | 'report_resolved'
  | 'announcement'
  | 'warning'
  | 'info'
  | 'support_ticket'

export interface Profile {
  id: string
  name: string
  username?: string
  bio: string | null
  avatar_url: string | null
  location: string | null
  created_at: string
  role?: 'user' | 'admin'
  suspended?: boolean
  banned?: boolean
  banned_reason?: string | null
  banned_at?: string | null
  disabled?: boolean
  locked_until?: string | null
  lock_reason?: string | null
  phone?: string | null
  phone_verified?: boolean
  identity_verified?: boolean
  kyc_status?: 'unverified' | 'pending' | 'verified' | 'rejected'
  kyc_rejection_reason?: string | null
  hide_location?: boolean
  appear_offline?: boolean
  profile_visibility?: 'public' | 'matched_only'
  notify_match_request?: boolean
  notify_new_message?: boolean
  notify_session_reminder?: boolean
  /** In-app notification opt-outs by group; a group is on unless explicitly false.
   *  Groups: matches, messages, social, community, support. Account/safety
   *  notifications are always delivered (enforced by DB trigger). */
  notification_prefs?: Record<string, boolean>
  headline?: string | null
  availability?: 'available' | 'busy' | 'unavailable' | null
  intents?: string[] | null
  cover_image_url?: string | null
  website_url?: string | null
  github_url?: string | null
  linkedin_url?: string | null
}

export interface Experience {
  id: string
  user_id: string
  title: string
  organization: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
  created_at: string
}

export type EndorsementRequestStatus = 'pending' | 'fulfilled' | 'dismissed'

export interface EndorsementRequest {
  id: string
  requester_id: string
  recipient_id: string
  skill_name: string
  status: EndorsementRequestStatus
  created_at: string
}

export type OrganizationRole = 'owner' | 'admin' | 'moderator' | 'instructor' | 'member'
export type OrgVisibility = 'public' | 'private' | 'hidden'
export type OrgMembershipType = 'open' | 'request' | 'invitation'
export type OrgVerificationLevel = 'none' | 'basic' | 'standard'
export type OrgCategory =
  | 'School / University'
  | 'Professional'
  | 'Tech Club'
  | 'Non-Profit'
  | 'Government'
  | 'Startup'
  | 'Community'
  | 'Other'

export interface Organization {
  id: string
  name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  cover_image_url: string | null
  website: string | null
  email: string | null
  phone: string | null
  country: string | null
  city: string | null
  category: OrgCategory | null
  is_verified: boolean
  verification_level: OrgVerificationLevel
  internal_only_swapping: boolean
  visibility: OrgVisibility
  membership_type: OrgMembershipType
  org_code: string | null
  email_domain: string | null
  owner_id: string | null
  reapply_cooldown_days?: number | null
  max_members?: number | null
  default_member_role?: 'admin' | 'moderator' | 'instructor' | 'member' | null
  auto_expire_requests_days?: number | null
  created_at: string
  updated_at: string
}

export interface OrganizationAnnouncement {
  id: string
  organization_id: string
  author_id: string | null
  title: string
  content: string
  type: 'news' | 'event' | 'alert' | 'milestone'
  is_pinned: boolean
  created_at: string
  updated_at: string
  author?: Profile
}

export interface OrganizationPost {
  id: string
  organization_id: string | null
  author_id: string | null
  title: string | null
  content: string | null
  category: 'opportunity' | 'news' | 'project' | 'help_wanted' | 'event'
  image_url: string | null
  image_urls: string[]
  visibility?: 'public' | 'connections' | 'private' | 'specific'
  is_published: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  author?: Profile
  organization?: Organization | null
}

export interface PostComment {
  id: string
  post_id: string
  user_id: string
  content: string
  parent_id?: string | null
  is_pinned?: boolean
  as_organization?: boolean
  updated_at?: string | null
  created_at: string
  deleted_at?: string | null
  user?: Profile
}

export interface Workshop {
  id: string
  organization_id: string
  instructor_id: string | null
  title: string
  description: string | null
  scheduled_at: string
  duration_minutes: number
  max_participants: number | null
  location: string | null
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
  is_public: boolean
  created_at: string
  updated_at: string
  instructor?: Profile
  organization?: Organization
}

export interface WorkshopAttendee {
  id: string
  workshop_id: string
  user_id: string
  status: 'registered' | 'attended' | 'cancelled'
  confirmation_code: string
  created_at: string
  profile?: Profile
  workshop?: Workshop
}

export interface OrganizationThread {
  id: string
  organization_id: string
  user_id: string
  subject: string | null
  last_message_at: string
  created_at: string
  user?: Profile
  organization?: Organization
}

export interface OrganizationMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
  sender?: Profile
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  created_at: string
  profile?: Profile
  organization?: Organization
}

export interface OrganizationInvite {
  id: string
  organization_id: string
  email: string
  inviter_id: string
  role: 'admin' | 'member'
  status: 'pending' | 'accepted' | 'expired' | 'declined'
  created_at: string
  expires_at: string
  organization?: Organization
  inviter?: Profile
}

export interface OrganizationJoinRequest {
  id: string
  organization_id: string
  user_id: string
  message: string | null
  skills: string | null
  experience: string | null
  status: 'pending' | 'approved' | 'declined'
  reviewed_by: string | null
  reviewed_at: string | null
  decline_reason?: string | null
  cooldown_days?: number | null
  cooldown_until?: string | null
  cooldown_waived_at?: string | null
  cooldown_waived_by?: string | null
  created_at: string
  profile?: Profile
  organization?: Organization
  reviewer?: Profile
}

export interface OrganizationInviteCode {
  id: string
  organization_id: string
  code: string
  role: 'admin' | 'moderator' | 'instructor' | 'member'
  label: string | null
  max_uses: number | null
  use_count: number
  expires_at: string | null
  revoked_at: string | null
  created_by: string | null
  created_at: string
}

export interface OrganizationInviteCodeUse {
  id: string
  code_id: string
  user_id: string
  used_at: string
  profile?: Profile
}

export interface OrganizationUserInvite {
  id: string
  organization_id: string
  user_id: string
  invited_by: string | null
  role: 'admin' | 'moderator' | 'instructor' | 'member'
  message: string | null
  status: 'pending' | 'accepted' | 'declined' | 'revoked'
  created_at: string
  responded_at: string | null
  profile?: Profile
  inviter?: Profile
  organization?: Organization
}

export type BadgeType = 'verified' | 'top_teacher' | 'top_learner' | 'trusted' | 'community_star' | 'early_adopter'

export interface UserBadge {
  id: string
  user_id: string
  badge_type: BadgeType
  awarded_by: string | null
  awarded_at: string
}

export interface Report {
  id: string
  reporter_id: string
  reported_id: string
  reason: string
  created_at: string
  resolved_at?: string | null
  action_taken?: string | null
  reporter?: Profile
  reported?: Profile
}

export interface UserSkill {
  id: string
  user_id: string
  skill_name: string
  category: SkillCategory
  type: 'teach' | 'learn'
  level: SkillLevel | null
  description: string | null
  pinned?: boolean
}

export interface MatchRequest {
  id: string
  from_user_id: string
  to_user_id: string
  status: MatchStatus
  created_at: string
  unmatched_at?: string | null
  from_profile?: Profile
  to_profile?: Profile
}

export interface Message {
  id: string
  match_id: string
  sender_id: string
  content: string | null
  attachment_url?: string | null
  attachment_type?: 'image' | 'file' | 'audio' | null
  attachment_name?: string | null
  read_at: string | null
  deleted_at: string | null
  created_at: string
  sender?: Profile
}

export interface Endorsement {
  id: string
  endorser_id: string
  endorsee_id: string
  skill_name: string
  created_at: string
  pinned?: boolean
  hidden?: boolean
  endorser?: Profile
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  entity_id: string | null
  href: string | null
  read_at: string | null
  created_at: string
}

export interface Session {
  id: string
  match_id: string
  scheduled_at: string
  duration_minutes: number
  skill_focus: string
  notes: string | null
  status: SessionStatus
  match?: MatchRequest
}

export interface Review {
  id: string
  session_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer?: Profile
}

export interface ProfileWithSkills extends Profile {
  teach_skills: UserSkill[]
  learn_skills: UserSkill[]
  avg_rating?: number
  review_count?: number
  organizations?: OrganizationMember[]
}
