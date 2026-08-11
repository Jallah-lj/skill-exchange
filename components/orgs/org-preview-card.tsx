'use client'

import { Badge } from '@/components/ui/badge'
import { Building2, Globe, MapPin, Eye, Lock, EyeOff, Users, Mail, KeyRound } from 'lucide-react'
import type { OrgCategory, OrgVisibility, OrgMembershipType } from '@/lib/types'

interface OrgPreviewCardProps {
  name: string
  slug: string
  category: OrgCategory | ''
  bio: string
  website: string
  city: string
  country: string
  logoUrl: string
  coverUrl: string
  visibility: OrgVisibility
  membershipType: OrgMembershipType
}

const VISIBILITY_META: Record<OrgVisibility, { label: string; icon: React.ElementType }> = {
  public: { label: 'Public', icon: Eye },
  private: { label: 'Private', icon: Lock },
  hidden: { label: 'Hidden', icon: EyeOff },
}

const MEMBERSHIP_META: Record<OrgMembershipType, { label: string; icon: React.ElementType }> = {
  open: { label: 'Open join', icon: Users },
  request: { label: 'Approval required', icon: Mail },
  invitation: { label: 'Invite only', icon: KeyRound },
}

export function OrgPreviewCard(props: OrgPreviewCardProps) {
  const { name, slug, category, bio, website, city, country, logoUrl, coverUrl, visibility, membershipType } = props
  const VisibilityIcon = VISIBILITY_META[visibility].icon
  const MembershipIcon = MEMBERSHIP_META[membershipType].icon
  const location = [city, country].filter(Boolean).join(', ')

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="relative h-24 bg-gradient-to-br from-violet-500/30 via-fuchsia-500/10 to-transparent">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="px-5 pb-5">
        <div className="-mt-8 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-7 w-7 text-muted-foreground" />
          )}
        </div>

        <h3 className="text-lg font-semibold leading-tight">{name || 'Your organization'}</h3>
        <p className="text-xs text-muted-foreground font-mono">/orgs/{slug || 'your-org'}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {category && <Badge variant="secondary" className="text-xs">{category}</Badge>}
          <Badge variant="outline" className="gap-1 text-xs">
            <VisibilityIcon className="h-3 w-3" /> {VISIBILITY_META[visibility].label}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <MembershipIcon className="h-3 w-3" /> {MEMBERSHIP_META[membershipType].label}
          </Badge>
        </div>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {bio || 'Your description will appear here. Tell people what your organization does and what skills members share.'}
        </p>

        {(location || website) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {location}
              </span>
            )}
            {website && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" /> {website.replace(/^https?:\/\//, '')}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> 1 member · founded today
        </div>
      </div>
    </div>
  )
}
