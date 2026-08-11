'use client'

import { useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Camera, X } from 'lucide-react'
import { readFileAsDataUrl } from '@/lib/utils'
import { ImageCropDialog } from '@/components/profile/image-crop-dialog'

interface AvatarUploadProps {
  avatarUrl: string
  name: string
  isEditing: boolean
  uploading: boolean
  onUpload: (file: File) => void
  onRemove: () => void
  className?: string
}

export function AvatarUpload({ avatarUrl, name, isEditing, uploading, onUpload, onRemove, className }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)

  return (
    <div className="relative">
      <Avatar
        className={`h-24 w-24 ${isEditing ? 'cursor-pointer' : ''} ${className ?? ''}`}
        onClick={() => (isEditing ? fileInputRef.current?.click() : undefined)}
      >
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="text-3xl">{name.slice(0, 2).toUpperCase() || 'ME'}</AvatarFallback>
      </Avatar>
      {uploading && (
        <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {isEditing && !uploading && (
        <button
          type="button"
          aria-label="Change photo"
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      )}
      {isEditing && !uploading && avatarUrl && (
        <button
          type="button"
          aria-label="Remove photo"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute top-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {isEditing && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Upload photo"
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
        aspect={1}
        cropShape="round"
        title="Adjust your photo"
        onCancel={() => setPendingImage(null)}
        onConfirm={(croppedFile) => {
          setPendingImage(null)
          onUpload(croppedFile)
        }}
      />
    </div>
  )
}
