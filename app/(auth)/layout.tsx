import { SmokeyBackground } from '@/components/ui/login-form'
import Link from 'next/link'
import { LogoMark } from '@/components/logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-gray-900">
      <SmokeyBackground color="#3b0764" backdropBlurAmount="none" />
      <div className="relative z-10 p-6">
        <Link href="/browse" className="flex items-center gap-2 font-bold text-xl w-fit text-white">
          <LogoMark className="h-6" />
          SkillSwap
        </Link>
      </div>
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-16">
        {children}
      </div>
    </div>
  )
}
