'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Loader2, Building2, Search, ShieldCheck, ShieldOff,
  Trash2, Users, Globe, ExternalLink, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface OrgRow {
  id: string
  name: string
  slug: string
  bio: string | null
  website: string | null
  avatar_url: string | null
  is_verified: boolean
  internal_only_swapping: boolean
  owner_id: string | null
  created_at: string
  _member_count: number
  _owner_name: string | null
}

export default function AdminOrgsPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [filtered, setFiltered] = useState<OrgRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const res = await fetch('/api/admin/orgs')
    if (!res.ok) {
      toast.error('Failed to load organizations')
      setLoading(false)
      return
    }
    const { orgs: data } = await res.json()
    setOrgs(data ?? [])
    setFiltered(data ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!search.trim()) { setFiltered(orgs); return }
    const q = search.toLowerCase()
    setFiltered(orgs.filter(o =>
      o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
    ))
  }, [search, orgs])

  const toggleVerify = async (org: OrgRow) => {
    setActionLoading(org.id)
    const res = await fetch('/api/admin/orgs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: org.id, is_verified: !org.is_verified }),
    })
    if (res.ok) {
      toast.success(org.is_verified ? 'Organization un-verified' : 'Organization verified!')
      await load()
    } else {
      toast.error('Failed to update organization')
    }
    setActionLoading(null)
  }

  const deleteOrg = async (org: OrgRow) => {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return
    setActionLoading(org.id)
    const res = await fetch('/api/admin/orgs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: org.id }),
    })
    if (res.ok) {
      toast.success('Organization deleted')
      await load()
    } else {
      toast.error('Failed to delete organization')
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orgs.length} organizations on the platform</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-64"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No organizations found</p>
          </div>
        ) : (
          filtered.map((org) => (
            <Card key={org.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 font-bold text-lg shrink-0">
                    {org.avatar_url
                      ? <img src={org.avatar_url} alt="" className="h-full w-full object-cover rounded-xl" />
                      : org.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/orgs/${org.slug}`}
                        target="_blank"
                        className="font-semibold hover:text-primary flex items-center gap-1"
                      >
                        {org.name}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </Link>
                      <span className="text-xs text-muted-foreground font-mono">/{org.slug}</span>
                      {org.is_verified && (
                        <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">
                          <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Verified
                        </Badge>
                      )}
                      {org.internal_only_swapping && (
                        <Badge variant="outline" className="text-[10px]">Internal Only</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {org._member_count} members
                      </span>
                      {org._owner_name && (
                        <span>Owner: <span className="font-medium text-foreground">{org._owner_name}</span></span>
                      )}
                      {org.website && (
                        <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                          <Globe className="h-3 w-3" />{org.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                    </div>

                    {org.bio && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{org.bio}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant={org.is_verified ? 'outline' : 'default'}
                      className={org.is_verified ? 'text-muted-foreground' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                      disabled={actionLoading === org.id}
                      onClick={() => toggleVerify(org)}
                    >
                      {actionLoading === org.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : org.is_verified ? (
                        <><ShieldOff className="h-3.5 w-3.5 mr-1" /> Un-verify</>
                      ) : (
                        <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verify</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:border-destructive"
                      disabled={actionLoading === org.id}
                      onClick={() => deleteOrg(org)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
