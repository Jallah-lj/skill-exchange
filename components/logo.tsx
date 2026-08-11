import Image from 'next/image'
import { cn } from '@/lib/utils'

// Single source of truth for the brand mark. To use the rendered PNG version
// instead of the vector, save it as public/logo.png and change this to '/logo.png'.
export const LOGO_SRC = '/logo.png'   // was '/logo.svg'



export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="SkillSwap"
      width={28}
      height={46}
      priority
      className={cn('h-7 w-auto', className)}
    />
  )
}
