import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/logo'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <LogoMark className="h-14 mb-6 opacity-80" />
      <p className="text-sm font-semibold tracking-widest text-violet-500 uppercase mb-2">404</p>
      <h1 className="text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-muted-foreground max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/browse" />}>Go to Browse</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>Home</Button>
      </div>
    </div>
  )
}
