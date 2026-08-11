'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Shield, ShieldCheck, Users, Crown, Headphones,
  DollarSign, FileText, Plus, Trash2, RefreshCw,
  Search, CheckCircle2, X, Eye, Edit2, Download,
  Check, UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminRole {
  id: string
  name: string
  description: string
  color: string
  permissions: Record<string, boolean>
  created_at: string
  _count?: number
}

interface RoleAssignment {
  id: string
  user_id: string
  role_id: string
  assigned_at: string
  profiles: { name: string; avatar_url: string | null; role: string }
  admin_roles: { name: string; color: string }
}

const PERMISSION_LABELS: Record<string, string> = {
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  export: 'Export',
}

const COLOR_CLASSES: Record<string, string> = {
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  emerald:'bg-emerald-100 text-emerald-700 border-emerald-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pink:   'bg-pink-100 text-pink-700 border-pink-200',
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  super_admin: Crown,
  platform_admin: ShieldCheck,
  moderator: Shield,
  support_agent: Headphones,
  finance_manager: DollarSign,
  content_manager: FileText,
}

const REFRESH_INTERVAL = 30_000

export default function AdminRolesPage() {
  const supabase = createClient()
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [assignDialog, setAssignDialog] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([])
  const [assigning, setAssigning] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const [{ data: rolesData }, { data: assignData }] = await Promise.all([
      supabase.from('admin_roles').select('*').order('name'),
      supabase.from('admin_role_assignments')
        .select('*, profiles(name, avatar_url, role), admin_roles(name, color)')
        .order('assigned_at', { ascending: false }),
    ])

    const countMap: Record<string, number> = {}
    for (const a of assignData ?? []) {
      countMap[a.role_id] = (countMap[a.role_id] ?? 0) + 1
    }

    setRoles((rolesData ?? []).map(r => ({ ...r, _count: countMap[r.id] ?? 0 })))
    setAssignments(assignData ?? [])
    setCountdown(REFRESH_INTERVAL / 1000)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [load])

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setUserResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .ilike('name', `%${q}%`)
      .limit(8)
    setUserResults(data ?? [])
  }

  const assignRole = async (userId: string) => {
    if (!selectedRole) return
    setAssigning(true)
    const { error } = await supabase.from('admin_role_assignments').insert({
      user_id: userId,
      role_id: selectedRole.id,
    })
    if (error) {
      toast.error(error.message.includes('unique') ? 'User already has this role' : error.message)
    } else {
      toast.success('Role assigned')
      setAssignDialog(false)
      setUserSearch('')
      setUserResults([])
      load()
    }
    setAssigning(false)
  }

  const revokeRole = async (assignmentId: string) => {
    const { error } = await supabase.from('admin_role_assignments').delete().eq('id', assignmentId)
    if (error) toast.error(error.message)
    else { toast.success('Role revoked'); load() }
  }

  const filtered = assignments.filter(a =>
    !search || a.profiles?.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Role-based access control · Auto-refreshing in {countdown}s
          </p>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh now
        </button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(role => {
          const Icon = ROLE_ICONS[role.name] ?? Shield
          const colorCls = COLOR_CLASSES[role.color] ?? COLOR_CLASSES.violet
          return (
            <div key={role.id} className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className={cn('h-10 w-10 rounded-lg border flex items-center justify-center', colorCls)}>
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {role._count ?? 0} {role._count === 1 ? 'member' : 'members'}
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold text-sm capitalize">{role.name.replace(/_/g, ' ')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
              </div>
              {/* Permission pills */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(role.permissions).map(([key, allowed]) => (
                  <span
                    key={key}
                    className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                      allowed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                    )}
                  >
                    {allowed ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                    {PERMISSION_LABELS[key]}
                  </span>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={() => { setSelectedRole(role); setAssignDialog(true) }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign to user
              </Button>
            </div>
          )
        })}
      </div>

      {/* Current role assignments */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border">
        <div className="p-5 border-b flex items-center justify-between gap-4">
          <h2 className="font-semibold">Current Role Assignments</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="divide-y">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">No role assignments yet</p>
          )}
          {filtered.map(a => {
            const colorCls = COLOR_CLASSES[a.admin_roles?.color ?? 'violet'] ?? COLOR_CLASSES.violet
            return (
              <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={a.profiles?.avatar_url ?? ''} />
                  <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
                    {a.profiles?.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.profiles?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Assigned {new Date(a.assigned_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={cn('text-[10px] border capitalize', colorCls)}>
                  {a.admin_roles?.name?.replace(/_/g, ' ')}
                </Badge>
                {a.profiles?.role === 'admin' && (
                  <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-200">
                    Platform Admin
                  </Badge>
                )}
                <button
                  onClick={() => revokeRole(a.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors ml-1"
                  title="Revoke role"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Permission matrix */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-x-auto">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Permission Matrix</h2>
          <p className="text-xs text-muted-foreground mt-0.5">What each role can do across the platform</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">Role</th>
              {Object.keys(PERMISSION_LABELS).map(p => (
                <th key={p} className="px-4 py-3 font-medium text-muted-foreground text-center">{PERMISSION_LABELS[p]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles.map(role => (
              <tr key={role.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <span className="font-medium capitalize">{role.name.replace(/_/g, ' ')}</span>
                </td>
                {Object.keys(PERMISSION_LABELS).map(p => (
                  <td key={p} className="px-4 py-3 text-center">
                    {role.permissions[p] ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-gray-300 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={assignDialog} onOpenChange={v => { setAssignDialog(v); if (!v) { setUserSearch(''); setUserResults([]) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign "{selectedRole?.name.replace(/_/g, ' ')}" Role
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name…"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value) }}
                className="pl-9"
                autoFocus
              />
            </div>
            {userResults.length > 0 && (
              <div className="border rounded-lg divide-y">
                {userResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={u.avatar_url ?? ''} />
                      <AvatarFallback className="text-xs">{u.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-medium">{u.name}</span>
                    <Button size="sm" onClick={() => assignRole(u.id)} disabled={assigning}>
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {userSearch && userResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
