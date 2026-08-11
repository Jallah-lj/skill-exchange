'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { OrgImageUpload } from '@/components/orgs/org-image-upload'

interface OrgBrandingSettingsProps {
  orgId: string
  avatarUrl: string
  coverUrl: string
  onUpdated: (patch: { avatar_url?: string | null; cover_image_url?: string | null }) => void
}

export function OrgBrandingSettings({ orgId, avatarUrl, coverUrl, onUpdated }: OrgBrandingSettingsProps) {
  const supabase = createClient()

  const persist = async (patch: { avatar_url?: string | null; cover_image_url?: string | null }) => {
    const { error } = await supabase.from('organizations').update(patch).eq('id', orgId)
    if (error) { toast.error('Failed to save branding'); return }
    onUpdated(patch)
    toast.success('Branding updated!')
  }

  return (
    <Card className="border-0 ring-1 ring-border shadow-md">
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Logo and cover image shown on your public organization page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Cover image</Label>
          <OrgImageUpload
            variant="cover"
            imageUrl={coverUrl}
            onChange={(url) => persist({ cover_image_url: url || null })}
          />
        </div>
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <OrgImageUpload
              variant="logo"
              imageUrl={avatarUrl}
              onChange={(url) => persist({ avatar_url: url || null })}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Square works best. Changes save immediately.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
