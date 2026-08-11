'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, KeyRound, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function JoinByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<'working' | 'error'>('working')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const redeem = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/login?returnTo=/orgs/join/${code}`)
        return
      }

      const { data, error } = await supabase.rpc('redeem_org_invite_code', { p_code: code })
      if (error) {
        // Already a member? Send them to the org instead of showing an error.
        const alreadyMember = error.message?.startsWith('You are already a member')
        if (alreadyMember) {
          const { data: codeRow } = await supabase
            .from('organization_invite_codes')
            .select('organization_id, organization:organizations(slug)')
            .ilike('code', code)
            .maybeSingle()
          const orgSlug = (codeRow?.organization as { slug?: string } | null)?.slug
          if (orgSlug) { router.push(`/orgs/${orgSlug}`); return }
        }
        setErrorMsg(error.message || 'This invite code is not valid')
        setStatus('error')
        return
      }

      const result = data?.[0]
      toast.success(`Welcome to ${result?.org_name ?? 'the organization'}!`)
      router.push(`/orgs/${result?.org_slug ?? ''}`)
    }
    redeem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm border-0 ring-1 ring-border shadow-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === 'working' ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-500" />
              <div>
                <p className="font-semibold">Joining with code</p>
                <code className="font-mono text-sm tracking-widest text-muted-foreground">{code.toUpperCase()}</code>
              </div>
            </>
          ) : (
            <>
              <XCircle className="mx-auto h-10 w-10 text-red-500" />
              <div>
                <p className="font-semibold">Couldn't join</p>
                <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <Button variant="outline" className="gap-2" nativeButton={false} render={<Link href="/orgs" />}>
                <KeyRound className="h-4 w-4" /> Browse organizations
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
