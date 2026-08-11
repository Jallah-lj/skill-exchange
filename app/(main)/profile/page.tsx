'use client'

import { Loader2 } from 'lucide-react'
import { useProfile } from '@/hooks/use-profile'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileDetailsCard } from '@/components/profile/profile-details-card'
import { QuickStatsCard } from '@/components/profile/quick-stats-card'
import { ProfileCompletenessCard } from '@/components/profile/profile-completeness-card'
import { BadgesCard } from '@/components/profile/badges-card'
import { MyPostsSection } from '@/components/profile/my-posts-section'
import { SkillsSection } from '@/components/profile/skills-section'
import { ExperienceSection } from '@/components/profile/experience-section'
import { EndorsementsSection } from '@/components/profile/endorsements-section'

export default function ProfilePage() {
  const {
    loading,
    saving,
    isEditing,
    uploadingAvatar,
    uploadingCover,
    togglingEndorsement,
    form,
    updateForm,
    kycStatus,
    userId,
    teachSkills,
    learnSkills,
    receivedEndorsements,
    experiences,
    matches,
    badges,
    handleEdit,
    handleCancel,
    uploadAvatar,
    uploadCover,
    removeAvatar,
    removeCover,
    saveProfile,
    addSkills,
    removeSkill,
    toggleSkillPin,
    toggleEndorsementPin,
    toggleEndorsementHide,
    requestEndorsement,
    addExperience,
    removeExperience,
  } = useProfile()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const visibleEndorsementsCount = receivedEndorsements.filter((e) => !e.hidden).length
  const totalSkills = teachSkills.length + learnSkills.length

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 sm:px-0">
      <ProfileHeader
        userId={userId}
        name={form.name}
        headline={form.headline}
        location={form.location}
        availability={form.availability}
        kycStatus={kycStatus}
        avatarUrl={form.avatarUrl}
        coverUrl={form.coverUrl}
        isEditing={isEditing}
        saving={saving}
        uploadingAvatar={uploadingAvatar}
        uploadingCover={uploadingCover}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onSave={saveProfile}
        onUploadAvatar={uploadAvatar}
        onUploadCover={uploadCover}
        onRemoveAvatar={removeAvatar}
        onRemoveCover={removeCover}
      />

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ProfileDetailsCard form={form} isEditing={isEditing} onChange={updateForm} />
        <div className="space-y-6">
          <ProfileCompletenessCard
            hasAvatar={!!form.avatarUrl}
            hasCover={!!form.coverUrl}
            hasHeadline={!!form.headline}
            hasBio={!!form.bio}
            hasLocation={!!form.location}
            hasTeachSkill={teachSkills.length > 0}
            hasLearnSkill={learnSkills.length > 0}
          />
          <QuickStatsCard
            totalSkills={totalSkills}
            teachCount={teachSkills.length}
            learnCount={learnSkills.length}
            visibleEndorsementsCount={visibleEndorsementsCount}
          />
          <BadgesCard badges={badges} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SkillsSection
          variant="teach"
          skills={teachSkills}
          isEditing={isEditing}
          onAdd={addSkills}
          onRemove={(id) => removeSkill(id, 'teach')}
          onTogglePin={(id, pinned) => toggleSkillPin(id, 'teach', pinned)}
        />
        <SkillsSection
          variant="learn"
          skills={learnSkills}
          isEditing={isEditing}
          onAdd={addSkills}
          onRemove={(id) => removeSkill(id, 'learn')}
          onTogglePin={(id, pinned) => toggleSkillPin(id, 'learn', pinned)}
        />
      </section>

      <ExperienceSection
        experiences={experiences}
        isEditing={isEditing}
        onAdd={addExperience}
        onRemove={removeExperience}
      />

      <EndorsementsSection
        endorsements={receivedEndorsements}
        isEditing={isEditing}
        togglingId={togglingEndorsement}
        onTogglePin={toggleEndorsementPin}
        onToggleHide={toggleEndorsementHide}
        matches={matches}
        teachSkills={teachSkills}
        onRequestEndorsement={requestEndorsement}
      />

      {userId && <MyPostsSection userId={userId} />}
    </div>
  )
}
