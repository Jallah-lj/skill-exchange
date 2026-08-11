'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, ShieldCheck, Clock, MapPin, ExternalLink } from 'lucide-react'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { CoverUpload } from '@/components/profile/cover-upload'
import { AVAILABILITY_LABELS, type Availability } from '@/hooks/use-profile'

interface ProfileHeaderProps {
  userId: string | null
  name: string
  headline: string
  location: string
  availability: Availability
  kycStatus: string
  avatarUrl: string
  coverUrl: string
  isEditing: boolean
  saving: boolean
  uploadingAvatar: boolean
  uploadingCover: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onUploadAvatar: (file: File) => void
  onUploadCover: (file: File) => void
  onRemoveAvatar: () => void
  onRemoveCover: () => void
}

export function ProfileHeader({
  userId,
  name,
  headline,
  location,
  availability,
  kycStatus,
  avatarUrl,
  coverUrl,
  isEditing,
  saving,
  uploadingAvatar,
  uploadingCover,
  onEdit,
  onCancel,
  onSave,
  onUploadAvatar,
  onUploadCover,
  onRemoveAvatar,
  onRemoveCover,
}: ProfileHeaderProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
      <div className="relative h-36 sm:h-48">
        <CoverUpload
          coverUrl={coverUrl}
          isEditing={isEditing}
          uploading={uploadingCover}
          onUpload={onUploadCover}
          onRemove={onRemoveCover}
        />

        <div className="absolute right-4 top-4 flex flex-wrap items-center gap-2">
          {userId && (
            <Button
              variant="outline"
              className="bg-background/90"
              nativeButton={false}
              render={<Link href={`/profile/${userId}`} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> View public profile
            </Button>
          )}
          {!isEditing ? (
            <Button onClick={onEdit}>Edit profile</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="-mt-12 flex items-end gap-4 sm:-mt-14">
          <AvatarUpload
            avatarUrl={avatarUrl}
            name={name}
            isEditing={isEditing}
            uploading={uploadingAvatar}
            onUpload={onUploadAvatar}
            onRemove={onRemoveAvatar}
            className="ring-4 ring-background"
          />
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Professional profile</p>
            <h1 className="flex items-center gap-2 text-3xl font-semibold leading-tight">
              {name || 'Untitled profile'}
              {kycStatus === 'verified' && (
                <span title="Verified">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-blue-500" />
                </span>
              )}
            </h1>
            <p className="mt-2 text-sm text-foreground">{headline || 'Add a short headline that summarizes what you teach and learn.'}</p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Keep your teaching and learning story compelling, organized, and easy for others to browse.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {location || 'Location not set'}
            </span>
            {kycStatus !== 'verified' && (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> {kycStatus === 'pending' ? 'Pending verification' : 'Unverified'}
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> {AVAILABILITY_LABELS[availability]}
            </span>
          </div>
        </div>

        {!isEditing && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
            Click <span className="font-semibold">Edit profile</span> to update your photo, cover, summary, skills, and endorsements.
          </div>
        )}
      </div>
    </section>
  )
}
