'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, ImagePlus, X } from 'lucide-react'

interface PostImagesUploadProps {
  imageUrls: string[]
  onChange: (urls: string[]) => void
  max?: number
}

export function PostImagesUpload({ imageUrls, onChange, max = 6 }: PostImagesUploadProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (files: File[]) => {
    const remaining = max - imageUrls.length
    if (remaining <= 0) return
    const toUpload = files.slice(0, remaining)

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('You must be signed in')
      setUploading(false)
      return
    }

    const uploaded: string[] = []
    for (const file of toUpload) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is over 5MB`); continue }
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/post-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('covers').upload(path, file)
      if (error) { toast.error(`Failed to upload ${file.name}`); continue }
      const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(path)
      uploaded.push(publicUrl)
    }
    if (uploaded.length) onChange([...imageUrls, ...uploaded])
    setUploading(false)
  }

  const removeAt = (index: number) => onChange(imageUrls.filter((_, i) => i !== index))

  return (
    <div className="space-y-2">
      {imageUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imageUrls.map((url, index) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Post attachment" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => removeAt(index)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {imageUrls.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Add photo{imageUrls.length > 0 ? 's' : ''}
        </Button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        aria-label="Upload post images"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) upload(files)
        }}
      />
    </div>
  )
}
