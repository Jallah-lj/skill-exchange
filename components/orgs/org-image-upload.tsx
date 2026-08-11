'use client'

import { useRef, useState } from 'react'
import { Loader2, Camera, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, readFileAsDataUrl } from '@/lib/utils'
import { ImageCropDialog } from '@/components/profile/image-crop-dialog'

interface OrgImageUploadProps {
  variant: 'logo' | 'cover'
  imageUrl: string
  onChange: (url: string) => void
}

const VARIANT_CONFIG = {
  logo: {
    bucket: 'avatars',
    filePrefix: 'org-logo',
    aspect: 1,
    cropShape: 'round' as const,
    title: 'Adjust your logo',
    maxBytes: 2 * 1024 * 1024,
    maxLabel: '2MB',
  },
  cover: {
    bucket: 'covers',
    filePrefix: 'org-cover',
    aspect: 4,
    cropShape: 'rect' as const,
    title: 'Adjust your cover image',
    maxBytes: 5 * 1024 * 1024,
    maxLabel: '5MB',
  },
}

export function OrgImageUpload({ variant, imageUrl, onChange }: OrgImageUploadProps) {
  const supabase = createClient()
  const config = VARIANT_CONFIG[variant]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('You must be signed in')
      setUploading(false)
      return
    }

    // Uploaded before the org row exists, so the path is keyed to the creator's
    // folder (required by the bucket RLS policies) with a unique suffix.
    const path = `${user.id}/${config.filePrefix}-${Date.now()}.jpg`
    const { error } = await supabase.storage.from(config.bucket).upload(path, file, { upsert: true })
    if (error) {
      toast.error(`Upload failed — make sure the "${config.bucket}" bucket exists`)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from(config.bucket).getPublicUrl(path)
    onChange(publicUrl)
    setUploading(false)
  }

  return (
    <>
      {variant === 'logo' ? (
        <div className="relative h-20 w-20 shrink-0">
          <button
            type="button"
            aria-label={imageUrl ? 'Change logo' : 'Upload logo'}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'h-20 w-20 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center transition-colors hover:border-muted-foreground/50',
              imageUrl && 'border-solid',
            )}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-muted-foreground" />
            )}
          </button>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {imageUrl && !uploading && (
            <button
              type="button"
              aria-label="Remove logo"
              onClick={() => onChange('')}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            aria-label={imageUrl ? 'Change cover image' : 'Upload cover image'}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'h-28 w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50',
              imageUrl && 'border-solid',
            )}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <>
                <Camera className="h-4 w-4" /> Add a cover image (optional)
              </>
            )}
          </button>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {imageUrl && !uploading && (
            <button
              type="button"
              aria-label="Remove cover image"
              onClick={() => onChange('')}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          if (file.size > config.maxBytes) {
            toast.error(`Image must be under ${config.maxLabel}`)
            return
          }
          setPendingImage(await readFileAsDataUrl(file))
        }}
      />

      <ImageCropDialog
        open={pendingImage !== null}
        imageSrc={pendingImage}
        aspect={config.aspect}
        cropShape={config.cropShape}
        title={config.title}
        onCancel={() => setPendingImage(null)}
        onConfirm={(croppedFile) => {
          setPendingImage(null)
          upload(croppedFile)
        }}
      />
    </>
  )
}
