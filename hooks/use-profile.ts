'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { UserSkill, SkillCategory, SkillLevel, Experience, BadgeType } from '@/lib/types'

export const AVAILABILITY_OPTIONS = ['available', 'busy', 'unavailable'] as const
export type Availability = (typeof AVAILABILITY_OPTIONS)[number]

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Available',
  busy: 'Busy',
  unavailable: 'Unavailable',
}

export interface ReceivedEndorsement {
  id: string
  endorser_id: string
  skill_name: string
  created_at: string
  pinned: boolean
  hidden: boolean
  endorser: { id: string; name: string; avatar_url: string | null } | null
}

export interface MatchedConnection {
  id: string
  name: string
  avatar_url: string | null
}

export interface ProfileFormState {
  name: string
  username: string
  headline: string
  bio: string
  location: string
  availability: Availability
  avatarUrl: string
  coverUrl: string
  websiteUrl: string
  githubUrl: string
  linkedinUrl: string
}

export interface NewSkillInput {
  name: string
  category: SkillCategory | ''
  level: SkillLevel | ''
  description: string
  type: 'teach' | 'learn'
}

export interface NewExperienceInput {
  title: string
  organization: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
}

const EMPTY_FORM: ProfileFormState = {
  name: '',
  username: '',
  headline: '',
  bio: '',
  location: '',
  availability: 'available',
  avatarUrl: '',
  coverUrl: '',
  websiteUrl: '',
  githubUrl: '',
  linkedinUrl: '',
}

const byPinnedFirst = (a: UserSkill, b: UserSkill) => Number(!!b.pinned) - Number(!!a.pinned)

export function useProfile() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [togglingEndorsement, setTogglingEndorsement] = useState<string | null>(null)

  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM)
  const [snapshot, setSnapshot] = useState<ProfileFormState>(EMPTY_FORM)
  const [kycStatus, setKycStatus] = useState('unverified')
  const [teachSkills, setTeachSkills] = useState<UserSkill[]>([])
  const [learnSkills, setLearnSkills] = useState<UserSkill[]>([])
  const [receivedEndorsements, setReceivedEndorsements] = useState<ReceivedEndorsement[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [matches, setMatches] = useState<MatchedConnection[]>([])
  const [badges, setBadges] = useState<{ badge_type: BadgeType }[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [
      { data: profile },
      { data: skills },
      { data: endorsements },
      { data: experienceRows },
      { data: matchRows },
      { data: badgeRows },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_skills').select('*').eq('user_id', user.id),
      supabase
        .from('endorsements')
        .select('id, endorser_id, skill_name, created_at, pinned, hidden, endorser:profiles!endorser_id(id, name, avatar_url)')
        .eq('endorsee_id', user.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('experiences')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('match_requests')
        .select('from_user_id, to_user_id, from_user:profiles!from_user_id(id, name, avatar_url), to_user:profiles!to_user_id(id, name, avatar_url)')
        .eq('status', 'accepted')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
      supabase.from('user_badges').select('badge_type').eq('user_id', user.id),
    ])

    if (profile) {
      const next: ProfileFormState = {
        name: profile.name ?? '',
        username: profile.username ?? '',
        headline: profile.headline ?? '',
        bio: profile.bio ?? '',
        location: profile.location ?? '',
        availability: profile.availability ?? 'available',
        avatarUrl: profile.avatar_url ?? '',
        coverUrl: profile.cover_image_url ?? '',
        websiteUrl: profile.website_url ?? '',
        githubUrl: profile.github_url ?? '',
        linkedinUrl: profile.linkedin_url ?? '',
      }
      setForm(next)
      setSnapshot(next)
      setKycStatus(profile.kyc_status ?? 'unverified')
    }
    if (skills) {
      setTeachSkills(skills.filter((s: UserSkill) => s.type === 'teach').sort(byPinnedFirst))
      setLearnSkills(skills.filter((s: UserSkill) => s.type === 'learn').sort(byPinnedFirst))
    }
    setReceivedEndorsements((endorsements as unknown as ReceivedEndorsement[]) ?? [])
    setExperiences(experienceRows ?? [])
    setMatches(
      ((matchRows ?? []) as unknown as {
        from_user_id: string
        to_user_id: string
        from_user: MatchedConnection | null
        to_user: MatchedConnection | null
      }[]).flatMap((m) => {
        const other = m.from_user_id === user.id ? m.to_user : m.from_user
        return other ? [other] : []
      })
    )
    setBadges(badgeRows ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateForm = (patch: Partial<ProfileFormState>) => setForm((p) => ({ ...p, ...patch }))

  const handleEdit = () => setIsEditing(true)

  const handleCancel = () => {
    setForm(snapshot)
    setIsEditing(false)
  }

  const uploadAvatar = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return }
    setUploadingAvatar(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploadingAvatar(false)
      return
    }

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      toast.error('Upload failed — make sure the "avatars" bucket exists in Supabase Storage')
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    if (error) toast.error('Failed to save avatar')
    else {
      // Cache-bust: the path is stable per user, so browsers keep serving the old
      // cached image after a re-upload unless the URL changes.
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`
      updateForm({ avatarUrl: cacheBustedUrl })
      setSnapshot((p) => ({ ...p, avatarUrl: cacheBustedUrl }))
      toast.success('Photo updated!')
    }
    setUploadingAvatar(false)
  }

  const uploadCover = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setUploadingCover(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploadingCover(false)
      return
    }

    const ext = file.name.split('.').pop()
    const path = `${user.id}/cover.${ext}`

    const { error: uploadError } = await supabase.storage.from('covers').upload(path, file, { upsert: true })
    if (uploadError) {
      toast.error('Upload failed — make sure the "covers" bucket exists in Supabase Storage')
      setUploadingCover(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(path)
    const { error } = await supabase.from('profiles').update({ cover_image_url: publicUrl }).eq('id', user.id)
    if (error) toast.error('Failed to save cover photo')
    else {
      // Cache-bust: the path is stable per user, so browsers keep serving the old
      // cached image after a re-upload unless the URL changes.
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`
      updateForm({ coverUrl: cacheBustedUrl })
      setSnapshot((p) => ({ ...p, coverUrl: cacheBustedUrl }))
      toast.success('Cover photo updated!')
    }
    setUploadingCover(false)
  }

  const removeAvatar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    if (error) { toast.error('Failed to remove photo'); return }
    updateForm({ avatarUrl: '' })
    setSnapshot((p) => ({ ...p, avatarUrl: '' }))
    toast.success('Photo removed')
  }

  const removeCover = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ cover_image_url: null }).eq('id', user.id)
    if (error) { toast.error('Failed to remove cover photo'); return }
    updateForm({ coverUrl: '' })
    setSnapshot((p) => ({ ...p, coverUrl: '' }))
    toast.success('Cover photo removed')
  }

  const saveProfile = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { name, username, headline, bio, location, availability, websiteUrl, githubUrl, linkedinUrl } = form

    const cleanUsername = username.trim().toLowerCase()
    if (!/^[a-z0-9_.-]{2,32}$/.test(cleanUsername)) {
      toast.error('Username must be 2-32 characters: letters, numbers, "_", "." or "-" only')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        name,
        username: cleanUsername,
        headline,
        bio,
        location,
        availability,
        website_url: websiteUrl || null,
        github_url: githubUrl || null,
        linkedin_url: linkedinUrl || null,
      })
      .eq('id', user.id)

    if (error) {
      toast.error(error.code === '23505' ? 'That username is already taken' : 'Failed to save profile')
    } else {
      toast.success('Profile saved!')
      setSnapshot({ ...form, username: cleanUsername })
      setIsEditing(false)
    }
    setSaving(false)
  }

  const addSkills = async (skills: NewSkillInput[]) => {
    const valid = skills.filter((s) => s.name && s.category)
    if (valid.length === 0) {
      toast.error('Select at least one skill to add')
      return false
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase.from('user_skills').insert(
      valid.map((skill) => ({
        user_id: user.id,
        skill_name: skill.name,
        category: skill.category,
        type: skill.type,
        level: skill.type === 'teach' ? skill.level || null : null,
        description: skill.description || null,
      }))
    ).select()

    if (error) { toast.error('Failed to add skills'); return false }

    const teachAdded = data.filter((s: UserSkill) => s.type === 'teach')
    const learnAdded = data.filter((s: UserSkill) => s.type === 'learn')
    if (teachAdded.length) setTeachSkills((p) => [...p, ...teachAdded])
    if (learnAdded.length) setLearnSkills((p) => [...p, ...learnAdded])

    toast.success(data.length === 1 ? 'Skill added!' : `${data.length} skills added!`)
    return true
  }

  const removeSkill = async (id: string, type: 'teach' | 'learn') => {
    const { error } = await supabase.from('user_skills').delete().eq('id', id)
    if (error) { toast.error('Failed to remove skill'); return }
    if (type === 'teach') setTeachSkills((p) => p.filter((s) => s.id !== id))
    else setLearnSkills((p) => p.filter((s) => s.id !== id))
  }

  const toggleSkillPin = async (id: string, type: 'teach' | 'learn', pinned: boolean) => {
    const { error } = await supabase.from('user_skills').update({ pinned }).eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    const updateList = (list: UserSkill[]) =>
      list.map((s) => (s.id === id ? { ...s, pinned } : s)).sort(byPinnedFirst)
    if (type === 'teach') setTeachSkills(updateList)
    else setLearnSkills(updateList)
  }

  const toggleEndorsementPin = async (id: string, pinned: boolean) => {
    setTogglingEndorsement(id)
    const { error } = await supabase.from('endorsements').update({ pinned }).eq('id', id)
    if (error) toast.error('Failed to update')
    else setReceivedEndorsements((prev) => prev.map((e) => (e.id === id ? { ...e, pinned } : e)))
    setTogglingEndorsement(null)
  }

  const toggleEndorsementHide = async (id: string, hidden: boolean) => {
    setTogglingEndorsement(id)
    const { error } = await supabase.from('endorsements').update({ hidden }).eq('id', id)
    if (error) toast.error('Failed to update')
    else setReceivedEndorsements((prev) => prev.map((e) => (e.id === id ? { ...e, hidden } : e)))
    setTogglingEndorsement(null)
  }

  const requestEndorsement = async (recipientId: string, skillName: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase.from('endorsement_requests').insert({
      requester_id: user.id,
      recipient_id: recipientId,
      skill_name: skillName,
    })
    if (error) { toast.error('Failed to send request'); return false }

    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'endorsement_request',
      title: `${form.name || 'Someone'} requested an endorsement`,
      body: `for ${skillName}`,
      href: `/profile/${user.id}`,
    })

    toast.success('Endorsement request sent!')
    return true
  }

  const addExperience = async (input: NewExperienceInput) => {
    if (!input.title.trim()) { toast.error('Title is required'); return false }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // <input type="month"> yields "YYYY-MM"; the column is a date, so pad to the 1st.
    const normalizeMonth = (value: string) => (value.length === 7 ? `${value}-01` : value || null)

    const { data, error } = await supabase.from('experiences').insert({
      user_id: user.id,
      title: input.title,
      organization: input.organization || null,
      start_date: normalizeMonth(input.startDate),
      end_date: input.isCurrent ? null : normalizeMonth(input.endDate),
      is_current: input.isCurrent,
      description: input.description || null,
    }).select().single()

    if (error) { toast.error('Failed to add experience'); return false }
    setExperiences((p) => [data, ...p])
    toast.success('Experience added!')
    return true
  }

  const removeExperience = async (id: string) => {
    const { error } = await supabase.from('experiences').delete().eq('id', id)
    if (error) { toast.error('Failed to remove experience'); return }
    setExperiences((p) => p.filter((e) => e.id !== id))
  }

  return {
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
  }
}
