'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ImageCropDialogProps {
  open: boolean
  imageSrc: string | null
  aspect: number
  cropShape?: 'rect' | 'round'
  title: string
  onCancel: () => void
  onConfirm: (file: File) => void
}

async function getCroppedImageFile(imageSrc: string, area: Area, fileName: string): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = area.width
  canvas.height = area.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Failed to crop image')); return }
      resolve(new File([blob], fileName, { type: blob.type }))
    }, 'image/jpeg', 0.92)
  })
}

export function ImageCropDialog({ open, imageSrc, aspect, cropShape = 'rect', title, onCancel, onConfirm }: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleCropComplete = useCallback((_croppedArea: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels)
  }, [])

  const reset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return
    setProcessing(true)
    try {
      const file = await getCroppedImageFile(imageSrc, croppedArea, 'cropped.jpg')
      onConfirm(file)
      reset()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {imageSrc && (
          <div className="relative h-72 w-full overflow-hidden rounded-xl bg-muted">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>
        )}

        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={processing}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedArea}>
            {processing ? 'Saving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
