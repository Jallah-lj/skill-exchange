'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, PenSquare, Send, Check } from 'lucide-react'
import type { Organization, Profile } from '@/lib/types'
import { PostImagesUpload } from '@/components/post-images-upload'
import { MentionTextarea } from '@/components/mention-textarea'
import { notifyMentions } from '@/lib/mentions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { type Visibility, VISIBILITY_OPTIONS } from '@/lib/post-visibility'

const TEXTAREA_CLASSNAME =
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const CATEGORIES = [
  { value: 'news', label: 'News' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'project', label: 'Project' },
  { value: 'help_wanted', label: 'Help Wanted' },
  { value: 'event', label: 'Event' },
] as const

const PERSONAL = '__personal__'

export function PostComposer({ onPublished }: { onPublished?: () => void }) {
  const supabase = createClient()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationId, setOrganizationId] = useState(PERSONAL)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('news')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [connections, setConnections] = useState<Profile[]>([])
  const [audience, setAudience] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const [{ data: orgRows, error: orgError }, { data: matchRows }] = await Promise.all([
        supabase.from('organization_members').select('organization:organizations(*)').eq('user_id', user.id),
        supabase.from('match_requests')
          .select('from_user_id, to_user_id, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
          .eq('status', 'accepted')
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
      ])

      if (!orgError) {
        const orgs = (orgRows ?? [])
          .map((row: any) => row.organization)
          .filter(Boolean) as Organization[]
        setOrganizations(orgs)
      }

      const conns = (matchRows ?? []).map((m: any) =>
        m.from_user_id === user.id ? m.to_profile : m.from_profile
      ).filter(Boolean) as Profile[]
      setConnections(conns)

      setLoading(false)
    }

    load()
  }, [supabase])

  const toggleAudienceMember = (userId: string) => {
    setAudience((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const createPost = async () => {
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    // Title and content are each optional — a post just needs *something*:
    // a title, some content, or a photo. A completely empty post is the
    // only thing blocked here.
    if (!trimmedTitle && !trimmedContent && imageUrls.length === 0) {
      toast.error('Add a title, some content, or a photo')
      return
    }

    const isPersonal = organizationId === PERSONAL
    const effectiveVisibility: Visibility = isPersonal ? visibility : 'public'
    if (effectiveVisibility === 'specific' && audience.size === 0) {
      toast.error('Pick at least one person to share this with')
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please sign in to create a post')
        return
      }

      const { data: created, error } = await supabase.from('organization_posts').insert({
        organization_id: isPersonal ? null : organizationId,
        author_id: user.id,
        title: trimmedTitle || null,
        content: trimmedContent || null,
        category,
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
        visibility: effectiveVisibility,
        is_published: true,
      }).select('id').single()

      if (error) throw error

      if (effectiveVisibility === 'specific' && audience.size > 0) {
        const { error: audienceError } = await supabase.from('post_audience').insert(
          [...audience].map((userId) => ({ post_id: created.id, user_id: userId }))
        )
        if (audienceError) toast.error('Post published, but sharing with specific people failed — please edit and re-select them')
      }

      const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).single()
      void notifyMentions(supabase, {
        text: `${trimmedTitle} ${trimmedContent}`,
        actorName: me?.name ?? 'Someone',
        title: `${me?.name ?? 'Someone'} mentioned you in a post`,
        href: `/posts/${created.id}`,
        excludeUserId: user.id,
      })

      setTitle('')
      setContent('')
      setCategory('news')
      setImageUrls([])
      setVisibility('public')
      setAudience(new Set())
      onPublished?.()
      toast.success('Post published')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading composer
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PenSquare className="h-4 w-4" /> Create a post
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Post as</Label>
            <Select
              value={organizationId}
              onValueChange={(v) => {
                const next = v ?? PERSONAL
                setOrganizationId(next)
                // Org posts are always public — the audience picker only makes sense for personal posts.
                if (next !== PERSONAL) { setVisibility('public'); setAudience(new Set()) }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose who this post is from" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL} label="Yourself (personal post)">
                  Yourself (personal post)
                </SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id} label={org.name}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as typeof category)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value} label={item.label}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {organizationId === PERSONAL && (
          <div className="space-y-2">
            <Label>Who can see this?</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VISIBILITY_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVisibility(value)}
                  title={description}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-colors',
                    visibility === value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>

            {visibility === 'specific' && (
              connections.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  You don't have any connections yet — connect with people on{' '}
                  <a href="/browse" className="underline">Browse</a> to share posts with them directly.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {connections.map((c) => {
                    const checked = audience.has(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleAudienceMember(c.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm transition-colors hover:bg-muted',
                          checked && 'bg-muted'
                        )}
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={c.avatar_url ?? ''} />
                          <AvatarFallback className="text-[10px]">{c.name?.slice(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <span className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                        )}>
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to share?" />
        </div>

        <div className="space-y-2">
          <Label>Content (optional)</Label>
          <MentionTextarea
            value={content}
            onChange={setContent}
            placeholder="Write your post... use @ to mention a user or organization"
            rows={5}
            className={TEXTAREA_CLASSNAME}
          />
        </div>

        <div className="space-y-2">
          <Label>Photos (optional)</Label>
          <PostImagesUpload imageUrls={imageUrls} onChange={setImageUrls} />
        </div>

        <div className="flex justify-end">
          <Button onClick={createPost} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publish
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
