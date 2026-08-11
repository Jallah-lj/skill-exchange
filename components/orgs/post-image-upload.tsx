'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, ImagePlus, X } from 'lucide-react'

interface PostImageUploadProps {
  imageUrl: string
  onChange: (url: string) => void
}

export function PostImageUpload({ imageUrl, onChange }: PostImageUploadProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('You must be signed in')
      setUploading(false)
      return
    }

    // Post images live in the public "covers" bucket under the uploader's folder,
    // which the bucket RLS policies already allow.
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/post-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('covers').upload(path, file)
    if (error) {
      toast.error('Image upload failed')
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(path)
    onChange(publicUrl)
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Post attachment" className="max-h-64 w-full object-cover" />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => onChange('')}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Add photo
        </Button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload post image"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload(file)
        }}
      />
    </div>
  )
}
