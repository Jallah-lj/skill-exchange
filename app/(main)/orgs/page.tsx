'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Building2, Plus, Search, ShieldCheck, Globe, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Organization, OrganizationMember } from '@/lib/types'

export default function OrgsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [myOrgs, setMyOrgs] = useState<OrganizationMember[]>([])
  const [allOrgs, setAllOrgs] = useState<Organization[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: memberData }, { data: orgsData }] = await Promise.all([
        supabase
          .from('organization_members')
          .select('*, organization:organizations(*)')
          .eq('user_id', user.id),
        supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      setMyOrgs((memberData as any) ?? [])
      setAllOrgs(orgsData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const myOrgIds = new Set(myOrgs.map(m => m.organization_id))
  const filtered = allOrgs.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground mt-1">Teams and communities on SkillSwap.</p>
        </div>
        <Link href="/orgs/create">
          <Button className="gap-2"><Plus className="h-4 w-4" /> Create Org</Button>
        </Link>
      </div>

      {myOrgs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">My Organizations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myOrgs.map((member) => {
              const org = member.organization!
              return (
                <Link key={member.id} href={`/orgs/${org.slug}`}>
                  <Card className="hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer h-full">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 font-bold text-lg shrink-0">
                        {org.avatar_url
                          ? <img src={org.avatar_url} alt="" className="h-full w-full object-cover rounded-xl" />
                          : org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{org.name}</p>
                          {org.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Discover</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search organizations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-56 text-sm"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm font-medium">No organizations found</p>
            <Link href="/orgs/create">
              <Button size="sm" variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Create Organization
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((org) => (
              <Link key={org.id} href={`/orgs/${org.slug}`}>
                <Card className="hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer h-full">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 font-bold text-lg shrink-0">
                        {org.avatar_url
                          ? <img src={org.avatar_url} alt="" className="h-full w-full object-cover rounded-xl" />
                          : org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold truncate">{org.name}</p>
                          {org.is_verified && (
                            <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0 h-4 px-1.5">
                              <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Verified
                            </Badge>
                          )}
                        </div>
                        {org.website && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Globe className="h-3 w-3" />{org.website.replace(/^https?:\/\//, '')}
                          </p>
                        )}
                      </div>
                    </div>
                    {org.bio && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{org.bio}</p>}
                    <div className="flex items-center justify-between pt-1">
                      {myOrgIds.has(org.id)
                        ? <Badge variant="secondary" className="text-[10px]">Member</Badge>
                        : <span className="text-[10px] text-muted-foreground">Not a member</span>}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
