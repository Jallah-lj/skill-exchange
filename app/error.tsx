'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error boundary:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-5">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground max-w-sm mb-2">
        An unexpected error occurred. Your data is safe — try again, and if it keeps happening,
        contact support.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60 mb-6 font-mono">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3 mt-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/support')}>
          Contact Support
        </Button>
      </div>
    </div>
  )
}
