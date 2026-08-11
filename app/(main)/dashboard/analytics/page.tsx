'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'

export default function AnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      setLoading(false)
    }
    getUser()
  }, [router, supabase])

  if (loading || !userId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your activity and performance on SkillSwap</p>
      </div>
      <AnalyticsDashboard userId={userId} />
    </div>
  )
}
