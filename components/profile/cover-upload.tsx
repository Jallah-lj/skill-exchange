'use client'

import { useRef, useState } from 'react'
import { Loader2, Camera, X } from 'lucide-react'
import { cn, readFileAsDataUrl } from '@/lib/utils'
import { ImageCropDialog } from '@/components/profile/image-crop-dialog'

interface CoverUploadProps {
  coverUrl: string
  isEditing: boolean
  uploading: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}

export function CoverUpload({ coverUrl, isEditing, uploading, onUpload, onRemove }: CoverUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)

  return (
    <div className="group relative h-full w-full overflow-hidden bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-transparent">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      )}

      {isEditing && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="Change cover photo"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm',
              )}
            >
              <Camera className="h-3.5 w-3.5" /> Change cover
            </button>
            {coverUrl && (
              <button
                type="button"
                aria-label="Remove cover photo"
                onClick={onRemove}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {isEditing && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Upload cover photo"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) setPendingImage(await readFileAsDataUrl(file))
          }}
        />
      )}

      <ImageCropDialog
        open={pendingImage !== null}
        imageSrc={pendingImage}
        aspect={4}
        cropShape="rect"
        title="Adjust your cover photo"
        onCancel={() => setPendingImage(null)}
        onConfirm={(croppedFile) => {
          setPendingImage(null)
          onUpload(croppedFile)
        }}
      />
    </div>
  )
}
