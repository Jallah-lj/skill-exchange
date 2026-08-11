'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import {
  Loader2, Search, ExternalLink, UserX, UserCheck,
  ShieldCheck, ShieldOff, ChevronLeft, ChevronRight,
  Download, Users, UserMinus, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/lib/types'

interface AdminUser extends Profile {
  match_count: number
  review_count: number
  email?: string
}

const PAGE_SIZE = 20
const REFRESH_INTERVAL = 30_000

export default function AdminUsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadUsers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!profiles) return

    const ids = profiles.map((p) => p.id)

    const [{ data: matches }, { data: reviews }] = await Promise.all([
      supabase.from('match_requests').select('from_user_id, to_user_id').eq('status', 'accepted'),
      supabase.from('reviews').select('reviewee_id').in('reviewee_id', ids),
    ])

    const matchMap = new Map<string, number>()
    for (const m of matches ?? []) {
      matchMap.set(m.from_user_id, (matchMap.get(m.from_user_id) ?? 0) + 1)
      matchMap.set(m.to_user_id, (matchMap.get(m.to_user_id) ?? 0) + 1)
    }
    const reviewMap = new Map<string, number>()
    for (const r of reviews ?? []) {
      reviewMap.set(r.reviewee_id, (reviewMap.get(r.reviewee_id) ?? 0) + 1)
    }

    setUsers(profiles.map((p) => ({
      ...p,
      match_count: matchMap.get(p.id) ?? 0,
      review_count: reviewMap.get(p.id) ?? 0,
    })))
    setLastRefreshed(new Date())
    setCountdown(REFRESH_INTERVAL / 1000)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
    intervalRef.current = setInterval(loadUsers, REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [loadUsers])

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (query && !u.name.toLowerCase().includes(query.toLowerCase()) &&
          !(u.location ?? '').toLowerCase().includes(query.toLowerCase())) return false
      if (statusFilter === 'active' && u.suspended) return false
      if (statusFilter === 'suspended' && !u.suspended) return false
      if (roleFilter === 'admin' && u.role !== 'admin') return false
      if (roleFilter === 'user' && u.role === 'admin') return false
      return true
    })
  }, [users, query, statusFilter, roleFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSuspend = async (user: AdminUser) => {
    setTogglingId(user.id)
    const newVal = !user.suspended
    const { error, data } = await supabase
      .from('profiles').update({ suspended: newVal }).eq('id', user.id).select('suspended').single()
    if (error || !data) {
      toast.error('Update failed — check admin RLS policy in Supabase')
    } else {
      setUsers((p) => p.map((u) => u.id === user.id ? { ...u, suspended: data.suspended } : u))
      toast.success(newVal ? `${user.name} suspended` : `${user.name} reinstated`)
    }
    setTogglingId(null)
  }

  const toggleRole = async (user: AdminUser) => {
    setTogglingId(user.id)
    const newRole: 'user' | 'admin' = user.role === 'admin' ? 'user' : 'admin'
    const { error, data } = await supabase
      .from('profiles').update({ role: newRole }).eq('id', user.id).select('role').single()
    if (error || !data) {
      toast.error('Update failed — check admin RLS policy in Supabase')
    } else {
      setUsers((p) => p.map((u) => u.id === user.id ? { ...u, role: data.role } : u))
      toast.success(data.role === 'admin' ? `${user.name} promoted to Admin` : `${user.name} demoted to User`)
    }
    setTogglingId(null)
  }

  const bulkSuspend = async (suspend: boolean) => {
    if (selected.size === 0) return
    setBulkLoading(true)
    const ids = Array.from(selected)
    const { error, data } = await supabase
      .from('profiles').update({ suspended: suspend }).in('id', ids).select('id, suspended')
    if (error || !data?.length) {
      toast.error('Bulk action failed — check admin RLS policy in Supabase')
      setBulkLoading(false)
      return
    }
    const updatedMap = new Map(data.map((u: any) => [u.id, u.suspended]))
    setUsers((p) => p.map((u) => updatedMap.has(u.id) ? { ...u, suspended: updatedMap.get(u.id) } : u))
    toast.success(`${data.length} users ${suspend ? 'suspended' : 'reinstated'}`)
    setSelected(new Set())
    setBulkLoading(false)
  }

  const exportCSV = () => {
    const rows = [
      ['Name', 'Location', 'Role', 'Status', 'Matches', 'Reviews', 'Joined'],
      ...filtered.map((u) => [
        u.name, u.location ?? '', u.role ?? 'user',
        u.suspended ? 'Suspended' : 'Active',
        u.match_count, u.review_count,
        new Date(u.created_at).toLocaleDateString(),
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported to CSV')
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(paginated.map((u) => u.id)))
    }
  }

  // Summary cards
  const totalActive = users.filter((u) => !u.suspended).length
  const totalSuspended = users.filter((u) => u.suspended).length
  const totalAdmins = users.filter((u) => u.role === 'admin').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length.toLocaleString()} registered members</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 text-violet-500" />
            <span>Auto-refresh in <span className="font-semibold text-violet-600">{countdown}s</span></span>
            {lastRefreshed && (
              <span className="text-muted-foreground/60 hidden sm:inline">
                · {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh now
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalActive.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Active users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <UserMinus className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalSuspended}</p>
              <p className="text-xs text-muted-foreground">Suspended</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalAdmins}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or location…" className="pl-9" value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as any); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 px-4 py-2.5">
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">{selected.size} selected</span>
          <div className="flex gap-2 ml-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={bulkLoading}
              onClick={() => bulkSuspend(true)}>
              {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
              Suspend all
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs text-emerald-600" disabled={bulkLoading}
              onClick={() => bulkSuspend(false)}>
              <UserCheck className="h-3 w-3" /> Reinstate all
            </Button>
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white dark:bg-gray-900/50">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="rounded"
                    checked={selected.size === paginated.length && paginated.length > 0}
                    onChange={toggleSelectAll} />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Location</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Matches</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Reviews</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((user) => {
                const busy = togglingId === user.id
                return (
                  <tr key={user.id}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${user.suspended ? 'opacity-60' : ''} ${selected.has(user.id) ? 'bg-violet-50/50 dark:bg-violet-950/10' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded"
                        checked={selected.has(user.id)} onChange={() => toggleSelect(user.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold">
                            {user.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                          <AvatarImage src={user.avatar_url ?? ''} />
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.name}</span>
                            {user.role === 'admin' && (
                              <Badge className="text-[10px] py-0 px-1.5 h-4 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">{user.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.location ?? '—'}</td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell font-medium">{user.match_count}</td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell font-medium">{user.review_count}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      {new Date(user.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      {user.suspended
                        ? <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-0">Suspended</Badge>
                        : <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-0">Active</Badge>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View profile"
                          nativeButton={false} render={<Link href={`/admin/users/${user.id}`} />}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className={`h-7 w-7 p-0 ${user.role === 'admin' ? 'text-violet-500' : ''}`}
                          title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          disabled={busy} onClick={() => toggleRole(user)}>
                          {user.role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost"
                          className={`h-7 w-7 p-0 ${user.suspended ? 'text-emerald-500 hover:text-emerald-600' : 'text-red-400 hover:text-red-600'}`}
                          title={user.suspended ? 'Reinstate' : 'Suspend'}
                          disabled={busy} onClick={() => toggleSuspend(user)}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : user.suspended ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">No users match your filters.</div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm"
                className="h-8 w-8 p-0" onClick={() => setPage(p)}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
